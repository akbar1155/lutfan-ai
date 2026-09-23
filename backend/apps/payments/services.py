import base64
import uuid

from django.conf import settings

from apps.invitations.models import Invitation

from .errors import PaymeError

# Payme cancels an unfinished (CREATED) transaction on its own after this
# many milliseconds if we never confirm it. 12 hours, matches Payme's own
# reference implementation.
TRANSACTION_TIMEOUT_MS = 43200000

ACCOUNT_FIELD = "order_id"


def get_price_tiyin() -> int:
    """Fixed price per invitation, in tiyin (1 so'm = 100 tiyin)."""
    return int(settings.INVITATION_PRICE_UZS) * 100


def get_invitation_for_account(account: dict) -> Invitation:
    """
    Resolve the Invitation an incoming Payme request refers to.

    Payme sends `params.account` as a dict of the fields configured on their
    side for this cashier - here that's a single field, `order_id`, which we
    fill with the Invitation's UUID when we build the checkout link.
    """
    if not isinstance(account, dict) or ACCOUNT_FIELD not in account:
        raise PaymeError(
            PaymeError.ERROR_INVALID_ACCOUNT,
            "Account field is missing",
            data={"class": "Account", "field": ACCOUNT_FIELD},
        )

    raw_value = account.get(ACCOUNT_FIELD)
    try:
        invitation_id = uuid.UUID(str(raw_value))
    except (ValueError, TypeError, AttributeError):
        raise PaymeError(
            PaymeError.ERROR_INVALID_ACCOUNT,
            "Order not found",
            data={"class": "Account", "field": ACCOUNT_FIELD},
        )

    try:
        return Invitation.objects.get(pk=invitation_id, deleted_at__isnull=True)
    except Invitation.DoesNotExist:
        raise PaymeError(
            PaymeError.ERROR_INVALID_ACCOUNT,
            "Order not found",
            data={"class": "Account", "field": ACCOUNT_FIELD},
        )


def check_amount(invitation: Invitation, amount) -> None:
    expected = get_price_tiyin()
    try:
        amount = int(amount)
    except (TypeError, ValueError):
        raise PaymeError(PaymeError.ERROR_INVALID_AMOUNT, "Invalid amount")
    if amount != expected:
        raise PaymeError(PaymeError.ERROR_INVALID_AMOUNT, "Invalid amount")


def build_checkout_link(invitation: Invitation, *, lang: str = "uz", sandbox: bool | None = None) -> str:
    """
    Build a Payme Checkout (GET-method) link for this invitation.
    See developer.help.paycom.uz "Отправка чека по методу GET".
    """
    if sandbox is None:
        sandbox = bool(settings.PAYME_TEST_MODE)
    host = "test.paycom.uz" if sandbox else "checkout.paycom.uz"
    return_url = f"{settings.APP_BASE_URL.rstrip('/')}/payment?invitation={invitation.id}"
    raw = (
        f"m={settings.PAYME_MERCHANT_ID};"
        f"ac.{ACCOUNT_FIELD}={invitation.id};"
        f"a={get_price_tiyin()};"
        f"l={lang};"
        f"c={return_url}"
    )
    encoded = base64.b64encode(raw.encode("utf-8")).decode("ascii")
    return f"https://{host}/{encoded}"
