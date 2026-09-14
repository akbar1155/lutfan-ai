from django.db import migrations


SLUGS = ("burgundy", "beige")


def hide_tags(apps, schema_editor):
    MoodTag = apps.get_model("content", "MoodTag")
    MoodTag.objects.filter(slug__in=SLUGS).update(is_active=False)


def show_tags(apps, schema_editor):
    MoodTag = apps.get_model("content", "MoodTag")
    MoodTag.objects.filter(slug__in=SLUGS).update(is_active=True)


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0006_add_more_mood_colors"),
    ]

    operations = [
        migrations.RunPython(hide_tags, show_tags),
    ]
