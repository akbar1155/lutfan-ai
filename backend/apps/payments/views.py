import base64
import binascii
import json
import logging

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.invitations.models import Invitation

from .errors import PaymeError
from .models import PaymeTransaction
from .services import (
    ACCOUNT_FIELD,
    TRANSACTION_TIMEOUT_MS,
    build_checkout_link,
    check_amount,
    get_invitation_for_account,
    get_price_tiyin,
)

logger = logging.getLogger(__name__)


def _now_ms() -> int:
    return int(timezone.now().timestamp() * 1000)


def _authorize(request) -> None:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Basic "):
        raise PaymeError(PaymeError.ERROR_INSUFFICIENT_PRIVILEGE, "Missing authorization")
    try:
        decoded = base64.b64decode(header[len("Basic ") :]).decode("utf-8")
        login, _, key = decoded.partition(":")
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise PaymeError(PaymeError.ERROR_INSUFFICIENT_PRIVILEGE, "Invalid authorization")

    expected_key = settings.PAYME_KEY
    if not expected_key or login != "Paycom" or key != expected_key:
        raise PaymeError(PaymeError.ERROR_INSUFFICIENT_PRIVILEGE, "Invalid credentials")


def _account_payload(invitation_id) -> dict:
    return {ACCOUNT_FIELD: str(invitation_id)}


def _transaction_payload(txn: PaymeTransaction) -> dict:
    return {
        "transaction": str(txn.pk),
        "state": txn.state,
        "create_time": txn.create_time,
        "perform_time": txn.perform_time,
        "cancel_time": txn.cancel_time,
        "reason": txn.reason,
    }


