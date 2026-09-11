from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .config import parse_postgres_dsn, sanitize_error

logger = logging.getLogger("apps.backup")


@dataclass(frozen=True)
class DumpResult:
    path: Path
    size_bytes: int


class DumpError(RuntimeError):
    pass


def run_pg_dump(database_url: str, output_path: Path) -> DumpResult:
    dsn = parse_postgres_dsn(database_url)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    cmd = [
        "pg_dump",
        "-Fc",
        "-h",
        dsn["host"],
        "-p",
        dsn["port"],
        "-U",
        dsn["user"] or "postgres",
        "-d",
        dsn["dbname"],
        "-f",
        str(output_path),
    ]
    env = os.environ.copy()
    if dsn["password"]:
        env["PGPASSWORD"] = dsn["password"]
    env.setdefault("PGCONNECT_TIMEOUT", "30")

    logger.info("Database dump started")
    try:
        completed = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=60 * 30,
        )
    except FileNotFoundError as exc:
        raise DumpError("pg_dump is not installed in this environment") from exc
    except subprocess.TimeoutExpired as exc:
        raise DumpError("pg_dump timed out") from exc

    if completed.returncode != 0:
        err = sanitize_error(completed.stderr or completed.stdout or "pg_dump failed")
        raise DumpError(f"pg_dump failed: {err}")

    validate_dump(output_path)
    size = output_path.stat().st_size
    logger.info("Database dump completed (%s bytes)", size)
    return DumpResult(path=output_path, size_bytes=size)


def validate_dump(path: Path) -> None:
    if not path.exists():
        raise DumpError("Dump file was not created")
    size = path.stat().st_size
    if size <= 0:
        raise DumpError("Dump file is empty (0 bytes)")

    # Custom-format archives start with 'PGDMP'
    header = path.read_bytes()[:5]
    if header != b"PGDMP":
        raise DumpError("Dump file is not a valid pg_dump custom archive")

    if not shutil.which("pg_restore"):
        logger.warning("pg_restore not found; skipped TOC validation")
        return

    listed = subprocess.run(
        ["pg_restore", "-l", str(path)],
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )
    if listed.returncode != 0:
        err = sanitize_error(listed.stderr or listed.stdout or "pg_restore -l failed")
        raise DumpError(f"Dump integrity check failed: {err}")
    if not (listed.stdout or "").strip():
        raise DumpError("Dump archive TOC is empty")
    logger.info("Validation completed")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
