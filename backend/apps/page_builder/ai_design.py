"""Map a free-text design prompt to a restricted design configuration.

Does not touch invitation copy. Never returns HTML/JS.
Falls back to heuristics if Gemini is unavailable.
"""

from __future__ import annotations

import json
import logging
import re

from django.conf import settings

from .catalog import (
    ANIMATIONS,
    CURATED_COMBOS,
    DENSITIES,
    DEFAULT_DESIGN,
    FLOWERS,
    FONTS,
    FRAMES,
    PATTERNS,
    PRIMARY_COLORS,
    TEXTURES,
    sanitize_design_config,
)

logger = logging.getLogger(__name__)

_KEYWORD_MAP: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("primaryColor", "burgundy", ("bordo", "burgundy", "wine", "qizil", "wine-red")),
    ("primaryColor", "emerald", ("zumrad", "emerald", "yashil", "green")),
    ("primaryColor", "navy", ("navy", "ko‘k", "kok", "blue", "tungi", "to‘q ko‘k", "toq kok")),
    ("primaryColor", "gold", ("oltin", "gold", "golden", "zarhal")),
    ("primaryColor", "rose", ("pushti", "rose", "pink", "blush")),
    ("primaryColor", "black", ("qora", "black")),
    ("primaryColor", "white", ("oq ", "white", "snow")),
    ("primaryColor", "beige", ("bej", "beige", "qum")),
    ("primaryColor", "ivory", ("fil suyagi", "ivory", "ochiq fon", "open background", "cream", "krem")),
    ("pattern", "floral", ("gulli", "floral", "gul naqsh")),
    ("pattern", "geometric", ("geometrik", "geometric")),
    ("pattern", "royal", ("royal", "shohona", "saroy")),
    ("pattern", "minimal", ("minimal", "sodda", "clean")),
    ("pattern", "elegant", ("nafis", "elegant")),
    ("pattern", "oriental", ("sharq", "oriental", "arabesk", "naqsh")),
    ("pattern", "arabesque", ("arabesque", "islamiy")),
    ("pattern", "uzbek-national", ("o'zbek", "uzbek", "milliy", "adras", "ikat")),
    ("flower", "none", ("gulsiz", "no flower", "without flower")),
    ("flower", "tulip", ("lola", "tulip")),
    ("flower", "peony", ("pion", "peony")),
    ("flower", "jasmine", ("yasemin", "jasmine")),
    ("flower", "lotus", ("nilufar", "lotus", "quritilgan", "dried")),
    ("flower", "botanical", ("botanik", "botanical", "yaproq")),
    ("flower", "rose", ("atirgul", "rose", "gul")),
    ("texture", "silk", ("ipak", "silk")),
    ("texture", "marble", ("marmar", "marble")),
    ("texture", "parchment", ("pergament", "parchment")),
    ("texture", "handmade-paper", ("qo‘lda", "handmade")),
    ("texture", "textured", ("relyef", "textured")),
    ("texture", "clean", ("tekis fon", "clean paper")),
    ("texture", "premium-paper", ("premium qog‘oz", "premium paper")),
    ("frame", "none", ("ramkasiz", "no frame", "without frame")),
    ("frame", "floral", ("gulli ramka", "floral frame")),
    ("frame", "royal", ("royal ramka", "shohona ramka")),
    ("frame", "double", ("ikki ramka", "double frame")),
    ("frame", "thin-elegant", ("ingichka", "thin frame")),
    ("frame", "minimal", ("minimal ramka",)),
    ("frame", "gold-ornamental", ("oltin ramka", "ornament ramka", "gold frame")),
    ("font", "modern", ("zamonaviy", "modern")),
    ("font", "minimal", ("minimal shrift",)),
    ("font", "oriental", ("sharqona shrift", "oriental font")),
    ("font", "classic", ("klassik", "classic")),
    ("font", "luxury", ("hashamat", "luxury")),
    ("font", "elegant", ("nafis shrift", "elegant font")),
    ("animation", "none", ("animatsiyasiz", "no animation")),
    ("animation", "floating-flowers", ("suzuvchi gul", "floating")),
    ("animation", "golden-particles", ("zarracha", "particle", "oltin chang")),
    ("animation", "ornament-reveal", ("naqsh ochil", "ornament reveal")),
    ("animation", "elegant-reveal", ("sekin ochil", "reveal")),
    ("animation", "soft-fade", ("fade", "so‘nish")),
    ("animation", "gentle", ("yumshoq", "gentle")),
    ("decorationDensity", "minimal", ("kam bezak", "minimal bezak", "toza")),
    ("decorationDensity", "rich", ("boy bezak", "ko‘p bezak", "rich", "luxury dekor")),
    ("decorationDensity", "balanced", ("muvozanat", "balanced")),
)

