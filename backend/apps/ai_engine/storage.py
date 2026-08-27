from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from django.conf import settings


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        region_name=settings.AWS_S3_REGION_NAME,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


def _parse_s3_url(url: str) -> tuple[str, str] | None:
    """Return (bucket, key) from stored S3/MinIO URL."""
    if not url or url.startswith("/media/"):
        return None
    parsed = urlparse(url)
    path = parsed.path.lstrip("/")
    if not path:
        return None
    parts = path.split("/", 1)
    if len(parts) != 2:
        return None
    bucket, key = parts
    if bucket not in (
        settings.AWS_STORAGE_BUCKET_NAME_PUBLIC,
        settings.AWS_STORAGE_BUCKET_NAME_PRIVATE,
    ):
        return None
    return bucket, key


def generate_presigned_url(bucket: str, key: str, expires: int = 3600) -> str:
    client = _s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )


def upload_bytes(
    data: bytes,
    key: str,
    *,
    content_type: str = "image/jpeg",
    private: bool = True,
) -> str:
    bucket = (
        settings.AWS_STORAGE_BUCKET_NAME_PRIVATE
        if private
        else settings.AWS_STORAGE_BUCKET_NAME_PUBLIC
    )
    local_fallback = Path(settings.MEDIA_ROOT) / key
    try:
        client = _s3_client()
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        # Store canonical internal URL (resolved at read time)
        return f"s3://{bucket}/{key}"
    except Exception:
        local_fallback.parent.mkdir(parents=True, exist_ok=True)
        local_fallback.write_bytes(data)
        return f"/media/{key}"


def _as_relative_media(url: str) -> str | None:
    """Keep /media/ same-origin so Vite (dev) and frontend nginx (prod) can proxy it."""
    if url.startswith("/media/"):
        return url
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https") and parsed.path.startswith("/media/"):
        return parsed.path
    return None


def resolve_media_url(url: str | None, *, expires: int = 3600) -> str | None:
    """Turn stored URL into a browser-accessible URL."""
    if not url:
        return None

    relative = _as_relative_media(url)
    if relative:
        return relative

    if url.startswith("s3://"):
        # s3://bucket/key
        match = re.match(r"s3://([^/]+)/(.+)", url)
        if not match:
            return url
        bucket, key = match.group(1), match.group(2)
        try:
            return generate_presigned_url(bucket, key, expires=expires)
        except Exception:
            return url

    parsed = _parse_s3_url(url)
    if parsed:
        bucket, key = parsed
        try:
            if bucket == settings.AWS_STORAGE_BUCKET_NAME_PUBLIC:
                return f"{settings.CDN_BASE_URL.rstrip('/')}/{key}"
            return generate_presigned_url(bucket, key, expires=expires)
        except Exception:
            return url

    return url
