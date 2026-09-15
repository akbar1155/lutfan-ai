from __future__ import annotations

import secrets
import string

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel

from .catalog import DEFAULT_DESIGN, DEFAULT_MUSIC


SLUG_ALPHABET = string.ascii_letters + string.digits


def generate_page_slug(length: int = 8) -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(length))


class InvitationPageStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    UNPUBLISHED = "unpublished", "Unpublished"


class InvitationPage(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="invitation_pages",
    )
    slug = models.SlugField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=120, blank=True, default="")
    main_text = models.TextField(blank=True, default="")
    event_date = models.DateField(null=True, blank=True)
    event_time = models.TimeField(null=True, blank=True)
    address = models.CharField(max_length=240, blank=True, default="")
    design_config = models.JSONField(default=dict, blank=True)
    music_config = models.JSONField(default=dict, blank=True)
    design_prompt = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=InvitationPageStatus.choices,
        default=InvitationPageStatus.DRAFT,
    )

    class Meta:
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        if not self.design_config:
            self.design_config = dict(DEFAULT_DESIGN)
        if not self.music_config:
            self.music_config = dict(DEFAULT_MUSIC)
        return super().save(*args, **kwargs)

    def _unique_slug(self) -> str:
        for _ in range(12):
            candidate = generate_page_slug()
            qs = InvitationPage.objects.filter(slug=candidate)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if not qs.exists():
                return candidate
        return generate_page_slug(12)
