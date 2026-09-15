from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsNotBanned

from .ai_design import interpret_design_prompt, pick_curated_combo
from .catalog import DEFAULT_DESIGN, DEFAULT_MUSIC, MUSIC_PRESETS, sanitize_design_config
from .event_fields import (
    iso_date,
    iso_time,
    normalize_event_slug,
    normalize_schedule,
    normalize_subtype_slugs,
    parse_date,
    parse_time,
    primary_slot,
    publish_missing,
    sync_nikoh_schedule,
)
from .models import InvitationPage, InvitationPageStatus
from .serializers import (
    InvitationPageWriteSerializer,
    serialize_page,
)

MAX_MUSIC_BYTES = 8 * 1024 * 1024
ALLOWED_MUSIC_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".m4a",
}
ALLOWED_MUSIC_EXTS = {".mp3", ".m4a", ".wav"}


def _user_page(request, pk) -> InvitationPage:
    from django.shortcuts import get_object_or_404

    return get_object_or_404(InvitationPage, pk=pk, user=request.user)


DEFAULT_PAGE_BODY = "Sizni tantanamizga taklif etamiz."


def _page_title(data: dict) -> str:
    custom = str(data.get("title") or "").strip()
    if custom:
        return custom
    event = normalize_event_slug(data.get("event_slug"))
    if event in ("aqiqa", "sunnat"):
        return (
            str(data.get("child_name") or "").strip()
            or str(data.get("family_signature") or "").strip()
        )
    if event == "birthday":
        return (
            str(data.get("person_name") or "").strip()
            or str(data.get("family_signature") or "").strip()
        )
    return (
        str(data.get("person_name") or "").strip()
        or str(data.get("family_signature") or "").strip()
    )


def _compose_write(page: InvitationPage, incoming: dict) -> dict:
    event = normalize_event_slug(incoming.get("eventSlug", page.event_slug))
    slugs = normalize_subtype_slugs(
        event, incoming.get("subtypeSlugs", page.subtype_slugs)
    )
    date_s = incoming.get("date")
    if date_s is None:
        date_s = iso_date(page.event_date)
    time_s = incoming.get("time")
    if time_s is None:
        time_s = iso_time(page.event_time)
    date_s = iso_date(date_s)
    time_s = iso_time(time_s)
    schedule = normalize_schedule(
        incoming.get("ceremonySchedule", page.ceremony_schedule)
    )
    if event == "nikoh":
        schedule = sync_nikoh_schedule(slugs, schedule, date_s, time_s)
        date_s, time_s = primary_slot(slugs, schedule)
    else:
        slugs = []
        schedule = {}
    family = str(incoming.get("familySignature", page.family_signature) or "").strip()
    person = str(incoming.get("personName", page.person_name) or "").strip()
    child = str(incoming.get("childName", page.child_name) or "").strip()
    gender = str(incoming.get("childGender", page.child_gender) or "").strip().lower()
    if gender not in ("boy", "girl"):
        gender = ""
    venue = str(incoming.get("venueName", page.venue_name) or "").strip()
    address = str(incoming.get("address", page.address) or "").strip()
    main = str(incoming.get("mainText", page.main_text) or "").strip()
    ready = str(incoming.get("readyTextId", page.ready_text_id) or "classic1").strip().lower()
    lang = str(incoming.get("displayLang", page.display_lang) or "uz-latn").strip()
    payload = {
        "event_slug": event,
        "subtype_slugs": slugs,
        "title": str(incoming.get("title", page.title) or "").strip(),
        "ready_text_id": ready if ready else "classic1",
        "main_text": main,
        "event_date": parse_date(date_s),
        "event_time": parse_time(time_s),
        "family_signature": family,
        "person_name": person,
        "child_name": child,
        "child_gender": gender,
        "venue_name": venue,
        "address": address or venue,
        "ceremony_schedule": schedule,
        "display_lang": lang if lang in ("uz-latn", "uz-cyrl", "ru") else "uz-latn",
        "design_config": incoming.get("designConfig", page.design_config),
        "music_config": incoming.get("musicConfig", page.music_config),
        "design_prompt": incoming.get("designPrompt", page.design_prompt),
    }
    payload["title"] = _page_title(payload)
    if not payload["main_text"]:
        payload["main_text"] = DEFAULT_PAGE_BODY
    return payload


def _apply_write(page: InvitationPage, data: dict) -> InvitationPage:
    mapping = {
        "title": "title",
        "ready_text_id": "ready_text_id",
        "main_text": "main_text",
        "event_date": "event_date",
        "event_time": "event_time",
        "family_signature": "family_signature",
        "person_name": "person_name",
        "child_name": "child_name",
        "child_gender": "child_gender",
        "venue_name": "venue_name",
        "address": "address",
        "event_slug": "event_slug",
        "subtype_slugs": "subtype_slugs",
        "ceremony_schedule": "ceremony_schedule",
        "display_lang": "display_lang",
        "design_config": "design_config",
        "music_config": "music_config",
        "design_prompt": "design_prompt",
    }
    for src, attr in mapping.items():
        if src in data:
            setattr(page, attr, data[src])
    if not page.title:
        page.title = _page_title(
            {
                "event_slug": page.event_slug,
                "child_name": page.child_name,
                "person_name": page.person_name,
                "family_signature": page.family_signature,
                "title": page.title,
            }
        )
    page.save()
    return page


class PageListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request):
        qs = InvitationPage.objects.filter(user=request.user).order_by("-updated_at")[:50]
        return Response([serialize_page(p) for p in qs])

    def post(self, request):
        serializer = InvitationPageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        page = InvitationPage.objects.create(
            user=request.user,
            design_config=serializer.validated_data.get("design_config") or dict(DEFAULT_DESIGN),
            music_config=serializer.validated_data.get("music_config") or dict(DEFAULT_MUSIC),
            status=InvitationPageStatus.DRAFT,
        )
        incoming = request.data if isinstance(request.data, dict) else {}
        payload = _compose_write(page, incoming)
        if "design_config" in serializer.validated_data:
            payload["design_config"] = serializer.validated_data["design_config"]
        if "music_config" in serializer.validated_data:
            payload["music_config"] = serializer.validated_data["music_config"]
        _apply_write(page, payload)
        return Response(serialize_page(page), status=status.HTTP_201_CREATED)


class PageDetailView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request, pk):
        return Response(serialize_page(_user_page(request, pk)))

    def put(self, request, pk):
        page = _user_page(request, pk)
        serializer = InvitationPageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incoming = request.data if isinstance(request.data, dict) else {}
        payload = _compose_write(page, incoming)
        for key in ("design_config", "music_config", "design_prompt"):
            if key in serializer.validated_data:
                payload[key] = serializer.validated_data[key]
        _apply_write(page, payload)
        return Response(serialize_page(page))

    def patch(self, request, pk):
        return self.put(request, pk)


class PagePublishView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        page = _user_page(request, pk)
        incoming = request.data if isinstance(request.data, dict) and request.data else {}
        payload = _compose_write(page, incoming)
        missing = publish_missing(payload)
        if missing:
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": missing,
                        "details": {},
                    }
                },
                status=400,
            )
        _apply_write(page, payload)
        page.status = InvitationPageStatus.PUBLISHED
        page.save(update_fields=["status", "updated_at"])
        return Response(serialize_page(page))


class PageUnpublishView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        page = _user_page(request, pk)
        page.status = InvitationPageStatus.UNPUBLISHED
        page.save(update_fields=["status", "updated_at"])
        return Response(serialize_page(page))


class PageMusicUploadView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        from pathlib import Path

        from apps.ai_engine.storage import resolve_media_url, upload_bytes

        page = _user_page(request, pk)
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "Musiqa fayli kerak", "details": {}}},
                status=400,
            )
        if upload.size > MAX_MUSIC_BYTES:
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Musiqa 8 MB dan oshmasin",
                        "details": {},
                    }
                },
                status=400,
            )
        ext = Path(upload.name or "").suffix.lower()
        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        if ext not in ALLOWED_MUSIC_EXTS and content_type not in ALLOWED_MUSIC_TYPES:
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Faqat MP3, M4A yoki WAV",
                        "details": {},
                    }
                },
                status=400,
            )
        if ext not in ALLOWED_MUSIC_EXTS:
            ext = ALLOWED_MUSIC_TYPES.get(content_type, ".mp3")
        data = upload.read()
        if len(data) < 64:
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "Fayl bo‘sh", "details": {}}},
                status=400,
            )
        key = f"page-builder/music/{page.id}/{page.slug}{ext}"
        stored = upload_bytes(
            data,
            key,
            content_type=content_type or "audio/mpeg",
            private=False,
        )
        page.music_config = {
            "source": "upload",
            "presetId": page.music_config.get("presetId") if isinstance(page.music_config, dict) else "elegant",
            "url": stored,
        }
        page.save(update_fields=["music_config", "updated_at"])
        payload = serialize_page(page)
        payload["musicConfig"]["url"] = resolve_media_url(stored) or payload["musicConfig"].get("url")
        return Response(payload)


class PageAiStyleView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]
    parser_classes = [JSONParser]

    def post(self, request, pk=None):
        prompt = str((request.data or {}).get("prompt") or "").strip()[:500]
        current = sanitize_design_config((request.data or {}).get("current"))
        if prompt:
            design = interpret_design_prompt(prompt, current)
        else:
            design = pick_curated_combo(current)
        if pk:
            page = _user_page(request, pk)
            page.design_config = design
            if prompt:
                page.design_prompt = prompt
            page.save()
            payload = serialize_page(page)
            payload["designConfig"] = design
            return Response(payload)
        return Response({"designConfig": design})


class PageSurpriseView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk=None):
        current = sanitize_design_config((request.data or {}).get("current"))
        design = pick_curated_combo(current)
        if pk:
            page = _user_page(request, pk)
            page.design_config = design
            page.save(update_fields=["design_config", "updated_at"])
            return Response(serialize_page(page))
        return Response({"designConfig": design})


class PublicPageView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        from django.shortcuts import get_object_or_404

        page = get_object_or_404(
            InvitationPage,
            slug=slug,
            status=InvitationPageStatus.PUBLISHED,
        )
        return Response(serialize_page(page, public=True))


class CatalogView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from .catalog import (
            ANIMATIONS,
            DENSITIES,
            FLOWERS,
            FONTS,
            FRAMES,
            PATTERNS,
            PRIMARY_COLORS,
            TEXTURES,
        )

        return Response(
            {
                "primaryColor": list(PRIMARY_COLORS),
                "pattern": list(PATTERNS),
                "flower": list(FLOWERS),
                "texture": list(TEXTURES),
                "frame": list(FRAMES),
                "font": list(FONTS),
                "animation": list(ANIMATIONS),
                "decorationDensity": list(DENSITIES),
                "music": list(MUSIC_PRESETS),
                "defaults": {"designConfig": DEFAULT_DESIGN, "musicConfig": DEFAULT_MUSIC},
            }
        )
