import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Language(models.TextChoices):
    UZ_LATN = "uz-latn", "Uzbek Latin"
    UZ_CYRL = "uz-cyrl", "Uzbek Cyrillic"
    RU = "ru", "Russian"


class Role(models.TextChoices):
    USER = "user", "User"
    ADMIN = "admin", "Admin"


class UserManager(BaseUserManager):
    def create_user(self, telegram_id, first_name, **extra):
        if telegram_id is None:
            raise ValueError("telegram_id is required")
        user = self.model(telegram_id=telegram_id, first_name=first_name, **extra)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, telegram_id, first_name="Admin", **extra):
        extra.setdefault("role", Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(telegram_id, first_name, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    telegram_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=64, blank=True, null=True)
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128, blank=True, null=True)
    photo_url = models.URLField(max_length=512, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    language = models.CharField(
        max_length=16, choices=Language.choices, default=Language.UZ_LATN
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.USER)
    is_banned = models.BooleanField(default=False)
    ban_reason = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "telegram_id"
    REQUIRED_FIELDS = ["first_name"]

    class Meta:
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.username or self.first_name or str(self.telegram_id)

    @property
    def is_admin(self):
        return self.role == Role.ADMIN or self.is_superuser


class UserSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    refresh_token_hash = models.CharField(max_length=256)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["refresh_token_hash"]),
            models.Index(fields=["expires_at"]),
        ]
