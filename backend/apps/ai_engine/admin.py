from django.contrib import admin

from .models import AIGeneration, AIGenerationCache, AdminAction, SystemLog


@admin.register(AIGeneration)
class AIGenerationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "invitation",
        "status",
        "generation_path",
        "model",
        "provider_cost_usd",
        "duration_ms",
        "created_at",
    )
    list_filter = ("status", "generation_path", "model")
    search_fields = (
        "id",
        "user__username",
        "user__first_name",
        "invitation__id",
        "final_prompt",
    )
    readonly_fields = ("id", "created_at", "updated_at", "queued_at")
    autocomplete_fields = ("user", "invitation", "prompt_preset")


@admin.register(AIGenerationCache)
class AIGenerationCacheAdmin(admin.ModelAdmin):
    list_display = ("id", "cache_key", "generation_path", "hit_count", "created_at")
    search_fields = ("cache_key",)
    readonly_fields = ("id", "created_at", "last_used_at")


@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ("id", "level", "module", "message_short", "created_at")
    list_filter = ("level", "module")
    search_fields = ("message", "module")
    readonly_fields = ("id", "created_at")

    @admin.display(description="Message")
    def message_short(self, obj: SystemLog):
        msg = obj.message or ""
        return msg if len(msg) <= 80 else f"{msg[:80]}…"


@admin.register(AdminAction)
class AdminActionAdmin(admin.ModelAdmin):
    list_display = ("id", "admin", "action", "target_type", "target_id", "created_at")
    list_filter = ("action", "target_type")
    search_fields = ("action", "target_type", "admin__username", "admin__first_name")
    readonly_fields = ("id", "created_at")
