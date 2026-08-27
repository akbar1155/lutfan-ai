from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled


def check_generation_rate_limit(user_id: str) -> None:
    # Demo / local: 0 = unlimited
    hour_max = int(getattr(settings, "RATE_LIMIT_GENERATIONS_PER_HOUR", 0) or 0)
    day_max = int(getattr(settings, "RATE_LIMIT_GENERATIONS_PER_DAY", 0) or 0)
    if hour_max <= 0 and day_max <= 0:
        return

    hour_key = f"gen_limit:hour:{user_id}"
    day_key = f"gen_limit:day:{user_id}"
    hour_count = cache.get(hour_key, 0)
    day_count = cache.get(day_key, 0)

    if hour_max > 0 and hour_count >= hour_max:
        raise Throttled(detail="Generation hourly limit exceeded")
    if day_max > 0 and day_count >= day_max:
        raise Throttled(detail="Generation daily limit exceeded")

    if hour_max > 0:
        cache.set(hour_key, hour_count + 1, timeout=3600)
    if day_max > 0:
        cache.set(day_key, day_count + 1, timeout=86400)
