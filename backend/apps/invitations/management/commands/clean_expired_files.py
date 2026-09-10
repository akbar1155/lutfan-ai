import re
from datetime import timedelta

import boto3
from botocore.client import Config
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.invitations.models import Invitation, RenderedFile


class Command(BaseCommand):
    help = "Delete expired invitation files from S3 and soft-delete invitations"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Delete invitations expired more than N days ago (default: 7)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        days_buffer = options["days"]
        cutoff = timezone.now() - timedelta(days=days_buffer)

        expired_invitations = Invitation.objects.filter(
            Q(expires_at__lt=cutoff) & Q(deleted_at__isnull=True)
        )

        count = expired_invitations.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No expired invitations to clean"))
            return

        self.stdout.write(f"Found {count} expired invitation(s)")

        s3_client = self._get_s3_client()
        deleted_files = 0
        deleted_invitations = 0

        for invitation in expired_invitations.iterator():
            self.stdout.write(f"Processing invitation {invitation.id}...")

            rendered_files = RenderedFile.objects.filter(
                invitation=invitation, deleted_at__isnull=True
            )

            for rf in rendered_files:
                if self._delete_s3_file(s3_client, rf.url, dry_run):
                    deleted_files += 1
                    if not dry_run:
                        rf.deleted_at = timezone.now()
                        rf.save(update_fields=["deleted_at"])

            if not dry_run:
                invitation.deleted_at = timezone.now()
                invitation.save(update_fields=["deleted_at"])
            deleted_invitations += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Would delete {deleted_files} file(s) and soft-delete {deleted_invitations} invitation(s)"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted {deleted_files} file(s) and soft-deleted {deleted_invitations} invitation(s)"
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
