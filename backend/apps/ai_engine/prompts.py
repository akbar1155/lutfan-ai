from __future__ import annotations

import re

from apps.content.models import MoodTag
from apps.core.dates import format_dates_in_text
from apps.invitations.models import GenerationPath, Invitation

from .spelling import (
    normalize_invitation_spelling,
    sanitize_overlay_field,
    scrub_junk_lines,
)

_DATETIME_LINE_RE = re.compile(
    r"("
    r"\d{1,2}\s*[-./]\s*[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘']+"
    r"|\d{1,2}\.\d{1,2}\.\d{4}"
    r").*\d{1,2}:\d{2}"
    r"|soat\s+\d{1,2}:\d{2}"
    r"|соат\s+\d{1,2}:\d{2}",
    re.IGNORECASE,
)


def _looks_like_datetime_line(text: str) -> bool:
    t = (text or "").strip()
    if not t or "\n" in t or len(t) > 90:
        return False
    return bool(_DATETIME_LINE_RE.search(t))


def sanitize_user_text(value: str, max_len: int = 400) -> str:
    text = (value or "").strip()[:max_len]
    text = text.replace("{", "(").replace("}", ")")
    return text


def _event_slug(invitation: Invitation) -> str:
    if getattr(invitation, "event", None):
        return invitation.event.slug or ""
    if invitation.event_id:
        return str(invitation.event_id)
    return ""


def _inject_child_name(body: str, child: str, lang: str) -> str:
    """Put the child's name in the body instead of using it as a footer."""
    child = (child or "").strip()
    body = (body or "").strip()
    if not child:
        return body
    if child.lower() in body.lower():
        return body
    patterns = [
        (r"(?i)farzandimizning", f"farzandimiz {child}ning"),
        (r"(?i)фарзандимизнинг", f"фарзандимиз {child}нинг"),
        (r"(?i)o[ʻʼ''`]?g[ʻʼ''`]?limizning", f"oʻgʻlimiz {child}ning"),
        (r"(?i)ўғлимизнинг", f"ўғлимиз {child}нинг"),
        (r"(?i)нашего ребёнка", f"нашего ребёнка {child}"),
        (r"(?i)нашего сына", f"нашего сына {child}"),
        (r"(?i)our (?:child|son)", f"our child {child}"),
    ]
    for pat, repl in patterns:
        updated, n = re.subn(pat, repl, body, count=1)
        if n:
            return updated
    if not body:
        return child
    if lang.startswith("ru"):
        return f"{body.rstrip('.')} — {child}."
    return f"{body.rstrip('.')} {child}."


