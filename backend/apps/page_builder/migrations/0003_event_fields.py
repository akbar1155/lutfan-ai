from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("page_builder", "0002_event_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitationpage",
            name="event_slug",
            field=models.CharField(blank=True, default="nikoh", max_length=32),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="subtype_slugs",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="child_name",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="child_gender",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="ceremony_schedule",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="display_lang",
            field=models.CharField(blank=True, default="uz-latn", max_length=16),
        ),
    ]
