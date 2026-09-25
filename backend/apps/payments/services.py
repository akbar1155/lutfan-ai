import base64
import uuid
from urllib.parse import quote

from django.conf import settings

from apps.invitations.models import Invitation

from .errors import PaymeError

# Payme cancels an unfinished (CREATED) transaction on its own after this
# many milliseconds if we never confirm it. 12 hours, matches Payme's own
# reference implementation.
TRANSACTION_TIMEOUT_MS = 43200000

ACCOUNT_FIELD = "order_id"


def get_price_tiyin() -> int:
    """
    Get current invitation price in tiyin (1 so'm = 100 tiyin).
    Reads from PricingConfig model if available, otherwise falls back to settings.
    """
    try:
        from apps.content.models import PricingConfig
        price_uzs = PricingConfig.get_current().invitation_price_uzs
    except Exception:
        # Fallback to settings if model not available or migration not run yet
        price_uzs = int(settings.INVITATION_PRICE_UZS)
    return price_uzs * 100


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
    # base64 can contain "/" and "+" (our raw string embeds a full
    # https://...  return URL, which reliably produces them); left
    # unescaped they split the path into extra segments and Payme's
    # own frontend router 404s with "Cannot match any routes". Percent-
    # encode the token so it is one safe path segment; Payme decodes it
    # server-side before base64-decoding, per their GET-method spec.
    return f"https://{host}/{quote(encoded, safe='')}"


def build_click_checkout_link(invitation: Invitation, *, lang: str = "uz") -> str:
    """
    Build a Click.uz checkout link for this invitation.
    See docs.click.uz for Click payment button integration.
    """
    service_id = getattr(settings, "CLICK_SERVICE_ID", "")
    merchant_id = getattr(settings, "CLICK_MERCHANT_ID", "")

    if not service_id or not merchant_id:
        # Fallback to Payme if Click not configured
        return build_checkout_link(invitation, lang=lang)

    return_url = f"{settings.APP_BASE_URL.rstrip('/')}/payment?invitation={invitation.id}"
    amount = get_price_tiyin() / 100  # Click uses so'm, not tiyin

    # Click checkout URL format
    # https://my.click.uz/services/pay?service_id=XXX&merchant_id=XXX&amount=XXX&transaction_param=XXX&return_url=XXX
    params = {
        "service_id": service_id,
        "merchant_id": merchant_id,
        "amount": f"{amount:.2f}",
        "transaction_param": str(invitation.id),
        "return_url": return_url,
    }

    query = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
    return f"https://my.click.uz/services/pay?{query}"
