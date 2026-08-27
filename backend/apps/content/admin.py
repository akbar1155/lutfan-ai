from django.contrib import admin

from .models import AIPromptPreset, EventConfig, MoodTag, Template, TextTemplate


@admin.register(EventConfig)
class EventConfigAdmin(admin.ModelAdmin):
    list_display = ("slug", "sort_order", "is_active")
    prepopulated_fields = {"slug": ()}


@admin.register(TextTemplate)
class TextTemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "event", "language", "tone", "is_active", "usage_count")
    list_filter = ("language", "tone", "is_active")


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ("theme_name", "event", "is_featured", "is_active", "usage_count")


@admin.register(MoodTag)
class MoodTagAdmin(admin.ModelAdmin):
    list_display = ("slug", "category", "sort_order", "is_active")


@admin.register(AIPromptPreset)
class AIPromptPresetAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "version", "is_active")
