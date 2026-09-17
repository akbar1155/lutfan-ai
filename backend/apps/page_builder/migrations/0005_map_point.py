from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("page_builder", "0004_ready_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitationpage",
            name="map_lat",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="map_lng",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
