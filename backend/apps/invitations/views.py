from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_engine.tasks import enqueue_invitation_generation
from apps.ai_engine.storage import resolve_media_url
from apps.content.models import EventConfig
from apps.users.permissions import IsNotBanned

from .models import (
    AnalyticsEvent,
    Invitation,
    InvitationHistory,
    InvitationStatus,
    ShareEvent,
)
from .rate_limit import check_generation_rate_limit
from .serializers import (
    InvitationCreateSerializer,
    InvitationSerializer,
    InvitationUpdateSerializer,
    ShareSerializer,
)
from .validation import validate_invitation_payload


def _parse_iso_date(value):
    if not value:
        return None
    text = str(value).strip()[:10]
    try:
        from datetime import date

        return date.fromisoformat(text)
    except ValueError:
        return None


def _history(invitation, action, request, snapshot=None):
    import json
    import uuid

    safe_snapshot = None
    if snapshot is not None:
        safe_snapshot = json.loads(json.dumps(snapshot, default=str))
    InvitationHistory.objects.create(
        id=uuid.uuid4(),
        invitation=invitation,
        action=action,
        snapshot=safe_snapshot,
        ip_address=request.META.get("REMOTE_ADDR"),
        user_agent=request.META.get("HTTP_USER_AGENT"),
    )


class InvitationListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request):
        qs = Invitation.objects.filter(user=request.user, deleted_at__isnull=True)
        event_slug = request.query_params.get("event_slug")
        status_filter = request.query_params.get("status")
        if event_slug:
            qs = qs.filter(event_id=event_slug)
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.order_by("-created_at")
        return Response(InvitationSerializer(qs, many=True).data)

    def post(self, request):
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        event = get_object_or_404(EventConfig, slug=data["event_slug"], is_active=True)
        invitation = Invitation.objects.create(
            user=request.user,
            event=event,
            subtype_slug=data.get("subtype_slug"),
            language=data.get("language", "uz-latn"),
            event_data={},
        )
        _history(invitation, "created", request)
        return Response(
            InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED
        )


class InvitationDetailView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get_object(self, request, pk):
        return get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )

    def get(self, request, pk):
        return Response(InvitationSerializer(self.get_object(request, pk)).data)

    def patch(self, request, pk):
        invitation = self.get_object(request, pk)
        serializer = InvitationUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        for field in (
            "subtype_slug",
            "inviter_type",
            "language",
            "event_data",
            "generation_path",
            "selected_mood_tags",
            "custom_style_note",
            "primary_format",
            "event_date",
        ):
            if field in data:
                setattr(invitation, field, data[field])

        if "subtype_slugs" in data:
            slugs = [str(s).strip() for s in (data["subtype_slugs"] or []) if str(s).strip()]
            # Deduplicate while preserving order
            seen: set[str] = set()
            unique: list[str] = []
            for slug in slugs:
                if slug in seen:
                    continue
                seen.add(slug)
                unique.append(slug)
            invitation.subtype_slugs = unique
            invitation.subtype_slug = unique[0] if unique else None
        elif "subtype_slug" in data and data.get("subtype_slug"):
            # Legacy single field → keep list in sync
            invitation.subtype_slugs = [data["subtype_slug"]]

        if "template_id" in data:
            invitation.template_id = data["template_id"]
        if "ai_preset_id" in data:
            invitation.ai_preset_id = data["ai_preset_id"]

        if "event_data" in data or "event_date" in data:
            validate_invitation_payload(
                invitation.event,
                invitation.event_data,
                event_date=invitation.event_date,
            )

        if invitation.event_data and not invitation.event_date:
            structured = invitation.event_data.get("structured_fields") or {}
            raw_date = structured.get("event_date")
            parsed = _parse_iso_date(raw_date)
            if parsed:
                invitation.event_date = parsed

        invitation.save()
        try:
            _history(
                invitation,
                "edited",
                request,
                snapshot=InvitationSerializer(invitation).data,
            )
        except Exception:
            # History must never break the user flow
            pass
        return Response(InvitationSerializer(invitation).data)

    def delete(self, request, pk):
        invitation = self.get_object(request, pk)
        invitation.deleted_at = timezone.now()
        invitation.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationGenerateView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )
        if not invitation.generation_path:
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "generation_path is required",
                        "details": {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validate_invitation_payload(
            invitation.event,
            invitation.event_data,
            event_date=invitation.event_date,
            for_generate=True,
        )

        check_generation_rate_limit(str(request.user.id))
        invitation.status = InvitationStatus.GENERATING
        invitation.last_error = None
        invitation.save(update_fields=["status", "last_error", "updated_at"])

        async_result = enqueue_invitation_generation(str(invitation.id))
        invitation.last_job_id = async_result.id
        invitation.save(update_fields=["last_job_id", "updated_at"])
        _history(invitation, "regenerated", request)

        return Response(
            {"job_id": async_result.id, "invitation_id": str(invitation.id)},
            status=status.HTTP_202_ACCEPTED,
        )


class InvitationStatusView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request, pk):
        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )
        # Watchdog: runserver reload / hung Gemini can leave status=generating forever
        if invitation.status == InvitationStatus.GENERATING:
            age = (timezone.now() - invitation.updated_at).total_seconds()
            if age > 150:
                invitation.status = InvitationStatus.FAILED
                invitation.last_error = (
                    "Generation timed out. Please try again "
                    "(do not restart the server while generating)."
                )
                invitation.save(update_fields=["status", "last_error", "updated_at"])

        image_url = resolve_media_url(invitation.final_image_url) if invitation.final_image_url else None
        return Response(
            {
                "invitation_id": str(invitation.id),
                "status": invitation.status,
                "job_id": invitation.last_job_id,
                "image_url": image_url,
                "error": invitation.last_error,
            }
        )


