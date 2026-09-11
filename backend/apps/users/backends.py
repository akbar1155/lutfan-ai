from __future__ import annotations

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class UsernameOrTelegramBackend(ModelBackend):
    """Allow Django admin / session login with username or telegram_id."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if not username or password is None:
            return None

        raw = str(username).strip()
        user = (
            User.objects.filter(username__iexact=raw).order_by("-updated_at").first()
            if raw
            else None
        )
        if user is None:
            try:
                tg_id = int(raw)
            except (TypeError, ValueError):
                tg_id = None
            if tg_id is not None:
                user = User.objects.filter(telegram_id=tg_id).first()

        if user is None:
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
