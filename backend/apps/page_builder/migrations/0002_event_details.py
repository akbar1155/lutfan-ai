from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("page_builder", "0001_invitation_page"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitationpage",
            name="family_signature",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="person_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="invitationpage",
            name="venue_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