def build_text_blocks(invitation: Invitation) -> dict[str, str]:
    data = invitation.event_data or {}
    blocks = data.get("final_text_blocks") or {}
    lang = invitation.language
    header = normalize_invitation_spelling(
        format_dates_in_text(
            sanitize_user_text(blocks.get("header", "")), language=lang
        ),
        lang,
    )
    body = normalize_invitation_spelling(
        format_dates_in_text(
            sanitize_user_text(blocks.get("body", ""), 600), language=lang
        ),
        lang,
    )
    date_time = normalize_invitation_spelling(
        format_dates_in_text(
            sanitize_user_text(blocks.get("date_time", "")), language=lang
        ),
        lang,
    )
    address = normalize_invitation_spelling(
        sanitize_user_text(blocks.get("address", "")), lang
    )
    footer = normalize_invitation_spelling(
        sanitize_user_text(blocks.get("footer", "")), lang
    )
    structured = data.get("structured_fields") or {}
    schedule = data.get("ceremony_schedule") or {}

    header = sanitize_overlay_field(header)
    body = scrub_junk_lines(body)
    date_time = scrub_junk_lines(date_time)
    address = sanitize_overlay_field(address)
    footer = sanitize_overlay_field(footer)

    from apps.core.dates import format_display_datetime

    if not date_time:
        recovered = format_display_datetime(
            (structured.get("event_date") or "").strip() or None,
            (structured.get("event_time") or "").strip() or None,
            language=lang,
        )
        if recovered:
            date_time = normalize_invitation_spelling(recovered, lang)

    # Custom text sometimes puts the date in body and junk in date_time
    if _looks_like_datetime_line(body):
        if not date_time:
            date_time = body
        body = ""

    # Prefer per-part schedule when user hasn't already set a multi-line date block
    if isinstance(schedule, dict):
        valid_slots = {
            k: v
            for k, v in schedule.items()
            if isinstance(v, dict)
            and ((v.get("date") or "").strip() or (v.get("time") or "").strip())
        }
    else:
        valid_slots = {}

    if len(valid_slots) >= 2:
        from apps.core.dates import format_display_datetime

        from .layout import condense_invite_body

        body = condense_invite_body(body)

        lines: list[str] = []
        preferred = list(invitation.subtype_slugs or []) or list(valid_slots.keys())
        # Chronological; primary nikoh first on ties
        def _slot_key(slug: str) -> tuple:
            slot = valid_slots.get(slug) or {}
            d = (slot.get("date") or "9999-99-99").strip()
            tm = (slot.get("time") or "99:99").strip()
            primary = 0 if re.search(r"nikoh|vechir", slug, re.I) else 1
            return (d, tm, primary, slug)

        slugs = sorted(
            [s for s in preferred if s in valid_slots] or list(valid_slots.keys()),
            key=_slot_key,
        )
        for slug in slugs:
            slot = valid_slots.get(slug)
            if not slot:
                continue
            d = (slot.get("date") or "").strip()
            tm = (slot.get("time") or "").strip()
            label = _subtype_name(invitation, slug)
            when = format_display_datetime(d or None, tm or None, language=lang)
            if when:
                lines.append(f"{label} | {when}" if label else when)
        if lines:
            date_time = normalize_invitation_spelling("\n".join(lines), lang)
    else:
        subtype_label = _subtype_label(invitation)
        parts = [p.strip() for p in subtype_label.split(",") if p.strip()]
        if len(parts) >= 2 and date_time and "\n" not in date_time:
            date_time = "\n".join(f"{part} | {date_time}" for part in parts)

    if not footer:
        footer = sanitize_overlay_field(
            normalize_invitation_spelling(
                sanitize_user_text(structured.get("family_signature", ""), 120),
                lang,
            )
        )
    child = sanitize_overlay_field(structured.get("child_name", ""))
    event_slug = _event_slug(invitation)
    if child and event_slug in ("aqiqa", "sunnat"):
        body = _inject_child_name(body, child, lang)
        if footer and footer.lower() == child.lower():
            footer = ""

    # Hayit: no calendar date/time on the card
    if event_slug == "hayit":
        date_time = ""

    return {
        "header": header,
        "body": body,
        "date_time": date_time,
        "address": address,
        "footer": footer,
    }


def _style_only_payload() -> str:
    """AI draws décor only — invitation words are typeset later in PIL."""
    return (
        "CRITICAL: NO TEXT on the image at all.\n"
        "Do NOT draw letters, numbers, words, titles, dates, names, watermarks, "
        "or fake typography in any language/script.\n"
        "Leave a calm, mostly empty center area (soft paper/texture) for text "
        "to be added later by software.\n"
        "Only decorative stationery: paper texture, elegant frame, florals, "
        "ornaments, soft lighting."
    )


def _subtype_name(invitation: Invitation, slug: str) -> str:
    event = invitation.event
    for item in event.subtypes or []:
        if item.get("slug") == slug:
            tr = item.get("names") or {}
            return (
                tr.get(invitation.language)
                or tr.get("uz-latn")
                or tr.get("uz-cyrl")
                or slug
            )
    return slug


def _subtype_label(invitation: Invitation) -> str:
    slugs = list(invitation.subtype_slugs or [])
    if not slugs and invitation.subtype_slug:
        slugs = [invitation.subtype_slug]
    if not slugs:
        return ""
    event = invitation.event
    names: list[str] = []
    for item in event.subtypes or []:
        if item.get("slug") in slugs:
            tr = item.get("names") or {}
            names.append(
                tr.get(invitation.language)
                or tr.get("uz-latn")
                or tr.get("uz-cyrl")
                or item.get("slug")
            )
    return ", ".join(names) if names else ", ".join(slugs)


