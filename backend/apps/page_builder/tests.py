from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.page_builder.ai_design import heuristic_design_from_prompt
from apps.page_builder.catalog import sanitize_design_config
from apps.page_builder.models import InvitationPage, InvitationPageStatus

User = get_user_model()


class PageBuilderApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            telegram_id=92001, first_name="PageBuilder"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_draft_and_publish_public_slug(self):
        created = self.client.post(
            "/api/v1/pages",
            {
                "title": "Nikoh to‘yi",
                "mainText": "Sizni nikoh to‘yimizga taklif etamiz.",
                "date": "2026-10-10",
                "time": "18:00",
                "address": "Toshkent, Navruz hall",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        page_id = created.json()["id"]
        slug = created.json()["slug"]
        self.assertEqual(created.json()["status"], "draft")

        public = self.client.get(f"/api/v1/public/pages/{slug}")
        self.assertEqual(public.status_code, 404)

        published = self.client.post(f"/api/v1/pages/{page_id}/publish", {}, format="json")
        self.assertEqual(published.status_code, 200, published.content)
        self.assertEqual(published.json()["status"], "published")

        guest = APIClient()
        visible = guest.get(f"/api/v1/public/pages/{slug}")
        self.assertEqual(visible.status_code, 200)
        body = visible.json()
        self.assertEqual(body["title"], "Nikoh to‘yi")
        self.assertEqual(body["mainText"], "Sizni nikoh to‘yimizga taklif etamiz.")
        self.assertNotIn("designPrompt", body)

    def test_unknown_design_values_are_dropped(self):
        clean = sanitize_design_config(
            {"primaryColor": "neon", "pattern": "oriental", "html": "<script>"}
        )
        self.assertEqual(clean["primaryColor"], "ivory")
        self.assertEqual(clean["pattern"], "oriental")
        self.assertNotIn("html", clean)

    def test_prompt_does_not_change_copy_fields(self):
        design = heuristic_design_from_prompt(
            "Juda nafis va premium, o‘zbekona sharqona naqshlar, oltin rang, fon juda ochiq."
        )
        self.assertEqual(design["pattern"], "uzbek-national")
        self.assertEqual(design["primaryColor"], "ivory")
        self.assertEqual(design["frame"], "gold-ornamental")

    def test_publish_requires_fields(self):
        created = self.client.post("/api/v1/pages", {}, format="json")
        page_id = created.json()["id"]
        published = self.client.post(f"/api/v1/pages/{page_id}/publish", {}, format="json")
        self.assertEqual(published.status_code, 400)

    def test_owner_isolation(self):
        other = User.objects.create_user(
            telegram_id=92002, first_name="Other"
        )
        page = InvitationPage.objects.create(
            user=other,
            title="Private",
            main_text="Matn",
            status=InvitationPageStatus.DRAFT,
        )
        resp = self.client.get(f"/api/v1/pages/{page.id}")
        self.assertEqual(resp.status_code, 404)
