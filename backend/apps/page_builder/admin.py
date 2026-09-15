from django.contrib import admin

from .models import InvitationPage


@admin.register(InvitationPage)
class InvitationPageAdmin(admin.ModelAdmin):
    list_display = ("slug", "title", "status", "user", "updated_at")
    list_filter = ("status",)
    search_fields = ("slug", "title", "address")
    readonly_fields = ("id", "slug", "created_at", "updated_at")
