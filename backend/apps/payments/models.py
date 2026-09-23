from django.db import models

from apps.invitations.models import Invitation


class PaymeTransaction(models.Model):
    """
    One row per Payme (Paycom) Merchant API transaction.

    State machine mirrors Payme's own spec (see developer.help.paycom.uz):
      1  CREATED                  -> CreateTransaction succeeded, awaiting confirmation
      2  COMPLETED                -> PerformTransaction succeeded, money captured
     -1  CANCELLED                -> cancelled before it was ever completed
     -2  CANCELLED_AFTER_COMPLETE -> cancelled/refunded after it was completed
    """

    class State(models.IntegerChoices):
        CREATED = 1, "Created"
        COMPLETED = 2, "Completed"
        CANCELLED = -1, "Cancelled"
        CANCELLED_AFTER_COMPLETE = -2, "Cancelled after complete"

    # Payme's own transaction id (24-char hex string they generate) - primary key
    # from their side, so we key on it directly instead of a surrogate id.
    paycom_transaction_id = models.CharField(max_length=32, unique=True)
    # Timestamp Payme sent us in CreateTransaction.params.time (ms epoch, their clock).
    paycom_time = models.BigIntegerField()

    invitation = models.ForeignKey(
        Invitation, on_delete=models.PROTECT, related_name="payme_transactions"
    )
    amount = models.BigIntegerField(help_text="Amount in tiyin (1 so'm = 100 tiyin)")
    state = models.SmallIntegerField(choices=State.choices, default=State.CREATED)
    reason = models.SmallIntegerField(null=True, blank=True)

    # Our server-side timestamps, ms epoch - these are what CheckTransaction/
    # GetStatement report back to Payme.
    create_time = models.BigIntegerField()
    perform_time = models.BigIntegerField(default=0)
    cancel_time = models.BigIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["invitation"]),
            models.Index(fields=["state"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.paycom_transaction_id} ({self.get_state_display()})"

    def is_expired(self, timeout_ms: int) -> bool:
        from django.utils import timezone

        if self.state != self.State.CREATED:
            return False
        now_ms = int(timezone.now().timestamp() * 1000)
        return (now_ms - self.create_time) > timeout_ms
