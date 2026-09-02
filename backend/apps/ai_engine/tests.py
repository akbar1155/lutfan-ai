from django.test import SimpleTestCase
from PIL import Image, ImageDraw

from apps.ai_engine.fonts import SERIF_BOLD_PATHS, SERIF_PATHS, load_font
from apps.ai_engine.layout import analyze_safe_region, wrap_text
from apps.ai_engine.prompts import _inject_child_name, _inject_hayit_occasion, build_text_blocks
from apps.ai_engine.spelling import is_junk_field_value, scrub_junk_lines


class FontLoaderTests(SimpleTestCase):
    def test_bundled_serif_is_scalable(self):
        font = load_font(SERIF_BOLD_PATHS, 96)
        self.assertGreaterEqual(int(getattr(font, "size", 0) or 0), 96)
        self.assertGreaterEqual(font.getbbox("A")[3] - font.getbbox("A")[1], 50)
        path = str(getattr(font, "path", "") or "")
        self.assertTrue(path.endswith(".ttf") or path.endswith(".otf"), path)


class JunkFieldTests(SimpleTestCase):
    def test_real_invitation_bodies_are_kept(self):
        samples = [
            "Aziz mehmonimiz, Sizni nikoh to‘yimizga taklif etamiz. "
            "Baxtli kunimizni Siz bilan birga nishonlash biz uchun katta sharaf.",
            "Farzandimizning aqiqa marosimi munosabati bilan "
            "Sizni mehmon bo‘lishga taklif etamiz.",
            "O‘g‘limiz Sardor ning sunnat to‘yi munosabati bilan "
            "Sizni tantanamizga taklif etamiz.",
            "Hayit bayrami munosabati bilan Sizni oilaviy dasturxonimizga taklif etamiz.",
            "Дорогой гость, приглашаем Вас на нашу свадьбу — никах.",
            "Азиз меҳмонимиз, Сизни никоҳ тўйимизга таклиф этамиз.",
        ]
        for text in samples:
            with self.subTest(text=text[:40]):
                self.assertFalse(is_junk_field_value(text), text)
                self.assertTrue(scrub_junk_lines(text))

    def test_placeholder_junk_is_rejected(self):
        for text in ("aaaa", "a, a", "test", "ewd, ewewfwf", "qwerty", "saom, dresw", "dresw", "salomliuy, tergachi"):
            with self.subTest(text=text):
                self.assertTrue(is_junk_field_value(text), text)


class OverlaySafeRegionTests(SimpleTestCase):
    def test_ai_corner_guard_insets_more_than_template(self):
        img = Image.new("RGB", (2400, 3000), (250, 244, 232))
        plain = analyze_safe_region(img, corner_guard=False)
        guarded = analyze_safe_region(img, corner_guard=True)
        self.assertGreater(guarded.y0, plain.y0)
        self.assertGreater(guarded.x0, plain.x0)
        self.assertLess(guarded.y1, plain.y1)

    def test_russian_orphan_last_word_is_merged(self):
        img = Image.new("RGB", (2400, 3000), (250, 244, 232))
        draw = ImageDraw.Draw(img)
        font = load_font(SERIF_PATHS, 48)
        text = (
            "Дорогой гость, искренне приглашаем Вас на нашу свадьбу. "
            "Для нас большая честь разделить этот счастливый день с Вами."
        )
        lines = wrap_text(draw, text, font, 720)
        self.assertTrue(lines)
        last = lines[-1].strip()
        self.assertNotIn(last.lower(), {"нас", "вами.", "вами", "с"})


class ChildNameOverlayTests(SimpleTestCase):
    def test_injects_into_generic_aqiqa_body(self):
        body = "Farzandimizning aqiqa marosimi munosabati bilan taklif etamiz."
        out = _inject_child_name(body, "Sardor", "uz-latn")
        self.assertIn("Sardor", out)
        self.assertNotEqual(out, body)

    def test_build_text_blocks_does_not_use_child_as_footer(self):
        class Event:
            slug = "aqiqa"
            subtypes = []

        class Inv:
            language = "uz-latn"
            event = Event()
            event_id = "aqiqa"
            subtype_slug = None
            subtype_slugs = []
            event_data = {
                "final_text_blocks": {
                    "header": "Assalomu alaykum!",
                    "body": "Farzandimizning aqiqa marosimi munosabati bilan taklif etamiz.",
                    "date_time": "",
                    "address": "Toshkent",
                    "footer": "",
                },
                "structured_fields": {"child_name": "Sardor"},
            }

        blocks = build_text_blocks(Inv())
        self.assertIn("Sardor", blocks["body"])
        self.assertNotEqual(blocks["footer"].lower(), "sardor")


