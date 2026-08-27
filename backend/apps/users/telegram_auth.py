import hashlib
import hmac
import time
from typing import Any

from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed


def verify_telegram_login(data: dict[str, Any]) -> dict[str, Any]:
    """Validate Telegram Login Widget payload per Telegram docs."""
    received_hash = data.get("hash")
    if not received_hash:
        raise AuthenticationFailed("Missing Telegram hash")

    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        raise AuthenticationFailed("TELEGRAM_BOT_TOKEN is not configured")

    check_dict = {k: v for k, v in data.items() if k != "hash" and v is not None}
    data_check_string = "\n".join(f"{k}={check_dict[k]}" for k in sorted(check_dict))
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed, received_hash):
        raise AuthenticationFailed("Invalid Telegram hash")

    auth_date = int(check_dict.get("auth_date", 0))
    if auth_date < int(time.time()) - 86400:
        raise AuthenticationFailed("Telegram auth_date expired")

    return check_dict


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
