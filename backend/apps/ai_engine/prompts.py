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


def _inject_hayit_occasion(body: str, occasion: str) -> str:
    """Swap generic Hayit wording for Ramazon / Qurbon when the body is still generic."""
    occ = (occasion or "").strip()
    text = (body or "").replace("{hayit_occasion}", occ or "Hayit")
    if not occ:
        return text
    if occ.lower() in text.lower():
        return text
    patterns = [
        (r"(?i)oilaviy hayit ziyofatimiz", f"oilaviy {occ} ziyofatimiz"),
        (r"(?i)hayit ziyofatimiz", f"{occ} ziyofatimiz"),
        (r"(?i)hayit ziyofatini", f"{occ} ziyofatini"),
        (r"(?i)hayit ziyofati", f"{occ} ziyofati"),
        (r"(?i)hayit bayrami", occ),
        (r"(?i)оилавий ҳайт зиёфатимиз", f"оилавий {occ} зиёфатимиз"),
        (r"(?i)ҳайт зиёфатимиз", f"{occ} зиёфатимиз"),
        (r"(?i)ҳайт зиёфатини", f"{occ} зиёфатини"),
        (r"(?i)ҳайт зиёфати", f"{occ} зиёфати"),
        (r"(?i)ҳайт байрами", occ),
        (r"(?i)семейный праздник Хаит", occ),
        (r"(?i)праздника Хаит", occ),
        (r"(?i)праздник Хаит", occ),
    ]
    for pat, repl in patterns:
        updated, n = re.subn(pat, repl, text, count=1)
        if n:
            return updated
    return text


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
            sanitize_user_text(blocks.get("body", ""), 900), language=lang
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

        # Keep the user's full body — layout shrinks fonts to fit; do not truncate.
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

    # Hayit: no calendar date/time on the card; name Ramazon vs Qurbon in the body
    if event_slug == "hayit":
        date_time = ""
        body = _inject_hayit_occasion(body, _subtype_label(invitation))

    return {
        "header": header,
        "body": body,
        "date_time": date_time,
        "address": address,
        "footer": footer,
    }


def _style_only_payload() -> str:
    """AI draws décor only — invitation words are typeset later in PIL."""
    return STYLE_ONLY_CONSTRAINT


