from __future__ import annotations

import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


MAGIC = b"LUTFAN1\n"
NONCE_LEN = 12


def encrypt_file(src: Path, dest: Path, key: bytes) -> None:
    if len(key) != 32:
        raise ValueError("Encryption key must be 32 bytes")
    plaintext = src.read_bytes()
    nonce = os.urandom(NONCE_LEN)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    dest.write_bytes(MAGIC + nonce + ciphertext)


def decrypt_file(src: Path, dest: Path, key: bytes) -> None:
    if len(key) != 32:
        raise ValueError("Encryption key must be 32 bytes")
    data = src.read_bytes()
    if not data.startswith(MAGIC):
        raise ValueError("Invalid encrypted backup header")
    body = data[len(MAGIC) :]
    nonce = body[:NONCE_LEN]
    ciphertext = body[NONCE_LEN:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    dest.write_bytes(plaintext)
