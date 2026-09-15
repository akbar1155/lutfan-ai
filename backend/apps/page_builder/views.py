from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsNotBanned

from .ai_design import interpret_design_prompt, pick_curated_combo
from .catalog import DEFAULT_DESIGN, DEFAULT_MUSIC, MUSIC_PRESETS, sanitize_design_config
from .models import InvitationPage, InvitationPageStatus
from .serializers import (
    InvitationPageWriteSerializer,
    PublishSerializer,
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


def _apply_write(page: InvitationPage, data: dict) -> InvitationPage:
    mapping = {
        "title": "title",
        "main_text": "main_text",
        "event_date": "event_date",
        "event_time": "event_time",
        "address": "address",
        "design_config": "design_config",
        "music_config": "music_config",
        "design_prompt": "design_prompt",
    }
    for src, attr in mapping.items():
        if src in data:
            setattr(page, attr, data[src])
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
            title=serializer.validated_data.get("title", ""),
            main_text=serializer.validated_data.get("main_text", ""),
            event_date=serializer.validated_data.get("event_date"),
            event_time=serializer.validated_data.get("event_time"),
            address=serializer.validated_data.get("address", ""),
            design_config=serializer.validated_data.get("design_config") or dict(DEFAULT_DESIGN),
            music_config=serializer.validated_data.get("music_config") or dict(DEFAULT_MUSIC),
            design_prompt=serializer.validated_data.get("design_prompt", ""),
            status=InvitationPageStatus.DRAFT,
        )
        return Response(serialize_page(page), status=status.HTTP_201_CREATED)


class PageDetailView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request, pk):
        return Response(serialize_page(_user_page(request, pk)))

    def put(self, request, pk):
        page = _user_page(request, pk)
        serializer = InvitationPageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _apply_write(page, serializer.validated_data)
        return Response(serialize_page(page))

    def patch(self, request, pk):
        return self.put(request, pk)


class PagePublishView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        page = _user_page(request, pk)
        incoming = request.data if isinstance(request.data, dict) and request.data else {}
        payload = {
            "title": incoming.get("title", page.title),
            "mainText": incoming.get("mainText", page.main_text),
            "date": incoming.get("date", page.event_date.isoformat() if page.event_date else None),
            "time": incoming.get(
                "time",
                page.event_time.strftime("%H:%M") if page.event_time else None,
            ),
            "address": incoming.get("address", page.address),
            "designConfig": incoming.get("designConfig", page.design_config),
            "musicConfig": incoming.get("musicConfig", page.music_config),
            "designPrompt": incoming.get("designPrompt", page.design_prompt),
        }
        serializer = PublishSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        _apply_write(page, serializer.validated_data)
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
        if prompt:
            design = interpret_design_prompt(prompt)
        else:
            current = sanitize_design_config((request.data or {}).get("current"))
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
