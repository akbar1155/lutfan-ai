from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserSession
from .serializers import (
    TelegramAuthSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)
from .telegram_auth import hash_refresh_token, verify_telegram_login


def _client_meta(request):
    ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    if not ip:
        ip = request.META.get("REMOTE_ADDR")
    ua = request.META.get("HTTP_USER_AGENT", "")
    return ip, ua


def _set_refresh_cookie(response, refresh: RefreshToken) -> None:
    response.set_cookie(
        key="refresh_token",
        value=str(refresh),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        max_age=30 * 24 * 60 * 60,
        path="/api/v1/auth",
    )


def _issue_auth_response(request, user: User) -> Response:
    refresh = RefreshToken.for_user(user)
    ip, ua = _client_meta(request)
    UserSession.objects.create(
        user=user,
        refresh_token_hash=hash_refresh_token(str(refresh)),
        ip_address=ip or None,
        user_agent=ua or None,
        expires_at=timezone.now() + timedelta(days=30),
    )
    response = Response(
        {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            # Body fallback when cross-origin cookies are blocked (localhost vs 127.0.0.1)
            "refresh": str(refresh),
        }
    )
    _set_refresh_cookie(response, refresh)
    return response


def _raw_refresh_token(request) -> str | None:
    raw = request.COOKIES.get("refresh_token")
    if raw:
        return raw
    body = request.data if hasattr(request, "data") else {}
    if isinstance(body, dict):
        token = body.get("refresh")
        if isinstance(token, str) and token.strip():
            return token.strip()
    return None


class TelegramAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = TelegramAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = verify_telegram_login(serializer.validated_data)

        defaults = {
            "first_name": payload.get("first_name") or "User",
            "last_name": payload.get("last_name") or None,
            "username": payload.get("username") or None,
            "photo_url": payload.get("photo_url") or None,
            "last_login_at": timezone.now(),
        }
        user, _created = User.objects.update_or_create(
            telegram_id=int(payload["id"]),
            defaults=defaults,
        )
        if user.is_banned:
            return Response(
                {
                    "error": {
                        "code": "USER_BANNED",
                        "message": user.ban_reason or "Account is banned",
                        "details": {},
                        "request_id": getattr(request, "request_id", None),
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return _issue_auth_response(request, user)


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = _raw_refresh_token(request)
        if not raw:
            return Response(
                {"error": {"code": "NO_REFRESH", "message": "Missing refresh cookie"}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            token = RefreshToken(raw)
            user_id = token.get("user_id")
            user = User.objects.get(id=user_id)
        except Exception:
            return Response(
                {"error": {"code": "INVALID_REFRESH", "message": "Invalid refresh"}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        hashed = hash_refresh_token(raw)
        session = UserSession.objects.filter(
            user=user, refresh_token_hash=hashed, revoked_at__isnull=True
        ).first()
        if not session or session.expires_at < timezone.now():
            return Response(
                {"error": {"code": "SESSION_EXPIRED", "message": "Session expired"}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if user.is_banned:
            return Response(
                {"error": {"code": "USER_BANNED", "message": user.ban_reason or "Banned"}},
                status=status.HTTP_403_FORBIDDEN,
            )

        access = token.access_token
        response = Response({"access": str(access), "user": UserSerializer(user).data})
        _set_refresh_cookie(response, token)
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw = _raw_refresh_token(request)
        if raw:
            UserSession.objects.filter(
                user=request.user,
                refresh_token_hash=hash_refresh_token(raw),
                revoked_at__isnull=True,
            ).update(revoked_at=timezone.now())
        response = Response({"ok": True})
        response.delete_cookie("refresh_token", path="/api/v1/auth")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class DevLoginView(APIView):
    """Local-only login when Telegram bot token is not configured."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        if not settings.ALLOW_DEV_LOGIN:
            return Response(status=status.HTTP_404_NOT_FOUND)

        telegram_id = int(request.data.get("telegram_id", 1001))
        as_admin = bool(request.data.get("as_admin", False))
        user, _ = User.objects.update_or_create(
            telegram_id=telegram_id,
            defaults={
                "first_name": request.data.get("first_name", "Dev User"),
                "username": request.data.get("username", "dev_user"),
                "role": "admin" if as_admin else "user",
                "is_staff": as_admin,
                "is_superuser": as_admin,
                "last_login_at": timezone.now(),
            },
        )
        return _issue_auth_response(request, user)


class AdminPasswordLoginView(APIView):
    """Username/password login for the custom admin panel (shareable credentials)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = str(request.data.get("username") or "").strip()
        password = str(request.data.get("password") or "")
        if not username or not password:
            return Response(
                {
                    "error": {
                        "code": "INVALID_CREDENTIALS",
                        "message": "Username and password are required",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = (
            User.objects.filter(username__iexact=username, is_active=True)
            .order_by("-updated_at")
            .first()
        )
        if (
            user is None
            or not user.is_admin
            or not user.has_usable_password()
            or not user.check_password(password)
        ):
            return Response(
                {
                    "error": {
                        "code": "INVALID_CREDENTIALS",
                        "message": "Invalid username or password",
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if user.is_banned:
            return Response(
                {
                    "error": {
                        "code": "USER_BANNED",
                        "message": user.ban_reason or "Account is banned",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at", "updated_at"])
        return _issue_auth_response(request, user)
