from __future__ import annotations


def event_subtype_mode(event) -> str:
    """Return 'single', 'multi', or 'none' from event config."""
    schema = getattr(event, "fields_schema", None) or {}
    raw = str(schema.get("subtype_mode") or "").strip().lower()
    if raw in {"single", "multi"}:
        return raw
    subtypes = getattr(event, "subtypes", None) or []
    return "multi" if subtypes else "none"


def event_subtype_slugs(event) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in getattr(event, "subtypes", None) or []:
        if not isinstance(item, dict):
            continue
        slug = str(item.get("slug") or "").strip()
        if not slug or slug in seen:
            continue
        seen.add(slug)
        out.append(slug)
    return out


def normalize_invitation_subtypes(
    event,
    slugs: list[str] | None,
    single_slug: str | None = None,
) -> list[str]:
    allowed = set(event_subtype_slugs(event))
    chosen: list[str] = []
    seen: set[str] = set()
    for raw in list(slugs or []) + ([single_slug] if single_slug else []):
        slug = str(raw or "").strip()
        if not slug or slug in seen:
            continue
        if allowed and slug not in allowed:
            continue
        seen.add(slug)
        chosen.append(slug)
    if event_subtype_mode(event) == "single":
        return chosen[:1]
    return chosen