class MultiCeremonyBodyTests(SimpleTestCase):
    def test_build_text_blocks_keeps_full_body_with_schedule(self):
        full_body = (
            "Hayotimizning yangi sahifasi boshlanayotgan nikoh to‘yimizga "
            "Sizni hurmat bilan chorlaymiz. Ushbu qutlug‘ kunda Sizni "
            "mehmonlarimiz safida ko‘rish biz uchun alohida mamnuniyat. "
            "Tashrifingiz bayramimizga yanada ko‘rk bag‘ishlaydi. "
            "Quvonchli daqiqalarimizni birga o‘tkazishni intizorlik bilan kutamiz."
        )

        class Event:
            slug = "nikoh"
            subtypes = [
                {"slug": "maslahat_oshi", "names": {"uz-latn": "Maslahat oshi"}},
                {"slug": "nikoh_oqshomi", "names": {"uz-latn": "Nikoh oqshomi"}},
            ]

        class Inv:
            language = "uz-latn"
            event = Event()
            event_id = "nikoh"
            subtype_slug = None
            subtype_slugs = ["maslahat_oshi", "nikoh_oqshomi"]
            event_data = {
                "final_text_blocks": {
                    "header": "Aziz mehmonlar!",
                    "body": full_body,
                    "date_time": "",
                    "address": "versal, Yubnusabod",
                    "footer": "",
                },
                "structured_fields": {},
                "ceremony_schedule": {
                    "maslahat_oshi": {"date": "2026-09-02", "time": "14:30"},
                    "nikoh_oqshomi": {"date": "2026-09-09", "time": "16:15"},
                },
            }

        blocks = build_text_blocks(Inv())
        # Spelling normalize may tweak casing; content must stay complete.
        self.assertGreaterEqual(len(blocks["body"]), len(full_body) - 20)
        self.assertIn("yangi sahifasi", blocks["body"].lower())
        self.assertIn("alohida mamnuniyat", blocks["body"].lower())
        self.assertIn("ko‘rk bag‘ishlaydi", blocks["body"].lower())
        self.assertIn("intizorlik", blocks["body"].lower())
        self.assertIn("Maslahat oshi", blocks["date_time"])
        self.assertIn("Nikoh oqshomi", blocks["date_time"])


class HayitOccasionOverlayTests(SimpleTestCase):
    def test_generic_hayit_body_becomes_ramazon(self):
        body = "Hayit bayrami munosabati bilan Sizni oilaviy dasturxonimizga taklif etamiz."
        out = _inject_hayit_occasion(body, "Ramazon hayiti")
        self.assertIn("Ramazon hayiti", out)
        self.assertNotIn("Hayit bayrami", out)

    def test_build_text_blocks_uses_qurbon_and_drops_date(self):
        class Event:
            slug = "hayit"
            subtypes = [
                {
                    "slug": "qurbon_hayiti",
                    "names": {"uz-latn": "Qurbon hayiti"},
                }
            ]

        class Inv:
            language = "uz-latn"
            event = Event()
            event_id = "hayit"
            subtype_slug = "qurbon_hayiti"
            subtype_slugs = ["qurbon_hayiti"]
            event_data = {
                "final_text_blocks": {
                    "header": "Assalomu alaykum!",
                    "body": "Hayit bayrami munosabati bilan Sizni taklif etamiz.",
                    "date_time": "12.04.2026, soat 10:00",
                    "address": "Toshkent",
                    "footer": "",
                },
                "structured_fields": {},
            }

        blocks = build_text_blocks(Inv())
        self.assertEqual(blocks["date_time"], "")
        self.assertIn("Qurbon hayiti", blocks["body"])

