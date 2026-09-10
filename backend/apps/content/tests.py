from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from apps.content.management.commands.seed_data import EVENTS
from apps.content.models import EventConfig, MoodTag, Template, TextTemplate
from apps.content.subtypes import event_subtype_mode, normalize_invitation_subtypes
from apps.content.template_assets import EVENT_TEMPLATE_PICKS, design_meta
from apps.users.models import Role, User


class EventTemplateCatalogTests(SimpleTestCase):
    def test_each_event_has_three_unique_cards(self):
        self.assertGreaterEqual(len(EVENT_TEMPLATE_PICKS), 6)
        featured = []
        all_stems = []
        for slug, picks in EVENT_TEMPLATE_PICKS.items():
            self.assertEqual(len(picks), 3, slug)
            themes = [theme for _key, theme, _tags in picks]
            self.assertEqual(len(themes), len(set(themes)), themes)
            featured.append((slug, picks[0][0], picks[0][1]))
            all_stems.extend(f"{slug}_{key}" for key, _theme, _tags in picks)
            for key, _theme, _tags in picks:
                meta = design_meta(key)
                self.assertTrue(meta["palette"])
                self.assertTrue(meta["look"])
        featured_keys = [item[1] for item in featured]
        self.assertEqual(len(featured_keys), len(set(featured_keys)))
        self.assertEqual(len(all_stems), len(set(all_stems)))


class HayitSubtypeConfigTests(SimpleTestCase):
    def test_hayit_is_single_choice_ramazon_or_qurbon(self):
        hayit = next(item for item in EVENTS if item["slug"] == "hayit")
        slugs = [row["slug"] for row in hayit["subtypes"]]
        self.assertEqual(slugs, ["ramazon_hayiti", "qurbon_hayiti"])
        self.assertEqual(hayit["fields_schema"].get("subtype_mode"), "single")
        self.assertFalse(hayit.get("is_active", True))

    def test_single_mode_keeps_only_one_slug(self):
        event = type(
            "Event",
            (),
            {
                "subtypes": [
                    {"slug": "ramazon_hayiti"},
                    {"slug": "qurbon_hayiti"},
                ],
                "fields_schema": {"subtype_mode": "single"},
            },
        )()
        self.assertEqual(event_subtype_mode(event), "single")
        self.assertEqual(
            normalize_invitation_subtypes(
                event, ["ramazon_hayiti", "qurbon_hayiti"]
            ),
            ["ramazon_hayiti"],
        )
        self.assertEqual(
            normalize_invitation_subtypes(event, ["nope"], "qurbon_hayiti"),
            ["qurbon_hayiti"],
        )


class SeedPreservesCustomTemplatesTests(TestCase):
    def test_seed_does_not_delete_or_deactivate_admin_uploads(self):
        call_command("seed_data")
        admin = User.objects.filter(role=Role.ADMIN).first()
        event = EventConfig.objects.get(slug="aqiqa")
        custom = Template.objects.create(
            event=event,
            theme_name="Admin Upload Custom",
            style_tags=[],
            color_palette=[],
            mood_tags=[],
            bg_url="s3://lutfan-public/templates/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bg.jpg",
            bg_url_preview=(
                "s3://lutfan-public/templates/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/preview.jpg"
            ),
            ai_composition_prompt="Place text elegantly.",
            supports_dark_text=True,
            dominant_colors=[],
            supported_formats=["4:5"],
            is_active=True,
            is_featured=False,
            created_by_admin=admin,
        )
        call_command("seed_data")
        custom.refresh_from_db()
        self.assertTrue(custom.is_active)
        self.assertEqual(custom.theme_name, "Admin Upload Custom")
        self.assertTrue(Template.objects.filter(pk=custom.pk).exists())

    def test_seed_does_not_overwrite_admin_edits(self):
        call_command("seed_data")
        event = EventConfig.objects.get(slug="aqiqa")
        event.name_translations = {"uz-latn": "Custom Aqiqa Name"}
        event.save(update_fields=["name_translations", "updated_at"])

        text = TextTemplate.objects.filter(event=event).first()
        self.assertIsNotNone(text)
        text.preview_text = "ADMIN CUSTOM PREVIEW {host_name}"
        text.save(update_fields=["preview_text", "updated_at"])

        mood = MoodTag.objects.first()
        self.assertIsNotNone(mood)
        mood.is_active = False
        mood.prompt_snippet = "admin-only snippet"
        mood.save(update_fields=["is_active", "prompt_snippet"])

        call_command("seed_data")
        event.refresh_from_db()
        text.refresh_from_db()
        mood.refresh_from_db()
        self.assertEqual(event.name_translations.get("uz-latn"), "Custom Aqiqa Name")
        self.assertEqual(text.preview_text, "ADMIN CUSTOM PREVIEW {host_name}")
        self.assertFalse(mood.is_active)
        self.assertEqual(mood.prompt_snippet, "admin-only snippet")


class SeedPreservesEventActiveFlagTests(TestCase):
    def test_seed_does_not_reactivate_disabled_events(self):
        event = EventConfig.objects.create(
            slug="aqiqa",
            name_translations={"uz-latn": "Aqiqa"},
            fields_schema={},
            is_active=False,
            sort_order=2,
        )
        call_command("seed_data")
        event.refresh_from_db()
        self.assertFalse(event.is_active)
