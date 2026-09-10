import re
from datetime import timedelta

import boto3
from botocore.client import Config
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.ai_engine.models import AIGenerationCache


class Command(BaseCommand):
    help = "Clean up old AI generation cache entries with hit_count=1"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=60,
            help="Delete cache entries older than N days with hit_count=1 (default: 60)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        days_old = options["days"]
        cutoff = timezone.now() - timedelta(days=days_old)

        old_cache_entries = AIGenerationCache.objects.filter(
            hit_count=1, created_at__lt=cutoff
        )

        count = old_cache_entries.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No old cache entries to clean"))
            return

        self.stdout.write(f"Found {count} old cache entry/entries with hit_count=1")

        s3_client = self._get_s3_client()
        deleted_files = 0
        deleted_entries = 0

        for entry in old_cache_entries.iterator():
            if self._delete_s3_file(s3_client, entry.result_url, dry_run):
                deleted_files += 1

            if not dry_run:
                entry.delete()
            deleted_entries += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Would delete {deleted_files} file(s) and {deleted_entries} cache entry/entries"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted {deleted_files} file(s) and {deleted_entries} cache entry/entries"
                )
            )

    def _get_s3_client(self):
        return boto3.client(
            "s3",
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            region_name=settings.AWS_S3_REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )

    def _delete_s3_file(self, client, url: str, dry_run: bool) -> bool:
        """Delete file from S3, return True if successful or would be successful."""
        if not url or url.startswith("/media/"):
            return False

        if url.startswith("s3://"):
            match = re.match(r"s3://([^/]+)/(.+)", url)
            if not match:
                return False
            bucket, key = match.group(1), match.group(2)
        else:
            from urllib.parse import urlparse

            parsed = urlparse(url)
            path = parsed.path.lstrip("/")
            if not path:
                return False
            parts = path.split("/", 1)
            if len(parts) != 2:
                return False
            bucket, key = parts

        if bucket not in (
            settings.AWS_STORAGE_BUCKET_NAME_PUBLIC,
            settings.AWS_STORAGE_BUCKET_NAME_PRIVATE,
        ):
            return False

        if dry_run:
            self.stdout.write(f"  Would delete s3://{bucket}/{key}")
            return True

        try:
            client.delete_object(Bucket=bucket, Key=key)
            self.stdout.write(f"  Deleted s3://{bucket}/{key}")
            return True
        except Exception as e:
            self.stderr.write(f"  Failed to delete s3://{bucket}/{key}: {e}")
            return False
