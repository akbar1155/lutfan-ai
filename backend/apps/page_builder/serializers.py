from __future__ import annotations

from rest_framework import serializers

from .catalog import sanitize_design_config, sanitize_music_config
from .models import InvitationPage


class InvitationPageWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    mainText = serializers.CharField(
        max_length=1200, required=False, allow_blank=True, source="main_text"
    )
    date = serializers.DateField(required=False, allow_null=True, source="event_date")
    time = serializers.TimeField(required=False, allow_null=True, source="event_time")
    address = serializers.CharField(max_length=240, required=False, allow_blank=True)
    designConfig = serializers.JSONField(required=False, source="design_config")
    musicConfig = serializers.JSONField(required=False, source="music_config")
    designPrompt = serializers.CharField(
        max_length=500, required=False, allow_blank=True, source="design_prompt"
    )

    def validate_designConfig(self, value):
        return sanitize_design_config(value)

    def validate_musicConfig(self, value):
        return sanitize_music_config(value)


class PublishSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120)
    mainText = serializers.CharField(max_length=1200, source="main_text")
    date = serializers.DateField(source="event_date")
    time = serializers.TimeField(source="event_time")
    address = serializers.CharField(max_length=240)
    designConfig = serializers.JSONField(required=False, source="design_config")
    musicConfig = serializers.JSONField(required=False, source="music_config")
    designPrompt = serializers.CharField(
        max_length=500, required=False, allow_blank=True, source="design_prompt"
    )

    def validate_designConfig(self, value):
        return sanitize_design_config(value)

    def validate_musicConfig(self, value):
        return sanitize_music_config(value)


def serialize_page(page: InvitationPage, *, public: bool = False) -> dict:
    from apps.ai_engine.storage import resolve_media_url

    music = sanitize_music_config(page.music_config)
    if music.get("url"):
        music["url"] = resolve_media_url(music["url"]) or ""
    payload = {
        "id": str(page.id),
        "slug": page.slug,
        "title": page.title,
        "mainText": page.main_text,
        "date": page.event_date.isoformat() if page.event_date else "",
        "time": page.event_time.strftime("%H:%M") if page.event_time else "",
        "address": page.address,
        "designConfig": sanitize_design_config(page.design_config),
        "musicConfig": music,
        "status": page.status,
        "publicUrl": f"/p/{page.slug}",
        "updatedAt": page.updated_at.isoformat(),
        "createdAt": page.created_at.isoformat(),
    }
    if not public:
        payload["designPrompt"] = page.design_prompt
    return payload
