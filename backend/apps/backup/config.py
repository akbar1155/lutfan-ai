from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from django.conf import settings


SECRET_PATTERNS = (
    re.compile(r"(?i)(password|passwd|pwd)\s*[:=]\s*\S+"),
    re.compile(r"(?i)(token|api[_-]?key|secret|encryption[_-]?key)\s*[:=]\s*\S+"),
    re.compile(r"postgresql://[^/\s]+"),
    re.compile(r"(?i)bot\d+:[A-Za-z0-9_-]{20,}"),
)


def sanitize_error(message: object) -> str:
    text = str(message or "Unknown error")
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    text = re.sub(r":[^:@/\s]+@", ":[REDACTED]@", text)
    return text[:500]


@dataclass(frozen=True)
class BackupSettings:
    enabled: bool
    schedule: str
    timezone: str
    bot_token: str
    chat_id: str
    encryption_key: str
    keep_local: bool
    retention_days: int
    project_name: str
    workdir: str
    local_dir: str
    database_url: str


def _database_url_from_django() -> str:
    raw = os.environ.get("DATABASE_URL", "").strip()
    if raw:
        return raw

    db = settings.DATABASES["default"]
    engine = str(db.get("ENGINE") or "")
    if "postgresql" not in engine and "psycopg" not in engine:
        return ""
    user = unquote(str(db.get("USER") or ""))
    password = unquote(str(db.get("PASSWORD") or ""))
    host = str(db.get("HOST") or "localhost")
    port = str(db.get("PORT") or "5432")
    name = str(db.get("NAME") or "")
    if password:
        auth = f"{user}:{password}@"
    elif user:
        auth = f"{user}@"
    else:
        auth = ""
    return f"postgresql://{auth}{host}:{port}/{name}"


def load_backup_settings() -> BackupSettings:
    return BackupSettings(
        enabled=bool(getattr(settings, "BACKUP_ENABLED", False)),
        schedule=str(getattr(settings, "BACKUP_SCHEDULE", "0 21 * * *") or "0 21 * * *"),
        timezone=str(getattr(settings, "BACKUP_TIMEZONE", "Asia/Tashkent") or "Asia/Tashkent"),
        bot_token=str(getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""),
        chat_id=str(getattr(settings, "TELEGRAM_BACKUP_CHAT_ID", "") or "").strip(),
        encryption_key=str(getattr(settings, "BACKUP_ENCRYPTION_KEY", "") or ""),
        keep_local=bool(getattr(settings, "BACKUP_KEEP_LOCAL", False)),
        retention_days=int(getattr(settings, "BACKUP_LOCAL_RETENTION_DAYS", 2) or 2),
        project_name=str(getattr(settings, "BACKUP_PROJECT_NAME", "Lutfan AI") or "Lutfan AI"),
        workdir=str(getattr(settings, "BACKUP_WORKDIR", "/tmp/lutfan-backups") or "/tmp/lutfan-backups"),
        local_dir=str(getattr(settings, "BACKUP_LOCAL_DIR", "/var/lutfan-backups") or "/var/lutfan-backups"),
        database_url=_database_url_from_django(),
    )


def parse_postgres_dsn(database_url: str) -> dict[str, str]:
    if not database_url:
        raise ValueError("DATABASE_URL is empty")
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("Backup requires PostgreSQL DATABASE_URL")
    dbname = (parsed.path or "/").lstrip("/")
    if not dbname:
        raise ValueError("DATABASE_URL missing database name")
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "dbname": dbname,
    }


def derive_encryption_key(raw_key: str) -> bytes:
    value = (raw_key or "").strip()
    if not value:
        raise ValueError("BACKUP_ENCRYPTION_KEY is not configured")
    if re.fullmatch(r"[0-9a-fA-F]{64}", value):
        return bytes.fromhex(value)
    try:
        import base64

        padded = value + "=" * (-len(value) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode("ascii"))
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    return hashlib.sha256(value.encode("utf-8")).digest()


def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            if unit == "B":
                return f"{int(size)} {unit}"
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{num_bytes} B"
