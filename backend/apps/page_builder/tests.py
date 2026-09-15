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

        published = self.client.post(
            f"/api/v1/pages/{page_id}/publish",
            {
                "familySignature": "Tohirov",
                "personName": "Malika",
                "venueName": "Navruz hall",
            },
            format="json",
        )
        self.assertEqual(published.status_code, 200, published.content)
        self.assertEqual(published.json()["status"], "published")
        self.assertEqual(published.json()["personName"], "Malika")
        self.assertEqual(published.json()["venueName"], "Navruz hall")
        self.assertEqual(published.json()["familySignature"], "Tohirov")
        self.assertEqual(published.json()["eventSlug"], "nikoh")
        self.assertIn("nikoh_oqshomi", published.json()["subtypeSlugs"])

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

    def test_prompt_keeps_text_font_unless_asked(self):
        design = heuristic_design_from_prompt(
            "Gulli ramka, relyef qog‘oz, suzuvchi gullar",
            {"font": "classic", "flower": "rose"},
        )
        self.assertEqual(design["font"], "classic")
        self.assertEqual(design["frame"], "floral")

    def test_prompt_changes_font_when_shrift_is_named(self):
        design = heuristic_design_from_prompt(
            "Nafis shrift qo‘llang",
            {"font": "minimal"},
        )
        self.assertEqual(design["font"], "elegant")

    def test_publish_requires_fields(self):
        created = self.client.post("/api/v1/pages", {}, format="json")
        page_id = created.json()["id"]
        published = self.client.post(f"/api/v1/pages/{page_id}/publish", {}, format="json")
        self.assertEqual(published.status_code, 400)

    def test_aqiqa_publish_requires_child_fields(self):
        created = self.client.post(
            "/api/v1/pages",
            {
                "eventSlug": "aqiqa",
                "mainText": "Aqiqa dasturxoni",
                "date": "2026-10-10",
                "time": "10:00",
                "familySignature": "Tohirov",
                "venueName": "Uy",
                "address": "Toshkent",
            },
            format="json",
        )
        page_id = created.json()["id"]
        missing = self.client.post(f"/api/v1/pages/{page_id}/publish", {}, format="json")
        self.assertEqual(missing.status_code, 400)
        published = self.client.post(
            f"/api/v1/pages/{page_id}/publish",
            {"childName": "Sardor", "childGender": "boy"},
            format="json",
        )
        self.assertEqual(published.status_code, 200, published.content)
        self.assertEqual(published.json()["eventSlug"], "aqiqa")
        self.assertEqual(published.json()["childName"], "Sardor")

    def test_custom_title_is_kept(self):
        created = self.client.post(
            "/api/v1/pages",
            {
                "eventSlug": "aqiqa",
                "title": "Assalomu alaykum!",
                "mainText": "Aqiqa dasturxoni",
                "date": "2026-10-10",
                "time": "10:00",
                "familySignature": "Tohirov",
                "childName": "Sardor",
                "childGender": "boy",
                "venueName": "Uy",
                "address": "Toshkent",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        page_id = created.json()["id"]
        self.assertEqual(created.json()["title"], "Assalomu alaykum!")
        saved = self.client.patch(
            f"/api/v1/pages/{page_id}",
            {"childName": "Sardorbek"},
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.content)
        self.assertEqual(saved.json()["title"], "Assalomu alaykum!")
        self.assertEqual(saved.json()["childName"], "Sardorbek")

    def test_nikoh_schedule_saved_on_publish(self):
        created = self.client.post(
            "/api/v1/pages",
            {
                "eventSlug": "nikoh",
                "subtypeSlugs": ["nikoh_oqshomi", "nahorgi_osh"],
                "mainText": "Sizni nikoh to‘yimizga taklif etamiz.",
                "familySignature": "Tohirov",
                "venueName": "Navruz hall",
                "address": "Toshkent",
                "ceremonySchedule": {
                    "nikoh_oqshomi": {"date": "2026-10-10", "time": "18:00"},
                    "nahorgi_osh": {"date": "2026-10-11", "time": "07:00"},
                },
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        page_id = created.json()["id"]
        published = self.client.post(f"/api/v1/pages/{page_id}/publish", {}, format="json")
        self.assertEqual(published.status_code, 200, published.content)
        body = published.json()
        self.assertEqual(body["subtypeSlugs"], ["nikoh_oqshomi", "nahorgi_osh"])
        self.assertEqual(body["ceremonySchedule"]["nahorgi_osh"]["time"], "07:00")
        self.assertEqual(body["date"], "2026-10-10")
        self.assertEqual(body["time"], "18:00")

    def test_ready_text_id_roundtrip(self):
        created = self.client.post(
            "/api/v1/pages",
            {"readyTextId": "warm1", "mainText": "Samimiy taklif matni."},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.json()["readyTextId"], "warm1")
        self.assertEqual(created.json()["mainText"], "Samimiy taklif matni.")

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
