from django.urls import path

from .views import (
    CatalogView,
    PageAiStyleView,
    PageDetailView,
    PageListCreateView,
    PageMusicUploadView,
    PagePublishView,
    PageSurpriseView,
    PageUnpublishView,
    PublicPageView,
)

urlpatterns = [
    path("pages/catalog", CatalogView.as_view()),
    path("pages", PageListCreateView.as_view()),
    path("pages/ai-style", PageAiStyleView.as_view()),
    path("pages/surprise", PageSurpriseView.as_view()),
    path("pages/<uuid:pk>", PageDetailView.as_view()),
    path("pages/<uuid:pk>/publish", PagePublishView.as_view()),
    path("pages/<uuid:pk>/unpublish", PageUnpublishView.as_view()),
    path("pages/<uuid:pk>/music", PageMusicUploadView.as_view()),
    path("pages/<uuid:pk>/ai-style", PageAiStyleView.as_view()),
    path("pages/<uuid:pk>/surprise", PageSurpriseView.as_view()),
    path("public/pages/<slug:slug>", PublicPageView.as_view()),
]
