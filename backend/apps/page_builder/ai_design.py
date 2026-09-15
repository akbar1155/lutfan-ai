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
    ("primaryColor", "navy", ("navy", "ko‘k", "kok", "blue", "tungi")),
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
    ("flower", "dried", ("quritilgan", "dried")),
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


def heuristic_design_from_prompt(prompt: str) -> dict[str, str]:
    text = _fold(prompt)
    if not text:
        return dict(DEFAULT_DESIGN)
    out = dict(DEFAULT_DESIGN)
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
    return sanitize_design_config(out)


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


def interpret_design_prompt(prompt: str) -> dict[str, str]:
    heuristic = heuristic_design_from_prompt(prompt)
    from_model = _gemini_design(prompt) if (prompt or "").strip() else None
    if not from_model:
        return heuristic
    # Model wins for recognized fields; heuristic already sanitized defaults.
    return sanitize_design_config(from_model)


def pick_curated_combo(exclude: dict | None = None) -> dict[str, str]:
    import random

    current = sanitize_design_config(exclude)
    choices = [c for c in CURATED_COMBOS if c != current] or list(CURATED_COMBOS)
    return dict(random.choice(choices))
