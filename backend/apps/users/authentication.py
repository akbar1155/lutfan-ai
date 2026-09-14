import logging

from rest_framework_simplejwt.authentication import JWTAuthentication

from .last_seen import touch_user_last_seen

logger = logging.getLogger(__name__)


class LastSeenJWTAuthentication(JWTAuthentication):
    """JWT auth that records last_seen_at (throttled) for admin activity."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result
        try:
            touch_user_last_seen(getattr(user, "id", None))
        except Exception:
            logger.exception("Failed to touch last_seen_at for user %s", getattr(user, "id", None))
        return user, validated_token
