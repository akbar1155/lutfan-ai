from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.ai_engine.storage import resolve_media_url


@override_settings(
    MEDIA_ROOT="/tmp/lutfan-media-test",
    AWS_STORAGE_BUCKET_NAME_PUBLIC="lutfan-public",
    AWS_STORAGE_BUCKET_NAME_PRIVATE="lutfan-private",
    CDN_BASE_URL="https://lutfanai.uz/s3",
    AWS_S3_ENDPOINT_URL="http://minio:9000",
)
class ResolveMediaUrlTests(SimpleTestCase):
    def test_relative_media_unchanged(self):
        self.assertEqual(
            resolve_media_url("/media/templates/demo.jpg"),
            "/media/templates/demo.jpg",
        )

    def test_public_s3_uses_cdn(self):
        self.assertEqual(
            resolve_media_url("s3://lutfan-public/templates/abc/bg.jpg"),
            "https://lutfanai.uz/s3/templates/abc/bg.jpg",
        )

    def test_local_file_preferred_over_cdn(self):
        root = Path("/tmp/lutfan-media-test")
        key = "templates/localpref/bg.jpg"
        path = root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"jpg")
        try:
            self.assertEqual(
                resolve_media_url(f"s3://lutfan-public/{key}"),
                f"/media/{key}",
            )
        finally:
            path.unlink(missing_ok=True)

    @patch("apps.ai_engine.storage.generate_presigned_url")
    def test_private_s3_presigns(self, mock_presign):
        mock_presign.return_value = "http://minio:9000/signed"
        self.assertEqual(
            resolve_media_url("s3://lutfan-private/gens/x.png"),
            "http://minio:9000/signed",
        )
        mock_presign.assert_called_once()
