from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from apps.backup.config import (
    derive_encryption_key,
    human_size,
    parse_postgres_dsn,
    sanitize_error,
)
from apps.backup.crypto import decrypt_file, encrypt_file
from apps.backup.dump import sha256_file, validate_dump
from apps.backup.lock import BackupLock, BackupLockError
from apps.backup.notify import format_failure_message, format_success_caption
from apps.backup.pipeline import run_backup


class ConfigHelpersTests(SimpleTestCase):
    def test_sanitize_hides_dsn_and_token(self):
        text = sanitize_error(
            "failed postgresql://lutfan:secret@postgres:5432/lutfan token=bot123:ABCDEFGHIJKLMNOPQRSTUV"
        )
        self.assertNotIn("secret", text)
        self.assertNotIn("bot123:", text)
        self.assertIn("[REDACTED]", text)

    def test_parse_dsn(self):
        dsn = parse_postgres_dsn("postgresql://u:p%40ss@db:5433/mydb")
        self.assertEqual(dsn["user"], "u")
        self.assertEqual(dsn["password"], "p@ss")
        self.assertEqual(dsn["host"], "db")
        self.assertEqual(dsn["port"], "5433")
        self.assertEqual(dsn["dbname"], "mydb")

    def test_derive_key_hex_and_passphrase(self):
        hex_key = "ab" * 32
        self.assertEqual(len(derive_encryption_key(hex_key)), 32)
        self.assertEqual(len(derive_encryption_key("my-passphrase")), 32)

    def test_human_size(self):
        self.assertEqual(human_size(500), "500 B")
        self.assertTrue(human_size(5 * 1024 * 1024).endswith("MB"))


class CryptoTests(SimpleTestCase):
    def test_encrypt_decrypt_roundtrip(self):
        key = derive_encryption_key("test-key-please-change")
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "a.dump"
            enc = Path(tmp) / "a.dump.enc"
            out = Path(tmp) / "a.out"
            src.write_bytes(b"PGDMP" + b"\x00" * 100)
            encrypt_file(src, enc, key)
            self.assertTrue(enc.read_bytes().startswith(b"LUTFAN1\n"))
            decrypt_file(enc, out, key)
            self.assertEqual(out.read_bytes(), src.read_bytes())


class LockTests(SimpleTestCase):
    def test_duplicate_lock_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "backup.lock"
            with BackupLock(lock_path):
                with self.assertRaises(BackupLockError):
                    with BackupLock(lock_path):
                        pass


class DumpValidateTests(SimpleTestCase):
    def test_validate_rejects_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.dump"
            path.write_bytes(b"")
            with self.assertRaises(Exception):
                validate_dump(path)

    def test_validate_rejects_non_pgdmp(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.dump"
            path.write_bytes(b"not-a-dump")
            with self.assertRaises(Exception):
                validate_dump(path)

    def test_sha256(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.bin"
            path.write_bytes(b"abc")
            self.assertEqual(
                sha256_file(path),
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            )


class NotifyFormatTests(SimpleTestCase):
    def test_success_caption_mentions_private_chat(self):
        text = format_success_caption(
            project="Lutfan AI",
            when_date="11.09.2026",
            when_time="21:00",
            timezone="Asia/Tashkent",
            size_bytes=1024,
            filename="lutfan_database_2026-09-11_21-00-00.dump.enc",
            sha256="abc",
        )
        self.assertIn("SUCCESS", text)
        self.assertIn("private chat", text.lower())

    def test_failure_message_sanitized(self):
        text = format_failure_message(
            project="Lutfan AI",
            when_date="11.09.2026",
            when_time="21:00",
            stage="Database Dump",
            error="password=supersecret failed",
        )
        self.assertIn("FAILED", text)
        self.assertNotIn("supersecret", text)


@override_settings(
    BACKUP_ENABLED=True,
    BACKUP_ENCRYPTION_KEY="unit-test-key",
    TELEGRAM_BOT_TOKEN="123:ABC",
    TELEGRAM_BACKUP_CHAT_ID="999001",
    BACKUP_WORKDIR="",  # set in test
    BACKUP_KEEP_LOCAL=False,
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "lutfan",
            "USER": "lutfan",
            "PASSWORD": "secret",
            "HOST": "postgres",
            "PORT": "5432",
        }
    },
)
class PipelineTests(SimpleTestCase):
    @patch("apps.backup.pipeline.send_document")
    @patch("apps.backup.pipeline.run_pg_dump")
    def test_pipeline_success(self, mock_dump, mock_send):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(BACKUP_WORKDIR=tmp):
                dump_path = Path(tmp) / "will_be_replaced.dump"

                def fake_dump(url, output_path: Path):
                    output_path.write_bytes(b"PGDMP" + b"\x01" * 64)
                    from apps.backup.dump import DumpResult

                    return DumpResult(path=output_path, size_bytes=output_path.stat().st_size)

                mock_dump.side_effect = fake_dump
                result = run_backup(force=True)
                self.assertTrue(result.ok, result.message)
                mock_send.assert_called_once()
                # plaintext dump must be gone
                leftovers = list(Path(tmp).glob("*.dump"))
                self.assertEqual(leftovers, [])

    @patch("apps.backup.pipeline.send_message")
    @patch("apps.backup.pipeline.run_pg_dump", side_effect=Exception("pg_dump failed"))
    def test_pipeline_failure_notifies(self, _mock_dump, mock_send):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(BACKUP_WORKDIR=tmp):
                result = run_backup(force=True)
                self.assertFalse(result.ok)
                self.assertEqual(result.stage, "Database Dump")
                mock_send.assert_called_once()


if __name__ == "__main__":
    unittest.main()
