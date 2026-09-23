from django.contrib import admin

from .models import PaymeTransaction


@admin.register(PaymeTransaction)
class PaymeTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "paycom_transaction_id",
        "invitation",
        "amount",
        "state",
        "reason",
        "created_at",
    )
    list_filter = ("state",)
    search_fields = ("paycom_transaction_id", "invitation__id")
    readonly_fields = [f.name for f in PaymeTransaction._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