def format_exact_text_for_prompt(blocks: dict[str, str] | None) -> str:
    """Exact invitation copy Gemini must paint onto the card."""
    blocks = blocks or {}
    sections: list[str] = []
    mapping = (
        ("header", "HEADER (greeting / title)"),
        ("body", "BODY (main invitation message)"),
        ("date_time", "DATE & TIME"),
        ("address", "VENUE / ADDRESS"),
        ("footer", "FOOTER (host / signature)"),
    )
    for key, label in mapping:
        value = (blocks.get(key) or "").strip()
        if value:
            sections.append(f'{label}:\n"""\n{value}\n"""')
    if not sections:
        return ""
    return (
        "Render this EXACT text on the invitation card "
        "(character-by-character — no paraphrasing, no translation, no invented lines):\n\n"
        + "\n\n".join(sections)
        + "\n\nOmit empty sections entirely. Do not invent missing names, dates, or addresses."
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


ART_DIRECTOR_ROLE = """
You are a senior invitation art director for a premium Central Asian stationery house.
Design a COMPLETE visual composition for a print-ready digital taklifnoma (invitation card).

You are NOT filling a blank rectangle with text.
You are designing the entire card as a cohesive luxury editorial piece:
frame + corner florals + ornaments + paper atmosphere + visual balance.

Think like a professional wedding invitation designer — modern luxury, not a generic AI template.
""".strip()


STYLE_ONLY_CONSTRAINT = """
TEXT CONSTRAINT (absolute):
- Draw ZERO letters, numbers, words, titles, dates, names, calligraphy, watermarks,
  logos, QR codes, or fake typography in ANY language or script.
- Software will typeset the real invitation text later onto a TEXT-SAFE ZONE.

TEXT-SAFE ZONE (center ~38–45% of the card, continuous paper — NOT a floating panel):
- Soft ivory/cream paper texture only in the middle.
- NO floating white card, NO drop-shadow plate, NO frosted glass box, NO inner parchment rectangle.
- Keep the center calm enough to read overlay text, but the REST of the card must feel richly designed.
""".strip()


TEXT_IN_IMAGE_CONSTRAINT = """
TEXT RENDERING (absolute — the AI paints the full card including typography):
- Paint the EXACT invitation text provided in this prompt — character by character.
- Do NOT invent, paraphrase, translate, shorten, or omit any provided line.
- Do NOT add slogans, fake dates, watermarks, logos, QR codes, or extra names.
- Elegant centered hierarchy: greeting/title larger; body readable; date/time clear; venue below.
- High-contrast dark ink on light cream/ivory paper — crisp, print-ready lettering.
- Correct alphabet exactly as given (Uzbek Latin / Uzbek Cyrillic / Russian).
- Numbers, times, and punctuation must match exactly (e.g. 18:00, apostrophes o‘/g‘).
- Florals/ornaments stay at frame and corners — never cover or muddy the letters.
- Continuous paper center (NO floating white card, NO drop-shadow plate, NO frosted box).
""".strip()


BASE_DESIGN_PROMPT = """
COMPOSITION BRIEF:
- Full-bleed invitation stationery, print-ready, ~8–12% outer margin.
- Design the whole page as one balanced composition (not a sparse template).
- Decorative energy concentrates at frame, corners, and edges; center holds the typography.
- Organic variation: each corner related but NOT copy-pasted identical.
- Motifs should feel hand-composed for THIS occasion — not a sticker pack.
- Aim for luxury wedding/event invitation density: rich but readable.
""".strip()


CORNER_DECORATION_SYSTEM = """
CORNER DECORATION SYSTEM (mandatory):
- All four corners must carry botanical / floral / ornamental presence matching the
  SELECTED decoration language (do not invent roses unless moods ask for roses).
- TOP-LEFT: strongest corner cluster flowing inward from the edge.
- TOP-RIGHT: balancing cluster with organic variation (different arrangement).
- BOTTOM-LEFT: continuation / trailing stems / soft foliage or ornaments.
- BOTTOM-RIGHT: closing composition element.
- Décor must grow naturally FROM the frame edges INTO the card — not tiny floating stickers.
- Forbidden: four identical corner circles, tiny sparse sprigs, empty corners, clip-art icons.
""".strip()


FRAME_SYSTEM = """
FRAME SYSTEM (premium stationery):
- Prefer a double-line or multi-layer elegant frame (thin outer + slightly stronger inner line),
  OR an ornamental gold filigree frame with refined corner joins.
- Optional subtle mid ornaments at top-center and bottom-center (scrollwork, small heart, medallion).
- Frame must have breathing room from the paper edge and from the text-safe center.
- Forbidden as the ONLY decoration: a single plain thin border, border-radius card with no corners,
  thick cheap gold stroke, neon outline.
""".strip()


LAYOUT_SINGLE = """
LAYOUT:
- Centered stationery hierarchy space: middle column reserved for invitation typography.
- Equal left/right margins; florals and ornaments hug the perimeter.
- Optional thin gold separators above/below text blocks (ornament only — not fake words).
- Keep top and bottom motifs fully visible (not cropped).
""".strip()


LAYOUT_SINGLE_WITH_TEXT = """
LAYOUT (full card with painted text):
- Center the invitation copy in a calm middle column with clear vertical rhythm:
  HEADER → BODY → DATE/TIME → ADDRESS → optional FOOTER.
- Comfortable line spacing; body wraps naturally; no cramped edges.
- Equal left/right margins; florals and ornaments hug the perimeter only.
- Optional thin gold rules between sections — never covering letters.
- Keep top and bottom motifs fully visible (not cropped).
""".strip()


LAYOUT_MULTI = """
LAYOUT (multi-ceremony card):
- Same perimeter richness; slightly taller open center for multiple date rows.
- Optional subtle side botanical accents.
- No floating white panel.
""".strip()


LAYOUT_MULTI_WITH_TEXT = """
LAYOUT (multi-ceremony card with painted text):
- Same perimeter richness; taller center column for multiple ceremony date/time rows.
- Paint each ceremony row clearly (label + date/time) using the EXACT lines provided.
- Optional subtle side botanical accents that never cover text.
- No floating white panel.
""".strip()


DECORATION_DENSITY = """
DECORATION DENSITY TARGET: LUXURY (about 40–50% decorative presence on the card).
- Corners and frame must feel filled and intentional.
- Do NOT leave large unexplained empty regions near the edges.
- Do NOT let décor invade or muddy the readable text center.
- If the design looks sparse or "empty template", intensify corners/frame/ornaments.
""".strip()


COLOR_PALETTES = {
    "emerald_gold": (
        "Palette EMERALD_GOLD: ivory/cream paper #FDF8EE, antique muted gold #C5A059, "
        "deep forest green #0B2B24 / #1A4540. Gold must be champagne/antique — never neon."
    ),
    "champagne_olive": (
        "Palette CHAMPAGNE_OLIVE: warm cream, champagne gold, soft olive and sage leaves."
    ),
    "dusty_rose": (
        "Palette DUSTY_ROSE: warm white, dusty rose florals, muted rose-gold accents."
    ),
    "sage_antique": (
        "Palette SAGE_ANTIQUE: ivory, sage green foliage, antique gold ornaments."
    ),
    "burgundy_gold": (
        "Palette BURGUNDY_GOLD: warm white paper, deep burgundy accents, antique gold."
    ),
    "blush_pearl": (
        "Palette BLUSH_PEARL: soft blush wash, pearl cream, rose-gold fine lines."
    ),
}


EVENT_STYLE_PROMPTS = {
    "nikoh": (
        "EVENT — NIKOH (Uzbek wedding): romantic luxury. Cream ivory paper, deep green + "
        "antique gold, elegant double gold frame, soft filigree. Optional subtle rings or "
        "couple silhouette ONLY as tiny edge ornaments (never large faces). "
        "Floral motifs ONLY as directed by selected moods — do not default to roses."
    ),
    "aqiqa": (
        "EVENT — AQIQA: soft, warm, family-oriented elegance. Blush-to-ivory wash, "
        "fine metallic frame, gentle botanical corners. Calm premium, not childish. "
        "Motifs follow selected moods — no default roses."
    ),
    "sunnat": (
        "EVENT — SUNNAT TOʻYI: festive yet dignified Uzbek celebration. Sage + ivory, "
        "thin gold multi-line frame, matching geometric OR floral corners (pick one language). "
        "Optional single crest (crescent OR geometric medallion) — never a mixed icon row."
    ),
    "birthday": (
        "EVENT — TUGʻILGAN KUN: refined celebration stationery. Elegant accents, soft florals "
        "or botanical corners, premium not cartoonish, no balloons overload."
    ),
    "hudoyi": (
        "EVENT — HUDOYI: respectful, restrained traditional elegance. Soft neutrals, "
        "subtle islimiy-inspired geometric or botanical ornaments, calm spiritual luxury."
    ),
    "hayit": (
        "EVENT — HAYIT: festive warm cream paper, deep green and copper/gold accents, "
        "soft floral or geometric ornamental border. Premium Eid gathering feel. No animals."
    ),
    "ramazon_hayiti": (
        "OCCASION — Ramazon hayiti (Eid al-Fitr): joyful feast mood; lantern or crescent "
        "ornaments only at edges; warm festive light; rich but orderly corners."
    ),
    "qurbon_hayiti": (
        "OCCASION — Qurbon hayiti (Eid al-Adha): dignified festive feast; geometric Islamic "
        "corner ornaments; no animals; refined gold frame."
    ),
}


ANTI_PLAIN_RULES = """
NOT ALLOWED (reject these looks):
- Plain white/cream page with only a simple thin border
- Only one weak border and empty corners
- Four tiny identical corner dots/circles
- Generic empty AI template appearance
- Excessive unexplained empty space at edges
- Neon colors, purple glow, cheap gradients, comic/3D plastic
- Mixed sticker icon rows, clipped badges
- Decoration covering the text-safe center
- Floating white card panel / drop-shadow plate in the middle
""".strip()


QUALITY_CONTROL_PROMPT = """
INTERNAL SELF-CRITIQUE before finalizing the image:
1) Is the composition visually rich enough for a premium invitation?
2) Are all four corners properly decorated with organic variation?
3) Is the frame multi-layer / ornamental enough (not a lone thin stroke)?
4) Does it look professionally designed (not a blank template)?
5) Is event type visually suggested through motifs/palette?
6) Is decorative density ~luxury without crushing the center?
7) Any forbidden plain-border / empty-corner look? If yes — enrich and redraw mentally.
Then output the final richly composed BACKGROUND with ZERO text.
""".strip()


QUALITY_CONTROL_WITH_TEXT = """
INTERNAL SELF-CRITIQUE before finalizing the image:
1) Is the composition visually rich enough for a premium invitation?
2) Are all four corners properly decorated with organic variation?
3) Is the frame multi-layer / ornamental enough (not a lone thin stroke)?
4) Is every provided text line painted exactly (spelling, numbers, alphabet)?
5) Is typography crisp, centered, high-contrast, and not covered by florals?
6) Is decorative density ~luxury without crushing readability?
7) Any gibberish, wrong alphabet mix, or invented extra text? If yes — fix mentally.
Then output the final COMPLETE invitation card WITH the exact text painted in.
""".strip()


DEFAULT_NEGATIVE = (
    "any text, letters, numbers, typography, calligraphy writing, watermark, logo, "
    "QR, faces, gibberish glyphs, neon/purple glow, comic/3D plastic, cluttered center, "
    "floating white card panel, drop shadow card, mixed sticker icon row, "
    "clipped/cropped badges, placeholder lorem text, aaaa, plain empty template, "
    "single thin border only, empty corners, sparse decoration, neon gold"
)


DEFAULT_NEGATIVE_WITH_TEXT = (
    "gibberish glyphs, misspelled words, mixed Latin and Cyrillic in the same word, "
    "watermark, logo, QR, faces, neon/purple glow, comic/3D plastic, "
    "floating white card panel, drop shadow card, mixed sticker icon row, "
    "clipped/cropped badges, placeholder lorem text, aaaa, plain empty template, "
    "single thin border only, empty corners, sparse decoration, neon gold, "
    "blurry unreadable letters, text cut off by flowers"
)


# Mood-tag slug → design preset hints (optional enrichment)
MOOD_PRESET_HINTS: dict[str, dict[str, str]] = {
    "rose_gold": {"palette": "dusty_rose", "decoration": "rose"},
    "emerald": {"palette": "emerald_gold", "decoration": "botanical"},
    "ivory": {"palette": "champagne_olive", "decoration": "minimal_luxury"},
    "peonies": {"palette": "dusty_rose", "decoration": "floral"},
    "fine_line": {"palette": "sage_antique", "decoration": "minimal_luxury"},
    "ornament": {"palette": "emerald_gold", "decoration": "uzbek_ornament"},
    "event_rows": {"palette": "champagne_olive", "decoration": "minimal_luxury", "frame": "fine"},
    "minimalist": {"palette": "champagne_olive", "decoration": "minimal_luxury", "frame": "fine", "density": "airy"},
    "velvet": {"palette": "burgundy_gold", "decoration": "luxury_wedding"},
    "watercolor": {"palette": "blush_pearl", "decoration": "botanical"},
    "silk": {"palette": "champagne_olive", "decoration": "floral"},
    "marble": {"palette": "sage_antique", "decoration": "gold_ornamental"},
    "linen": {"palette": "champagne_olive", "decoration": "minimal_luxury"},
    "pearlescent": {"palette": "blush_pearl", "decoration": "gold_ornamental"},
    "handmade": {"palette": "sage_antique", "decoration": "botanical"},
}


DECORATION_STYLE_LINES = {
    "floral": "Decoration language: lush floral bouquets (peonies/garden flowers — roses ONLY if mood asks), soft leaves, natural stems.",
    "botanical": "Decoration language: botanical sprigs, leaves, branches, elegant green foliage — NO roses.",
    "rose": "Decoration language: cream and blush roses with gold-tinted leaves.",
    "gold_ornamental": "Decoration language: antique-gold filigree, scrollwork, refined ornaments — NO roses.",
    "luxury_wedding": "Decoration language: luxury wedding florals + soft gold filigree accents (follow mood flower choice).",
    "uzbek_ornament": (
        "Decoration language: delicate modern-Uzbek ornamental motifs / islimiy-inspired "
        "patterns (subtle, contemporary — not Soviet-era kitsch). NO roses."
    ),
    "romantic": "Decoration language: romantic florals, soft hearts only as tiny ornaments, airy gold lines.",
    "minimal_luxury": "Decoration language: restrained luxury — refined frame, sparse but intentional corner flora — NO roses.",
}


def resolve_design_preset(
    *,
    event_slug: str,
    mood_slugs: list[str] | None = None,
) -> dict[str, str]:
    """
    Modular design preset for Gemini composition.

    Example:
      {style, decoration, frame, palette, density}
    Extend by adding keys to COLOR_PALETTES / DECORATION_STYLE_LINES / MOOD_PRESET_HINTS.
    """
    mood_slugs = mood_slugs or []
    preset = {
        "style": "luxury",
        "decoration": "botanical",
        "frame": "ornamental",
        "palette": "emerald_gold",
        "density": "rich",
    }
    # Event defaults only when the user has not picked moods — otherwise moods win.
    if not mood_slugs:
        event_defaults = {
            "nikoh": {"decoration": "luxury_wedding", "palette": "emerald_gold"},
            "aqiqa": {"decoration": "botanical", "palette": "blush_pearl", "frame": "fine"},
            "sunnat": {"decoration": "uzbek_ornament", "palette": "sage_antique"},
            "birthday": {"decoration": "botanical", "palette": "champagne_olive"},
            "hudoyi": {"decoration": "uzbek_ornament", "palette": "sage_antique", "style": "restrained"},
            "hayit": {"decoration": "uzbek_ornament", "palette": "emerald_gold"},
        }
        preset.update(event_defaults.get(event_slug, {}))
    else:
        event_light = {
            "nikoh": {"palette": "emerald_gold"},
            "aqiqa": {"palette": "blush_pearl", "frame": "fine"},
            "sunnat": {"palette": "sage_antique"},
            "birthday": {"palette": "champagne_olive"},
            "hudoyi": {"palette": "sage_antique", "style": "restrained"},
            "hayit": {"palette": "emerald_gold"},
        }
        preset.update(event_light.get(event_slug, {}))
        for slug in mood_slugs:
            hint = MOOD_PRESET_HINTS.get(slug)
            if hint:
                preset.update(hint)
    return preset


def _palette_line(palette_key: str) -> str:
    return COLOR_PALETTES.get(palette_key, COLOR_PALETTES["emerald_gold"])


def _decoration_line(decoration_key: str) -> str:
    return DECORATION_STYLE_LINES.get(
        decoration_key, DECORATION_STYLE_LINES["floral"]
    )


def _frame_line(frame_key: str) -> str:
    if frame_key == "fine":
        return (
            "Frame: elegant thin double-line gold frame with refined corner joins; "
            "still decorate all four corners florally."
        )
    return FRAME_SYSTEM


def compose_design_modules(
    *,
    event_slug: str,
    fmt: str,
    multi: bool,
    subtype_label: str,
    mood: str,
    preset: dict[str, str],
    user_request: str = "",
    include_text: bool = False,
    text_payload: str = "",
) -> str:
    """Assemble modular Art-Director prompt blocks for Gemini."""
    hayit_extra = ""
    if event_slug == "hayit" and subtype_label:
        lowered = subtype_label.lower()
        if "ramazon" in lowered or "ramadan" in lowered or "fitr" in lowered:
            hayit_extra = EVENT_STYLE_PROMPTS["ramazon_hayiti"]
        elif "qurbon" in lowered or "qurban" in lowered or "adha" in lowered:
            hayit_extra = EVENT_STYLE_PROMPTS["qurbon_hayiti"]

    event_line = EVENT_STYLE_PROMPTS.get(
        event_slug,
        "EVENT: Premium Central Asian celebration invitation — elegant, modern, culturally rooted.",
    )

    if include_text:
        text_constraint = TEXT_IN_IMAGE_CONSTRAINT
        layout = LAYOUT_MULTI_WITH_TEXT if multi else LAYOUT_SINGLE_WITH_TEXT
        quality = QUALITY_CONTROL_WITH_TEXT
        occasion = (
            f"Occasion: {subtype_label}." if subtype_label else ""
        )
        final = (
            "FINAL OUTPUT: a COMPLETE premium invitation card WITH the exact provided "
            "text painted into the design (décor + typography together)."
        )
    else:
        text_constraint = STYLE_ONLY_CONSTRAINT
        layout = LAYOUT_MULTI if multi else LAYOUT_SINGLE
        quality = QUALITY_CONTROL_PROMPT
        occasion = (
            f"Occasion mood for: {subtype_label} (visual only — still zero text)."
            if subtype_label
            else ""
        )
        final = "FINAL OUTPUT: a richly composed invitation BACKGROUND with ZERO readable text."

    parts = [
        ART_DIRECTOR_ROLE,
        BASE_DESIGN_PROMPT,
        text_constraint,
        CORNER_DECORATION_SYSTEM,
        _frame_line(preset.get("frame", "ornamental")),
        layout,
        DECORATION_DENSITY,
        _palette_line(preset.get("palette", "emerald_gold")),
        _decoration_line(preset.get("decoration", "floral")),
        event_line,
        f"Design preset: style={preset.get('style')}, decoration={preset.get('decoration')}, "
        f"frame={preset.get('frame')}, palette={preset.get('palette')}, density={preset.get('density')}.",
        f"One image, aspect ratio {fmt}.",
        f"Visual style cues from SELECTED moods (follow these strictly): {mood}." if mood else "",
        occasion,
        hayit_extra,
        f"Additional art direction: {user_request}" if user_request else "",
        text_payload if include_text and text_payload else "",
        ANTI_PLAIN_RULES,
        quality,
        final,
    ]
    return "\n\n".join(p for p in parts if p)


QUALITY_RULES = DECORATION_DENSITY  # backwards-compatible alias
STYLE_ONLY = STYLE_ONLY_CONSTRAINT
EVENT_STYLE = EVENT_STYLE_PROMPTS


def _compose_quality_tail(
    *,
    lang: str,
    fmt: str,
    subtype_label: str,
    event_slug: str,
    multi: bool,
    mood: str = "",
    mood_slugs: list[str] | None = None,
    user_request: str = "",
    include_text: bool = False,
    text_payload: str = "",
) -> str:
    del lang
    preset = resolve_design_preset(event_slug=event_slug, mood_slugs=mood_slugs)
    return compose_design_modules(
        event_slug=event_slug,
        fmt=fmt,
        multi=multi,
        subtype_label=subtype_label,
        mood=mood,
        preset=preset,
        user_request=user_request,
        include_text=include_text,
        text_payload=text_payload,
    )


def build_prompt(
    invitation: Invitation,
    blocks: dict[str, str] | None = None,
) -> tuple[str, str | None, dict | None]:
    lang = invitation.language
    subtype_label = _subtype_label(invitation)
    multi = _subtype_count(invitation) >= 2
    event_slug = ""
    if getattr(invitation, "event", None):
        event_slug = invitation.event.slug
    elif invitation.event_id:
        event_slug = str(invitation.event_id)
    fmt = invitation.primary_format or "4:5"

    # Gemini paints décor only; PIL typesets exact user text (edits must appear).
    include_text = False
    text_blocks = blocks if blocks is not None else build_text_blocks(invitation)
    text_payload = ""

    model_params: dict = {"aspect_ratio": fmt}
    if invitation.ai_preset and invitation.ai_preset.model_params:
        model_params.update(dict(invitation.ai_preset.model_params))
    model_params["aspect_ratio"] = fmt

    mood_slugs = list(invitation.selected_mood_tags or [])
    mood_snippets: list[str] = []
    if mood_slugs:
        by_slug = {
            m.slug: m.prompt_snippet
            for m in MoodTag.objects.filter(slug__in=mood_slugs, is_active=True)
        }
        mood_snippets = [
            by_slug[s] if s in by_slug else f"visual mood: {s.replace('_', ' ')}"
            for s in mood_slugs
        ]
    custom_note = ""
    if invitation.custom_style_note:
        custom_note = sanitize_user_text(invitation.custom_style_note, 200)
        mood_snippets.append(custom_note)

    rose_allowed = any(s in ("rose_gold", "peonies") for s in mood_slugs)
    if mood_slugs and not rose_allowed:
        mood_snippets.append(
            "CRITICAL: Do NOT draw roses, rose bouquets, or rose-gold florals. "
            "Use ONLY the selected mood motifs above."
        )

    mood = ", ".join(s for s in mood_snippets if s) or (
        "elegant cream stationery, refined ornamental frame, botanical corner accents"
    )

    preset = resolve_design_preset(event_slug=event_slug, mood_slugs=mood_slugs)
    design_modules = compose_design_modules(
        event_slug=event_slug,
        fmt=fmt,
        multi=multi,
        subtype_label=subtype_label,
        mood=mood,
        preset=preset,
        user_request=custom_note,
        include_text=include_text,
        text_payload=text_payload,
    )

    if invitation.generation_path == GenerationPath.TEMPLATE and invitation.template:
        composition = invitation.template.ai_composition_prompt
        prompt = (
            f"{ART_DIRECTOR_ROLE}\n\n"
            f"{composition}\n\n"
            "Style board attached. Create a NEW invitation BACKGROUND in the same "
            "visual language (palette, florals, frame) — not a photocopy. "
            "Keep corner decoration and frame richness at luxury density.\n\n"
            f"{design_modules}"
        )
        negative = (
            invitation.ai_preset.negative_prompt if invitation.ai_preset else DEFAULT_NEGATIVE
        )
        neg = (negative or DEFAULT_NEGATIVE).strip()
        if "any text" not in neg.lower():
            neg = f"{DEFAULT_NEGATIVE}; {neg}"
        return prompt, neg, model_params

    header = (text_blocks.get("header") or "").strip()
    body = (text_blocks.get("body") or "").strip()
    date_time = (text_blocks.get("date_time") or "").strip()
    address = (text_blocks.get("address") or "").strip()
    footer = (text_blocks.get("footer") or "").strip()

    if invitation.ai_preset and invitation.ai_preset.base_prompt:
        base = invitation.ai_preset.base_prompt
        if include_text:
            base = (
                base.replace("{mood_snippets}", mood)
                .replace("{header_text}", header)
                .replace("{body_text}", body)
                .replace("{date_time_text}", date_time)
                .replace("{address_text}", address)
                .replace("{footer_text}", footer)
            )
            # Drop legacy "BACKGROUND (no text)" wording from older presets.
            base = (
                base.replace("BACKGROUND (no text)", "invitation card with exact text")
                .replace("background (no text)", "invitation card with exact text")
                .replace("(no text)", "with exact invitation text")
            )
        else:
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
        prompt = f"{base.rstrip()}\n\n{design_modules}"
    else:
        if include_text:
            prompt = (
                "Create a premium print-ready Uzbek taklifnoma — complete card with "
                "décor AND the exact invitation text painted in.\n\n"
                f"{design_modules}"
            )
        else:
            prompt = (
                "Create a premium print-ready Uzbek taklifnoma BACKGROUND (no text).\n\n"
                f"{design_modules}"
            )

    if include_text:
        negative = (
            invitation.ai_preset.negative_prompt if invitation.ai_preset else None
        ) or DEFAULT_NEGATIVE_WITH_TEXT
        neg = negative.strip()
        # Strip legacy "no text" bans from older seeded negatives.
        for ban in (
            "any text, letters, numbers, watermark, logo, faces,",
            "any text, letters, numbers,",
            "any text,",
        ):
            neg = neg.replace(ban, "")
        if "gibberish" not in neg.lower():
            neg = f"{DEFAULT_NEGATIVE_WITH_TEXT}; {neg}".strip("; ")
    else:
        negative = (
            invitation.ai_preset.negative_prompt if invitation.ai_preset else None
        ) or DEFAULT_NEGATIVE
        neg = negative.strip()
        if "any text" not in neg.lower():
            neg = f"{DEFAULT_NEGATIVE}; {neg}"
        if mood_slugs and not rose_allowed:
            neg = f"{neg}; roses, rose bouquets, rose petals, pink rose clusters"
    return prompt, neg, model_params
