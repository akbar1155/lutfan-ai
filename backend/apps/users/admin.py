from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import AdminAuthenticationForm
from .models import User, UserSession

admin.site.site_header = "Lutfan AI — Django admin"
admin.site.site_title = "Lutfan AI"
admin.site.index_title = "Boshqaruv"
admin.site.login_form = AdminAuthenticationForm


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("-created_at",)
    list_display = (
        "username",
        "telegram_id",
        "first_name",
        "role",
        "language",
        "is_staff",
        "is_superuser",
        "is_banned",
        "created_at",
    )
    search_fields = ("username", "first_name", "last_name", "telegram_id", "phone")
    list_filter = ("role", "is_banned", "language", "is_staff", "is_superuser")
    filter_horizontal = ("groups", "user_permissions")
    readonly_fields = ("id", "created_at", "updated_at", "last_login", "last_login_at", "last_seen_at")
    fieldsets = (
        (None, {"fields": ("id", "username", "password")}),
        (
            "Profile",
            {
                "fields": (
                    "telegram_id",
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
        (
            "Activity",
            {
                "fields": (
                    "last_login",
                    "last_login_at",
                    "last_seen_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "telegram_id",
                    "first_name",
                    "role",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "ip_address", "expires_at", "revoked_at", "created_at")
    list_filter = ("revoked_at",)
    search_fields = ("user__username", "user__first_name", "ip_address")
    readonly_fields = ("id", "created_at", "refresh_token_hash")
