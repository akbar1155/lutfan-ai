from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.users.management.commands.ensure_admin_login import synthetic_telegram_id
from apps.users.models import Role, User


class AdminPasswordLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User(
            telegram_id=synthetic_telegram_id("admin"),
            username="admin",
            first_name="Admin",
            role=Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.user.set_password("admin123")
        self.user.save()

    def test_admin_login_success(self):
        res = self.client.post(
            "/api/v1/auth/admin-login",
            {"username": "admin", "password": "admin123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["role"], "admin")
        self.assertTrue(res.data.get("access"))

    def test_admin_login_rejects_bad_password(self):
        res = self.client.post(
            "/api/v1/auth/admin-login",
            {"username": "admin", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_admin_login_rejects_non_admin(self):
        u = User(telegram_id=42, username="guest", first_name="Guest", role=Role.USER)
        u.set_password("admin123")
        u.save()
        res = self.client.post(
            "/api/v1/auth/admin-login",
            {"username": "guest", "password": "admin123"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)


class EnsureAdminLoginCommandTests(TestCase):
    def test_creates_password_admin(self):
        from django.core.management import call_command

        call_command("ensure_admin_login", username="panel", password="Secret123!")
        user = User.objects.get(username="panel")
        self.assertEqual(user.role, Role.ADMIN)
        self.assertTrue(user.check_password("Secret123!"))
