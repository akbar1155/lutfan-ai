from django.urls import path

from .views import (
    AnalyticsIngestView,
    InvitationDetailView,
    InvitationDownloadView,
    InvitationEventsView,
    InvitationFormatsView,
    InvitationGenerateView,
    InvitationListCreateView,
    InvitationShareView,
    InvitationStatusView,
    PublicInvitationView,
    UserInvitationsAliasView,
)

urlpatterns = [
    path("public/invitations/<uuid:pk>", PublicInvitationView.as_view()),
    path("invitations", InvitationListCreateView.as_view()),
    path("invitations/<uuid:pk>", InvitationDetailView.as_view()),
    path("invitations/<uuid:pk>/generate", InvitationGenerateView.as_view()),
    path("invitations/<uuid:pk>/status", InvitationStatusView.as_view()),
    path("invitations/<uuid:pk>/formats", InvitationFormatsView.as_view()),
    path("invitations/<uuid:pk>/share", InvitationShareView.as_view()),
    path("invitations/<uuid:pk>/download", InvitationDownloadView.as_view()),
    path("invitations/<uuid:pk>/events", InvitationEventsView.as_view()),
    path("user/invitations", UserInvitationsAliasView.as_view()),
    path("analytics/events", AnalyticsIngestView.as_view()),
]
