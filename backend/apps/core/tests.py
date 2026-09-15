from django.test import SimpleTestCase

from apps.core.dates import (
    fix_cyrillic_month_spelling,
    format_display_date,
    format_dates_in_text,
)


class CyrillicMonthTests(SimpleTestCase):
    def test_uzbek_cyrillic_uses_standard_september(self):
        self.assertEqual(format_display_date("2026-09-16", "uz-cyrl"), "16-сентябрь")

    def test_other_cyrillic_months_use_soft_sign(self):
        self.assertEqual(format_display_date("2026-01-05", "uz-cyrl"), "5-январь")
        self.assertEqual(format_display_date("2026-10-01", "uz-cyrl"), "1-октябрь")
        self.assertEqual(format_display_date("2026-06-12", "uz-cyrl"), "12-июнь")

    def test_misspelled_months_are_rewritten(self):
        self.assertEqual(
            fix_cyrillic_month_spelling("Сана: 16-сентабр"),
            "Сана: 16-сентябрь",
        )
        self.assertEqual(
            format_dates_in_text("Сана: 16-сентабр", "uz-cyrl"),
            "Сана: 16-сентябрь",
        )

    def test_russian_genitive_months_unchanged(self):
        self.assertEqual(format_display_date("2026-09-16", "ru"), "16 сентября")
