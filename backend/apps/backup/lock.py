from __future__ import annotations

import fcntl
import logging
from pathlib import Path
from types import TracebackType

logger = logging.getLogger("apps.backup")


class BackupLockError(RuntimeError):
    pass


class BackupLock:
    """Exclusive file lock so only one backup runs at a time."""

    def __init__(self, lock_path: Path):
        self.lock_path = lock_path
        self._fh = None

    def __enter__(self) -> "BackupLock":
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self.lock_path, "a+", encoding="utf-8")
        try:
            fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            self._fh.close()
            self._fh = None
            raise BackupLockError("Another backup process is already running") from exc
        self._fh.seek(0)
        self._fh.truncate()
        self._fh.write("locked\n")
        self._fh.flush()
        logger.info("Backup lock acquired")
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        if self._fh is not None:
            try:
                fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            finally:
                self._fh.close()
                self._fh = None
            logger.info("Backup lock released")
