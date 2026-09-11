from __future__ import annotations

import logging
import time
from pathlib import Path

logger = logging.getLogger("apps.backup")


def prune_local_backups(directory: Path, retention_days: int) -> int:
    if retention_days < 0:
        return 0
    if not directory.exists():
        return 0
    cutoff = time.time() - retention_days * 86400
    removed = 0
    for path in directory.glob("*.dump.enc"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink(missing_ok=True)
                removed += 1
        except OSError as exc:
            logger.warning("Failed to prune %s: %s", path.name, exc)
    if removed:
        logger.info("Pruned %s local backup file(s)", removed)
    return removed