class PaymeMerchantAPIView(APIView):
    """
    Single JSON-RPC 2.0 endpoint for Payme's Merchant API.

    Registered in the Payme Business cabinet as the cashier's API Endpoint:
    https://lutfanai.uz/api/v1/payments/payme/callback/
    Payme calls this same URL for every method (CheckPerformTransaction,
    CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction,
    GetStatement) - the method name is inside the JSON-RPC body, not the URL.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        try:
            body = json.loads(request.body.decode("utf-8") or "{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self._error_response(
                None, PaymeError(PaymeError.ERROR_INVALID_JSON_RPC_OBJECT, "Invalid JSON")
            )

        rpc_id = body.get("id")
        method = body.get("method")
        params = body.get("params") or {}

        try:
            _authorize(request)
            handler = self._handlers().get(method)
            if handler is None:
                raise PaymeError(PaymeError.ERROR_METHOD_NOT_FOUND, "Method not found")
            with transaction.atomic():
                result = handler(params)
        except PaymeError as exc:
            return self._error_response(rpc_id, exc)
        except Exception:
            logger.exception("Payme merchant API internal error, method=%s", method)
            return self._error_response(
                rpc_id, PaymeError(PaymeError.ERROR_INTERNAL_SYSTEM, "Internal error")
            )

        return Response({"jsonrpc": "2.0", "id": rpc_id, "result": result})

    def _error_response(self, rpc_id, exc: PaymeError) -> Response:
        # Payme expects HTTP 200 even for RPC errors - the error lives in the body.
        return Response({"jsonrpc": "2.0", "id": rpc_id, "error": exc.as_rpc_error()})

    def _handlers(self):
        return {
            "CheckPerformTransaction": self._check_perform_transaction,
            "CreateTransaction": self._create_transaction,
            "PerformTransaction": self._perform_transaction,
            "CancelTransaction": self._cancel_transaction,
            "CheckTransaction": self._check_transaction,
            "GetStatement": self._get_statement,
        }

    # -- Methods -----------------------------------------------------------

    def _check_perform_transaction(self, params: dict) -> dict:
        invitation = get_invitation_for_account(params.get("account") or {})
        check_amount(invitation, params.get("amount"))
        if invitation.is_paid:
            raise PaymeError(
                PaymeError.ERROR_INVALID_ACCOUNT,
                "Order already paid",
                data={"class": "Account", "field": ACCOUNT_FIELD},
            )
        active = PaymeTransaction.objects.filter(
            invitation=invitation,
            state__in=[PaymeTransaction.State.CREATED, PaymeTransaction.State.COMPLETED],
        ).exists()
        if active:
            raise PaymeError(
                PaymeError.ERROR_INVALID_ACCOUNT,
                "Order already has a transaction",
                data={"class": "Account", "field": ACCOUNT_FIELD},
            )
        return {"allow": True}

    def _create_transaction(self, params: dict) -> dict:
        paycom_id = params.get("id")
        paycom_time = params.get("time")
        amount = params.get("amount")

        existing = (
            PaymeTransaction.objects.select_for_update()
            .filter(paycom_transaction_id=paycom_id)
            .first()
        )
        if existing:
            if existing.state == PaymeTransaction.State.CREATED:
                if existing.is_expired(TRANSACTION_TIMEOUT_MS):
                    existing.state = PaymeTransaction.State.CANCELLED
                    existing.reason = 4  # cancelled by timeout
                    existing.cancel_time = _now_ms()
                    existing.save(update_fields=["state", "reason", "cancel_time", "updated_at"])
                    raise PaymeError(PaymeError.ERROR_COULD_NOT_PERFORM, "Transaction expired")
                return {
                    "create_time": existing.create_time,
                    "transaction": str(existing.pk),
                    "state": existing.state,
                }
            if existing.state == PaymeTransaction.State.COMPLETED:
                return {
                    "create_time": existing.create_time,
                    "transaction": str(existing.pk),
                    "state": existing.state,
                }
            raise PaymeError(PaymeError.ERROR_COULD_NOT_PERFORM, "Transaction cancelled")

        invitation = get_invitation_for_account(params.get("account") or {})
        check_amount(invitation, amount)
        if invitation.is_paid:
            raise PaymeError(
                PaymeError.ERROR_INVALID_ACCOUNT,
                "Order already paid",
                data={"class": "Account", "field": ACCOUNT_FIELD},
            )
        other_active = PaymeTransaction.objects.filter(
            invitation=invitation,
            state__in=[PaymeTransaction.State.CREATED, PaymeTransaction.State.COMPLETED],
        ).exists()
        if other_active:
            raise PaymeError(PaymeError.ERROR_COULD_NOT_PERFORM, "Order already has a transaction")

        create_time = _now_ms()
        txn = PaymeTransaction.objects.create(
            paycom_transaction_id=paycom_id,
            paycom_time=paycom_time,
            invitation=invitation,
            amount=amount,
            state=PaymeTransaction.State.CREATED,
            create_time=create_time,
        )
        return {"create_time": create_time, "transaction": str(txn.pk), "state": txn.state}

    def _perform_transaction(self, params: dict) -> dict:
        txn = self._get_transaction_locked(params.get("id"))

        if txn.state == PaymeTransaction.State.CREATED:
            if txn.is_expired(TRANSACTION_TIMEOUT_MS):
                txn.state = PaymeTransaction.State.CANCELLED
                txn.reason = 4
                txn.cancel_time = _now_ms()
                txn.save(update_fields=["state", "reason", "cancel_time", "updated_at"])
                raise PaymeError(PaymeError.ERROR_COULD_NOT_PERFORM, "Transaction expired")

            txn.state = PaymeTransaction.State.COMPLETED
            txn.perform_time = _now_ms()
            txn.save(update_fields=["state", "perform_time", "updated_at"])

            invitation = txn.invitation
            invitation.is_paid = True
            invitation.paid_at = timezone.now()
            invitation.save(update_fields=["is_paid", "paid_at", "updated_at"])

            return {"transaction": str(txn.pk), "perform_time": txn.perform_time, "state": txn.state}

        if txn.state == PaymeTransaction.State.COMPLETED:
            return {"transaction": str(txn.pk), "perform_time": txn.perform_time, "state": txn.state}

        raise PaymeError(PaymeError.ERROR_COULD_NOT_PERFORM, "Transaction cancelled")

    def _cancel_transaction(self, params: dict) -> dict:
        txn = self._get_transaction_locked(params.get("id"))
        reason = params.get("reason")

        if txn.state == PaymeTransaction.State.CREATED:
            txn.state = PaymeTransaction.State.CANCELLED
            txn.reason = reason
            txn.cancel_time = _now_ms()
            txn.save(update_fields=["state", "reason", "cancel_time", "updated_at"])
        elif txn.state == PaymeTransaction.State.COMPLETED:
            txn.state = PaymeTransaction.State.CANCELLED_AFTER_COMPLETE
            txn.reason = reason
            txn.cancel_time = _now_ms()
            txn.save(update_fields=["state", "reason", "cancel_time", "updated_at"])
            # Refunded after completion: an order that was already generated
            # stays generated, but block further paid actions on it.
            invitation = txn.invitation
            invitation.is_paid = False
            invitation.save(update_fields=["is_paid", "updated_at"])
        # else: already cancelled (either state) - fall through and return
        # the existing cancel data untouched, per Payme's idempotency rules.

        return {"transaction": str(txn.pk), "cancel_time": txn.cancel_time, "state": txn.state}

    def _check_transaction(self, params: dict) -> dict:
        txn = self._get_transaction_locked(params.get("id"))
        return _transaction_payload(txn)

    def _get_statement(self, params: dict) -> dict:
        date_from = params.get("from")
        date_to = params.get("to")
        qs = PaymeTransaction.objects.filter(
            create_time__gte=date_from, create_time__lte=date_to
        ).order_by("create_time")
        transactions = []
        for txn in qs:
            transactions.append(
                {
                    "id": txn.paycom_transaction_id,
                    "time": txn.paycom_time,
                    "amount": txn.amount,
                    "account": _account_payload(txn.invitation_id),
                    "create_time": txn.create_time,
                    "perform_time": txn.perform_time,
                    "cancel_time": txn.cancel_time,
                    "transaction": str(txn.pk),
                    "state": txn.state,
                    "reason": txn.reason,
                }
            )
        return {"transactions": transactions}

    # -- Helpers -------------------------------------------------------------

    def _get_transaction_locked(self, paycom_id) -> PaymeTransaction:
        txn = (
            PaymeTransaction.objects.select_for_update()
            .filter(paycom_transaction_id=paycom_id)
            .first()
        )
        if txn is None:
            raise PaymeError(PaymeError.ERROR_TRANSACTION_NOT_FOUND, "Transaction not found")
        return txn


class InvitationPaymentLinkView(APIView):
    """
    Returns the price and a ready-to-open Payme checkout link for one
    invitation, so the frontend doesn't have to build the base64 link itself.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        invitation = get_object_or_404(
            Invitation, pk=pk, user=request.user, deleted_at__isnull=True
        )
        lang = request.query_params.get("lang", "uz")
        return Response(
            {
                "invitation_id": str(invitation.id),
                "is_paid": invitation.is_paid,
                "amount_tiyin": get_price_tiyin(),
                "amount_uzs": get_price_tiyin() // 100,
                "checkout_url": build_checkout_link(invitation, lang=lang),
            }
        )