def _subtype_count(invitation: Invitation) -> int:
    slugs = list(invitation.subtype_slugs or [])
    if not slugs and invitation.subtype_slug:
        slugs = [invitation.subtype_slug]
    return len(slugs)


STYLE_ONLY = """
STYLE-ONLY BACKGROUND (text is NOT rendered by the image model):
- Zero letters/numbers/glyphs anywhere on the card.
- Empty readable center (cream/ivory paper continuous with the page — NO floating white card panel, NO drop-shadow card, NO frosted glass plate behind text).
- ONE elegant outer frame only (avoid double heavy framing).
- Frame and florals stay in borders/corners — never crowd the center.
- Corner florals must match each other in style and weight (or use a single strong corner).
- At most 1–2 cultural motifs total; never a mixed sticker row of unrelated icons.
- No fake "Lorem" or sample invitation wording.
- Do NOT draw an inner rectangle, parchment card, or shadowed box in the middle.
""".strip()


EVENT_STYLE = {
    "nikoh": (
        "Uzbek wedding taklifnoma: cream ivory paper, thin gold frame, matching corner roses, "
        "deep green accents, gold flourishes. No icon sticker packs. "
        "Palette cream #FDF8EE, gold #C5A059, green #0B2B24."
    ),
    "aqiqa": (
        "Aqiqa card: white-to-blush wash, rose-gold frame, fine-line roses, "
        "calm open center. Palette blush, white, rose-gold."
    ),
    "sunnat": (
        "Sunnat toʻyi: sage + ivory paper, ONE thin gold frame, matching geometric or "
        "fine floral corners only. Optional single crest (crescent OR geometric medallion) — "
        "never a row of mixed icons (no mosque+drum+mandala sticker pack). "
        "Dignified, formal, empty center for text."
    ),
    "birthday": (
        "Birthday invite: refined modern celebration, soft accents, elegant not childish."
    ),
    "hudoyi": (
        "Hudoyi: calm spiritual elegance, soft neutrals, minimal ornament."
    ),
    "hayit": (
        "Hayit: festive warm tones, soft floral/geometric border, premium feel."
    ),
}


LAYOUT_SINGLE = """
Layout: elegant centered stationery — ornate border/corners, soft open middle (same paper, not a separate card).
Equal left/right margins; florals only at edges; keep top and bottom motifs fully visible.
""".strip()


LAYOUT_MULTI = """
Layout: same elegant stationery with a clear open center; optional subtle side motifs.
Still no text or labels for ceremony parts; no floating white panel.
""".strip()


DEFAULT_NEGATIVE = (
    "any text, letters, numbers, typography, calligraphy writing, watermark, logo, "
    "QR, faces, gibberish glyphs, neon/purple glow, comic/3D plastic, cluttered center, "
    "floating white card panel, drop shadow card, mixed sticker icon row, "
    "clipped/cropped badges, placeholder lorem text, aaaa"
)


QUALITY_RULES = """
Print-ready full-bleed invitation background; ~8–12% margins; premium paper feel;
sharp florals/frame; high-end Central Asian celebration stationery aesthetic.
Center must stay soft and empty for later text overlay.
""".strip()


def _compose_quality_tail(
    *,
    lang: str,
    fmt: str,
    subtype_label: str,
    event_slug: str,
    multi: bool,
) -> str:
    del lang  # Script handled when PIL overlays final copy
    parts = [
        STYLE_ONLY,
        QUALITY_RULES,
        LAYOUT_MULTI if multi else LAYOUT_SINGLE,
        f"One image, aspect {fmt}.",
        EVENT_STYLE.get(
            event_slug,
            "Premium Central Asian celebration invitation, elegant and modern.",
        ),
    ]
    if subtype_label:
        parts.append(
            f"Occasion mood for: {subtype_label} "
            "(visual mood only — still draw zero text)."
        )
    return "\n".join(parts)


