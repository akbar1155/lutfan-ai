from django.test import SimpleTestCase

from apps.content.management.commands.seed_data import EVENTS
from apps.content.subtypes import event_subtype_mode, normalize_invitation_subtypes
from apps.content.template_assets import EVENT_TEMPLATE_PICKS, design_meta


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
