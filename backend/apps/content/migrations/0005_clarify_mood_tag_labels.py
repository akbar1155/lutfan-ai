from django.db import migrations

# Keep in sync with seed_data.MOOD_TAGS display names / categories.
MOOD_LABELS = {
    "rose_gold": (
        "color",
        {"uz-cyrl": "Олтин", "uz-latn": "Oltin", "ru": "Золотой"},
    ),
    "emerald": (
        "color",
        {"uz-cyrl": "Яшил", "uz-latn": "Yashil", "ru": "Зелёный"},
    ),
    "ivory": (
        "color",
        {"uz-cyrl": "Оқ", "uz-latn": "Oq", "ru": "Белый"},
    ),
    "pink": (
        "color",
        {"uz-cyrl": "Пушти", "uz-latn": "Pushti", "ru": "Розовый"},
    ),
    "burgundy": (
        "color",
        {"uz-cyrl": "Бордо", "uz-latn": "Bordo", "ru": "Бордовый"},
    ),
    "blue": (
        "color",
        {"uz-cyrl": "Кўк", "uz-latn": "Ko‘k", "ru": "Синий"},
    ),
    "beige": (
        "color",
        {"uz-cyrl": "Беж", "uz-latn": "Bej", "ru": "Бежевый"},
    ),
    "silver": (
        "color",
        {"uz-cyrl": "Кумуш", "uz-latn": "Kumush", "ru": "Серебряный"},
    ),
    "bronze": (
        "color",
        {"uz-cyrl": "Бронза", "uz-latn": "Bronza", "ru": "Бронзовый"},
    ),
    "peonies": (
        "flowers",
        {"uz-cyrl": "Катта гуллар", "uz-latn": "Katta gullar", "ru": "Крупные цветы"},
    ),
    "fine_line": (
        "flowers",
        {
            "uz-cyrl": "Чизиқли барглар",
            "uz-latn": "Chiziqli barglar",
            "ru": "Листья линиями",
        },
    ),
    "ornament": (
        "style",
        {"uz-cyrl": "Рамка ва нақш", "uz-latn": "Ramka va naqsh", "ru": "Рамка и узор"},
    ),
    "minimalist": (
        "style",
        {"uz-cyrl": "Минимализм", "uz-latn": "Minimalizm", "ru": "Минимализм"},
    ),
    "velvet": (
        "texture",
        {"uz-cyrl": "Юмшоқ қоғоз", "uz-latn": "Yumshoq qog‘oz", "ru": "Мягкая бумага"},
    ),
    "silk": (
        "texture",
        {"uz-cyrl": "Силлиқ сирт", "uz-latn": "Silliq sirt", "ru": "Гладкая поверхность"},
    ),
    "marble": (
        "texture",
        {"uz-cyrl": "Тош нақшли", "uz-latn": "Tosh naqshli", "ru": "Каменный узор"},
    ),
    "watercolor": (
        "texture",
        {"uz-cyrl": "Бўёқли қоғоз", "uz-latn": "Bo‘yoqli qog‘oz", "ru": "Акварельная бумага"},
    ),
    "linen": (
        "texture",
        {"uz-cyrl": "Матоли сирт", "uz-latn": "Matoli sirt", "ru": "Тканевая текстура"},
    ),
    "pearlescent": (
        "texture",
        {
            "uz-cyrl": "Ялтироқ сирт",
            "uz-latn": "Yaltiroq sirt",
            "ru": "Блестящая поверхность",
        },
    ),
}

RETIRED_MOOD_SLUGS = ("event_rows", "handmade")

NEW_MOOD_SNIPPETS = {
    "pink": "soft dusty pink and blush accents on warm cream paper with delicate metallic highlights",
    "burgundy": "deep burgundy accents with antique gold on warm cream invitation paper",
    "blue": "soft navy and sky-blue accents on cream paper with muted silver-gold highlights",
    "beige": "warm beige and sand tones with soft champagne accents on cream paper",
    "silver": "cool silver metallic frame and accents on soft white cream paper",
    "bronze": "warm bronze and copper metallic accents on cream paper",
}


def forwards(apps, schema_editor):
    MoodTag = apps.get_model("content", "MoodTag")
    for i, (slug, (category, names)) in enumerate(MOOD_LABELS.items()):
        defaults = {
            "category": category,
            "name_translations": names,
            "is_active": True,
            "sort_order": i,
        }
        existing = MoodTag.objects.filter(slug=slug).first()
        if existing is None:
            MoodTag.objects.create(
                slug=slug,
                prompt_snippet=NEW_MOOD_SNIPPETS.get(slug, ""),
                **defaults,
            )
        else:
            for key, value in defaults.items():
                setattr(existing, key, value)
            existing.save()
    MoodTag.objects.filter(slug__in=RETIRED_MOOD_SLUGS).update(is_active=False)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0004_ensure_family_signature_fields"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
