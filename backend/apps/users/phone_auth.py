"""Phone number normalize + synthetic helpers for password auth."""

from __future__ import annotations

import re

# Stored form: +998XXXXXXXXX (Uzbekistan mobile).
_DIGITS = re.compile(r"\D+")


def normalize_phone(raw: str | None) -> str | None:
    if raw is None:
        return None
    digits = _DIGITS.sub("", str(raw).strip())
    if not digits:
        return None

    if digits.startswith("998") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+998{digits[1:]}"
    if len(digits) == 9 and digits[0] == "9":
        return f"+998{digits}"
    if digits.startswith("998") and len(digits) > 12:
        return None
    if str(raw).strip().startswith("+") and len(digits) >= 10:
        # Allow other E.164 if already international.
        return f"+{digits}"
    return None


def phone_is_valid_uz(phone: str | None) -> bool:
    if not phone:
        return False
    return bool(re.fullmatch(r"\+998\d{9}", phone))
