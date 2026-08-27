from collections import defaultdict

from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIPromptPreset, EventConfig, MoodTag, Template, TextTemplate
from .serializers import (
    AIPromptPresetSerializer,
    EventConfigSerializer,
    MoodTagSerializer,
    TemplateSerializer,
    TextTemplateSerializer,
)


class EventListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = EventConfigSerializer
    queryset = EventConfig.objects.filter(is_active=True)
    pagination_class = None


class EventDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = EventConfigSerializer
    lookup_field = "slug"
    queryset = EventConfig.objects.filter(is_active=True)


class TextTemplateListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TextTemplateSerializer
    pagination_class = None

    def get_queryset(self):
        from django.db.models import Q

        qs = TextTemplate.objects.filter(is_active=True)
        event_slug = self.request.query_params.get("event_slug")
        if not event_slug:
            return qs.none()
        qs = qs.filter(event_id=event_slug)
        language = self.request.query_params.get("language")
        if language:
            qs = qs.filter(language=language)
        tone = self.request.query_params.get("tone")
        if tone:
            qs = qs.filter(tone=tone)
        # Optional filters: keep universal (null/blank) templates plus exact matches.
        subtype = self.request.query_params.get("subtype_slug")
        if subtype:
            qs = qs.filter(
                Q(subtype_slug=subtype)
                | Q(subtype_slug__isnull=True)
                | Q(subtype_slug="")
            )
        inviter = self.request.query_params.get("inviter_type")
        if inviter:
            qs = qs.filter(
                Q(inviter_type=inviter)
                | Q(inviter_type__isnull=True)
                | Q(inviter_type="")
            )
        return qs.order_by("-usage_count", "sort_order")


class TemplateListView(generics.ListAPIView):
    # Public: home gallery + featured previews (no secrets in JPG metadata)
    permission_classes = [AllowAny]
    serializer_class = TemplateSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Template.objects.filter(is_active=True)
        event_slug = self.request.query_params.get("event_slug")
        if not event_slug:
            return qs.none()
        qs = qs.filter(event_id=event_slug)
        subtype = self.request.query_params.get("subtype_slug")
        if subtype:
            qs = qs.filter(subtype_slug=subtype)
        return qs.order_by("-is_featured", "theme_name", "-usage_count")


class TemplateDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = TemplateSerializer
    queryset = Template.objects.filter(is_active=True)


class MoodTagListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tags = MoodTag.objects.filter(is_active=True).order_by("category", "sort_order")
        grouped = defaultdict(list)
        for tag in tags:
            grouped[tag.category].append(MoodTagSerializer(tag).data)
        return Response(grouped)


class AIPresetListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AIPromptPresetSerializer
    pagination_class = None

    def get_queryset(self):
        qs = AIPromptPreset.objects.filter(is_active=True)
        event_slug = self.request.query_params.get("event_slug")
        if event_slug:
            qs = qs.filter(event_id=event_slug) | qs.filter(event__isnull=True)
        return qs
