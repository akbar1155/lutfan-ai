"""Hide orphan recoveries that still carry placeholder "Restored …" names."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.content.models import Template


class Command(BaseCommand):
    help = (
        "Deactivate Template rows whose theme_name starts with 'Restored ' "
        "so they no longer appear in the public JPG picker."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many rows would be deactivated",
        )

    def handle(self, *args, **options):
        qs = Template.objects.filter(
            theme_name__istartswith="Restored ",
            is_active=True,
        )
        count = qs.count()
        if options["dry_run"]:
            self.stdout.write(f"would deactivate {count} restored template(s)")
            for row in qs.order_by("theme_name")[:30]:
                self.stdout.write(f"  - {row.theme_name} ({row.id})")
            return

        updated = qs.update(is_active=False)
        self.stdout.write(
            self.style.SUCCESS(f"deactivated {updated} restored template(s)")
        )
