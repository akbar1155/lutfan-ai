"""Recreate Template rows for admin JPG uploads still in MinIO/media.

Admin uploads live at templates/<32hex>/bg.jpg. When seed_data historically
deleted DB rows, the files often remained. This command re-attaches them.
"""

from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.ai_engine.storage import _s3_client
from apps.content.models import EventConfig, Template
from apps.users.models import Role, User

TOKEN_RE = re.compile(r"^templates/([0-9a-f]{32})/(bg|preview)\.jpe?g$", re.I)


class Command(BaseCommand):
    help = "Restore Template DB rows for orphaned admin uploads in storage"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List orphans without creating rows",
        )
        parser.add_argument(
            "--event",
            default="aqiqa",
            help="Event slug for recovered templates (default: aqiqa)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        event_slug = options["event"]
        event = EventConfig.objects.filter(slug=event_slug).first()
        if event is None:
            event = EventConfig.objects.order_by("sort_order").first()
        if event is None:
            self.stderr.write("No EventConfig found; cannot recover templates.")
            return

        admin = User.objects.filter(role=Role.ADMIN).order_by("created_at").first()
        if admin is None:
            admin = User.objects.order_by("created_at").first()
        if admin is None:
            self.stderr.write("No user found for created_by_admin.")
            return

        tokens = self._discover_tokens()
        existing_urls = set(
            Template.objects.values_list("bg_url", flat=True)
        ) | set(Template.objects.values_list("bg_url_preview", flat=True))

        created = 0
        skipped = 0
        for token, paths in sorted(tokens.items()):
            bg_key = paths.get("bg")
            if not bg_key:
                skipped += 1
                continue
            bg_url = self._store_url(bg_key)
            preview_key = paths.get("preview") or bg_key
            preview_url = self._store_url(preview_key)
            if any(bg_url in u or token in (u or "") for u in existing_urls):
                skipped += 1
                continue
            if Template.objects.filter(bg_url__contains=token).exists():
                skipped += 1
                continue

            theme_name = f"Restored {token[:8]}"
            if dry_run:
                self.stdout.write(f"would restore {token} -> {event.slug}")
            else:
                Template.objects.create(
                    event=event,
                    theme_name=theme_name,
                    style_tags=["restored"],
                    color_palette=[],
                    mood_tags=[],
                    bg_url=bg_url,
                    bg_url_preview=preview_url,
                    ai_composition_prompt="Place text elegantly.",
                    supports_dark_text=True,
                    dominant_colors=[],
                    supported_formats=["4:5", "9:16", "1:1"],
                    is_active=True,
                    is_featured=False,
                    created_by_admin=admin,
                )
                self.stdout.write(self.style.SUCCESS(f"restored {token}"))
            created += 1

        verb = "would restore" if dry_run else "restored"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {created} orphan template(s); skipped {skipped}"
            )
        )

    def _store_url(self, key: str) -> str:
        bucket = settings.AWS_STORAGE_BUCKET_NAME_PUBLIC
        # Prefer s3:// form used by upload_bytes; local fallbacks use /media/.
        if key.startswith("/media/"):
            return key
        local = Path(settings.MEDIA_ROOT) / key
        if local.is_file() and not settings.AWS_S3_ENDPOINT_URL:
            return f"/media/{key}"
        return f"s3://{bucket}/{key}"

    def _discover_tokens(self) -> dict[str, dict[str, str]]:
        tokens: dict[str, dict[str, str]] = {}

        # Local media volume
        media = Path(settings.MEDIA_ROOT) / "templates"
        if media.is_dir():
            for path in media.rglob("*"):
                if not path.is_file():
                    continue
                rel = path.relative_to(settings.MEDIA_ROOT).as_posix()
                match = TOKEN_RE.match(rel)
                if not match:
                    continue
                token, kind = match.group(1).lower(), match.group(2).lower()
                tokens.setdefault(token, {})[kind] = rel

        # MinIO / S3
        try:
            client = _s3_client()
            bucket = settings.AWS_STORAGE_BUCKET_NAME_PUBLIC
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket, Prefix="templates/"):
                for obj in page.get("Contents") or []:
                    key = obj["Key"]
                    match = TOKEN_RE.match(key)
                    if not match:
                        continue
                    token, kind = match.group(1).lower(), match.group(2).lower()
                    tokens.setdefault(token, {})[kind] = key
        except Exception as exc:
            self.stdout.write(f"S3 list skipped: {exc}")

        return tokens
