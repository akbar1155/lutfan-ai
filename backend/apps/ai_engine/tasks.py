from __future__ import annotations

import hashlib
import logging
import threading
import time
import uuid
from datetime import timedelta
from pathlib import Path

import requests
from celery import shared_task
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from apps.invitations.models import (
    GenerationPath,
    Invitation,
    InvitationStatus,
    RenderedFile,
)

from .generator import compose_from_template_bytes, generate_image_bytes
from .models import AIGeneration, AIGenerationCache
from .prompts import build_prompt, build_text_blocks
from .storage import resolve_media_url, upload_bytes

logger = logging.getLogger(__name__)


def enqueue_invitation_generation(
    invitation_id: str, extra_format: str | None = None
):
    """
    Start image generation and return a job-like object with `.id`.

    With CELERY_TASK_ALWAYS_EAGER the default `.delay()` would block the HTTP
    request for the full Gemini run (often 30–120s+), which breaks ngrok/Vite
    proxies (ERR_NGROK_3004 / 503). Run in a daemon thread instead so the API
    can return 202 and the client can poll `/status`.
    """
    if settings.CELERY_TASK_ALWAYS_EAGER:
        job_id = f"local-{uuid.uuid4()}"

        def _run() -> None:
            close_old_connections()
            try:
                generate_invitation_image.apply(
                    args=[invitation_id],
                    kwargs={"extra_format": extra_format},
                    task_id=job_id,
                )
            except Exception:
                logger.exception(
                    "Background invitation generation failed id=%s", invitation_id
                )
            finally:
                close_old_connections()

        threading.Thread(
            target=_run, name=f"gen-{invitation_id}", daemon=True
        ).start()

        class _LocalJob:
            id = job_id

        return _LocalJob()

    return generate_invitation_image.delay(invitation_id, extra_format=extra_format)

def _load_template_bytes(url: str) -> bytes | None:
    """Load template image from local /media path or HTTP URL."""
    if not url:
        return None
    if url.startswith("/media/"):
        path = Path(settings.MEDIA_ROOT) / url.removeprefix("/media/")
        if path.is_file():
            return path.read_bytes()
        return None
    try:
        resolved = resolve_media_url(url) or url
        resp = requests.get(resolved, timeout=20)
        if resp.ok and resp.content:
            return resp.content
    except requests.RequestException:
        return None
    return None


def _cache_key(
    invitation: Invitation,
    prompt: str,
    fmt: str,
    blocks: dict | None = None,
) -> str:
    blocks = blocks or {}
    block_blob = "|".join(
        f"{k}={(blocks.get(k) or '').strip()}"
        for k in ("header", "body", "date_time", "address", "footer")
    )
    payload = "|".join(
        [
            "overlay-v9-ai-corner-guard",
            invitation.generation_path or "",
            str(invitation.template_id or invitation.ai_preset_id or ""),
            ",".join(sorted(invitation.selected_mood_tags or [])),
            hashlib.sha256(prompt.encode()).hexdigest()[:32],
            hashlib.sha256(block_blob.encode()).hexdigest()[:24],
            invitation.language,
            fmt,
        ]
    )
    return hashlib.sha256(payload.encode()).hexdigest()


@shared_task(name="ai_engine.ping")
def ping():
    return {"ok": True}


