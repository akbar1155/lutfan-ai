from __future__ import annotations

from datetime import date

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.ai_engine.spelling import is_junk_field_value


_SKIP_JUNK_TYPES = {"enum", "date", "time"}
_SKIP_JUNK_KEYS = {"child_gender", "inviter", "event_date", "event_time"}


def _iter_schema_fields(schema: dict):
    if not isinstance(schema, dict):
        return
    for group in ("required", "optional"):
        for field in schema.get(group) or []:
            if isinstance(field, dict) and field.get("key"):
                yield field


def schema_date_min_today(schema: dict) -> bool:
    for field in _iter_schema_fields(schema):
        if field.get("key") == "event_date" and field.get("min") == "today":
            return True
    return False


def _parse_iso_date(value) -> date | None:
    if not value:
        return None
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _collect_event_dates(event_data: dict, event_date) -> list[date]:
    found: list[date] = []
    parsed = _parse_iso_date(event_date)
    if parsed:
        found.append(parsed)
    if not isinstance(event_data, dict):
        return found
    structured = event_data.get("structured_fields") or {}
    if isinstance(structured, dict):
        parsed = _parse_iso_date(structured.get("event_date"))
        if parsed:
            found.append(parsed)
    schedule = event_data.get("ceremony_schedule") or {}
    if isinstance(schedule, dict):
        for slot in schedule.values():
            if not isinstance(slot, dict):
                continue
            parsed = _parse_iso_date(slot.get("date"))
            if parsed:
                found.append(parsed)
    return found


def _junk_structured_fields(event_data: dict, schema: dict) -> str | None:
    if not isinstance(event_data, dict):
        return None
    structured = event_data.get("structured_fields") or {}
    if not isinstance(structured, dict):
        return None
    type_by_key = {
        str(field["key"]): str(field.get("type") or "string")
        for field in _iter_schema_fields(schema)
    }
    for key, raw in structured.items():
        value = str(raw or "").strip()
        if not value:
            continue
        if key in _SKIP_JUNK_KEYS or type_by_key.get(key) in _SKIP_JUNK_TYPES:
            continue
        if is_junk_field_value(value):
            return key
    return None


def _junk_text_blocks(event_data: dict) -> str | None:
    if not isinstance(event_data, dict):
        return None
    blocks = event_data.get("final_text_blocks") or {}
    if not isinstance(blocks, dict):
        return None
    for key in ("header", "body", "address", "footer"):
        value = str(blocks.get(key) or "").strip()
        if not value:
            continue
        if is_junk_field_value(value):
            return key
    return None


def validate_invitation_payload(
    event,
    event_data: dict | None,
    event_date=None,
    *,
    for_generate: bool = False,
) -> None:
    """Reject past dates (when schema says min=today) and placeholder junk."""
    schema = getattr(event, "fields_schema", None) or {}
    data = event_data if isinstance(event_data, dict) else {}

    if schema_date_min_today(schema):
        today = timezone.localdate()
        for parsed in _collect_event_dates(data, event_date):
            if parsed < today:
                raise ValidationError("Event date cannot be in the past.")

    junk_field = _junk_structured_fields(data, schema)
    if junk_field:
        raise ValidationError("Please enter real invitation details, not placeholder text.")

    if for_generate:
        junk_block = _junk_text_blocks(data)
        if junk_block:
            raise ValidationError("Please enter real invitation text, not placeholder text.")
