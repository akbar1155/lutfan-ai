import uuid

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.users.models import Language


class EventConfig(TimeStampedModel):
    slug = models.SlugField(max_length=32, unique=True)
    icon_url = models.URLField(max_length=512, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    name_translations = models.JSONField(default=dict)
    description_translations = models.JSONField(default=dict, blank=True, null=True)
    subtypes = models.JSONField(default=list, blank=True, null=True)
    fields_schema = models.JSONField(default=dict)
    color_themes = models.JSONField(default=dict, blank=True, null=True)

    class Meta:
        ordering = ["sort_order", "slug"]

    def __str__(self):
        return self.slug


class TextTemplate(TimeStampedModel):
    class Tone(models.TextChoices):
        CLASSIC = "classic", "Classic"
        WARM = "warm", "Warm"
        FORMAL = "formal", "Formal"
        POETIC = "poetic", "Poetic"
        MODERN = "modern", "Modern"

    event = models.ForeignKey(
        EventConfig,
        to_field="slug",
        db_column="event_slug",
        on_delete=models.CASCADE,
        related_name="text_templates",
    )
    subtype_slug = models.CharField(max_length=32, blank=True, null=True)
    inviter_type = models.CharField(max_length=32, blank=True, null=True)
    language = models.CharField(max_length=16, choices=Language.choices)
    title = models.CharField(max_length=128)
    preview_text = models.TextField()
    variables_used = models.JSONField(default=list)
    tone = models.CharField(max_length=16, choices=Tone.choices, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    usage_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_text_templates",
    )

    class Meta:
        indexes = [
            models.Index(fields=["event", "language", "is_active"]),
            models.Index(fields=["-usage_count"]),
        ]


class Template(TimeStampedModel):
    event = models.ForeignKey(
        EventConfig,
        to_field="slug",
        db_column="event_slug",
        on_delete=models.CASCADE,
        related_name="templates",
    )
    subtype_slug = models.CharField(max_length=32, blank=True, null=True)
    theme_name = models.CharField(max_length=128)
    style_tags = models.JSONField(default=list, blank=True)
    color_palette = models.JSONField(default=list, blank=True)
    mood_tags = models.JSONField(default=list, blank=True)
    bg_url = models.URLField(max_length=512)
    bg_url_preview = models.URLField(max_length=512)
    ai_composition_prompt = models.TextField()
    supports_dark_text = models.BooleanField(default=True)
    dominant_colors = models.JSONField(default=list, blank=True)
    supported_formats = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    view_count = models.IntegerField(default=0)
    usage_count = models.IntegerField(default=0)
    created_by_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_templates",
    )


class MoodTag(models.Model):
    class Category(models.TextChoices):
        COLOR = "color", "Color"
        FLOWERS = "flowers", "Flowers"
        STYLE = "style", "Style"
        TEXTURE = "texture", "Texture"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=32, unique=True)
    category = models.CharField(max_length=16, choices=Category.choices)
    name_translations = models.JSONField(default=dict)
    prompt_snippet = models.CharField(max_length=256)
    icon_url = models.URLField(max_length=512, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)


class AIPromptPreset(TimeStampedModel):
    name = models.CharField(max_length=128)
    event = models.ForeignKey(
        EventConfig,
        to_field="slug",
        db_column="event_slug",
        on_delete=models.CASCADE,
        related_name="ai_presets",
        null=True,
        blank=True,
    )
    base_prompt = models.TextField()
    negative_prompt = models.TextField(blank=True, null=True)
    model_params = models.JSONField(default=dict)
    example_output_url = models.URLField(max_length=512, blank=True, null=True)
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
