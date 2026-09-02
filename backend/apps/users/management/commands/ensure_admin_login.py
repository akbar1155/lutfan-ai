"""Create or update a password-based admin login for the custom admin panel."""

from __future__ import annotations

import hashlib

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.users.models import Role, User


def synthetic_telegram_id(username: str) -> int:
    digest = hashlib.sha256(f"admin-login:{username.lower()}".encode()).hexdigest()
    # Negative reserved space so it never collides with real Telegram ids.
    return -int(digest[:12], 16)


class Command(BaseCommand):
    help = "Ensure a username/password admin account exists for /admin"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default=getattr(settings, "ADMIN_LOGIN_USERNAME", None) or "admin",
        )
        parser.add_argument(
            "--password",
            default=getattr(settings, "ADMIN_LOGIN_PASSWORD", None) or "",
        )
        parser.add_argument(
            "--first-name",
            default="Admin",
        )

    def handle(self, *args, **options):
        username = (options["username"] or "admin").strip()
        password = (options["password"] or "").strip()
        if not password:
            password = getattr(settings, "ADMIN_LOGIN_PASSWORD", "") or "admin123"
        first_name = (options["first_name"] or "Admin").strip() or "Admin"

        tg_id = synthetic_telegram_id(username)
        user = User.objects.filter(username__iexact=username).first()
        if user is None:
            user = User.objects.filter(telegram_id=tg_id).first()

        created = False
        if user is None:
            user = User(
                telegram_id=tg_id,
                username=username,
                first_name=first_name,
            )
            created = True

        user.username = username
        user.first_name = first_name or user.first_name or "Admin"
        user.role = Role.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_banned = False
        user.set_password(password)
        user.last_login_at = timezone.now()
        user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} admin login user '{username}' (role=admin, password login enabled)"
            )
        )
