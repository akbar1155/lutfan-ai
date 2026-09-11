from django.contrib import admin
from django.utils.html import format_html

from .models import (
    AnalyticsEvent,
    DailyMetric,
    GenerationRateLimit,
    Invitation,
    InvitationHistory,
    Notification,
    RenderedFile,
    ShareEvent,
)


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "event",
        "status",
        "generation_path",
        "created_at",
        "expires_at",
    )
    list_filter = ("status", "event", "language", "generation_path")
    search_fields = (
        "id",
        "user__username",
        "user__first_name",
        "user__telegram_id",
        "custom_style_note",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "preview_image",
        "generation_count",
        "last_generation_at",
        "last_job_id",
    )
    autocomplete_fields = ("user", "template", "ai_preset")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "user",
                    "event",
                    "status",
                    "language",
                    "subtype_slug",
                    "subtype_slugs",
                    "inviter_type",
                )
            },
        ),
        (
            "Content",
            {"fields": ("event_data", "event_date", "preview_image", "final_image_url")},
        ),
        (
            "Style / AI",
            {
                "fields": (
                    "generation_path",
                    "template",
                    "ai_preset",
                    "selected_mood_tags",
                    "custom_style_note",
                    "primary_format",
                    "additional_formats",
                )
            },
        ),
        (
            "Generation",
            {
                "fields": (
                    "generation_count",
                    "last_generation_at",
                    "last_job_id",
                    "last_error",
                    "expires_at",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Preview")
    def preview_image(self, obj: Invitation):
        url = (obj.final_image_url or "").strip()
        if not url:
            return "—"
        return format_html(
            '<a href="{0}" target="_blank" rel="noopener"><img src="{0}" '
            'alt="" style="max-width:220px;max-height:280px;border-radius:8px;" /></a>',
            url,
        )


@admin.register(InvitationHistory)
class InvitationHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "invitation", "action", "created_at")
    list_filter = ("action",)
    search_fields = ("invitation__id", "action")
    readonly_fields = ("id", "created_at")


@admin.register(RenderedFile)
class RenderedFileAdmin(admin.ModelAdmin):
    list_display = ("id", "invitation", "file_type", "width", "height", "created_at")
    list_filter = ("file_type",)
    search_fields = ("invitation__id", "url")


@admin.register(ShareEvent)
class ShareEventAdmin(admin.ModelAdmin):
    list_display = ("id", "invitation", "platform", "shared_by", "created_at")
    list_filter = ("platform",)
    search_fields = ("invitation__id", "shared_by__username", "shared_by__first_name")


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_name", "user", "session_id", "created_at")
    list_filter = ("event_name",)
    search_fields = ("event_name", "session_id", "user__username")
    readonly_fields = ("id", "created_at")


@admin.register(DailyMetric)
class DailyMetricAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "new_users",
        "dau",
        "invitations_created",
        "invitations_completed",
        "ai_generations_count",
        "ai_cost_usd",
    )
    ordering = ("-date",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "channel", "status", "scheduled_at", "sent_at")
    list_filter = ("type", "channel", "status")
    search_fields = ("user__username", "user__first_name")


@admin.register(GenerationRateLimit)
class GenerationRateLimitAdmin(admin.ModelAdmin):
    list_display = ("id", "per_hour", "per_day", "updated_at")

    def has_add_permission(self, request):
        return not GenerationRateLimit.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
