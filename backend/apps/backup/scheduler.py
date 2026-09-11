from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from croniter import croniter

from .config import load_backup_settings
from .pipeline import run_backup

logger = logging.getLogger("apps.backup")


def run_scheduler_forever(poll_seconds: int = 20) -> None:
    settings = load_backup_settings()
    tz = ZoneInfo(settings.timezone)
    logger.info(
        "Backup scheduler started schedule=%r timezone=%s enabled=%s",
        settings.schedule,
        settings.timezone,
        settings.enabled,
    )
    # Anchor so we don't fire immediately for a past slot on boot.
    last_fire: datetime | None = datetime.now(tz)
    while True:
        settings = load_backup_settings()
        tz = ZoneInfo(settings.timezone)
        now = datetime.now(tz)
        try:
            cron = croniter(settings.schedule, now)
            prev = cron.get_prev(datetime)
            if prev.tzinfo is None:
                prev = prev.replace(tzinfo=tz)
            else:
                prev = prev.astimezone(tz)
        except (KeyError, ValueError) as exc:
            logger.error("Invalid BACKUP_SCHEDULE %r: %s", settings.schedule, exc)
            time.sleep(60)
            continue

        should_run = (
            settings.enabled
            and prev <= now
            and (last_fire is None or prev > last_fire)
            and (now - prev) <= timedelta(minutes=2)
        )
        if should_run:
            logger.info("Schedule matched at %s — starting backup", now.isoformat())
            result = run_backup(force=False, cfg=settings)
            last_fire = prev
            if not result.ok:
                logger.error("Scheduled backup failed: %s", result.message)
        time.sleep(max(5, poll_seconds))