class InvitationFormatsView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )
        fmt = request.data.get("format")
        if fmt not in ("9:16", "1:1"):
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "format must be 9:16 or 1:1"}},
                status=400,
            )
        # Extra crops must not overwrite the 4:5 HD primary_format.
        check_generation_rate_limit(str(request.user.id))
        invitation.status = InvitationStatus.GENERATING
        invitation.save(update_fields=["status", "updated_at"])
        async_result = enqueue_invitation_generation(
            str(invitation.id), extra_format=fmt
        )
        invitation.last_job_id = async_result.id
        invitation.save(update_fields=["last_job_id", "updated_at"])
        return Response({"job_id": async_result.id}, status=202)


class PublicInvitationView(APIView):
    """Shareable card for a ready invitation — no auth, no private fields."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        invitation = get_object_or_404(
            Invitation,
            pk=pk,
            deleted_at__isnull=True,
            status=InvitationStatus.READY,
        )
        if not invitation.final_image_url:
            return Response(
                {"error": {"code": "NOT_READY", "message": "Image not ready"}},
                status=404,
            )
        return Response(
            {
                "id": str(invitation.id),
                "event_slug": invitation.event_id,
                "language": invitation.language,
                "image_url": resolve_media_url(invitation.final_image_url),
            }
        )


class InvitationShareView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )
        serializer = ShareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ShareEvent.objects.create(
            invitation=invitation,
            shared_by=request.user,
            platform=serializer.validated_data["platform"],
        )
        _history(invitation, "shared", request)
        return Response({"ok": True})


class InvitationDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request, pk):
        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )
        fmt = request.query_params.get("aspect") or request.query_params.get("ratio") or "4:5"
        # NOTE: do not use ?format= — DRF reserves it for content negotiation and returns 404.
        ref = invitation.final_image_url
        if fmt != "4:5" and invitation.additional_formats:
            ref = (invitation.additional_formats.get(fmt) or ref)
        if not ref:
            return Response(
                {"error": {"code": "NOT_READY", "message": "Image not ready"}},
                status=404,
            )
        url = resolve_media_url(ref)
        _history(invitation, "downloaded", request)
        return Response({"url": url, "expires_in": 3600})


class InvitationEventsView(APIView):
    """SSE stream for generation updates (short-poll friendly long response)."""

    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request, pk):
        from django.http import StreamingHttpResponse
        import json
        import time

        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )

        def event_stream():
            for _ in range(40):
                invitation.refresh_from_db()
                payload = {
                    "invitation_id": str(invitation.id),
                    "status": invitation.status,
                    "image_url": resolve_media_url(invitation.final_image_url)
                    if invitation.final_image_url
                    else None,
                    "error": invitation.last_error,
                }
                event_name = {
                    InvitationStatus.GENERATING: "generation:started",
                    InvitationStatus.READY: "generation:complete",
                    InvitationStatus.FAILED: "generation:failed",
                }.get(invitation.status, "generation:queued")
                yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
                if invitation.status in (
                    InvitationStatus.READY,
                    InvitationStatus.FAILED,
                    InvitationStatus.DRAFT,
                ):
                    break
                time.sleep(1.5)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        return response


class AnalyticsIngestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        AnalyticsEvent.objects.create(
            user=request.user if request.user.is_authenticated else None,
            session_id=request.data.get("session_id", "anonymous"),
            event_name=request.data.get("event_name", "unknown"),
            properties=request.data.get("properties") or {},
            utm_source=request.data.get("utm_source"),
            utm_medium=request.data.get("utm_medium"),
            utm_campaign=request.data.get("utm_campaign"),
            referrer_url=request.data.get("referrer_url"),
            user_agent=request.META.get("HTTP_USER_AGENT"),
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        return Response({"ok": True}, status=201)


class UserInvitationsAliasView(InvitationListCreateView):
    """TZ path: GET /user/invitations"""

    def post(self, request):
        return Response(status=405)
