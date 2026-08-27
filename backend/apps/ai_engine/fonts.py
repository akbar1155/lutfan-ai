"""TrueType/OpenType discovery for invitation overlay.

Production Docker has no macOS fonts. Bundle Noto (Latin + Cyrillic) and
prefer those so PIL never falls back to the tiny bitmap default.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Sequence

from PIL import ImageFont

logger = logging.getLogger(__name__)

_BUNDLE = Path(__file__).resolve().parent / "assets" / "fonts"

_SYSTEM_SANS = [
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]

_SYSTEM_SERIF = [
    "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
]


def _existing(paths: Sequence[str | Path]) -> list[str]:
    out: list[str] = []
    for path in paths:
        p = Path(path)
        if p.is_file():
            out.append(str(p))
    return out


def _bundled(*names: str) -> list[str]:
    return _existing(_BUNDLE / name for name in names)


SANS_PATHS = _bundled("NotoSans-Regular.ttf") + _existing(_SYSTEM_SANS)
SANS_BOLD_PATHS = (
    _bundled("NotoSans-SemiBold.ttf") + SANS_PATHS
)
SERIF_PATHS = (
    _bundled("NotoSerif-Regular.ttf", "NotoSerif-Regular.otf")
    + _existing(_SYSTEM_SERIF)
    + SANS_PATHS
)
SERIF_BOLD_PATHS = (
    _bundled("NotoSerif-SemiBold.ttf", "NotoSerif-SemiBold.otf")
    + SERIF_PATHS
)


def load_font(paths: Sequence[str], size: int) -> ImageFont.ImageFont:
    size = max(int(size), 16)
    for path in paths:
        if not Path(path).is_file():
            continue
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    logger.error(
        "Invitation overlay: no TTF/OTF font found (text will be unreadable). "
        "Install fonts-noto-core or keep apps/ai_engine/assets/fonts/"
    )
    return ImageFont.load_default()


def font_is_scalable(font: ImageFont.ImageFont) -> bool:
    return bool(getattr(font, "path", None) or getattr(font, "size", None) not in (None, 10, 11))
