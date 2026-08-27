from django.urls import path

from .views import (
    DevLoginView,
    LogoutView,
    MeView,
    ProfileView,
    RefreshView,
    TelegramAuthView,
)

urlpatterns = [
    path("auth/telegram", TelegramAuthView.as_view()),
    path("auth/dev-login", DevLoginView.as_view()),
    path("auth/refresh", RefreshView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/me", MeView.as_view()),
    path("user/profile", ProfileView.as_view()),
]
