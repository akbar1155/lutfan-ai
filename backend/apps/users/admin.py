from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, UserSession


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("-created_at",)
    list_display = (
        "telegram_id",
        "username",
        "first_name",
        "role",
        "language",
        "is_banned",
        "created_at",
    )
    search_fields = ("username", "first_name", "telegram_id")
    list_filter = ("role", "is_banned", "language")
    filter_horizontal = ("groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("telegram_id", "password")}),
        (
            "Profile",
            {
                "fields": (
                    "username",
                    "first_name",
                    "last_name",
                    "photo_url",
                    "phone",
                    "language",
                    "role",
                )
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "is_banned",
                    "ban_reason",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                )
            },
        ),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("telegram_id", "first_name", "role", "password1", "password2"),
            },
        ),
    )


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "revoked_at", "created_at")
