from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", None) if request else None

    if response is None:
        return Response(
            {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Unexpected server error",
                    "details": {},
                    "request_id": request_id,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = "ERROR"
    details = response.data
    message = "Request failed"

    if response.status_code == 429:
        code = "RATE_LIMITED"
        if isinstance(response.data, dict):
            if "detail" in response.data and not isinstance(response.data.get("detail"), dict):
                message = str(response.data["detail"])
                details = {}
            else:
                # Throttled(detail={...}) becomes the body itself in DRF
                payload = (
                    response.data["detail"]
                    if isinstance(response.data.get("detail"), dict)
                    else response.data
                )
                message = str(payload.get("message") or payload.get("detail") or message)
                code = str(payload.get("code") or code)
                details = {
                    k: v for k, v in payload.items() if k not in ("message", "detail")
                }
        elif isinstance(response.data, list):
            message = str(response.data[0]) if response.data else message
            details = {"errors": response.data}
    elif isinstance(response.data, dict):
        if "detail" in response.data:
            message = str(response.data["detail"])
            details = {}
            code = (
                "AUTHENTICATION_FAILED" if response.status_code in (401, 403) else "ERROR"
            )
        else:
            code = "VALIDATION_ERROR"
            message = "Validation failed"
    elif isinstance(response.data, list):
        message = str(response.data[0]) if response.data else message
        details = {"errors": response.data}

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details if isinstance(details, dict) else {"raw": details},
            "request_id": request_id,
        }
    }
    return response
