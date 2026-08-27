from django.conf import settings
from django.db import connection
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = False
        redis_ok = False

        try:
            connection.ensure_connection()
            db_ok = True
        except Exception:
            db_ok = False

        try:
            cache.set("healthcheck", "1", 5)
            redis_ok = cache.get("healthcheck") == "1"
        except Exception:
            redis_ok = False

        status_code = 200 if db_ok else 503
        return Response(
            {
                "status": "ok" if db_ok else "degraded",
                "database": "up" if db_ok else "down",
                "redis": "up" if redis_ok else "unknown",
                "service": "lutfan-api",
                "debug": settings.DEBUG,
            },
            status=status_code,
        )
