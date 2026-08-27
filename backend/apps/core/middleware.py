import uuid


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response


class BanCheckMiddleware:
    """DRF authentication happens in views; this covers session/Django admin paths."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated and getattr(user, "is_banned", False):
            from django.http import JsonResponse

            return JsonResponse(
                {
                    "error": {
                        "code": "USER_BANNED",
                        "message": getattr(user, "ban_reason", None) or "Banned",
                        "details": {},
                        "request_id": getattr(request, "request_id", None),
                    }
                },
                status=403,
            )
        return self.get_response(request)
