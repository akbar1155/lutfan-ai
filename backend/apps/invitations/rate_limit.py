from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled

from .models import GenerationRateLimit

LIMITS_CACHE_KEY = "generation_rate_limits_v1"


def get_generation_limits() -> tuple[int, int]:
    """Return (per_hour, per_day). 0 means unlimited."""
    cached = cache.get(LIMITS_CACHE_KEY)
    if isinstance(cached, (list, tuple)) and len(cached) == 2:
        return int(cached[0] or 0), int(cached[1] or 0)
    try:
        obj = GenerationRateLimit.get_solo()
        hour_max = int(obj.per_hour or 0)
        day_max = int(obj.per_day or 0)
    except Exception:
        hour_max = int(getattr(settings, "RATE_LIMIT_GENERATIONS_PER_HOUR", 0) or 0)
        day_max = int(getattr(settings, "RATE_LIMIT_GENERATIONS_PER_DAY", 0) or 0)
    cache.set(LIMITS_CACHE_KEY, (hour_max, day_max), timeout=120)
    return hour_max, day_max


def invalidate_generation_limits_cache() -> None:
    cache.delete(LIMITS_CACHE_KEY)


def check_generation_rate_limit(user_id: str) -> None:
    hour_max, day_max = get_generation_limits()
    if hour_max <= 0 and day_max <= 0:
        return

    hour_key = f"gen_limit:hour:{user_id}"
    day_key = f"gen_limit:day:{user_id}"
    hour_count = cache.get(hour_key, 0)
    day_count = cache.get(day_key, 0)

    if hour_max > 0 and hour_count >= hour_max:
        raise Throttled(
            detail={
                "code": "GENERATION_HOURLY_LIMIT",
                "message": "Generation hourly limit exceeded",
                "limit": hour_max,
            }
        )
    if day_max > 0 and day_count >= day_max:
        raise Throttled(
            detail={
                "code": "GENERATION_DAILY_LIMIT",
                "message": "Generation daily limit exceeded",
                "limit": day_max,
            }
        )

    if hour_max > 0:
        cache.set(hour_key, hour_count + 1, timeout=3600)
    if day_max > 0:
        cache.set(day_key, day_count + 1, timeout=86400)
