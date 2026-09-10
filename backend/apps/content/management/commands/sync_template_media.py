"""Download public MinIO template objects into MEDIA_ROOT for /media/ serving."""

from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.ai_engine.storage import _s3_client
from apps.content.models import Template

TOKEN_RE = re.compile(r"^templates/[0-9a-f]{32}/(bg|preview)\.jpe?g$", re.I)
S3_RE = re.compile(r"^s3://[^/]+/(.+)$")


class Command(BaseCommand):
    help = "Mirror public template objects from MinIO into MEDIA_ROOT"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List keys that would be synced",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        keys: set[str] = set()

        for url in Template.objects.values_list("bg_url", "bg_url_preview"):
            for item in url:
                if not item:
                    continue
                if item.startswith("/media/"):
                    keys.add(item[len("/media/") :])
                    continue
                match = S3_RE.match(item)
                if match:
                    keys.add(match.group(1))

        try:
            client = _s3_client()
            bucket = settings.AWS_STORAGE_BUCKET_NAME_PUBLIC
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket, Prefix="templates/"):
                for obj in page.get("Contents") or []:
                    key = obj["Key"]
                    if TOKEN_RE.match(key) or key.startswith("templates/"):
                        keys.add(key)
        except Exception as exc:
            self.stdout.write(f"S3 list skipped: {exc}")

        synced = 0
        skipped = 0
        missing = 0
        for key in sorted(keys):
            dest = Path(settings.MEDIA_ROOT) / key
            if dest.is_file() and dest.stat().st_size > 0:
                skipped += 1
                continue
            if dry_run:
                self.stdout.write(f"would sync {key}")
                synced += 1
                continue
            try:
                client = _s3_client()
                bucket = settings.AWS_STORAGE_BUCKET_NAME_PUBLIC
                dest.parent.mkdir(parents=True, exist_ok=True)
                client.download_file(bucket, key, str(dest))
                self.stdout.write(self.style.SUCCESS(f"synced {key}"))
                synced += 1
            except Exception as exc:
                missing += 1
                self.stdout.write(f"miss {key}: {exc}")

        verb = "would sync" if dry_run else "synced"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {synced}; already local {skipped}; missing {missing}"
            )
        )
