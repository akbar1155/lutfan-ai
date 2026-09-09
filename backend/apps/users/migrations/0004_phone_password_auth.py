from django.db import migrations, models


def blank_phone_to_null(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(phone="").update(phone=None)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_user_last_seen_at"),
    ]

    operations = [
        migrations.RunPython(blank_phone_to_null, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="telegram_id",
            field=models.BigIntegerField(blank=True, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name="user",
            name="phone",
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["phone"], name="users_user_phone_4e31d5_idx"),
        ),
    ]
