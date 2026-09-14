from django.test import TestCase
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


class DjangoAdminUsernameLoginTests(TestCase):
    def setUp(self):
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

    def test_login_with_username(self):
        from django.contrib.auth import authenticate

        authed = authenticate(username="admin", password="admin123")
        self.assertIsNotNone(authed)
        self.assertEqual(authed.pk, self.user.pk)

    def test_login_with_telegram_id(self):
        from django.contrib.auth import authenticate

        authed = authenticate(
            username=str(self.user.telegram_id), password="admin123"
        )
        self.assertIsNotNone(authed)
        self.assertEqual(authed.pk, self.user.pk)

    def test_django_admin_session_login(self):
        ok = self.client.login(username="admin", password="admin123")
        self.assertTrue(ok)
        res = self.client.get("/django-admin/")
        self.assertEqual(res.status_code, 200)


class PhoneAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_and_login(self):
        reg = self.client.post(
            "/api/v1/auth/register",
            {
                "phone": "90 123 45 67",
                "password": "secret12",
                "first_name": "Ali",
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 200)
        self.assertEqual(reg.data["user"]["phone"], "+998901234567")
        self.assertIsNone(reg.data["user"]["telegram_id"])
        self.assertTrue(reg.data.get("access"))

        login = self.client.post(
            "/api/v1/auth/login",
            {"phone": "+998901234567", "password": "secret12"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data["user"]["first_name"], "Ali")

    def test_register_rejects_duplicate_phone(self):
        User.objects.create_user(
            phone="+998901234567",
            first_name="Ali",
            password="secret12",
        )
        res = self.client.post(
            "/api/v1/auth/register",
            {
                "phone": "998901234567",
                "password": "other12",
                "first_name": "Vali",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_login_rejects_bad_password(self):
        User.objects.create_user(
            phone="+998901234567",
            first_name="Ali",
            password="secret12",
        )
        res = self.client.post(
            "/api/v1/auth/login",
            {"phone": "901234567", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_existing_telegram_user_untouched(self):
        tg = User.objects.create_user(
            telegram_id=777001,
            first_name="Old",
        )
        self.assertFalse(tg.has_usable_password())
        self.assertIsNone(tg.phone)
        User.objects.create_user(
            phone="+998909998877",
            first_name="New",
            password="secret12",
        )
        tg.refresh_from_db()
        self.assertEqual(tg.telegram_id, 777001)
        self.assertEqual(User.objects.filter(telegram_id=777001).count(), 1)


class LastSeenTests(TestCase):
    def test_touch_updates_stale_last_seen(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.users.last_seen import is_currently_online, touch_user_last_seen

        user = User.objects.create_user(telegram_id=501, first_name="Seen")
        stale = timezone.now() - timedelta(days=4)
        User.objects.filter(pk=user.pk).update(last_seen_at=stale)
        touch_user_last_seen(user.pk)
        user.refresh_from_db()
        self.assertTrue(is_currently_online(user.last_seen_at))

    def test_resolve_picks_newest_timestamp(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.users.last_seen import resolve_last_activity_at

        now = timezone.now()
        picked = resolve_last_activity_at(
            last_seen_at=now - timedelta(days=4),
            last_login_at=now - timedelta(days=4),
            last_invitation_at=now - timedelta(days=4),
            last_session_at=now - timedelta(minutes=1),
            created_at=now - timedelta(days=10),
        )
        self.assertEqual(picked, now - timedelta(minutes=1))

    def test_authenticated_request_marks_online(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        user = User.objects.create_user(telegram_id=502, first_name="Api")
        token = str(RefreshToken.for_user(user).access_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = client.get("/api/v1/auth/me")
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertIsNotNone(user.last_seen_at)
