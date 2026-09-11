from __future__ import annotations

import logging
import time
from pathlib import Path

import requests

from .config import human_size, sanitize_error

logger = logging.getLogger("apps.backup")

TELEGRAM_API = "https://api.telegram.org"
MAX_FILE_BYTES = 49 * 1024 * 1024  # stay under Bot API ~50MB soft limit


class TelegramNotifyError(RuntimeError):
    pass


def _api(token: str, method: str) -> str:
    return f"{TELEGRAM_API}/bot{token}/{method}"


def send_message(token: str, chat_id: str, text: str) -> None:
    if not token or not chat_id:
        raise TelegramNotifyError("Telegram bot token or chat id is not configured")
    _request_with_retry(
        "sendMessage",
        lambda: requests.post(
            _api(token, "sendMessage"),
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
            timeout=60,
        ),
    )


def send_document(
    token: str,
    chat_id: str,
    file_path: Path,
    caption: str,
) -> None:
    if not token or not chat_id:
        raise TelegramNotifyError("Telegram bot token or chat id is not configured")
    size = file_path.stat().st_size
    if size > MAX_FILE_BYTES:
        raise TelegramNotifyError(
            f"Backup file too large for Telegram Bot API ({human_size(size)}; max ~50 MB)"
        )

    def do_send():
        with file_path.open("rb") as fh:
            return requests.post(
                _api(token, "sendDocument"),
                data={"chat_id": chat_id, "caption": caption[:1024]},
                files={"document": (file_path.name, fh)},
                timeout=300,
            )

    _request_with_retry("sendDocument", do_send)


def _request_with_retry(stage: str, factory) -> None:
    delays = (0, 30, 60)
    last_error = "unknown"
    for attempt, delay in enumerate(delays, start=1):
        if delay:
            logger.info("Telegram %s retry in %ss (attempt %s)", stage, delay, attempt)
            time.sleep(delay)
        try:
            response = factory()
        except requests.RequestException as exc:
            last_error = sanitize_error(exc)
            logger.warning("Telegram %s network error: %s", stage, last_error)
            continue
        if response.status_code == 200:
            payload = response.json() if response.content else {}
            if payload.get("ok"):
                return
            last_error = sanitize_error(payload.get("description") or response.text)
        else:
            last_error = sanitize_error(f"HTTP {response.status_code}: {response.text}")
        logger.warning("Telegram %s failed: %s", stage, last_error)
    raise TelegramNotifyError(f"{stage} failed after retries: {last_error}")


def format_success_caption(
    *,
    project: str,
    when_date: str,
    when_time: str,
    timezone: str,
    size_bytes: int,
    filename: str,
    sha256: str,
) -> str:
    return (
        "🗄 DATABASE BACKUP\n\n"
        f"Project: {project}\n"
        "Database: PostgreSQL\n\n"
        f"Date: {when_date}\n"
        f"Time: {when_time}\n"
        f"Timezone: {timezone}\n\n"
        f"Size: {human_size(size_bytes)}\n"
        "Status: SUCCESS\n\n"
        f"File:\n{filename}\n\n"
        f"SHA256:\n{sha256}\n\n"
        "Backup completed successfully.\n"
        "Sent to your private chat only."
    )


def format_failure_message(
    *,
    project: str,
    when_date: str,
    when_time: str,
    stage: str,
    error: str,
) -> str:
    return (
        "🚨 DATABASE BACKUP FAILED\n\n"
        f"Project: {project}\n"
        f"Date: {when_date}\n"
        f"Time: {when_time}\n\n"
        f"Stage:\n{stage}\n\n"
        f"Error:\n{sanitize_error(error)}\n\n"
        "Backup was NOT uploaded."
    )