@shared_task(
    name="ai_engine.generate_invitation_image",
    bind=True,
    max_retries=0,  # retries × Gemini hang ≈ 15min waits behind ngrok
    autoretry_for=(),
)
def generate_invitation_image(self, invitation_id: str, extra_format: str | None = None):
    started = time.time()
    invitation = Invitation.objects.select_related("template", "ai_preset", "user", "event").get(
        id=invitation_id
    )
    fmt = extra_format or invitation.primary_format
    prompt, negative, model_params = build_prompt(invitation)
    blocks = build_text_blocks(invitation)

    generation = AIGeneration.objects.create(
        invitation=invitation,
        user=invitation.user,
        model=settings.NANO_BANANA_MODEL,
        generation_path=invitation.generation_path or GenerationPath.AI_FROM_SCRATCH,
        prompt_preset=invitation.ai_preset,
        base_image_url=invitation.template.bg_url if invitation.template else None,
        final_prompt=prompt,
        negative_prompt=negative,
        model_params=model_params or {},
        status=AIGeneration.Status.PROCESSING,
        started_at=timezone.now(),
    )

    try:
        key = _cache_key(invitation, prompt, fmt, blocks)
        cached = AIGenerationCache.objects.filter(cache_key=key).first()
        result_stored_url = None
        image_meta = None

        if cached:
            cached.hit_count += 1
            cached.save(update_fields=["hit_count", "last_used_at"])
            result_stored_url = cached.result_url
        else:
            base_bytes = None
            if (
                invitation.generation_path == GenerationPath.TEMPLATE
                and invitation.template
                and invitation.template.bg_url
            ):
                # Prefer full template for direct composite (preview is too soft)
                ref_url = invitation.template.bg_url
                base_bytes = _load_template_bytes(ref_url)
                if not base_bytes and invitation.template.bg_url_preview:
                    base_bytes = _load_template_bytes(
                        invitation.template.bg_url_preview
                    )

            if (
                invitation.generation_path == GenerationPath.TEMPLATE
                and base_bytes
            ):
                # Skip Gemini — template already has décor; overlay exact text only.
                style_tags = []
                if invitation.template:
                    style_tags = list(invitation.template.style_tags or [])
                    if invitation.template.theme_name:
                        style_tags.append(invitation.template.theme_name)
                gen_result = compose_from_template_bytes(
                    base_bytes,
                    blocks,
                    fmt=fmt,
                    style_tags=style_tags,
                    language=invitation.language,
                )
            else:
                gen_result = generate_image_bytes(
                    prompt,
                    fmt=fmt,
                    base_image_bytes=base_bytes,
                    blocks=blocks,
                    negative_prompt=negative,
                    model_params=model_params,
                    style_tags=list(invitation.selected_mood_tags or []),
                    language=invitation.language,
                )
            # Exact PIL overlay makes spelling deterministic — always cacheable.
            if not getattr(gen_result, "text_overlay", False):
                logger.warning(
                    "Generation for %s missing text overlay flag", invitation_id
                )
            image_meta = gen_result
            object_key = f"invitations/{invitation.id}/hd_{fmt.replace(':', '_')}.jpg"
            result_stored_url = upload_bytes(gen_result.data, object_key, private=True)
            AIGenerationCache.objects.create(
                cache_key=key,
                generation_path=invitation.generation_path
                or GenerationPath.AI_FROM_SCRATCH,
                result_url=result_stored_url,
            )

        if fmt == "4:5" or not extra_format:
            invitation.final_image_url = result_stored_url
        else:
            formats = invitation.additional_formats or {}
            formats[fmt] = result_stored_url
            invitation.additional_formats = formats

        invitation.status = InvitationStatus.READY
        invitation.generation_count += 1
        invitation.last_generation_at = timezone.now()
        invitation.last_error = None
        invitation.save()

        file_type = {
            "4:5": RenderedFile.FileType.HD_4_5,
            "9:16": RenderedFile.FileType.HD_9_16,
            "1:1": RenderedFile.FileType.HD_1_1,
        }.get(fmt, RenderedFile.FileType.HD_4_5)

        accessible = resolve_media_url(result_stored_url) or result_stored_url
        RenderedFile.objects.create(
            invitation=invitation,
            file_type=file_type,
            url=result_stored_url,
            cdn_url=accessible,
            file_size_bytes=image_meta.file_size_bytes if image_meta else 0,
            width=image_meta.width if image_meta else 0,
            height=image_meta.height if image_meta else 0,
            expires_at=timezone.now() + timedelta(days=90),
        )

        duration_ms = int((time.time() - started) * 1000)
        generation.status = AIGeneration.Status.SUCCESS
        generation.result_url = result_stored_url
        generation.completed_at = timezone.now()
        generation.duration_ms = duration_ms
        if image_meta and image_meta.source == "gemini":
            generation.provider_cost_usd = 0.02  # estimate until billing API wired
        generation.save()

        return {"ok": True, "url": accessible, "source": image_meta.source if image_meta else "cache"}
    except Exception as exc:
        invitation.status = InvitationStatus.FAILED
        invitation.last_error = str(exc)[:500]
        invitation.save(update_fields=["status", "last_error", "updated_at"])
        generation.status = AIGeneration.Status.FAILED
        generation.error_message = str(exc)[:1000]
        generation.completed_at = timezone.now()
        generation.save()
        raise
