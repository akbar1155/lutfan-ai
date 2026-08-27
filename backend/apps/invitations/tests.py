from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.content.models import EventConfig
from apps.invitations.models import Invitation, InvitationStatus
from apps.invitations.validation import validate_invitation_payload
from apps.users.models import User
from rest_framework.exceptions import ValidationError


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = AccessToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


class InvitationValidationTests(TestCase):
    def setUp(self):
        self.event = EventConfig.objects.create(
            slug="nikoh",
            name_translations={"uz-latn": "Nikoh"},
            fields_schema={
                "required": [
                    {"key": "event_date", "type": "date", "min": "today"},
                    {"key": "venue_name", "type": "string"},
                ],
                "optional": [],
            },
        )
        self.user = User.objects.create_user(
            telegram_id=91001, first_name="Tester"
        )
        self.client = _auth_client(self.user)

    def test_past_event_date_is_rejected(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        with self.assertRaises(ValidationError):
            validate_invitation_payload(
                self.event,
                {"structured_fields": {"event_date": yesterday, "venue_name": "Zal"}},
                event_date=yesterday,
            )

    def test_junk_venue_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_invitation_payload(
                self.event,
                {"structured_fields": {"venue_name": "aaaa"}},
            )

    def test_patch_past_date_returns_400(self):
        invitation = Invitation.objects.create(
            user=self.user,
            event=self.event,
            language="uz-latn",
            inviter_type="family",
            event_data={},
        )
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        res = self.client.patch(
            f"/api/v1/invitations/{invitation.id}",
            {
                "event_data": {
                    "structured_fields": {
                        "event_date": yesterday,
                        "venue_name": "Navruz zal",
                    }
                },
                "event_date": yesterday,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_generate_rejects_junk_text(self):
        invitation = Invitation.objects.create(
            user=self.user,
            event=self.event,
            language="uz-latn",
            inviter_type="family",
            generation_path="template",
            event_data={
                "structured_fields": {"venue_name": "Navruz zal"},
                "final_text_blocks": {"body": "aaaa", "header": "Salom"},
            },
        )
        res = self.client.post(f"/api/v1/invitations/{invitation.id}/generate")
        self.assertEqual(res.status_code, 400)

    @override_settings(
        RATE_LIMIT_GENERATIONS_PER_HOUR=0, RATE_LIMIT_GENERATIONS_PER_DAY=0
    )
    @patch("apps.invitations.views.enqueue_invitation_generation")
    def test_extra_format_keeps_primary_45(self, mock_enqueue):
        mock_enqueue.return_value = SimpleNamespace(id="job-extra")
        invitation = Invitation.objects.create(
            user=self.user,
            event=self.event,
            language="uz-latn",
            status=InvitationStatus.READY,
            primary_format="4:5",
            generation_path="template",
            final_image_url="/media/invitations/demo.jpg",
            event_data={"structured_fields": {"venue_name": "Navruz zal"}},
        )
        res = self.client.post(
            f"/api/v1/invitations/{invitation.id}/formats",
            {"format": "9:16"},
            format="json",
        )
        self.assertEqual(res.status_code, 202)
        invitation.refresh_from_db()
        self.assertEqual(invitation.primary_format, "4:5")
        mock_enqueue.assert_called_once()
        self.assertEqual(mock_enqueue.call_args.kwargs.get("extra_format"), "9:16")

    def test_public_share_ready_only(self):
        invitation = Invitation.objects.create(
            user=self.user,
            event=self.event,
            language="uz-latn",
            status=InvitationStatus.READY,
            final_image_url="/media/invitations/demo.jpg",
        )
        anon = APIClient()
        res = anon.get(f"/api/v1/public/invitations/{invitation.id}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("image_url", res.data)
        self.assertNotIn("event_data", res.data)

        invitation.status = InvitationStatus.DRAFT
        invitation.save(update_fields=["status"])
        hidden = anon.get(f"/api/v1/public/invitations/{invitation.id}")
        self.assertEqual(hidden.status_code, 404)

    def test_public_unknown_id_is_404(self):
        anon = APIClient()
        res = anon.get(f"/api/v1/public/invitations/{uuid4()}")
        self.assertEqual(res.status_code, 404)
