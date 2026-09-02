from datetime import timedelta
import csv
import io
import json
import re
import uuid
from pathlib import Path

from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
import requests
from PIL import Image

from apps.core.dates import format_numeric_date
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_engine.generator import generate_image_bytes
from apps.ai_engine.models import AIGeneration, AdminAction, SystemLog
from apps.ai_engine.storage import resolve_media_url, upload_bytes
from apps.content.models import AIPromptPreset, EventConfig, MoodTag, Template, TextTemplate
from apps.invitations.models import DailyMetric, Invitation, InvitationHistory, InvitationStatus
from apps.users.models import Role, User
from apps.users.permissions import IsAdminRole


def _admin_log(request, action: str, target_type: str, target_id=None, changes=None):
    AdminAction.objects.create(
        admin=request.user,
        action=action,
        target_type=target_type,
        target_id=target_id,
        changes=changes or {},
        ip_address=request.META.get("REMOTE_ADDR") or "127.0.0.1",
    )


def _parse_json_field(value, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default
        return json.loads(text)
    return value


def _extract_vars(preview_text: str) -> list[str]:
    return sorted(set(re.findall(r"\{([a-zA-Z0-9_]+)\}", preview_text or "")))


def _load_bytes_from_media_ref(url: str | None) -> bytes | None:
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


def _preview_and_palette(image_bytes: bytes) -> tuple[bytes, list[str]]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    preview = img.resize((600, 750), Image.Resampling.LANCZOS)
    colors = preview.getcolors(maxcolors=200000) or []
    colors.sort(key=lambda x: x[0], reverse=True)
    dominant = []
    for _, rgb in colors[:5]:
        dominant.append("#%02x%02x%02x" % rgb)
    out = io.BytesIO()
    preview.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue(), dominant


def _default_test_blocks() -> dict[str, str]:
    return {
        "header": "Assalomu alaykum!",
        "body": "Sizni quvonchli tadbirimizga taklif etamiz.",
        "date_time": "12.09.2026, 18:00",
        "address": "Navro‘z to‘yxonasi, Namangan",
    }


def _compose_test_prompt(base_prompt: str, blocks: dict[str, str], mood: str = "") -> str:
    prompt = (base_prompt or "").strip()
    prompt = prompt.replace("{mood_snippets}", mood or "cream, gold accents, elegant floral frame")
    prompt = prompt.replace("{header_text}", blocks.get("header", ""))
    prompt = prompt.replace("{body_text}", blocks.get("body", ""))
    prompt = prompt.replace("{date_time_text}", blocks.get("date_time", ""))
    prompt = prompt.replace("{address_text}", blocks.get("address", ""))
    prompt = prompt.replace("{footer_text}", "")
    if "HEADER" not in prompt:
        prompt = (
            f"{prompt}\n\n"
            f'HEADER: "{blocks.get("header", "")}"\n'
            f'BODY: "{blocks.get("body", "")}"\n'
            f'DATE_TIME: "{blocks.get("date_time", "")}"\n'
            f'ADDRESS: "{blocks.get("address", "")}"'
        )
    return prompt


def _daily_metrics_series(days: int = 14) -> list[dict]:
    """Live daily aggregates from DB (not cached DailyMetric rows)."""
    today = timezone.now().date()
    start = today - timedelta(days=max(days - 1, 0))
    series: list[dict] = []
    day = start
    while day <= today:
        ai_qs = AIGeneration.objects.filter(created_at__date=day)
        completed_qs = Invitation.objects.filter(status=InvitationStatus.READY).filter(
            Q(last_generation_at__date=day)
            | Q(last_generation_at__isnull=True, updated_at__date=day)
        )
        series.append(
            {
                "date": format_numeric_date(day),
                "new_users": User.objects.filter(created_at__date=day).count(),
                "dau": User.objects.filter(last_login_at__date=day).count(),
                "invitations_created": Invitation.objects.filter(created_at__date=day).count(),
                "invitations_completed": completed_qs.count(),
                "ai_cost_usd": float(
                    ai_qs.aggregate(total=Sum("provider_cost_usd"))["total"] or 0
                ),
            }
        )
        day += timedelta(days=1)
    return series


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.now().date()
        series = _daily_metrics_series(days=14)
        return Response(
            {
                "dau": User.objects.filter(last_login_at__date=today).count(),
                "new_users_today": User.objects.filter(created_at__date=today).count(),
                "invitations_today": Invitation.objects.filter(created_at__date=today).count(),
                "invitations_ready_week": Invitation.objects.filter(
                    status=InvitationStatus.READY,
                    created_at__gte=timezone.now() - timedelta(days=7),
                ).count(),
                "ai_generations_today": AIGeneration.objects.filter(
                    created_at__date=today
                ).count(),
                "ai_cost_today": (
                    AIGeneration.objects.filter(created_at__date=today).aggregate(
                        total=Sum("provider_cost_usd")
                    )["total"]
                    or 0
                ),
                "counts": {
                    "users": User.objects.count(),
                    "events": EventConfig.objects.count(),
                    "text_templates": TextTemplate.objects.count(),
                    "templates": Template.objects.count(),
                    "mood_tags": MoodTag.objects.count(),
                    "invitations": Invitation.objects.filter(deleted_at__isnull=True).count(),
                    "ai_presets": AIPromptPreset.objects.count(),
                },
                "charts": {
                    "daily_metrics": series,
                    "funnel": {
                        "created_week": Invitation.objects.filter(
                            created_at__gte=timezone.now() - timedelta(days=7)
                        ).count(),
                        "ready_week": Invitation.objects.filter(
                            created_at__gte=timezone.now() - timedelta(days=7),
                            status=InvitationStatus.READY,
                        ).count(),
                    },
                },
            }
        )


def _admin_user_payload(user: User, *, invitation_count: int | None = None) -> dict:
    payload = {
        "id": str(user.id),
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "photo_url": user.photo_url,
        "phone": user.phone,
        "language": user.language,
        "role": user.role,
        "is_banned": user.is_banned,
        "ban_reason": user.ban_reason,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
    if invitation_count is not None:
        payload["invitation_count"] = invitation_count
    return payload


class AdminUsersView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = User.objects.all().order_by("-created_at")
        search = (request.query_params.get("search") or "").strip()
        role = (request.query_params.get("role") or "").strip()
        status = (request.query_params.get("status") or "").strip()
        is_banned = request.query_params.get("is_banned")
        page = max(int(request.query_params.get("page", 1)), 1)
        limit = min(max(int(request.query_params.get("limit", 20)), 1), 100)

        if search:
            if search.isdigit() or (search.startswith("-") and search[1:].isdigit()):
                qs = qs.filter(telegram_id=int(search))
            else:
                qs = qs.filter(
                    Q(username__icontains=search)
                    | Q(first_name__icontains=search)
                    | Q(last_name__icontains=search)
                    | Q(phone__icontains=search)
                )
        if role in {Role.USER, Role.ADMIN}:
            qs = qs.filter(role=role)
        if status == "banned":
            qs = qs.filter(is_banned=True)
        elif status == "inactive":
            qs = qs.filter(is_banned=False, is_active=False)
        elif status == "active":
            qs = qs.filter(is_banned=False, is_active=True)
        elif is_banned in {"true", "false"}:
            qs = qs.filter(is_banned=(is_banned == "true"))

        qs = qs.annotate(
            invitation_count=Count(
                "invitations",
                filter=Q(invitations__deleted_at__isnull=True),
            )
        )
        total = qs.count()
        offset = (page - 1) * limit
        rows = qs[offset : offset + limit]
        return Response(
            {
                "count": total,
                "page": page,
                "limit": limit,
                "results": [
                    _admin_user_payload(u, invitation_count=int(u.invitation_count or 0))
                    for u in rows
                ],
            }
        )


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        invitations = (
            Invitation.objects.filter(user=user, deleted_at__isnull=True)
            .order_by("-created_at")
            .select_related("event")[:20]
        )
        history = (
            InvitationHistory.objects.filter(invitation__user=user)
            .order_by("-created_at")
            .select_related("invitation")[:20]
        )
        sessions = list(
            user.sessions.order_by("-created_at").values(
                "id",
                "ip_address",
                "user_agent",
                "created_at",
                "expires_at",
                "revoked_at",
            )[:10]
        )
        invitation_count = Invitation.objects.filter(
            user=user, deleted_at__isnull=True
        ).count()
        active_sessions = user.sessions.filter(
            revoked_at__isnull=True, expires_at__gt=timezone.now()
        ).count()
        return Response(
            {
                "user": {
                    **_admin_user_payload(user, invitation_count=invitation_count),
                    "active_sessions": active_sessions,
                },
                "sessions": [
                    {
                        "id": str(s["id"]),
                        "ip_address": s["ip_address"],
                        "user_agent": s["user_agent"],
                        "created_at": s["created_at"],
                        "expires_at": s["expires_at"],
                        "revoked_at": s["revoked_at"],
                        "is_active": s["revoked_at"] is None
                        and s["expires_at"] is not None
                        and s["expires_at"] > timezone.now(),
                    }
                    for s in sessions
                ],
                "invitations": [
                    {
                        "id": str(inv.id),
                        "event_slug": inv.event_id,
                        "status": inv.status,
                        "created_at": inv.created_at,
                    }
                    for inv in invitations
                ],
                "history": [
                    {
                        "id": str(h.id),
                        "invitation_id": str(h.invitation_id),
                        "action": h.action,
                        "created_at": h.created_at,
                    }
                    for h in history
                ],
            }
        )

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        before = {"is_banned": user.is_banned, "role": user.role}
        if "is_banned" in request.data:
            user.is_banned = bool(request.data["is_banned"])
        if "ban_reason" in request.data:
            user.ban_reason = request.data.get("ban_reason")
        if "role" in request.data:
            next_role = request.data["role"]
            if next_role not in {Role.USER, Role.ADMIN}:
                return Response(
                    {"error": {"code": "VALIDATION_ERROR", "message": "Invalid role"}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.id == request.user.id and next_role != Role.ADMIN:
                return Response(
                    {
                        "error": {
                            "code": "VALIDATION_ERROR",
                            "message": "Admin cannot demote self",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.role = next_role
            user.is_staff = user.role == Role.ADMIN
        user.save()
        _admin_log(
            request,
            "user_updated",
            "user",
            user.id,
            {"before": before, "after": dict(request.data)},
        )
        return Response({"ok": True})


class AdminEventsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = EventConfig.objects.all().order_by("sort_order", "slug")
        return Response(
            [
                {
                    "id": str(e.id),
                    "slug": e.slug,
                    "icon_url": e.icon_url,
                    "sort_order": e.sort_order,
                    "is_active": e.is_active,
                    "name_translations": e.name_translations,
                    "description_translations": e.description_translations,
                    "subtypes": e.subtypes,
                    "fields_schema": e.fields_schema,
                    "color_themes": e.color_themes,
                }
                for e in qs
            ]
        )

    def post(self, request):
        data = request.data
        slug = (data.get("slug") or "").strip()
        if not slug:
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "slug required"}},
                status=400,
            )
        event = EventConfig.objects.create(
            slug=slug,
            icon_url=data.get("icon_url") or None,
            sort_order=int(data.get("sort_order") or 0),
            is_active=bool(data.get("is_active", True)),
            name_translations=_parse_json_field(data.get("name_translations"), {}),
            description_translations=_parse_json_field(
                data.get("description_translations"), {}
            ),
            subtypes=_parse_json_field(data.get("subtypes"), []),
            fields_schema=_parse_json_field(data.get("fields_schema"), {"required": [], "optional": []}),
            color_themes=_parse_json_field(data.get("color_themes"), {}),
        )
        _admin_log(request, "event_created", "event", event.id, {"slug": event.slug})
        return Response({"id": str(event.id), "slug": event.slug}, status=201)


class AdminEventDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        event = get_object_or_404(EventConfig, pk=pk)
        data = request.data
        for field in ("icon_url",):
            if field in data:
                setattr(event, field, data.get(field) or None)
        if "sort_order" in data:
            event.sort_order = int(data["sort_order"])
        if "is_active" in data:
            event.is_active = bool(data["is_active"])
        for field in (
            "name_translations",
            "description_translations",
            "subtypes",
            "fields_schema",
            "color_themes",
        ):
            if field in data:
                setattr(event, field, _parse_json_field(data.get(field), getattr(event, field)))
        event.save()
        _admin_log(request, "event_updated", "event", event.id, dict(data))
        return Response({"ok": True})

    def delete(self, request, pk):
        event = get_object_or_404(EventConfig, pk=pk)
        event.is_active = False
        event.save(update_fields=["is_active", "updated_at"])
        _admin_log(request, "event_deactivated", "event", event.id)
        return Response({"ok": True})


class AdminTextTemplatesView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = TextTemplate.objects.select_related("event").order_by("event_id", "sort_order")
        event_slug = request.query_params.get("event_slug")
        if event_slug:
            qs = qs.filter(event_id=event_slug)
        return Response(
            [
                {
                    "id": str(t.id),
                    "event_slug": t.event_id,
                    "subtype_slug": t.subtype_slug,
                    "inviter_type": t.inviter_type,
                    "language": t.language,
                    "title": t.title,
                    "preview_text": t.preview_text,
                    "variables_used": t.variables_used,
                    "tone": t.tone,
                    "sort_order": t.sort_order,
                    "is_featured": t.is_featured,
                    "is_active": t.is_active,
                }
                for t in qs[:200]
            ]
        )

    def post(self, request):
        data = request.data
        event = get_object_or_404(EventConfig, slug=data.get("event_slug"))
        preview = data.get("preview_text") or ""
        tpl = TextTemplate.objects.create(
            event=event,
            subtype_slug=data.get("subtype_slug") or None,
            inviter_type=data.get("inviter_type") or None,
            language=data.get("language") or "uz-latn",
            title=data.get("title") or "Untitled",
            preview_text=preview,
            variables_used=_extract_vars(preview),
            tone=data.get("tone") or None,
            sort_order=int(data.get("sort_order") or 0),
            is_featured=bool(data.get("is_featured", False)),
            is_active=bool(data.get("is_active", True)),
            created_by_admin=request.user,
        )
        _admin_log(request, "text_template_created", "text_template", tpl.id)
        return Response({"id": str(tpl.id)}, status=201)


class AdminTextTemplateDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        tpl = get_object_or_404(TextTemplate, pk=pk)
        data = request.data
        if "event_slug" in data:
            tpl.event = get_object_or_404(EventConfig, slug=data["event_slug"])
        for field in ("subtype_slug", "inviter_type", "language", "title", "tone"):
            if field in data:
                setattr(tpl, field, data.get(field) or None)
        if "preview_text" in data:
            tpl.preview_text = data["preview_text"]
            tpl.variables_used = _extract_vars(tpl.preview_text)
        if "sort_order" in data:
            tpl.sort_order = int(data["sort_order"])
        if "is_featured" in data:
            tpl.is_featured = bool(data["is_featured"])
        if "is_active" in data:
            tpl.is_active = bool(data["is_active"])
        tpl.save()
        _admin_log(request, "text_template_updated", "text_template", tpl.id, dict(data))
        return Response({"ok": True})

    def delete(self, request, pk):
        tpl = get_object_or_404(TextTemplate, pk=pk)
        tpl.is_active = False
        tpl.save(update_fields=["is_active", "updated_at"])
        _admin_log(request, "text_template_deactivated", "text_template", tpl.id)
        return Response({"ok": True})


class AdminTemplatesView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = Template.objects.select_related("event").order_by("-created_at")
        event_slug = request.query_params.get("event_slug")
        if event_slug:
            qs = qs.filter(event_id=event_slug)
        return Response(
            [
                {
                    "id": str(t.id),
                    "event_slug": t.event_id,
                    "subtype_slug": t.subtype_slug,
                    "theme_name": t.theme_name,
                    "style_tags": t.style_tags,
                    "bg_url": resolve_media_url(t.bg_url) or t.bg_url,
                    "bg_url_preview": resolve_media_url(t.bg_url_preview) or t.bg_url_preview,
                    "ai_composition_prompt": t.ai_composition_prompt,
                    "supported_formats": t.supported_formats,
                    "is_active": t.is_active,
                    "is_featured": t.is_featured,
                }
                for t in qs[:200]
            ]
        )

    def post(self, request):
        data = request.data
        event = get_object_or_404(EventConfig, slug=data.get("event_slug"))
        upload = request.FILES.get("file")
        bg = data.get("bg_url") or ""
        preview = data.get("bg_url_preview") or bg
        dominant_colors = _parse_json_field(data.get("dominant_colors"), [])
        if upload:
            raw = upload.read()
            if len(raw) > 20 * 1024 * 1024:
                return Response(
                    {"error": {"code": "VALIDATION_ERROR", "message": "file too large (max 20MB)"}},
                    status=400,
                )
            token = uuid.uuid4().hex
            bg = upload_bytes(raw, f"templates/{token}/bg.jpg", private=False)
            preview_bytes, auto_colors = _preview_and_palette(raw)
            preview = upload_bytes(
                preview_bytes,
                f"templates/{token}/preview.jpg",
                private=False,
            )
            if not dominant_colors:
                dominant_colors = auto_colors
        tpl = Template.objects.create(
            event=event,
            subtype_slug=data.get("subtype_slug") or None,
            theme_name=data.get("theme_name") or "Theme",
            style_tags=_parse_json_field(data.get("style_tags"), []),
            color_palette=_parse_json_field(data.get("color_palette"), []),
            mood_tags=_parse_json_field(data.get("mood_tags"), []),
            bg_url=bg,
            bg_url_preview=preview,
            ai_composition_prompt=data.get("ai_composition_prompt") or "Place text elegantly.",
            supports_dark_text=bool(data.get("supports_dark_text", True)),
            dominant_colors=dominant_colors,
            supported_formats=_parse_json_field(data.get("supported_formats"), ["4:5", "9:16", "1:1"]),
            is_active=bool(data.get("is_active", True)),
            is_featured=bool(data.get("is_featured", False)),
            created_by_admin=request.user,
        )
        _admin_log(request, "template_created", "template", tpl.id)
        return Response({"id": str(tpl.id)}, status=201)


class AdminTemplateDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        tpl = get_object_or_404(Template, pk=pk)
        data = request.data
        upload = request.FILES.get("file")
        if "event_slug" in data:
            tpl.event = get_object_or_404(EventConfig, slug=data["event_slug"])
        for field in (
            "subtype_slug",
            "theme_name",
            "bg_url",
            "bg_url_preview",
            "ai_composition_prompt",
        ):
            if field in data:
                setattr(tpl, field, data.get(field) or getattr(tpl, field))
        for field in ("style_tags", "color_palette", "mood_tags", "dominant_colors", "supported_formats"):
            if field in data:
                setattr(tpl, field, _parse_json_field(data.get(field), getattr(tpl, field)))
        if upload:
            raw = upload.read()
            if len(raw) > 20 * 1024 * 1024:
                return Response(
                    {"error": {"code": "VALIDATION_ERROR", "message": "file too large (max 20MB)"}},
                    status=400,
                )
            token = uuid.uuid4().hex
            tpl.bg_url = upload_bytes(raw, f"templates/{token}/bg.jpg", private=False)
            preview_bytes, auto_colors = _preview_and_palette(raw)
            tpl.bg_url_preview = upload_bytes(
                preview_bytes,
                f"templates/{token}/preview.jpg",
                private=False,
            )
            if "dominant_colors" not in data:
                tpl.dominant_colors = auto_colors
        if "supports_dark_text" in data:
            tpl.supports_dark_text = bool(data["supports_dark_text"])
        if "is_active" in data:
            tpl.is_active = bool(data["is_active"])
        if "is_featured" in data:
            tpl.is_featured = bool(data["is_featured"])
        tpl.save()
        _admin_log(request, "template_updated", "template", tpl.id, dict(data))
        return Response({"ok": True})

    def delete(self, request, pk):
        tpl = get_object_or_404(Template, pk=pk)
        tpl.is_active = False
        tpl.save(update_fields=["is_active", "updated_at"])
        _admin_log(request, "template_deactivated", "template", tpl.id)
        return Response({"ok": True})


class AdminTemplateTestView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        tpl = get_object_or_404(Template, pk=pk)
        blocks = _default_test_blocks()
        blocks.update(_parse_json_field(request.data.get("blocks"), {}))
        prompt = _compose_test_prompt(tpl.ai_composition_prompt, blocks)
        base = _load_bytes_from_media_ref(tpl.bg_url_preview or tpl.bg_url)
        result = generate_image_bytes(
            prompt,
            fmt="4:5",
            base_image_bytes=base,
            blocks=blocks,
        )
        key = f"admin-tests/templates/{tpl.id}/{uuid.uuid4().hex}.jpg"
        stored = upload_bytes(result.data, key, private=False)
        url = resolve_media_url(stored) or stored
        _admin_log(request, "template_test_generated", "template", tpl.id, {"url": url})
        return Response({"ok": True, "result_url": url})


class AdminMoodTagsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = MoodTag.objects.all().order_by("category", "sort_order")
        return Response(
            [
                {
                    "id": str(m.id),
                    "slug": m.slug,
                    "category": m.category,
                    "name_translations": m.name_translations,
                    "prompt_snippet": m.prompt_snippet,
                    "icon_url": m.icon_url,
                    "sort_order": m.sort_order,
                    "is_active": m.is_active,
                }
                for m in qs
            ]
        )

    def post(self, request):
        data = request.data
        slug = (data.get("slug") or "").strip()
        mood = MoodTag.objects.create(
            slug=slug,
            category=data.get("category") or MoodTag.Category.STYLE,
            name_translations=_parse_json_field(data.get("name_translations"), {}),
            prompt_snippet=data.get("prompt_snippet") or "",
            icon_url=data.get("icon_url") or None,
            sort_order=int(data.get("sort_order") or 0),
            is_active=bool(data.get("is_active", True)),
        )
        _admin_log(request, "mood_tag_created", "mood_tag", mood.id)
        return Response({"id": str(mood.id)}, status=201)


class AdminMoodTagDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        mood = get_object_or_404(MoodTag, pk=pk)
        data = request.data
        for field in ("slug", "category", "prompt_snippet", "icon_url"):
            if field in data:
                setattr(mood, field, data.get(field) or getattr(mood, field))
        if "name_translations" in data:
            mood.name_translations = _parse_json_field(
                data["name_translations"], mood.name_translations
            )
        if "sort_order" in data:
            mood.sort_order = int(data["sort_order"])
        if "is_active" in data:
            mood.is_active = bool(data["is_active"])
        mood.save()
        _admin_log(request, "mood_tag_updated", "mood_tag", mood.id, dict(data))
        return Response({"ok": True})

    def delete(self, request, pk):
        mood = get_object_or_404(MoodTag, pk=pk)
        mood.is_active = False
        mood.save(update_fields=["is_active"])
        _admin_log(request, "mood_tag_deactivated", "mood_tag", mood.id)
        return Response({"ok": True})


class AdminAiPresetsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = AIPromptPreset.objects.select_related("event").order_by("-updated_at")
        return Response(
            [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "event_slug": p.event_id,
                    "base_prompt": p.base_prompt,
                    "negative_prompt": p.negative_prompt,
                    "model_params": p.model_params,
                    "example_output_url": p.example_output_url,
                    "version": p.version,
                    "is_active": p.is_active,
                }
                for p in qs[:200]
            ]
        )

    def post(self, request):
        data = request.data
        event = None
        if data.get("event_slug"):
            event = get_object_or_404(EventConfig, slug=data["event_slug"])
        preset = AIPromptPreset.objects.create(
            name=data.get("name") or "Preset",
            event=event,
            base_prompt=data.get("base_prompt") or "",
            negative_prompt=data.get("negative_prompt") or None,
            model_params=_parse_json_field(data.get("model_params"), {}),
            example_output_url=data.get("example_output_url") or None,
            version=int(data.get("version") or 1),
            is_active=bool(data.get("is_active", True)),
        )
        _admin_log(request, "ai_preset_created", "ai_preset", preset.id)
        return Response({"id": str(preset.id)}, status=201)


class AdminAiPresetDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        preset = get_object_or_404(AIPromptPreset, pk=pk)
        data = request.data
        if "event_slug" in data:
            preset.event = (
                get_object_or_404(EventConfig, slug=data["event_slug"])
                if data.get("event_slug")
                else None
            )
        for field in ("name", "base_prompt", "negative_prompt", "example_output_url"):
            if field in data:
                setattr(preset, field, data.get(field))
        if "model_params" in data:
            preset.model_params = _parse_json_field(data["model_params"], preset.model_params)
        if "version" in data:
            preset.version = int(data["version"])
        if "is_active" in data:
            preset.is_active = bool(data["is_active"])
        preset.save()
        _admin_log(request, "ai_preset_updated", "ai_preset", preset.id, dict(data))
        return Response({"ok": True})

    def delete(self, request, pk):
        preset = get_object_or_404(AIPromptPreset, pk=pk)
        preset.is_active = False
        preset.save(update_fields=["is_active", "updated_at"])
        _admin_log(request, "ai_preset_deactivated", "ai_preset", preset.id)
        return Response({"ok": True})


class AdminAiPresetTestView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        preset = get_object_or_404(AIPromptPreset, pk=pk)
        blocks = _default_test_blocks()
        blocks.update(_parse_json_field(request.data.get("blocks"), {}))
        mood = request.data.get("mood_snippets") or "premium cream paper, thin gold frame, floral corners"
        prompt = _compose_test_prompt(preset.base_prompt or "", blocks, mood=str(mood))
        model_params = _parse_json_field(request.data.get("model_params"), preset.model_params or {})
        result = generate_image_bytes(
            prompt,
            fmt=str(model_params.get("aspect_ratio") or "4:5"),
            blocks=blocks,
            negative_prompt=preset.negative_prompt or "",
            model_params=model_params,
        )
        key = f"admin-tests/presets/{preset.id}/{uuid.uuid4().hex}.jpg"
        stored = upload_bytes(result.data, key, private=False)
        preset.example_output_url = stored
        preset.save(update_fields=["example_output_url", "updated_at"])
        url = resolve_media_url(stored) or stored
        _admin_log(request, "ai_preset_test_generated", "ai_preset", preset.id, {"url": url})
        return Response({"ok": True, "result_url": url, "example_output_url": url})


class AdminInvitationsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = Invitation.objects.filter(deleted_at__isnull=True).select_related(
            "user", "event"
        ).order_by("-created_at")
        status_filter = request.query_params.get("status")
        event_slug = request.query_params.get("event_slug")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if event_slug:
            qs = qs.filter(event_id=event_slug)
        limit = min(max(int(request.query_params.get("limit", 50)), 1), 200)
        return Response(
            [
                {
                    "id": str(inv.id),
                    "status": inv.status,
                    "event_slug": inv.event_id,
                    "subtype_slugs": inv.subtype_slugs or ([inv.subtype_slug] if inv.subtype_slug else []),
                    "user_id": str(inv.user_id),
                    "user_name": inv.user.first_name,
                    "telegram_id": inv.user.telegram_id,
                    "language": inv.language,
                    "final_image_url": resolve_media_url(inv.final_image_url),
                    "created_at": inv.created_at,
                }
                for inv in qs[:limit]
            ]
        )


class AdminAiGenerationsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = AIGeneration.objects.select_related("user", "invitation").order_by("-created_at")
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(
            [
                {
                    "id": str(g.id),
                    "status": g.status,
                    "model": g.model,
                    "generation_path": g.generation_path,
                    "provider_cost_usd": g.provider_cost_usd,
                    "duration_ms": g.duration_ms,
                    "error_message": g.error_message,
                    "user_id": str(g.user_id),
                    "invitation_id": str(g.invitation_id),
                    "result_url": resolve_media_url(g.result_url),
                    "created_at": g.created_at,
                }
                for g in qs[:100]
            ]
        )


class AdminSystemLogsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = SystemLog.objects.order_by("-created_at")
        level = request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)
        return Response(
            [
                {
                    "id": str(log.id),
                    "level": log.level,
                    "module": log.module,
                    "message": log.message,
                    "context": log.context,
                    "created_at": log.created_at,
                }
                for log in qs[:100]
            ]
        )


class AdminAnalyticsExportView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="daily_metrics.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "date",
                "new_users",
                "dau",
                "invitations_created",
                "invitations_completed",
                "ai_generations_count",
                "ai_cost_usd",
                "downloads_count",
                "shares_count",
            ]
        )
        for row in DailyMetric.objects.order_by("-date")[:365]:
            writer.writerow(
                [
                    format_numeric_date(row.date),
                    row.new_users,
                    row.dau,
                    row.invitations_created,
                    row.invitations_completed,
                    row.ai_generations_count,
                    row.ai_cost_usd,
                    row.downloads_count,
                    row.shares_count,
                ]
            )
        _admin_log(request, "analytics_exported", "daily_metrics")
        return response
