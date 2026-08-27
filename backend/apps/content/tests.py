from django.test import SimpleTestCase

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
