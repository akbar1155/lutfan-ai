"""Activate or deactivate orphan templates with placeholder "Restored …" names."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.content.models import Template


class Command(BaseCommand):
    help = (
        "Manage Template rows whose theme_name starts with 'Restored '. "
        "Default: deactivate. Use --reactivate to turn them back on."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many rows would change",
        )
        parser.add_argument(
            "--reactivate",
            action="store_true",
            help="Set is_active=True for Restored … templates",
        )

    def handle(self, *args, **options):
        reactivate = bool(options["reactivate"])
        qs = Template.objects.filter(theme_name__istartswith="Restored ")
        if reactivate:
            qs = qs.filter(is_active=False)
            verb = "reactivate"
            next_active = True
        else:
            qs = qs.filter(is_active=True)
            verb = "deactivate"
            next_active = False

        count = qs.count()
        if options["dry_run"]:
            self.stdout.write(f"would {verb} {count} restored template(s)")
            for row in qs.order_by("theme_name")[:30]:
                self.stdout.write(f"  - {row.theme_name} ({row.id})")
            return

        updated = qs.update(is_active=next_active)
        self.stdout.write(self.style.SUCCESS(f"{verb}d {updated} restored template(s)"))
