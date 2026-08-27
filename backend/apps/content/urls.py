from django.urls import path

from .views import (
    AIPresetListView,
    EventDetailView,
    EventListView,
    MoodTagListView,
    TemplateDetailView,
    TemplateListView,
    TextTemplateListView,
)

urlpatterns = [
    path("events", EventListView.as_view()),
    path("events/<slug:slug>", EventDetailView.as_view()),
    path("text-templates", TextTemplateListView.as_view()),
    path("templates", TemplateListView.as_view()),
    path("templates/<uuid:pk>", TemplateDetailView.as_view()),
    path("mood-tags", MoodTagListView.as_view()),
    path("ai-presets", AIPresetListView.as_view()),
]
