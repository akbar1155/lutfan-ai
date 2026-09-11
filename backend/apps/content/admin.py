from django.contrib import admin

from .models import AIPromptPreset, EventConfig, MoodTag, Template, TextTemplate


@admin.register(EventConfig)
class EventConfigAdmin(admin.ModelAdmin):
    list_display = ("slug", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("slug",)
    ordering = ("sort_order", "slug")


@admin.register(TextTemplate)
class TextTemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "event", "language", "tone", "is_active", "usage_count")
    list_filter = ("language", "tone", "is_active", "event")
    search_fields = ("title", "body", "preview_text")


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = (
        "theme_name",
        "event",
        "is_featured",
        "is_active",
        "usage_count",
        "created_at",
    )
    list_filter = ("is_active", "is_featured", "event")
    search_fields = ("theme_name", "bg_url")


@admin.register(MoodTag)
class MoodTagAdmin(admin.ModelAdmin):
    list_display = ("slug", "category", "sort_order", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("slug",)
    ordering = ("sort_order", "slug")


@admin.register(AIPromptPreset)
class AIPromptPresetAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "version", "is_active")
    list_filter = ("is_active", "event")
    search_fields = ("name", "base_prompt", "negative_prompt")
