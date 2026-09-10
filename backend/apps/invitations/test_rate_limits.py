from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.content.models import EventConfig
from apps.invitations.models import GenerationRateLimit
from apps.invitations.rate_limit import (
    check_generation_rate_limit,
    get_generation_limits,
    invalidate_generation_limits_cache,
)
from apps.users.models import Role, User
from rest_framework.exceptions import Throttled


class GenerationRateLimitSettingsTests(TestCase):
    def setUp(self):
        cache.clear()
        GenerationRateLimit.objects.all().delete()

    def test_get_solo_uses_env_defaults(self):
        with override_settings(
            RATE_LIMIT_GENERATIONS_PER_HOUR=7,
            RATE_LIMIT_GENERATIONS_PER_DAY=11,
        ):
            obj = GenerationRateLimit.get_solo()
        self.assertEqual(obj.per_hour, 7)
        self.assertEqual(obj.per_day, 11)

    def test_check_uses_db_limits(self):
        GenerationRateLimit.objects.create(pk=1, per_hour=1, per_day=10)
        invalidate_generation_limits_cache()
        check_generation_rate_limit("user-a")
        with self.assertRaises(Throttled):
            check_generation_rate_limit("user-a")

    def test_admin_patch_updates_limits(self):
        admin = User.objects.create_user(
            telegram_id=-991001,
            first_name="LimitsAdmin",
            password="Secret123!",
            role=Role.ADMIN,
            is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user=admin)
        res = client.patch(
            "/api/v1/admin/generation-limits",
            {"per_hour": 3, "per_day": 9},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["per_hour"], 3)
        self.assertEqual(res.data["per_day"], 9)
        invalidate_generation_limits_cache()
        self.assertEqual(get_generation_limits(), (3, 9))
