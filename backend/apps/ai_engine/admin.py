from django.contrib import admin

from .models import AIGeneration, AIGenerationCache, AdminAction, SystemLog


@admin.register(AIGeneration)
class AIGenerationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "model", "duration_ms", "created_at")
    list_filter = ("status", "generation_path")


admin.site.register(AIGenerationCache)
admin.site.register(SystemLog)
admin.site.register(AdminAction)
