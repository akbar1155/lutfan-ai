import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.content.models import AIPromptPreset, EventConfig, Template
from apps.core.models import SoftDeleteModel, TimeStampedModel
from apps.users.models import Language


class InvitationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    GENERATING = "generating", "Generating"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class GenerationPath(models.TextChoices):
    TEMPLATE = "template", "Template"
    AI_FROM_SCRATCH = "ai_from_scratch", "AI from scratch"


class Invitation(TimeStampedModel, SoftDeleteModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="invitations"
    )
    status = models.CharField(
        max_length=16, choices=InvitationStatus.choices, default=InvitationStatus.DRAFT
    )
    event = models.ForeignKey(
        EventConfig,
        to_field="slug",
        db_column="event_slug",
        on_delete=models.PROTECT,
        related_name="invitations",
    )
    subtype_slug = models.CharField(max_length=32, blank=True, null=True)
    # Multiple ceremony parts on one invitation (e.g. nahorgi_osh + nikoh_oqshomi)
    subtype_slugs = models.JSONField(default=list, blank=True)
    inviter_type = models.CharField(max_length=32, blank=True, null=True)
    language = models.CharField(
        max_length=16, choices=Language.choices, default=Language.UZ_LATN
    )
    event_data = models.JSONField(default=dict)
    generation_path = models.CharField(
        max_length=32, choices=GenerationPath.choices, blank=True, null=True
    )
    template = models.ForeignKey(
        Template, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    ai_preset = models.ForeignKey(
        AIPromptPreset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    selected_mood_tags = models.JSONField(default=list, blank=True)
    custom_style_note = models.TextField(blank=True, null=True)
    primary_format = models.CharField(max_length=8, default="4:5")
    final_image_url = models.URLField(max_length=512, blank=True, null=True)
    additional_formats = models.JSONField(default=dict, blank=True, null=True)
    event_date = models.DateField(null=True, blank=True)
    generation_count = models.IntegerField(default=0)
    last_generation_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    last_job_id = models.CharField(max_length=64, blank=True, null=True)
    last_error = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["event"]),
            models.Index(fields=["expires_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=90)
        return super().save(*args, **kwargs)


class InvitationHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invitation = models.ForeignKey(
        Invitation, on_delete=models.CASCADE, related_name="history"
    )
    action = models.CharField(max_length=64)
    snapshot = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RenderedFile(TimeStampedModel, SoftDeleteModel):
    class FileType(models.TextChoices):
        HD_4_5 = "hd_4_5", "4:5"
        HD_9_16 = "hd_9_16", "9:16"
        HD_1_1 = "hd_1_1", "1:1"

    invitation = models.ForeignKey(
        Invitation, on_delete=models.CASCADE, related_name="rendered_files"
    )
    file_type = models.CharField(max_length=16, choices=FileType.choices)
    url = models.URLField(max_length=512)
    cdn_url = models.URLField(max_length=512)
    file_size_bytes = models.BigIntegerField(default=0)
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)
    expires_at = models.DateTimeField()


class ShareEvent(models.Model):
    class Platform(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"
        COPY_LINK = "copy_link", "Copy link"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, editable=False)
    invitation = models.ForeignKey(
        Invitation, on_delete=models.CASCADE, related_name="shares"
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shares"
    )
    platform = models.CharField(max_length=32, choices=Platform.choices)
    clicked_by_ip = models.GenericIPAddressField(null=True, blank=True)
    clicked_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    resulted_in_signup = models.BooleanField(default=False)
    resulted_in_signup_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)


class AnalyticsEvent(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
    )
    session_id = models.CharField(max_length=64)
    event_name = models.CharField(max_length=64)
    properties = models.JSONField(default=dict, blank=True)
    utm_source = models.CharField(max_length=64, blank=True, null=True)
    utm_medium = models.CharField(max_length=64, blank=True, null=True)
    utm_campaign = models.CharField(max_length=64, blank=True, null=True)
    referrer_url = models.URLField(max_length=512, blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)


class DailyMetric(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    date = models.DateField(unique=True)
    new_users = models.IntegerField(default=0)
    dau = models.IntegerField(default=0)
    invitations_created = models.IntegerField(default=0)
    invitations_completed = models.IntegerField(default=0)
    ai_generations_count = models.IntegerField(default=0)
    ai_cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    downloads_count = models.IntegerField(default=0)
    shares_count = models.IntegerField(default=0)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)


class Notification(models.Model):
    class Type(models.TextChoices):
        WELCOME = "welcome", "Welcome"
        GENERATION_COMPLETE = "generation_complete", "Generation complete"
        EXPIRING_SOON = "expiring_soon", "Expiring soon"
        SEASONAL = "seasonal", "Seasonal"

    class Channel(models.TextChoices):
        TELEGRAM_BOT = "telegram_bot", "Telegram bot"
        IN_APP = "in_app", "In-app"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=32, choices=Type.choices)
    channel = models.CharField(
        max_length=32, choices=Channel.choices, default=Channel.TELEGRAM_BOT
    )
    payload = models.JSONField(default=dict)
    language = models.CharField(max_length=16, choices=Language.choices)
    scheduled_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.SCHEDULED
    )
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)
