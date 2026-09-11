from django.core.management.base import BaseCommand

from apps.backup.scheduler import run_scheduler_forever


class Command(BaseCommand):
    help = "Run the backup cron scheduler loop (used by the backup Docker service)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--poll-seconds",
            type=int,
            default=20,
            help="How often to evaluate BACKUP_SCHEDULE (default: 20).",
        )

    def handle(self, *args, **options):
        run_scheduler_forever(poll_seconds=int(options["poll_seconds"]))
