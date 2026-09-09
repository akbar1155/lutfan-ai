from rest_framework import serializers

from .models import User
from .phone_auth import normalize_phone, phone_is_valid_uz


class TelegramAuthSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField(max_length=128)
    last_name = serializers.CharField(max_length=128, required=False, allow_blank=True)
    username = serializers.CharField(max_length=64, required=False, allow_blank=True)
    photo_url = serializers.URLField(required=False, allow_blank=True)
    auth_date = serializers.IntegerField()
    hash = serializers.CharField()


class PhoneRegisterSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    password = serializers.CharField(min_length=6, max_length=128, write_only=True)
    first_name = serializers.CharField(max_length=128)
    last_name = serializers.CharField(
        max_length=128, required=False, allow_blank=True, default=""
    )

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not phone_is_valid_uz(phone):
            raise serializers.ValidationError("Enter a valid Uzbekistan phone (+998…).")
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("This phone is already registered.")
        return phone

    def validate_first_name(self, value):
        name = (value or "").strip()
        if len(name) < 2:
            raise serializers.ValidationError("Name is too short.")
        return name


class PhoneLoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    password = serializers.CharField(max_length=128, write_only=True)

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError("Enter a valid phone number.")
        return phone


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "telegram_id",
            "username",
            "first_name",
            "last_name",
            "photo_url",
            "phone",
            "language",
            "role",
            "created_at",
        )
        read_only_fields = fields


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("language", "phone")

    def validate_phone(self, value):
        if value in (None, ""):
            return None
        phone = normalize_phone(value)
        if not phone_is_valid_uz(phone):
            raise serializers.ValidationError("Enter a valid Uzbekistan phone (+998…).")
        qs = User.objects.filter(phone=phone)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This phone is already registered.")
        return phone