_ALLOWED = {
    "primaryColor": PRIMARY_COLORS,
    "pattern": PATTERNS,
    "flower": FLOWERS,
    "texture": TEXTURES,
    "frame": FRAMES,
    "font": FONTS,
    "animation": ANIMATIONS,
    "decorationDensity": DENSITIES,
}


def _fold(text: str) -> str:
    return (
        (text or "")
        .strip()
        .lower()
        .replace("‘", "'")
        .replace("’", "'")
        .replace("ʻ", "'")
        .replace("ʼ", "'")
        .replace("`", "'")
    )


def heuristic_design_from_prompt(
    prompt: str, current: dict | None = None
) -> dict[str, str]:
    text = _fold(prompt)
    out = dict(sanitize_design_config(current) if current else DEFAULT_DESIGN)
    if not text:
        return out
    for field, value, needles in _KEYWORD_MAP:
        if any(_fold(n) in text for n in needles):
            out[field] = value
    if "ochiq" in text and "fon" in text:
        out["primaryColor"] = "ivory"
        out["texture"] = "premium-paper"
    if "oltin" in text or "gold" in text:
        out["frame"] = "gold-ornamental"
        if "ochiq" not in text:
            out["primaryColor"] = "gold"
    if not _prompt_mentions_font(text):
        base = sanitize_design_config(current) if current else DEFAULT_DESIGN
        out["font"] = base["font"]
    return sanitize_design_config(out)


def _prompt_mentions_font(text: str) -> bool:
    folded = _fold(text)
    if "shrift" in folded or re.search(r"\bfont\b", folded):
        return True
    explicit = (
        "cormorant",
        "playfair",
        "cinzel",
        "outfit",
        "source serif",
    )
    return any(n in folded for n in explicit)


def _gemini_design(prompt: str) -> dict[str, str] | None:
    api_key = getattr(settings, "GOOGLE_AI_API_KEY", "") or ""
    if not api_key:
        return None
    schema_hint = {
        key: list(values)
        for key, values in _ALLOWED.items()
    }
    instruction = (
        "You map a visual-style request for an Uzbek digital invitation into JSON. "
        "Do not invent HTML, CSS, or JavaScript. Do not change invitation text. "
        "Return ONLY a JSON object with these keys and ONLY values from the allowed lists:\n"
        f"{json.dumps(schema_hint, ensure_ascii=False)}\n"
        f"User style request: {prompt[:500]}"
    )
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=instruction,
            config=types.GenerateContentConfig(
                temperature=0.4,
                response_mime_type="application/json",
            ),
        )
        text = (getattr(response, "text", None) or "").strip()
        if not text:
            return None
        match = re.search(r"\{.*\}", text, re.S)
        payload = json.loads(match.group(0) if match else text)
        if not isinstance(payload, dict):
            return None
        return sanitize_design_config(payload)
    except Exception:
        logger.exception("page_builder AI style mapping failed")
        return None


def interpret_design_prompt(prompt: str, current: dict | None = None) -> dict[str, str]:
    base = sanitize_design_config(current)
    heuristic = heuristic_design_from_prompt(prompt, base)
    from_model = _gemini_design(prompt) if (prompt or "").strip() else None
    if not from_model:
        return heuristic
    # Model wins for recognized fields; keep the user's font unless they asked.
    merged = sanitize_design_config({**base, **from_model})
    if not _prompt_mentions_font(prompt):
        merged["font"] = base["font"]
    return merged


