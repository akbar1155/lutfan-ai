from django.core.management.base import BaseCommand, CommandError

from apps.backup.pipeline import run_backup


class Command(BaseCommand):
    help = (
        "Run a full DB backup now: dump → validate → encrypt → SHA256 → "
        "Telegram DM → cleanup. Works even when BACKUP_ENABLED=false."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            default=True,
            help="Ignored (manual runs always force). Kept for CLI clarity.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting manual database backup…")
        result = run_backup(force=True)
        if not result.ok:
            raise CommandError(f"Backup failed at {result.stage}: {result.message}")
        self.stdout.write(
            self.style.SUCCESS(
                f"Backup OK file={result.filename} sha256={result.sha256}"
            )
        )
