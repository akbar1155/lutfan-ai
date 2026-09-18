#!/usr/bin/env python3
"""
Database Restore Script for Lutfan AI
Decrypts and restores encrypted PostgreSQL backup files.

Usage:
    python scripts/restore_backup.py <encrypted_file.dump.enc>

Environment variables required:
    BACKUP_ENCRYPTION_KEY - The encryption key (64-char hex)
    DATABASE_URL - Target database URL (postgresql://...)
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def derive_encryption_key(raw_key: str) -> bytes:
    """Convert raw encryption key to 32-byte key."""
    import hashlib
    import re

    value = (raw_key or "").strip()
    if not value:
        raise ValueError("BACKUP_ENCRYPTION_KEY is not set")

    # Try hex format (64 hex chars = 32 bytes)
    if re.fullmatch(r"[0-9a-fA-F]{64}", value):
        return bytes.fromhex(value)

    # Try base64 format
    try:
        import base64
        padded = value + "=" * (-len(value) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode("ascii"))
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass

    # Fallback: hash the key
    return hashlib.sha256(value.encode("utf-8")).digest()


def decrypt_file(src: Path, dest: Path, key: bytes) -> None:
    """Decrypt an encrypted backup file."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    MAGIC = b"LUTFAN1\n"
    NONCE_LEN = 12

    if len(key) != 32:
        raise ValueError("Encryption key must be 32 bytes")

    print(f"📖 Reading encrypted file: {src}")
    data = src.read_bytes()

    if not data.startswith(MAGIC):
        raise ValueError("Invalid encrypted backup header (not a LUTFAN1 file)")

    body = data[len(MAGIC):]
    nonce = body[:NONCE_LEN]
    ciphertext = body[NONCE_LEN:]

    print("🔓 Decrypting...")
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)

    dest.write_bytes(plaintext)
    print(f"✅ Decrypted to: {dest} ({len(plaintext)} bytes)")


def parse_postgres_dsn(database_url: str) -> dict:
    """Parse PostgreSQL connection URL."""
    from urllib.parse import unquote, urlparse

    if not database_url:
        raise ValueError("DATABASE_URL is empty")

    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must be postgresql://")

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


def restore_dump(dump_file: Path, database_url: str, drop_existing: bool = False) -> None:
    """Restore PostgreSQL dump to database."""
    dsn = parse_postgres_dsn(database_url)

    # Build pg_restore command
    cmd = [
        "pg_restore",
        "--verbose",
        "--no-owner",
        "--no-acl",
        "-h", dsn["host"],
        "-p", dsn["port"],
        "-U", dsn["user"] or "postgres",
        "-d", dsn["dbname"],
    ]

    if drop_existing:
        cmd.extend(["--clean", "--if-exists"])

    cmd.append(str(dump_file))

    env = os.environ.copy()
    if dsn["password"]:
        env["PGPASSWORD"] = dsn["password"]

    print(f"\n🔄 Restoring to database: {dsn['dbname']} on {dsn['host']}:{dsn['port']}")
    print(f"   User: {dsn['user'] or 'postgres'}")

    if drop_existing:
        print("   ⚠️  --clean mode: existing objects will be dropped first!")
        confirm = input("\n   Type 'yes' to continue: ")
        if confirm.lower() != "yes":
            print("❌ Restore cancelled.")
            sys.exit(1)

    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=False,
            text=True,
            check=False,
        )

        if result.returncode == 0:
            print("\n✅ Database restored successfully!")
        else:
            print(f"\n⚠️  pg_restore finished with warnings (exit code {result.returncode})")
            print("   This is often normal for partial restores or permission issues.")

    except FileNotFoundError:
        print("❌ Error: pg_restore is not installed")
        sys.exit(1)
    except Exception as exc:
        print(f"❌ Error during restore: {exc}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Restore encrypted Lutfan AI database backup"
    )
    parser.add_argument(
        "encrypted_file",
        type=Path,
        help="Path to encrypted backup file (*.dump.enc)"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Drop existing database objects before restore (DANGEROUS!)"
    )
    parser.add_argument(
        "--keep-decrypted",
        action="store_true",
        help="Keep the decrypted dump file after restore"
    )

    args = parser.parse_args()

    # Check dependencies
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        print("❌ Error: cryptography library not installed")
        print("   Run: pip install cryptography")
        sys.exit(1)

    # Get encryption key
    encryption_key_raw = os.environ.get("BACKUP_ENCRYPTION_KEY", "")
    if not encryption_key_raw:
        print("❌ Error: BACKUP_ENCRYPTION_KEY environment variable not set")
        sys.exit(1)

    # Get database URL
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("❌ Error: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Check input file
    if not args.encrypted_file.exists():
        print(f"❌ Error: File not found: {args.encrypted_file}")
        sys.exit(1)

    print("=" * 70)
    print("  Lutfan AI Database Restore")
    print("=" * 70)

    try:
        # Derive encryption key
        key = derive_encryption_key(encryption_key_raw)

        # Decrypt
        decrypted_file = args.encrypted_file.with_suffix('.dump')
        decrypt_file(args.encrypted_file, decrypted_file, key)

        # Validate dump
        print("\n🔍 Validating dump file...")
        header = decrypted_file.read_bytes()[:5]
        if header != b"PGDMP":
            print("❌ Error: Decrypted file is not a valid PostgreSQL dump")
            sys.exit(1)
        print("✅ Dump file is valid")

        # Restore
        restore_dump(decrypted_file, database_url, drop_existing=args.clean)

    finally:
        # Cleanup decrypted file unless --keep-decrypted
        if decrypted_file.exists() and not args.keep_decrypted:
            print(f"\n🧹 Cleaning up decrypted file...")
            decrypted_file.unlink()

    print("\n" + "=" * 70)
    print("  Restore completed!")
    print("=" * 70)


if __name__ == "__main__":
    main()
