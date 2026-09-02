from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q, Sum

from apps.ai_engine.models import AIGeneration
from apps.invitations.models import DailyMetric, Invitation, InvitationStatus, ShareEvent
from apps.users.models import User


class Command(BaseCommand):
    help = "Rebuild daily_metrics for date range (inclusive)"

    def add_arguments(self, parser):
        parser.add_argument("--from", dest="from_date", type=str, required=False)
        parser.add_argument("--to", dest="to_date", type=str, required=False)

    def handle(self, *args, **options):
        to_date = date.fromisoformat(options["to_date"]) if options.get("to_date") else date.today()
        from_date = (
            date.fromisoformat(options["from_date"])
            if options.get("from_date")
            else to_date - timedelta(days=30)
        )
        if from_date > to_date:
            from_date, to_date = to_date, from_date

        day = from_date
        count = 0
        while day <= to_date:
            next_day = day + timedelta(days=1)
            new_users = User.objects.filter(created_at__date=day).count()
            dau = User.objects.filter(last_login_at__date=day).count()
            invitations_created = Invitation.objects.filter(created_at__date=day).count()
            invitations_completed = Invitation.objects.filter(status=InvitationStatus.READY).filter(
                Q(last_generation_at__date=day)
                | Q(last_generation_at__isnull=True, updated_at__date=day)
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

        self.stdout.write(self.style.SUCCESS(f"daily_metrics updated for {count} day(s)"))
