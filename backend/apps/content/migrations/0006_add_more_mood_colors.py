from django.db import migrations

NEW_COLORS = {
    "pink": (
        "color",
        "soft dusty pink and blush accents on warm cream paper with delicate metallic highlights",
        {"uz-cyrl": "Пушти", "uz-latn": "Pushti", "ru": "Розовый"},
    ),
    "burgundy": (
        "color",
        "deep burgundy accents with antique gold on warm cream invitation paper",
        {"uz-cyrl": "Бордо", "uz-latn": "Bordo", "ru": "Бордовый"},
    ),
    "blue": (
        "color",
        "soft navy and sky-blue accents on cream paper with muted silver-gold highlights",
        {"uz-cyrl": "Кўк", "uz-latn": "Ko‘k", "ru": "Синий"},
    ),
    "beige": (
        "color",
        "warm beige and sand tones with soft champagne accents on cream paper",
        {"uz-cyrl": "Беж", "uz-latn": "Bej", "ru": "Бежевый"},
    ),
    "silver": (
        "color",
        "cool silver metallic frame and accents on soft white cream paper",
        {"uz-cyrl": "Кумуш", "uz-latn": "Kumush", "ru": "Серебряный"},
    ),
    "bronze": (
        "color",
        "warm bronze and copper metallic accents on cream paper",
        {"uz-cyrl": "Бронза", "uz-latn": "Bronza", "ru": "Бронзовый"},
    ),
}


def forwards(apps, schema_editor):
    MoodTag = apps.get_model("content", "MoodTag")
    # Place new colors after existing ones.
    base = MoodTag.objects.filter(category="color").count()
    for i, (slug, (category, snippet, names)) in enumerate(NEW_COLORS.items()):
        existing = MoodTag.objects.filter(slug=slug).first()
        defaults = {
            "category": category,
            "prompt_snippet": snippet,
            "name_translations": names,
            "sort_order": base + i,
            "is_active": True,
        }
        if existing is None:
            MoodTag.objects.create(slug=slug, **defaults)
        else:
            for key, value in defaults.items():
                setattr(existing, key, value)
            existing.save()
    MoodTag.objects.filter(slug__in=("handmade", "event_rows")).update(is_active=False)


def backwards(apps, schema_editor):
    MoodTag = apps.get_model("content", "MoodTag")
    MoodTag.objects.filter(slug__in=NEW_COLORS).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0005_clarify_mood_tag_labels"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
