"""Allowed design/music IDs for interactive invitation pages.

Keep in sync with frontend/src/page-builder/config catalogs.
Unknown values from AI or clients fall back to DEFAULT_DESIGN / DEFAULT_MUSIC.
"""

from __future__ import annotations

PRIMARY_COLORS = (
    "ivory",
    "beige",
    "gold",
    "burgundy",
    "emerald",
    "navy",
    "rose",
    "black",
    "white",
)

PATTERNS = (
    "oriental",
    "uzbek-national",
    "floral",
    "arabesque",
    "geometric",
    "minimal",
    "royal",
    "elegant",
)

FLOWERS = (
    "rose",
    "tulip",
    "peony",
    "jasmine",
    "lotus",
    "botanical",
    "none",
)

TEXTURES = (
    "handmade-paper",
    "premium-paper",
    "silk",
    "parchment",
    "marble",
    "textured",
    "clean",
)

FRAMES = (
    "gold-ornamental",
    "floral",
    "thin-elegant",
    "double",
    "royal",
    "minimal",
    "none",
)

FONTS = (
    "elegant",
    "classic",
    "modern",
    "oriental",
    "luxury",
    "minimal",
)

ANIMATIONS = (
    "gentle",
    "elegant-reveal",
    "floating-flowers",
    "golden-particles",
    "ornament-reveal",
    "soft-fade",
    "none",
)

DENSITIES = ("minimal", "balanced", "rich")

MUSIC_PRESETS = (
    "elegant",
    "romantic",
    "traditional",
    "oriental",
    "calm",
    "celebration",
    "piano",
    "instrumental",
)

DEFAULT_DESIGN = {
    "primaryColor": "ivory",
    "pattern": "oriental",
    "flower": "rose",
    "texture": "premium-paper",
    "frame": "gold-ornamental",
    "font": "elegant",
    "animation": "gentle",
    "decorationDensity": "balanced",
}

DEFAULT_MUSIC = {
    "source": "preset",
    "presetId": "elegant",
    "url": "",
}

# Curated combinations for Surprise Me / AI Style (not random noise).
CURATED_COMBOS: tuple[dict[str, str], ...] = (
    {
        "primaryColor": "ivory",
        "pattern": "oriental",
        "flower": "rose",
        "texture": "silk",
        "frame": "gold-ornamental",
        "font": "elegant",
        "animation": "elegant-reveal",
        "decorationDensity": "rich",
    },
    {
        "primaryColor": "burgundy",
        "pattern": "royal",
        "flower": "peony",
        "texture": "parchment",
        "frame": "royal",
        "font": "luxury",
        "animation": "ornament-reveal",
        "decorationDensity": "rich",
    },
    {
        "primaryColor": "emerald",
        "pattern": "uzbek-national",
        "flower": "tulip",
        "texture": "handmade-paper",
        "frame": "floral",
        "font": "oriental",
        "animation": "floating-flowers",
        "decorationDensity": "balanced",
    },
    {
        "primaryColor": "navy",
        "pattern": "arabesque",
        "flower": "jasmine",
        "texture": "marble",
        "frame": "double",
        "font": "classic",
        "animation": "golden-particles",
        "decorationDensity": "balanced",
    },
    {
        "primaryColor": "rose",
        "pattern": "floral",
        "flower": "rose",
        "texture": "silk",
        "frame": "floral",
        "font": "elegant",
        "animation": "soft-fade",
        "decorationDensity": "balanced",
    },
    {
        "primaryColor": "gold",
        "pattern": "elegant",
        "flower": "lotus",
        "texture": "premium-paper",
        "frame": "thin-elegant",
        "font": "luxury",
        "animation": "gentle",
        "decorationDensity": "minimal",
    },
    {
        "primaryColor": "beige",
        "pattern": "minimal",
        "flower": "botanical",
        "texture": "clean",
        "frame": "minimal",
        "font": "minimal",
        "animation": "soft-fade",
        "decorationDensity": "minimal",
    },
    {
        "primaryColor": "white",
        "pattern": "geometric",
        "flower": "none",
        "texture": "textured",
        "frame": "thin-elegant",
        "font": "modern",
        "animation": "none",
        "decorationDensity": "minimal",
    },
    {
        "primaryColor": "black",
        "pattern": "royal",
        "flower": "rose",
        "texture": "silk",
        "frame": "gold-ornamental",
        "font": "luxury",
        "animation": "golden-particles",
        "decorationDensity": "rich",
    },
)


_FIELD_CHOICES = {
    "primaryColor": PRIMARY_COLORS,
    "pattern": PATTERNS,
    "flower": FLOWERS,
    "texture": TEXTURES,
    "frame": FRAMES,
    "font": FONTS,
    "animation": ANIMATIONS,
    "decorationDensity": DENSITIES,
}


def sanitize_design_config(raw: object | None) -> dict[str, str]:
    data = raw if isinstance(raw, dict) else {}
    out = dict(DEFAULT_DESIGN)
    for key, choices in _FIELD_CHOICES.items():
        value = str(data.get(key) or "").strip()
        if key == "flower" and value == "dried":
            value = "lotus"
        if value in choices:
            out[key] = value
    return out


def sanitize_music_config(raw: object | None) -> dict[str, str]:
    data = raw if isinstance(raw, dict) else {}
    source = str(data.get("source") or "preset").strip()
    if source not in ("preset", "upload"):
        source = "preset"
    preset = str(data.get("presetId") or DEFAULT_MUSIC["presetId"]).strip()
    if preset not in MUSIC_PRESETS:
        preset = DEFAULT_MUSIC["presetId"]
    url = str(data.get("url") or "").strip()
    if source != "upload":
        url = ""
    return {"source": source, "presetId": preset, "url": url}