def pick_curated_combo(exclude: dict | None = None) -> dict[str, str]:
    import random

    current = sanitize_design_config(exclude)
    choices = [c for c in CURATED_COMBOS if c != current] or list(CURATED_COMBOS)
    combo = dict(random.choice(choices))
    combo["font"] = current["font"]
    return sanitize_design_config(combo)


_PROMPT_LANG = {
    "uz-latn": "Uzbek Latin",
    "uz-cyrl": "Uzbek Cyrillic",
    "ru": "Russian",
}

_FALLBACK_PROMPTS = {
    "uz-latn": (
        "Nafis, sharqona naqsh, oltin ramka, ochiq fil suyagi fon, atirgul.",
        "Zumrad rang, o‘zbek milliy naqsh, lola, qo‘lda yasalgan qog‘oz.",
        "Bordo hashamat, pion, pergament qog‘oz, boy bezak va shohona ramka.",
        "Pushti gulli naqsh, ipak tekstura, atirgul, yumshoq ochilish.",
        "To‘q ko‘k arabesk, yasemin, marmar fon, ikki qator ramka.",
        "Oltin, nilufar, ingichka ramka, ochiq fon, kam bezak.",
        "Bej, botanik yaproqlar, tekis qog‘oz, sodda ramka.",
    ),
    "uz-cyrl": (
        "Нафис, шарқона нақш, олтин рамка, очиқ фил суяги фон, атиргул.",
        "Зумрад ранг, ўзбек миллий нақш, лола, қўлда ясалган қоғоз.",
        "Бордо ҳашамат, пион, пергамент қоғоз, бой безак ва шоҳона рамка.",
        "Пушти гулли нақш, ипак текстура, атиргул, юмшоқ очилиш.",
        "Тўқ кўк арабеск, ясемин, мармар фон, икки қатор рамка.",
        "Олтин, нилуфар, ингичка рамка, очиқ фон, кам безак.",
        "Беж, ботаник япроқлар, текис қоғоз, содда рамка.",
    ),
    "ru": (
        "Изящный восточный орнамент, золотая рамка, светлый фон, роза.",
        "Изумруд, узбекский узор, тюльпан, бумага ручной работы.",
        "Бордо, пион, пергамент, богатый декор и царская рамка.",
        "Розовый цветочный узор, шёлк, роза, мягкое появление.",
        "Тёмно-синяя арабеска, жасмин, мрамор, двойная рамка.",
        "Золото, лотос, тонкая рамка, светлый фон, мало декора.",
        "Бежевый, ботанические листья, гладкая бумага, простая рамка.",
    ),
}


def _clean_prompt_text(text: str) -> str:
    cleaned = (text or "").strip().strip("\"'`“”«»")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:500]


def _gemini_style_prompt(current: dict[str, str], lang: str) -> str | None:
    api_key = getattr(settings, "GOOGLE_AI_API_KEY", "") or ""
    if not api_key:
        return None
    language = _PROMPT_LANG.get(lang, _PROMPT_LANG["uz-latn"])
    instruction = (
        f"Write ONE short visual-style request for a digital invitation in {language}. "
        "One sentence, max 180 characters. Mention color, ornament, flower, paper or frame. "
        "No HTML, CSS, JavaScript, labels, or quotation marks. Plain text only. "
        f"Make it different from this current look: {json.dumps(current, ensure_ascii=False)}"
    )
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=instruction,
            config=types.GenerateContentConfig(temperature=0.9),
        )
        text = _clean_prompt_text(getattr(response, "text", None) or "")
        return text or None
    except Exception:
        logger.exception("page_builder AI prompt suggestion failed")
        return None


def suggest_style_prompt(
    current: dict | None = None,
    lang: str = "uz-latn",
    exclude: str = "",
) -> str:
    import random

    key = lang if lang in _FALLBACK_PROMPTS else "uz-latn"
    base = sanitize_design_config(current)
    from_model = _gemini_style_prompt(base, key)
    if from_model and _fold(from_model) != _fold(exclude):
        return from_model
    choices = [p for p in _FALLBACK_PROMPTS[key] if _fold(p) != _fold(exclude)]
    return random.choice(choices or list(_FALLBACK_PROMPTS[key]))
