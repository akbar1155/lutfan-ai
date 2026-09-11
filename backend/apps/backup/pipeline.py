from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import (
    BackupSettings,
    derive_encryption_key,
    human_size,
    load_backup_settings,
    sanitize_error,
)
from .crypto import encrypt_file
from .dump import run_pg_dump, sha256_file
from .lock import BackupLock, BackupLockError
from .notify import (
    TelegramNotifyError,
    format_failure_message,
    format_success_caption,
    send_document,
    send_message,
)
from .retention import prune_local_backups

logger = logging.getLogger("apps.backup")


@dataclass
class BackupRunResult:
    ok: bool
    stage: str
    message: str
    filename: str | None = None
    sha256: str | None = None
    size_bytes: int | None = None


def run_backup(*, force: bool = False, cfg: BackupSettings | None = None) -> BackupRunResult:
    settings = cfg or load_backup_settings()
    tz = ZoneInfo(settings.timezone)
    now = datetime.now(tz)
    date_label = now.strftime("%d.%m.%Y")
    time_label = now.strftime("%H:%M")
    stamp = now.strftime("%Y-%m-%d_%H-%M-%S")
    workdir = Path(settings.workdir)
    lock_path = workdir / "backup.lock"
    stage = "init"
    temp_paths: list[Path] = []

    if not force and not settings.enabled:
        logger.info("Backup skipped (BACKUP_ENABLED=false)")
        return BackupRunResult(ok=True, stage="skipped", message="BACKUP_ENABLED=false")

    try:
        with BackupLock(lock_path):
            logger.info("Backup started")
            workdir.mkdir(parents=True, exist_ok=True)

            stage = "config"
            if not settings.database_url:
                raise RuntimeError("PostgreSQL DATABASE_URL is required for backup")
            if not settings.encryption_key:
                raise RuntimeError("BACKUP_ENCRYPTION_KEY is not configured")
            if not settings.bot_token:
                raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
            if not settings.chat_id:
                raise RuntimeError(
                    "TELEGRAM_BACKUP_CHAT_ID is not configured "
                    "(your personal Telegram chat id)"
                )

            key = derive_encryption_key(settings.encryption_key)
            dump_name = f"lutfan_database_{stamp}.dump"
            enc_name = f"{dump_name}.enc"
            dump_path = workdir / dump_name
            enc_path = workdir / enc_name
            temp_paths.extend([dump_path, enc_path])

            stage = "Database Dump"
            dump = run_pg_dump(settings.database_url, dump_path)

            stage = "Encryption"
            logger.info("Encryption started")
            encrypt_file(dump_path, enc_path, key)
            # Remove plaintext dump ASAP
            dump_path.unlink(missing_ok=True)
            if dump_path in temp_paths:
                temp_paths.remove(dump_path)
            logger.info("Encryption completed")

            stage = "Checksum"
            digest = sha256_file(enc_path)
            size = enc_path.stat().st_size
            logger.info("SHA256 generated")

            stage = "Telegram Upload"
            caption = format_success_caption(
                project=settings.project_name,
                when_date=date_label,
                when_time=time_label,
                timezone=settings.timezone,
                size_bytes=size,
                filename=enc_name,
                sha256=digest,
            )
            logger.info("Telegram upload started")
            send_document(settings.bot_token, settings.chat_id, enc_path, caption)
            logger.info("Telegram upload completed")

            if settings.keep_local:
                local_dir = Path(settings.local_dir)
                local_dir.mkdir(parents=True, exist_ok=True)
                target = local_dir / enc_name
                shutil.copy2(enc_path, target)
                prune_local_backups(local_dir, settings.retention_days)
                logger.info("Local encrypted copy kept at %s", target.name)

            stage = "Cleanup"
            _cleanup(temp_paths)
            temp_paths.clear()
            logger.info("Temporary files removed")
            logger.info("Backup completed successfully (%s)", human_size(size))
            return BackupRunResult(
                ok=True,
                stage="done",
                message="ok",
                filename=enc_name,
                sha256=digest,
                size_bytes=size,
            )
    except BackupLockError as exc:
        logger.warning("%s", exc)
        return BackupRunResult(ok=False, stage="lock", message=str(exc))
    except Exception as exc:
        err = sanitize_error(exc)
        logger.exception("Backup failed at stage=%s", stage)
        _notify_failure(settings, date_label, time_label, stage, err)
        _cleanup(temp_paths)
        return BackupRunResult(ok=False, stage=stage, message=err)


def _notify_failure(
    settings: BackupSettings,
    date_label: str,
    time_label: str,
    stage: str,
    error: str,
) -> None:
    if not settings.bot_token or not settings.chat_id:
        logger.error("Cannot send failure DM: Telegram not configured")
        return
    text = format_failure_message(
        project=settings.project_name,
        when_date=date_label,
        when_time=time_label,
        stage=stage,
        error=error,
    )
    try:
        send_message(settings.bot_token, settings.chat_id, text)
    except TelegramNotifyError as notify_exc:
        logger.error("Failure DM failed: %s", sanitize_error(notify_exc))


def _cleanup(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
