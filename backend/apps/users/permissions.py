from rest_framework.permissions import BasePermission

from .models import Role


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role == Role.ADMIN or user.is_superuser)
        )


class IsNotBanned(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_banned:
            return False
        return True
