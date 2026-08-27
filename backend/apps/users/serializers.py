from rest_framework import serializers

from .models import User


class TelegramAuthSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField(max_length=128)
    last_name = serializers.CharField(max_length=128, required=False, allow_blank=True)
    username = serializers.CharField(max_length=64, required=False, allow_blank=True)
    photo_url = serializers.URLField(required=False, allow_blank=True)
    auth_date = serializers.IntegerField()
    hash = serializers.CharField()


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
