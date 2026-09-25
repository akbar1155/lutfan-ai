from django.contrib import admin
from django.utils.html import format_html

from .models import PaymeTransaction


@admin.register(PaymeTransaction)
class PaymeTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "paycom_transaction_id",
        "invitation_link",
        "amount_display",
        "state_display",
        "created_at",
        "perform_time",
    )
    list_filter = ("state", "created_at")
    search_fields = ("paycom_transaction_id", "invitation__id")
    readonly_fields = [f.name for f in PaymeTransaction._meta.fields] + ["amount_display", "invitation_link"]

    fieldsets = (
        ("Transaction Info", {
            "fields": ("paycom_transaction_id", "invitation_link", "amount_display", "state", "reason")
        }),
        ("Timestamps", {
            "fields": ("create_time", "perform_time", "cancel_time", "created_at", "updated_at")
        }),
    )

    def amount_display(self, obj):
        """Display amount in UZS"""
        uzs = obj.amount / 100
        return format_html('<strong>{:,.0f} UZS</strong>', uzs)
    amount_display.short_description = "Amount"

    def state_display(self, obj):
        """Display state with color coding"""
        colors = {
            PaymeTransaction.State.CREATED: "orange",
            PaymeTransaction.State.COMPLETED: "green",
            PaymeTransaction.State.CANCELLED: "red",
        }
        color = colors.get(obj.state, "gray")
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_state_display()
        )
    state_display.short_description = "Status"

    def invitation_link(self, obj):
        """Link to invitation admin page"""
        if obj.invitation:
            url = f"/admin/invitations/invitation/{obj.invitation.id}/change/"
            return format_html('<a href="{}">{}</a>', url, obj.invitation.id)
        return "-"
    invitation_link.short_description = "Invitation"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
