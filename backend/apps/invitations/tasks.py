from datetime import date, timedelta

from celery import shared_task
from django.core.management import call_command
from django.db.models import Sum
from django.utils import timezone

from apps.ai_engine.models import AIGeneration
from apps.invitations.models import DailyMetric, Invitation, InvitationStatus, ShareEvent
from apps.users.models import User


@shared_task(name="invitations.clean_expired_files")
def clean_expired_files_task():
    """Run the clean_expired_files management command."""
    call_command("clean_expired_files", days=7)
    return "Expired files cleanup completed"


@shared_task(name="invitations.clean_ai_cache")
def clean_ai_cache_task():
    """Run the clean_ai_cache management command."""
    call_command("clean_ai_cache", days=60)
    return "AI cache cleanup completed"


@shared_task(name="invitations.rebuild_daily_metrics")
def rebuild_daily_metrics_task(days_back: int = 2):
    """
    Rebuild daily metrics for the last N days.
    Runs daily at 04:00 UTC to aggregate yesterday's data.
    """
    to_date = date.today()
    from_date = to_date - timedelta(days=days_back)

    day = from_date
    count = 0
    while day <= to_date:
        next_day = day + timedelta(days=1)
        
        new_users = User.objects.filter(created_at__date=day).count()
        dau = User.objects.filter(last_login_at__date=day).count()
        invitations_created = Invitation.objects.filter(created_at__date=day).count()
        invitations_completed = Invitation.objects.filter(
            created_at__date=day, status=InvitationStatus.READY
        ).count()
        
        ai_generations_qs = AIGeneration.objects.filter(created_at__date=day)
        ai_generations_count = ai_generations_qs.count()
        ai_cost_usd = ai_generations_qs.aggregate(total=Sum("provider_cost_usd"))["total"] or 0
        
        shares_count = ShareEvent.objects.filter(created_at__date=day).count()

        DailyMetric.objects.update_or_create(
            date=day,
            defaults={
                "new_users": new_users,
                "dau": dau,
                "invitations_created": invitations_created,
                "invitations_completed": invitations_completed,
                "ai_generations_count": ai_generations_count,
                "ai_cost_usd": ai_cost_usd,
                "downloads_count": 0,
                "shares_count": shares_count,
            },
        )
        count += 1
        day = next_day

    return f"Daily metrics updated for {count} day(s)"


@shared_task(name="invitations.notify_expiring_soon")
def notify_expiring_soon_task():
    """
    Send notifications to users about invitations expiring within 7 days.
    Runs daily at 10:00 UTC.
    """
    from apps.invitations.models import Notification
    
    seven_days_from_now = timezone.now() + timedelta(days=7)
    one_day_from_now = timezone.now() + timedelta(days=1)
    
    expiring_invitations = Invitation.objects.filter(
        expires_at__gte=one_day_from_now,
        expires_at__lte=seven_days_from_now,
        status=InvitationStatus.READY,
        deleted_at__isnull=True,
    ).select_related("user")
    
    notifications_created = 0
    for invitation in expiring_invitations.iterator():
        already_notified = Notification.objects.filter(
            user=invitation.user,
            type=Notification.Type.EXPIRING_SOON,
            payload__invitation_id=str(invitation.id),
            created_at__gte=timezone.now() - timedelta(days=1),
        ).exists()
        
        if not already_notified:
            Notification.objects.create(
                user=invitation.user,
                type=Notification.Type.EXPIRING_SOON,
                channel=Notification.Channel.TELEGRAM_BOT,
                payload={
                    "invitation_id": str(invitation.id),
                    "event_slug": invitation.event.slug,
                    "expires_at": invitation.expires_at.isoformat(),
                },
                language=invitation.user.language,
                scheduled_at=timezone.now(),
            )
            notifications_created += 1
    
    return f"Created {notifications_created} expiring soon notification(s)"
