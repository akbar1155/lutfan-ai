"""
Payme (Paycom) Merchant API error codes.

Values match Payme's own reference implementation - see
https://developer.help.paycom.uz and github.com/PaycomUZ/paycom-integration-php-template
Do not change these numbers; Payme's sandbox conformance tests assert on them.
"""


class PaymeError(Exception):
    ERROR_INTERNAL_SYSTEM = -32400
    ERROR_INSUFFICIENT_PRIVILEGE = -32504
    ERROR_INVALID_JSON_RPC_OBJECT = -32600
    ERROR_METHOD_NOT_FOUND = -32601

    ERROR_INVALID_AMOUNT = -31001
    ERROR_TRANSACTION_NOT_FOUND = -31003
    ERROR_INVALID_ACCOUNT = -31050
    ERROR_COULD_NOT_CANCEL = -31007
    ERROR_COULD_NOT_PERFORM = -31008

    def __init__(self, code: int, message: str, data: dict | None = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(message)

    def as_rpc_error(self) -> dict:
        error: dict = {
            "code": self.code,
            "message": {
                "ru": self.message,
                "uz": self.message,
                "en": self.message,
            },
        }
        if self.data:
            error["data"] = self.data
        return error
