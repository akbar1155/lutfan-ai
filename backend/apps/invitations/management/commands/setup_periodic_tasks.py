from django.core.management.base import BaseCommand
from django_celery_beat.models import CrontabSchedule, PeriodicTask


class Command(BaseCommand):
    help = "Setup periodic tasks for scheduled jobs (cron jobs)"

    def handle(self, *args, **options):
        self.stdout.write("Setting up periodic tasks...")

        schedule_3am, _ = CrontabSchedule.objects.get_or_create(
            minute="0",
            hour="3",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone="UTC",
        )

        schedule_4am, _ = CrontabSchedule.objects.get_or_create(
            minute="0",
            hour="4",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone="UTC",
        )

        schedule_10am, _ = CrontabSchedule.objects.get_or_create(
            minute="0",
            hour="10",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone="UTC",
        )

        PeriodicTask.objects.update_or_create(
            name="Clean Expired Files",
            defaults={
                "task": "invitations.clean_expired_files",
                "crontab": schedule_3am,
                "enabled": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("✓ Clean Expired Files (daily at 03:00 UTC)"))

        PeriodicTask.objects.update_or_create(
            name="Rebuild Daily Metrics",
            defaults={
                "task": "invitations.rebuild_daily_metrics",
                "crontab": schedule_4am,
                "enabled": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("✓ Rebuild Daily Metrics (daily at 04:00 UTC)"))

        PeriodicTask.objects.update_or_create(
            name="Notify Expiring Soon",
            defaults={
                "task": "invitations.notify_expiring_soon",
                "crontab": schedule_10am,
                "enabled": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("✓ Notify Expiring Soon (daily at 10:00 UTC)"))

        PeriodicTask.objects.update_or_create(
            name="Clean AI Cache",
            defaults={
                "task": "invitations.clean_ai_cache",
                "crontab": schedule_3am,
                "enabled": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("✓ Clean AI Cache (daily at 03:00 UTC)"))

        self.stdout.write(self.style.SUCCESS("\nAll periodic tasks configured!"))
        self.stdout.write(
            "Run 'python manage.py migrate' to apply django_celery_beat migrations"
        )
