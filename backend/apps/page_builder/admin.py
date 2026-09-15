from django.contrib import admin

from .models import InvitationPage


@admin.register(InvitationPage)
class InvitationPageAdmin(admin.ModelAdmin):
    list_display = ("slug", "event_slug", "title", "status", "user", "updated_at")
    list_filter = ("status", "event_slug")
    search_fields = (
        "slug",
        "title",
        "person_name",
        "child_name",
        "family_signature",
        "venue_name",
        "address",
    )
    readonly_fields = ("id", "slug", "created_at", "updated_at")
