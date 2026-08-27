from rest_framework import serializers

from apps.ai_engine.storage import resolve_media_url

from .models import AIPromptPreset, EventConfig, MoodTag, Template, TextTemplate


class EventConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventConfig
        fields = (
            "id",
            "slug",
            "icon_url",
            "sort_order",
            "is_active",
            "name_translations",
            "description_translations",
            "subtypes",
            "fields_schema",
            "color_themes",
        )


class TextTemplateSerializer(serializers.ModelSerializer):
    event_slug = serializers.CharField(source="event_id")

    class Meta:
        model = TextTemplate
        fields = (
            "id",
            "event_slug",
            "subtype_slug",
            "inviter_type",
            "language",
            "title",
            "preview_text",
            "variables_used",
            "tone",
            "sort_order",
            "is_featured",
            "usage_count",
        )


class TemplateSerializer(serializers.ModelSerializer):
    event_slug = serializers.CharField(source="event_id")
    bg_url = serializers.SerializerMethodField()
    bg_url_preview = serializers.SerializerMethodField()

    class Meta:
        model = Template
        fields = (
            "id",
            "event_slug",
            "subtype_slug",
            "theme_name",
            "style_tags",
            "color_palette",
            "mood_tags",
            "bg_url",
            "bg_url_preview",
            "supports_dark_text",
            "dominant_colors",
            "supported_formats",
            "is_featured",
            "usage_count",
        )

    def get_bg_url(self, obj):
        return resolve_media_url(obj.bg_url) or obj.bg_url

    def get_bg_url_preview(self, obj):
        return resolve_media_url(obj.bg_url_preview) or obj.bg_url_preview


class MoodTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodTag
        fields = (
            "id",
            "slug",
            "category",
            "name_translations",
            "prompt_snippet",
            "icon_url",
            "sort_order",
        )


class AIPromptPresetSerializer(serializers.ModelSerializer):
    event_slug = serializers.CharField(source="event_id", allow_null=True)

    class Meta:
        model = AIPromptPreset
        fields = (
            "id",
            "name",
            "event_slug",
            "base_prompt",
            "negative_prompt",
            "model_params",
            "example_output_url",
            "version",
        )
