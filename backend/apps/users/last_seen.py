"""Track authenticated user presence for admin “last activity”."""

from __future__ import annotations

from django.core.cache import cache
from django.utils import timezone

# Avoid writing the DB on every API call.
TOUCH_INTERVAL_SECONDS = 60


def touch_user_last_seen(user_id) -> None:
    if not user_id:
        return
    key = f"user:last_seen_touch:{user_id}"
    if cache.get(key):
        return
    cache.set(key, 1, timeout=TOUCH_INTERVAL_SECONDS)
    from .models import User

    User.objects.filter(pk=user_id).update(last_seen_at=timezone.now())


def mark_user_login(user) -> None:
    """Call on explicit login (Telegram / admin password)."""
    now = timezone.now()
    user.last_login_at = now
    user.last_seen_at = now
    user.save(update_fields=["last_login_at", "last_seen_at", "updated_at"])


def resolve_last_activity_at(
    *,
    last_seen_at=None,
    last_login_at=None,
    last_login=None,
    last_invitation_at=None,
):
    """Pick the newest trustworthy activity timestamp (never updated_at)."""
    candidates = [
        last_seen_at,
        last_login_at,
        last_login,
        last_invitation_at,
    ]
    present = [c for c in candidates if c is not None]
    if not present:
        return None
    return max(present)
