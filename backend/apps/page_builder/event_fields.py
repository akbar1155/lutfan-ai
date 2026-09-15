from __future__ import annotations

from datetime import date, datetime, time

NIKOH_SUBTYPES = {
    "nikoh_oqshomi",
    "nahorgi_osh",
    "maslahat_oshi",
    "qiz_bazmi",
}
ACTIVE_EVENTS = {"nikoh", "aqiqa", "sunnat", "birthday", "hudoyi"}


def normalize_event_slug(value: str | None) -> str:
    slug = (value or "").strip()
    return slug if slug in ACTIVE_EVENTS else "nikoh"


def normalize_subtype_slugs(event: str, slugs) -> list[str]:
    if event != "nikoh":
        return []
    out: list[str] = []
    seen: set[str] = set()
    for raw in slugs or []:
        slug = str(raw or "").strip()
        if slug in NIKOH_SUBTYPES and slug not in seen:
            seen.add(slug)
            out.append(slug)
    return out or ["nikoh_oqshomi"]


def normalize_schedule(schedule) -> dict:
    if not isinstance(schedule, dict):
        return {}
    out: dict[str, dict[str, str]] = {}
    for key, slot in schedule.items():
        slug = str(key or "").strip()
        if not slug or not isinstance(slot, dict):
            continue
        out[slug] = {
            "date": str(slot.get("date") or "").strip(),
            "time": str(slot.get("time") or "").strip()[:5],
        }
    return out


def parse_date(value) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_time(value) -> time | None:
    if value in (None, ""):
        return None
    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)
    text = str(value).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text[:8], fmt).time().replace(second=0, microsecond=0)
        except ValueError:
            continue
    return None


def iso_date(value) -> str:
    if isinstance(value, date):
        return value.isoformat()
    return str(value or "").strip()


def iso_time(value) -> str:
    if isinstance(value, time):
        return value.strftime("%H:%M")
    text = str(value or "").strip()
    return text[:5] if text else ""


def sync_nikoh_schedule(
    slugs: list[str],
    schedule: dict,
    fallback_date: str,
    fallback_time: str,
) -> dict:
    out = dict(schedule or {})
    for slug in slugs:
        slot = out.get(slug) or {}
        date_s = str(slot.get("date") or "").strip() or fallback_date
        time_s = str(slot.get("time") or "").strip()[:5] or fallback_time
        out[slug] = {"date": date_s, "time": time_s}
    return {k: v for k, v in out.items() if k in slugs}


def primary_slot(slugs: list[str], schedule: dict) -> tuple[str, str]:
    for slug in slugs:
        slot = (schedule or {}).get(slug) or {}
        if slot.get("date") or slot.get("time"):
            return str(slot.get("date") or ""), str(slot.get("time") or "")[:5]
    return "", ""


def publish_missing(data: dict) -> str:
    event = normalize_event_slug(data.get("event_slug"))
    family = str(data.get("family_signature") or "").strip()
    venue = str(data.get("venue_name") or "").strip()
    address = str(data.get("address") or venue).strip()
    main = str(data.get("main_text") or "").strip()
    if not main:
        return "Asosiy matn kerak"
    if not venue:
        return "Joy nomi kerak"
    if not address:
        return "Manzil kerak"

    if event == "nikoh":
        if not family:
            return "Oila familiyasi kerak"
        slugs = normalize_subtype_slugs(event, data.get("subtype_slugs"))
        schedule = normalize_schedule(data.get("ceremony_schedule"))
        for slug in slugs:
            slot = schedule.get(slug) or {}
            if not slot.get("date") or not slot.get("time"):
                return "Har bir marosim uchun sana va vaqt kerak"
        return ""

    date_s = iso_date(data.get("event_date"))
    time_s = iso_time(data.get("event_time"))
    if not date_s or not time_s:
        return "Sana va vaqt kerak"
    if not family:
        return "Oila familiyasi kerak"
    if event == "aqiqa":
        if str(data.get("child_gender") or "").strip() not in ("boy", "girl"):
            return "Bola jinsini tanlang"
        if not str(data.get("child_name") or "").strip():
            return "Bola ismi kerak"
    elif event == "sunnat":
        if not str(data.get("child_name") or "").strip():
            return "Bola ismi kerak"
    elif event == "birthday":
        if not str(data.get("person_name") or "").strip():
            return "Ism kerak"
    return ""