def build_prompt(invitation: Invitation) -> tuple[str, str | None, dict | None]:
    lang = invitation.language
    subtype_label = _subtype_label(invitation)
    multi = _subtype_count(invitation) >= 2
    event_slug = ""
    if getattr(invitation, "event", None):
        event_slug = invitation.event.slug
    elif invitation.event_id:
        event_slug = str(invitation.event_id)
    fmt = invitation.primary_format or "4:5"

    model_params: dict = {"aspect_ratio": fmt}
    if invitation.ai_preset and invitation.ai_preset.model_params:
        model_params.update(dict(invitation.ai_preset.model_params))
    model_params["aspect_ratio"] = fmt

    style_payload = _style_only_payload()
    quality_tail = _compose_quality_tail(
        lang=lang,
        fmt=fmt,
        subtype_label=subtype_label,
        event_slug=event_slug,
        multi=multi,
    )

    if invitation.generation_path == GenerationPath.TEMPLATE and invitation.template:
        composition = invitation.template.ai_composition_prompt
        prompt = (
            f"{composition}\n\n"
            "Style board attached. Create a NEW invitation BACKGROUND in the same "
            "visual language (palette, florals, frame) — not a photocopy.\n\n"
            f"{style_payload}\n\n"
            f"{quality_tail}\n\n"
            "FINAL CHECK: the image must contain ZERO readable text."
        )
        negative = (
            invitation.ai_preset.negative_prompt if invitation.ai_preset else DEFAULT_NEGATIVE
        )
        # Always forbid text even if preset negative is soft
        neg = (negative or DEFAULT_NEGATIVE).strip()
        if "any text" not in neg.lower():
            neg = f"{DEFAULT_NEGATIVE}; {neg}"
        return prompt, neg, model_params

    mood_snippets = []
    if invitation.selected_mood_tags:
        mood_snippets = list(
            MoodTag.objects.filter(
                slug__in=invitation.selected_mood_tags, is_active=True
            ).values_list("prompt_snippet", flat=True)
        )
    if invitation.custom_style_note:
        mood_snippets.append(sanitize_user_text(invitation.custom_style_note, 200))
    mood = ", ".join(mood_snippets) or (
        "cream ivory paper, thin gold frame, corner roses, deep green accents"
        if event_slug == "nikoh"
        else "soft blush pink wash, rose-gold double frame, fine-line roses"
        if event_slug == "aqiqa"
        else "elegant classic ivory and soft gold"
    )

    if invitation.ai_preset and invitation.ai_preset.base_prompt:
        base = invitation.ai_preset.base_prompt
        for token in (
            'HEADER: "{header_text}"',
            'BODY: "{body_text}"',
            'DATE_TIME: "{date_time_text}"',
            'ADDRESS: "{address_text}"',
            'HEADER (greeting / title): "{header_text}"',
            'BODY (main message): "{body_text}"',
            'ADDRESS (venue): "{address_text}"',
            "Render this EXACT text (character-by-character, no paraphrasing):\n",
            "Render this exact text on the card:\n",
            "Render this exact text with clear hierarchy:\n",
        ):
            base = base.replace(token, "")
        base = (
            base.replace("{mood_snippets}", mood)
            .replace("{header_text}", "")
            .replace("{body_text}", "")
            .replace("{date_time_text}", "")
            .replace("{address_text}", "")
            .replace("{footer_text}", "")
        )
    else:
        base = (
            "Create a premium print-ready Uzbek taklifnoma BACKGROUND (no text). "
            f"Visual style: {mood}."
        )

    prompt = (
        base.rstrip()
        + "\n\n"
        + style_payload
        + "\n\n"
        + quality_tail
        + "\n\n"
        + "FINAL CHECK: the image must contain ZERO readable text of any kind."
    )
    negative = (
        invitation.ai_preset.negative_prompt if invitation.ai_preset else None
    ) or DEFAULT_NEGATIVE
    neg = negative.strip()
    if "any text" not in neg.lower():
        neg = f"{DEFAULT_NEGATIVE}; {neg}"
    return prompt, neg, model_params
