from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("page_builder", "0003_event_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitationpage",
            name="ready_text_id",
            field=models.CharField(blank=True, default="classic1", max_length=32),
        ),
        migrations.AlterField(
            model_name="invitationpage",
            name="main_text",
            field=models.TextField(blank=True, default=""),
        ),
    ]
