from django.contrib import admin

from .models import Invitation, InvitationHistory, ShareEvent


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "event", "status", "created_at", "expires_at")
    list_filter = ("status", "event", "language")


admin.site.register(InvitationHistory)
admin.site.register(ShareEvent)
