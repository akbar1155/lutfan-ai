from __future__ import annotations

import hashlib
import logging
import re
import threading
import time
import uuid
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

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

from .generator import (
    GenerationResult,
    compose_from_template_bytes,
    generate_image_bytes,
    overlay_exact_invitation_text,
)
from .models import AIGeneration, AIGenerationCache
from .prompts import build_prompt, build_text_blocks
from .storage import resolve_media_url, upload_bytes

logger = logging.getLogger(__name__)


def enqueue_invitation_generation(
    invitation_id: str,
    extra_format: str | None = None,
    *,
    text_only: bool = False,
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
                    kwargs={"extra_format": extra_format, "text_only": text_only},
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

    return generate_invitation_image.delay(
        invitation_id, extra_format=extra_format, text_only=text_only
    )

def _load_template_bytes(url: str) -> bytes | None:
    """Load template image from local /media, catalog assets, S3, or HTTP."""
    if not url:
        return None

    media_key: str | None = None
    if url.startswith("/media/"):
        media_key = url.removeprefix("/media/")
    else:
        parsed = urlparse(url)
        if parsed.path.startswith("/media/"):
            media_key = parsed.path.removeprefix("/media/")
        elif url.startswith("s3://"):
            match = re.match(r"s3://[^/]+/(.+)", url)
            if match:
                media_key = match.group(1)

    if media_key:
        local = Path(settings.MEDIA_ROOT) / media_key
        if local.is_file():
            return local.read_bytes()
        # Catalog JPGs shipped in the image under content/assets/templates/
        asset = (
            Path(__file__).resolve().parents[1]
            / "content"
            / "assets"
            / "templates"
            / Path(media_key).name
        )
        if asset.is_file():
            return asset.read_bytes()
        try:
            from apps.ai_engine.storage import _s3_client

            client = _s3_client()
            for bucket in (
                settings.AWS_STORAGE_BUCKET_NAME_PUBLIC,
                settings.AWS_STORAGE_BUCKET_NAME_PRIVATE,
            ):
                try:
                    obj = client.get_object(Bucket=bucket, Key=media_key)
                    data = obj["Body"].read()
                    if data:
                        try:
                            local.parent.mkdir(parents=True, exist_ok=True)
                            local.write_bytes(data)
                        except Exception:
                            pass
                        return data
                except Exception:
                    continue
        except Exception:
            pass

    try:
        resolved = resolve_media_url(url) or url
        if resolved.startswith("/media/"):
            path = Path(settings.MEDIA_ROOT) / resolved.removeprefix("/media/")
            if path.is_file():
                return path.read_bytes()
            base = getattr(settings, "APP_BASE_URL", "") or ""
            if base:
                resolved = f"{base.rstrip('/')}{resolved}"
        if resolved.startswith("http://") or resolved.startswith("https://"):
            resp = requests.get(resolved, timeout=20)
            if resp.ok and resp.content:
                return resp.content
    except requests.RequestException:
        return None
    return None


def _invitation_style_tags(invitation: Invitation) -> list[str]:
    tags: list[str] = []
    if invitation.generation_path == GenerationPath.TEMPLATE and invitation.template:
        tags = list(invitation.template.style_tags or [])
        if invitation.template.theme_name:
            tags.append(invitation.template.theme_name)
    else:
        tags = list(invitation.selected_mood_tags or [])
    return tags


def _persist_decor_url(invitation: Invitation, decor_url: str) -> None:
    data = dict(invitation.event_data or {})
    if data.get("decor_image_url") == decor_url:
        return
    data["decor_image_url"] = decor_url
    invitation.event_data = data
    invitation.save(update_fields=["event_data", "updated_at"])


def _load_decor_bytes(invitation: Invitation, fmt: str) -> tuple[bytes | None, bool]:
    """
    Background without invitation type.
    Returns (bytes, from_template).
    """
    del fmt  # reserved if we later store per-format décor
    if (
        invitation.generation_path == GenerationPath.TEMPLATE
        and invitation.template
        and invitation.template.bg_url
    ):
        data = _load_template_bytes(invitation.template.bg_url)
        if not data and invitation.template.bg_url_preview:
            data = _load_template_bytes(invitation.template.bg_url_preview)
        return data, True

    decor_url = (invitation.event_data or {}).get("decor_image_url")
    if decor_url:
        data = _load_template_bytes(str(decor_url))
        if data:
            return data, False
    # Text-only regenerate: reuse the last finished card as décor.
    if invitation.final_image_url:
        data = _load_template_bytes(str(invitation.final_image_url))
        if data:
            return data, False
    return None, False


def _compose_on_decor(
    decor_bytes: bytes,
    blocks: dict,
    *,
    fmt: str,
    style_tags: list[str],
    language: str | None,
    from_template: bool,
) -> GenerationResult:
    if from_template:
        return compose_from_template_bytes(
            decor_bytes,
            blocks,
            fmt=fmt,
            style_tags=style_tags,
            language=language,
        )
    # AI décor is already sized; only re-typeset copy.
    data = overlay_exact_invitation_text(
        decor_bytes,
        blocks,
        fmt=fmt,
        style_tags=style_tags,
        language=language,
        corner_guard=True,
    )
    width, height = 0, 0
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(data))
        width, height = img.width, img.height
    except Exception:
        pass
    return GenerationResult(
        data,
        source="text_overlay",
        width=width,
        height=height,
        text_overlay=True,
    )


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
            "overlay-v18-readable-meta",
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
def generate_invitation_image(
    self,
    invitation_id: str,
    extra_format: str | None = None,
    text_only: bool = False,
):
    started = time.time()
    invitation = Invitation.objects.select_related("template", "ai_preset", "user", "event").get(
        id=invitation_id
    )
    fmt = extra_format or invitation.primary_format
    blocks = build_text_blocks(invitation)
    prompt, negative, model_params = build_prompt(invitation, blocks=blocks)
    style_tags = _invitation_style_tags(invitation)

    generation = AIGeneration.objects.create(
        invitation=invitation,
        user=invitation.user,
        model=settings.NANO_BANANA_MODEL,
        generation_path=invitation.generation_path or GenerationPath.AI_FROM_SCRATCH,
        prompt_preset=invitation.ai_preset,
        base_image_url=invitation.template.bg_url if invitation.template else None,
        final_prompt=prompt,
        negative_prompt=negative,
        model_params={**(model_params or {}), "text_only": bool(text_only)},
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
            gen_result: GenerationResult | None = None

            # Text edit: keep existing décor, only re-typeset copy.
            if text_only:
                decor_bytes, from_template = _load_decor_bytes(invitation, fmt)
                if decor_bytes:
                    gen_result = _compose_on_decor(
                        decor_bytes,
                        blocks,
                        fmt=fmt,
                        style_tags=style_tags,
                        language=invitation.language,
                        from_template=from_template,
                    )
                else:
                    logger.info(
                        "text_only requested but no décor for %s — full generate",
                        invitation_id,
                    )

            if gen_result is None and (
                invitation.generation_path == GenerationPath.TEMPLATE
            ):
                decor_bytes, from_template = _load_decor_bytes(invitation, fmt)
                if decor_bytes and from_template:
                    gen_result = compose_from_template_bytes(
                        decor_bytes,
                        blocks,
                        fmt=fmt,
                        style_tags=style_tags,
                        language=invitation.language,
                    )
                else:
                    bg = (
                        invitation.template.bg_url
                        if invitation.template
                        else None
                    )
                    raise RuntimeError(
                        "Selected JPG template could not be loaded. "
                        f"bg_url={bg!r}"
                    )

            if gen_result is None:
                # AI-from-scratch: paint décor only, persist it, then overlay text.
                decor_result = generate_image_bytes(
                    prompt,
                    fmt=fmt,
                    base_image_bytes=None,
                    blocks=blocks,
                    negative_prompt=negative,
                    model_params=model_params,
                    style_tags=style_tags,
                    language=invitation.language,
                    overlay_text=False,
                    verify_text=False,
                    require_gemini=True,
                )
                decor_key = (
                    f"invitations/{invitation.id}/"
                    f"decor_{fmt.replace(':', '_')}.jpg"
                )
                decor_url = upload_bytes(decor_result.data, decor_key, private=True)
                _persist_decor_url(invitation, decor_url)
                final_data = overlay_exact_invitation_text(
                    decor_result.data,
                    blocks,
                    fmt=fmt,
                    style_tags=style_tags,
                    language=invitation.language,
                    corner_guard=True,
                )
                width, height = decor_result.width, decor_result.height
                try:
                    from PIL import Image
                    import io

                    img = Image.open(io.BytesIO(final_data))
                    width, height = img.width, img.height
                except Exception:
                    pass
                gen_result = GenerationResult(
                    final_data,
                    source=decor_result.source,
                    width=width,
                    height=height,
                    text_overlay=True,
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
