from django.db import migrations

# Non-nikoh only — nikoh schema is left untouched.
FAMILY_SIGNATURE_EVENTS = {
    "aqiqa": ["family_signature", "child_gender", "child_name"],
    "sunnat": ["family_signature", "child_name"],
    "birthday": ["family_signature", "person_name"],
    "hudoyi": ["family_signature"],
}

RETIRED_FIELD_KEYS = frozenset({"personal_message", "personalMessage"})


def _field_def(key: str) -> dict:
    if key == "family_signature":
        return {"key": "family_signature", "type": "string", "maxLength": 80}
    if key == "child_name":
        return {"key": "child_name", "type": "string", "maxLength": 50}
    if key == "child_gender":
        return {"key": "child_gender", "type": "enum", "options": ["boy", "girl"]}
    if key == "person_name":
        return {"key": "person_name", "type": "string", "maxLength": 50}
    return {"key": key, "type": "string", "maxLength": 100}


def _ensure_schema(schema: dict | None, event_slug: str) -> dict:
    out = dict(schema or {})
    for bucket in ("required", "optional"):
        rows = out.get(bucket)
        if not isinstance(rows, list):
            continue
        out[bucket] = [
            row
            for row in rows
            if not (
                isinstance(row, dict)
                and str(row.get("key") or "") in RETIRED_FIELD_KEYS
            )
        ]

    if event_slug not in FAMILY_SIGNATURE_EVENTS:
        return out

    desired = FAMILY_SIGNATURE_EVENTS[event_slug]
    required = [
        row
        for row in (out.get("required") or [])
        if isinstance(row, dict) and str(row.get("key") or "")
    ]
    optional = [
        row
        for row in (out.get("optional") or [])
        if isinstance(row, dict) and str(row.get("key") or "")
    ]
    by_key: dict[str, dict] = {}
    for row in required + optional:
        by_key[str(row["key"])] = dict(row)

    for key in desired:
        if key not in by_key:
            by_key[key] = _field_def(key)

    required_keys = {str(r["key"]) for r in required}
    required_keys.update(desired)
    if event_slug == "aqiqa":
        required_keys.add("child_name")

    ordered: list[dict] = []
    seen: set[str] = set()
    for key in desired:
        ordered.append(by_key[key])
        seen.add(key)
    for row in required:
        key = str(row["key"])
        if key in seen:
            continue
        if key in required_keys:
            ordered.append(by_key[key])
            seen.add(key)

    out["required"] = ordered
    out["optional"] = [
        by_key[str(row["key"])]
        for row in optional
        if str(row["key"]) not in seen
    ]
    return out


def forwards(apps, schema_editor):
    EventConfig = apps.get_model("content", "EventConfig")
    for event in EventConfig.objects.all():
        if event.slug == "nikoh":
            continue
        updated = _ensure_schema(
            event.fields_schema if isinstance(event.fields_schema, dict) else {},
            event.slug,
        )
        if updated != (event.fields_schema or {}):
            event.fields_schema = updated
            event.save(update_fields=["fields_schema", "updated_at"])


def backwards(apps, schema_editor):
    # Schema enrichment is additive; leave data as-is on reverse.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_text_template_created_by_set_null"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
