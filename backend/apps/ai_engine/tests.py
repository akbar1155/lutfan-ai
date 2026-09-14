from django.test import SimpleTestCase
from PIL import Image, ImageDraw

from apps.ai_engine.fonts import SERIF_BOLD_PATHS, SERIF_PATHS, load_font
from apps.ai_engine.layout import (
    analyze_safe_region,
    clear_safe_text_area,
    render_invitation_layout,
    wrap_text,
    _base_sizes,
    _clamp_sizes,
)
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
        self.assertGreaterEqual(guarded.x0, int(2400 * 0.185))
        self.assertLessEqual(guarded.y1, int(3000 * (1 - 0.220)))

    def test_safe_area_washes_invading_florals_not_center_paper(self):
        paper = (250, 244, 232)
        floral = (40, 90, 55)
        img = Image.new("RGB", (2400, 3000), paper)
        draw = ImageDraw.Draw(img)
        # Dark floral blobs that overlap the type column (as in production cards).
        draw.ellipse((60, 1980, 920, 2920), fill=floral)
        draw.ellipse((1480, 1980, 2340, 2920), fill=floral)
        draw.ellipse((80, 40, 720, 620), fill=floral)
        safe = analyze_safe_region(img, corner_guard=True)
        out = clear_safe_text_area(img, safe, corner_guard=True)
        cx, cy = 1200, 1500
        self.assertEqual(out.getpixel((cx, cy))[:3], paper)
        # Footer-zone floral that sat inside the type column must be washed toward paper.
        sample = out.getpixel((safe.x0 + 120, safe.y1 - 80))[:3]
        self.assertGreater(sum(sample), sum(floral) + 120)

    def test_safe_area_washes_pale_gold_filigree_under_type(self):
        """JPG templates often paint gold rules through the body — wash them out."""
        paper = (248, 242, 228)
        gold = (196, 168, 110)
        img = Image.new("RGB", (2400, 3000), paper)
        draw = ImageDraw.Draw(img)
        for y in (980, 1120, 1680, 1820):
            draw.line((520, y, 1880, y), fill=gold, width=3)
            draw.line((520, y + 10, 1880, y + 10), fill=gold, width=2)
        safe = analyze_safe_region(img, corner_guard=False)
        out = clear_safe_text_area(img, safe, corner_guard=False)
        sample = out.getpixel((1200, 980))[:3]
        # Gold hairline must move clearly toward paper so glyphs stay readable.
        self.assertGreater(sum(sample), sum(gold) + 80)
        dist_to_paper = sum(abs(a - b) for a, b in zip(sample, paper))
        dist_to_gold = sum(abs(a - b) for a, b in zip(sample, gold))
        self.assertLess(dist_to_paper, dist_to_gold)

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

    def test_sana_line_is_not_split_on_date_hyphen(self):
        from apps.ai_engine.layout import parse_schedule_blocks

        rows = parse_schedule_blocks("Sana: 10-sentabr\nVaqt: 17:00", "uz-latn")
        blob = "\n".join(f"{r['label']} {r['line']}" for r in rows)
        self.assertIn("10-sentabr", blob.replace("\u2011", "-"))
        self.assertNotIn("Sana: 10", [r["label"] for r in rows])

    def test_date_and_address_stay_near_body_size(self):
        sizes = _clamp_sizes(_base_sizes(1488, dense=True), 1488)
        self.assertGreaterEqual(sizes["date"], int(sizes["body"] * 0.90))
        self.assertGreaterEqual(sizes["address"], int(sizes["body"] * 0.88))
        crushed = _clamp_sizes(
            {
                "header": 40,
                "body": 50,
                "date": 10,
                "address": 10,
                "host": 40,
            },
            1488,
        )
        self.assertGreaterEqual(crushed["date"], int(crushed["body"] * 0.90))
        self.assertGreaterEqual(crushed["address"], int(crushed["body"] * 0.88))

    def test_dense_card_meta_fonts_match_body(self):
        img = Image.new("RGB", (2400, 3000), (252, 247, 236))
        out = render_invitation_layout(
            img,
            {
                "header": "Hurmatli va e‘zozli mehmonimiz!",
                "body": (
                    "Sizni va oila a‘zolaringizni xonadonimizdagi qutlug‘ ayyom, "
                    "farzandlarimizning muqaddas nikoh to‘yi munosabati bilan "
                    "yozilayotgan shukuhli dasturxonimizga taklif etamiz. Ushbu "
                    "quvonchli va mas’uliyatli onlarda yonimizda bo‘lib, "
                    "yoshlarimizning baxtiyor kelajagiga ezgu tilaklar bildirishingiz "
                    "biz uchun ulkan sharafdir."
                ),
                "date_time": "Sana: 10-sentabr\nVaqt: 17:00",
                "address": "Manzil: Yakkasaroy, Tergachi",
                "footer": "Yuksak ehtirom ila, Israilovlar oilasi",
            },
            language="uz-latn",
            corner_guard=True,
        )
        self.assertEqual(out.size, (2400, 3000))


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

    def test_build_text_blocks_keeps_edited_nikoh_footer(self):
        class Event:
            slug = "nikoh"
            subtypes = [
                {"slug": "nikoh_oqshomi", "names": {"uz-latn": "Nikoh oqshomi"}},
            ]

        class Inv:
            language = "uz-latn"
            event = Event()
            event_id = "nikoh"
            subtype_slug = "nikoh_oqshomi"
            subtype_slugs = ["nikoh_oqshomi"]
            event_data = {
                "final_text_blocks": {
                    "header": "EDITED HEADER",
                    "body": "EDITED BODY for the invitation card.",
                    "date_time": "Custom sana: 21-sentabr, soat 19:00",
                    "address": "Navruz Hall, Toshkent",
                    "footer": "EDITED FOOTER — custom closing",
                },
                "structured_fields": {
                    "family_signature": "Karimov",
                    "event_date": "2026-09-21",
                    "event_time": "19:00",
                    "venue_name": "Navruz Hall",
                    "venue_address": "Toshkent",
                },
                "ceremony_schedule": {
                    "nikoh_oqshomi": {"date": "2026-09-21", "time": "19:00"},
                    "maslahat_oshi": {"date": "2026-09-20", "time": "11:00"},
                },
            }

        blocks = build_text_blocks(Inv())
        self.assertEqual(blocks["header"], "EDITED HEADER")
        self.assertIn("EDITED BODY", blocks["body"])
        self.assertIn("EDITED FOOTER", blocks["footer"])
        self.assertNotIn("Karimovlar", blocks["footer"])
        self.assertIn("Custom sana", blocks["date_time"])
        self.assertIn("Navruz Hall", blocks["address"])

    def test_build_text_blocks_keeps_cleared_date_time_empty(self):
        """Edit → clear sana/vaqt → regenerate must not restore Ma'lumotlar date."""

        class Event:
            slug = "hudoyi"
            subtypes = []

        class Inv:
            language = "uz-latn"
            event = Event()
            event_id = "hudoyi"
            subtype_slug = None
            subtype_slugs = []
            event_data = {
                "final_text_blocks": {
                    "header": "Assalomu alaykum!",
                    "body": "Hudoyi dasturxoniga taklif etamiz.",
                    "date_time": "",
                    "address": "Asr toyxonasi",
                    "footer": "Yuksak ehtirom ila, Tohirovlar oilasi",
                },
                "structured_fields": {
                    "event_date": "2026-09-16",
                    "event_time": "07:00",
                    "venue_name": "Asr toyxonasi",
                    "venue_address": "Zafar diyor 119",
                    "family_signature": "Tohirov",
                },
            }

        blocks = build_text_blocks(Inv())
        self.assertEqual(blocks["date_time"], "")
        self.assertNotIn("07:00", blocks["date_time"])

    def test_build_text_blocks_keeps_cleared_address_and_footer_empty(self):
        """Edit → clear Manzil / Yakun → regenerate must not restore Ma'lumotlar."""

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
                    "header": "",
                    "body": "",
                    "date_time": "",
                    "address": "",
                    "footer": "",
                },
                "structured_fields": {
                    "child_name": "Sardor",
                    "event_date": "2026-09-16",
                    "event_time": "07:00",
                    "venue_name": "Asr toyxonasi",
                    "venue_address": "dcac",
                    "family_signature": "Muroodov",
                },
            }

        blocks = build_text_blocks(Inv())
        self.assertEqual(blocks["header"], "")
        self.assertEqual(blocks["body"], "")
        self.assertEqual(blocks["date_time"], "")
        self.assertEqual(blocks["address"], "")
        self.assertEqual(blocks["footer"], "")

    def test_build_text_blocks_fills_address_footer_when_keys_omitted(self):
        """First generate without edit keys still uses Ma'lumotlar venue / imzo."""

        class Event:
            slug = "nikoh"
            subtypes = []

        class Inv:
            language = "uz-latn"
            event = Event()
            event_id = "nikoh"
            subtype_slug = None
            subtype_slugs = []
            event_data = {
                "final_text_blocks": {
                    "header": "Assalomu alaykum!",
                    "body": "Sizni nikoh to‘yimizga taklif etamiz.",
                },
                "structured_fields": {
                    "venue_name": "Asr toyxonasi",
                    "venue_address": "Toshkent",
                    "family_signature": "Karimov",
                },
            }

        blocks = build_text_blocks(Inv())
        self.assertIn("Asr toyxonasi", blocks["address"])
        self.assertIn("Toshkent", blocks["address"])
        self.assertIn("Karimov", blocks["footer"])
        self.assertIn("Yuksak ehtirom ila", blocks["footer"])


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
                    # date_time omitted → auto-build from ceremony_schedule
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


class GuestRequestPromptTests(SimpleTestCase):
    def test_guest_request_is_mandatory_in_modules(self):
        from apps.ai_engine.prompts import compose_design_modules

        text = compose_design_modules(
            event_slug="nikoh",
            fmt="4:5",
            multi=False,
            subtype_label="",
            mood="gold frame",
            preset={
                "style": "classic",
                "decoration": "floral",
                "frame": "ornamental",
                "palette": "emerald_gold",
                "density": "luxury",
            },
            user_request="Mercedes belgisi bo‘lsin",
        )
        self.assertIn("Mercedes belgisi", text)
        self.assertIn("GUEST REQUEST", text)
        self.assertIn("highest visual priority", text)

    def test_negative_drops_logo_ban_when_guest_asks(self):
        from apps.ai_engine.prompts import (
            DEFAULT_NEGATIVE,
            relax_negative_for_guest_request,
        )

        neg = relax_negative_for_guest_request(
            DEFAULT_NEGATIVE, "mers mashina belgisi"
        )
        self.assertNotIn("logo", neg.lower())
        untouched = relax_negative_for_guest_request(DEFAULT_NEGATIVE, "")
        self.assertIn("logo", untouched.lower())

