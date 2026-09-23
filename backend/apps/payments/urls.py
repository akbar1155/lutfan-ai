from django.urls import path

from .views import InvitationPaymentLinkView, PaymeMerchantAPIView

urlpatterns = [
    path("payments/payme/callback/", PaymeMerchantAPIView.as_view()),
    path("invitations/<uuid:pk>/payment", InvitationPaymentLinkView.as_view()),
]
