from django.conf import settings
from django.db import models

from apps.content.models import AIPromptPreset
from apps.core.models import TimeStampedModel
from apps.invitations.models import GenerationPath, Invitation


class AIGeneration(TimeStampedModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        TIMEOUT = "timeout", "Timeout"

    invitation = models.ForeignKey(
        Invitation, on_delete=models.CASCADE, related_name="generations"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_generations"
    )
    model = models.CharField(max_length=64, default="gemini-2.5-flash-image")
    generation_path = models.CharField(max_length=32, choices=GenerationPath.choices)
    prompt_preset = models.ForeignKey(
        AIPromptPreset, null=True, blank=True, on_delete=models.SET_NULL
    )
    base_image_url = models.URLField(max_length=512, blank=True, null=True)
    final_prompt = models.TextField()
    negative_prompt = models.TextField(blank=True, null=True)
    model_params = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.QUEUED
    )
    result_url = models.URLField(max_length=512, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    provider_cost_usd = models.DecimalField(
        max_digits=8, decimal_places=4, null=True, blank=True
    )
    duration_ms = models.IntegerField(null=True, blank=True)
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)


class AIGenerationCache(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    cache_key = models.CharField(max_length=128, unique=True)
    generation_path = models.CharField(max_length=32, choices=GenerationPath.choices)
    result_url = models.URLField(max_length=512)
    hit_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)


class SystemLog(models.Model):
    class Level(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"
        CRITICAL = "critical", "Critical"

    id = models.UUIDField(primary_key=True, editable=False)
    level = models.CharField(max_length=16, choices=Level.choices)
    module = models.CharField(max_length=64)
    message = models.TextField()
    context = models.JSONField(default=dict, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    invitation = models.ForeignKey(
        Invitation, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)


class AdminAction(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="admin_actions"
    )
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=64, blank=True, null=True)
    target_id = models.UUIDField(null=True, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField()
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        import uuid

        if not self.id:
            self.id = uuid.uuid4()
        return super().save(*args, **kwargs)
