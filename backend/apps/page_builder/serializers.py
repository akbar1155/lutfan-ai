from __future__ import annotations

from rest_framework import serializers

from .catalog import sanitize_design_config, sanitize_music_config
from .event_fields import (
    iso_date,
    iso_time,
    normalize_event_slug,
    normalize_schedule,
    normalize_subtype_slugs,
)
from .models import InvitationPage


class InvitationPageWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    mainText = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, source="main_text"
    )
    readyTextId = serializers.CharField(
        max_length=32, required=False, allow_blank=True, source="ready_text_id"
    )
    date = serializers.DateField(required=False, allow_null=True, source="event_date")
    time = serializers.TimeField(required=False, allow_null=True, source="event_time")
    familySignature = serializers.CharField(
        max_length=80, required=False, allow_blank=True, source="family_signature"
    )
    personName = serializers.CharField(
        max_length=80, required=False, allow_blank=True, source="person_name"
    )
    childName = serializers.CharField(
        max_length=50, required=False, allow_blank=True, source="child_name"
    )
    childGender = serializers.CharField(
        max_length=16, required=False, allow_blank=True, source="child_gender"
    )
    venueName = serializers.CharField(
        max_length=100, required=False, allow_blank=True, source="venue_name"
    )
    address = serializers.CharField(max_length=240, required=False, allow_blank=True)
    mapLat = serializers.FloatField(required=False, allow_null=True, source="map_lat")
    mapLng = serializers.FloatField(required=False, allow_null=True, source="map_lng")
    eventSlug = serializers.CharField(
        max_length=32, required=False, allow_blank=True, source="event_slug"
    )
    subtypeSlugs = serializers.ListField(
        child=serializers.CharField(max_length=32),
        required=False,
        source="subtype_slugs",
    )
    ceremonySchedule = serializers.JSONField(
        required=False, source="ceremony_schedule"
    )
    displayLang = serializers.CharField(
        max_length=16, required=False, allow_blank=True, source="display_lang"
    )
    designConfig = serializers.JSONField(required=False, source="design_config")
    musicConfig = serializers.JSONField(required=False, source="music_config")
    designPrompt = serializers.CharField(
        max_length=500, required=False, allow_blank=True, source="design_prompt"
    )

    def validate_eventSlug(self, value):
        return normalize_event_slug(value)

    def validate_subtypeSlugs(self, value):
        return [str(v or "").strip() for v in (value or []) if str(v or "").strip()]

    def validate_ceremonySchedule(self, value):
        return normalize_schedule(value)

    def validate_childGender(self, value):
        raw = str(value or "").strip().lower()
        return raw if raw in ("boy", "girl") else ""

    def validate_readyTextId(self, value):
        raw = str(value or "").strip().lower()
        if raw and raw.replace("-", "").replace("_", "").isalnum() and len(raw) <= 32:
            return raw
        return "classic1"

    def validate_displayLang(self, value):
        raw = str(value or "").strip().lower()
        if raw in ("uz-latn", "uz-cyrl", "ru"):
            return raw
        return "uz-latn"

    def validate_designConfig(self, value):
        return sanitize_design_config(value)

    def validate_musicConfig(self, value):
        return sanitize_music_config(value)


def serialize_page(page: InvitationPage, *, public: bool = False) -> dict:
    from apps.ai_engine.storage import resolve_media_url

    music = sanitize_music_config(page.music_config)
    if music.get("url"):
        music["url"] = resolve_media_url(music["url"]) or ""
    event = normalize_event_slug(page.event_slug)
    slugs = normalize_subtype_slugs(event, page.subtype_slugs)
    payload = {
        "id": str(page.id),
        "slug": page.slug,
        "eventSlug": event,
        "subtypeSlugs": slugs,
        "title": page.title,
        "readyTextId": page.ready_text_id or "classic1",
        "mainText": page.main_text,
        "date": iso_date(page.event_date),
        "time": iso_time(page.event_time),
        "familySignature": page.family_signature,
        "personName": page.person_name,
        "childName": page.child_name,
        "childGender": page.child_gender,
        "venueName": page.venue_name,
        "address": page.address,
        "mapLat": page.map_lat,
        "mapLng": page.map_lng,
        "ceremonySchedule": normalize_schedule(page.ceremony_schedule),
        "displayLang": page.display_lang or "uz-latn",
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
