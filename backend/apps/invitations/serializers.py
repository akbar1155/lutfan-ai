from rest_framework import serializers

from apps.ai_engine.storage import resolve_media_url

from .models import Invitation, ShareEvent


class InvitationSerializer(serializers.ModelSerializer):
    event_slug = serializers.CharField(source="event_id")
    final_image_url = serializers.SerializerMethodField()
    additional_formats = serializers.SerializerMethodField()

    def get_final_image_url(self, obj: Invitation):
        if not obj.final_image_url:
            return None
        return resolve_media_url(obj.final_image_url)

    def get_additional_formats(self, obj: Invitation):
        if not obj.additional_formats:
            return None
        resolved: dict[str, str] = {}
        for fmt, ref in (obj.additional_formats or {}).items():
            if not ref:
                continue
            resolved[str(fmt)] = resolve_media_url(str(ref))
        return resolved if resolved else None

    class Meta:
        model = Invitation
        fields = (
            "id",
            "status",
            "event_slug",
            "subtype_slug",
            "subtype_slugs",
            "inviter_type",
            "language",
            "event_data",
            "generation_path",
            "template_id",
            "ai_preset_id",
            "selected_mood_tags",
            "custom_style_note",
            "primary_format",
            "final_image_url",
            "additional_formats",
            "event_date",
            "generation_count",
            "last_generation_at",
            "expires_at",
            "last_job_id",
            "last_error",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "final_image_url",
            "additional_formats",
            "generation_count",
            "last_generation_at",
            "expires_at",
            "last_job_id",
            "last_error",
            "created_at",
            "updated_at",
        )


class InvitationCreateSerializer(serializers.Serializer):
    event_slug = serializers.CharField(max_length=32)
    subtype_slug = serializers.CharField(max_length=32, required=False, allow_null=True)
    language = serializers.CharField(max_length=16, required=False, default="uz-latn")


class InvitationUpdateSerializer(serializers.Serializer):
    subtype_slug = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    subtype_slugs = serializers.ListField(
        child=serializers.CharField(max_length=32),
        required=False,
        allow_empty=True,
    )
    inviter_type = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    language = serializers.CharField(required=False)
    event_data = serializers.DictField(required=False)
    generation_path = serializers.ChoiceField(
        choices=["template", "ai_from_scratch"], required=False, allow_null=True
    )
    template_id = serializers.UUIDField(required=False, allow_null=True)
    ai_preset_id = serializers.UUIDField(required=False, allow_null=True)
    selected_mood_tags = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    custom_style_note = serializers.CharField(required=False, allow_blank=True)
    primary_format = serializers.ChoiceField(
        choices=["4:5", "9:16", "1:1"], required=False
    )
    event_date = serializers.DateField(
        required=False, allow_null=True, input_formats=["%Y-%m-%d"]
    )

    def to_internal_value(self, data):
        mutable = dict(data)
        if mutable.get("event_date") in ("", "null", "undefined"):
            mutable["event_date"] = None
        return super().to_internal_value(mutable)


class ShareSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=ShareEvent.Platform.choices)
