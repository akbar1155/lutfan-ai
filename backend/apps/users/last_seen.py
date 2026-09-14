"""Track authenticated user presence for admin “last activity”."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

# Avoid writing the DB on every API call.
TOUCH_INTERVAL_SECONDS = 60
# Treat as currently online in the admin list.
ONLINE_WINDOW_SECONDS = 5 * 60


def touch_user_last_seen(user_id) -> None:
    """Persist last_seen_at at most once per TOUCH_INTERVAL_SECONDS.

    Uses a DB compare so Redis/locmem cache cannot freeze a stale timestamp.
    """
    if not user_id:
        return
    now = timezone.now()
    cutoff = now - timedelta(seconds=TOUCH_INTERVAL_SECONDS)
    from .models import User

    User.objects.filter(pk=user_id).filter(
        Q(last_seen_at__isnull=True) | Q(last_seen_at__lte=cutoff)
    ).update(last_seen_at=now)


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
    last_session_at=None,
    created_at=None,
):
    """Pick the newest trustworthy activity timestamp (never updated_at)."""
    candidates = [
        last_seen_at,
        last_login_at,
        last_login,
        last_invitation_at,
        last_session_at,
        created_at,
    ]
    present = [c for c in candidates if c is not None]
    if not present:
        return None
    return max(present)


def is_currently_online(activity_at, *, now=None) -> bool:
    if activity_at is None:
        return False
    current = now or timezone.now()
    try:
        delta = current - activity_at
    except TypeError:
        return False
    return delta <= timedelta(seconds=ONLINE_WINDOW_SECONDS)
