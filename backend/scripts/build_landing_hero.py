"""Build three premium landing invitation cards (transparent floral PNGs)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
PUBLIC = ROOT / "frontend" / "public"
ASSETS = BACKEND / "apps" / "content" / "assets"
TEMPLATES = ASSETS / "templates"

sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from apps.ai_engine.layout import render_invitation_layout  # noqa: E402

CARD_W, CARD_H = 1200, 1500

CARDS = [
    {
        "out": "landing-card-aqiqa.png",
        "source": TEMPLATES / "aqiqa_atelier_blush.jpg",
        "grade": "blush",
        "cut": "round",
        "tags": ["blush", "romance"],
        "blocks": {
            "header": "Assalomu alaykum!",
            "body": "Farzandimizning aqiqa marosimi munosabati bilan Sizni mehmon bo‘lishga taklif etamiz.",
            "date_time": "12 oktabr 2026 | 11:00",
            "address": "Oilaviy dasturxon, Toshkent",
            "footer": "Sizni kutamiz",
        },
    },
    {
        "out": "landing-card-nikoh.png",
        "source": ASSETS / "landing_floral.png",
        "grade": "cream",
        "cut": "silhouette",
        "tags": ["classic", "gold"],
        "blocks": {
            "header": "Assalomu alaykum!",
            "body": "Aziz mehmonimiz, Sizni nikoh to‘yimizga taklif etamiz. Baxtli kunimizni Siz bilan birga nishonlash biz uchun katta sharaf.",
            "date_time": "20 sentabr 2026 | 18:00",
            "address": "Hilton Tashkent",
            "footer": "Sizni kutamiz",
        },
    },
    {
        "out": "landing-card-birthday.png",
        "source": TEMPLATES / "nikoh_atelier_cream.jpg",
        "grade": "champagne",
        "cut": "round",
        "tags": ["champagne", "warm"],
        "blocks": {
            "header": "Tug'ilgan kun muborak!",
            "body": "Tug'ilgan kunni nishonlashga sizni samimiy taklif etamiz. Bayram kayfiyatini birga ulashaylik!",
            "date_time": "5 noyabr 2026 | 19:00",
            "address": "Oilaviy dasturxon, Toshkent",
            "footer": "Sizni kutamiz",
        },
    },
]


def _cover_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    x0 = (nw - tw) // 2
    y0 = (nh - th) // 2
    return img.crop((x0, y0, x0 + tw, y0 + th))


def _sample_margin_paper(rgb: Image.Image) -> tuple[int, int, int]:
    w, h = rgb.size
    samples: list[tuple[int, int, int]] = []
    for x, y in (
        (w // 2, max(4, int(h * 0.04))),
        (max(4, int(w * 0.05)), h // 2),
        (min(w - 5, int(w * 0.95)), h // 2),
        (w // 2, min(h - 5, int(h * 0.96))),
    ):
        patch = rgb.crop((max(0, x - 6), max(0, y - 6), min(w, x + 6), min(h, y + 6)))
        px = patch.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))[:3]
        if sum(px) >= 640:
            samples.append(px)
    if not samples:
        return (252, 247, 236)
    samples.sort(key=sum, reverse=True)
    return samples[0]


def _wipe_text_well(img: Image.Image, *, aggressive: bool = False) -> Image.Image:
    """Clear baked copy in the center with margin paper color; keep corner florals."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    paper = _sample_margin_paper(rgb)
    fill = Image.new("RGB", rgb.size, paper)
    mask = Image.new("L", rgb.size, 0)
    draw = ImageDraw.Draw(mask)
    if aggressive:
        draw.rounded_rectangle(
            (int(w * 0.16), int(h * 0.08), int(w * 0.84), int(h * 0.92)),
            radius=max(36, min(w, h) // 16),
            fill=255,
        )
        draw.polygon([(0, 0), (int(w * 0.46), 0), (0, int(h * 0.38))], fill=0)
        draw.polygon([(w, 0), (int(w * 0.54), 0), (w, int(h * 0.38))], fill=0)
        draw.polygon([(0, h), (int(w * 0.46), h), (0, int(h * 0.62))], fill=0)
        draw.polygon([(w, h), (int(w * 0.54), h), (w, int(h * 0.62))], fill=0)
        draw.rectangle((int(w * 0.12), int(h * 0.04), int(w * 0.88), int(h * 0.24)), fill=255)
        draw.rectangle((int(w * 0.12), int(h * 0.76), int(w * 0.88), int(h * 0.95)), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(8))
        cleaned = Image.composite(fill, rgb, mask)
        diff = ImageChops.difference(cleaned, fill).convert("L")
        ink = diff.point(lambda v: 255 if v >= 18 else 0).filter(ImageFilter.MaxFilter(9))
        mid = Image.new("L", rgb.size, 0)
        ImageDraw.Draw(mid).rectangle(
            (int(w * 0.14), int(h * 0.06), int(w * 0.86), int(h * 0.94)),
            fill=255,
        )
        return Image.composite(fill, cleaned, ImageChops.multiply(ink, mid))

    draw.rounded_rectangle(
        (int(w * 0.22), int(h * 0.18), int(w * 0.78), int(h * 0.80)),
        radius=max(40, min(w, h) // 14),
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(8))
    return Image.composite(fill, rgb, mask)


def _grade(img: Image.Image, kind: str) -> Image.Image:
    rgb = img.convert("RGB")
    if kind == "blush":
        wash = Image.new("RGB", rgb.size, (255, 228, 224))
        out = Image.blend(rgb, wash, 0.10)
        out = ImageEnhance.Color(out).enhance(1.14)
        out = ImageEnhance.Contrast(out).enhance(1.10)
        return ImageEnhance.Sharpness(out).enhance(1.18)
    if kind == "champagne":
        wash = Image.new("RGB", rgb.size, (255, 236, 210))
        out = Image.blend(rgb, wash, 0.12)
        out = ImageEnhance.Color(out).enhance(1.12)
        out = ImageEnhance.Contrast(out).enhance(1.10)
        return ImageEnhance.Sharpness(out).enhance(1.16)
    out = ImageEnhance.Color(rgb).enhance(1.10)
    out = ImageEnhance.Contrast(out).enhance(1.12)
    return ImageEnhance.Sharpness(out).enhance(1.20)


def _knockout_outer_paper(img: Image.Image) -> Image.Image:
    """Make paper outside florals / frame transparent."""
    rgba = img.convert("RGBA")
    rgb = rgba.convert("RGB")
    w, h = rgb.size
    paper = _sample_margin_paper(rgb)
    diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, paper)).convert("L")
    walls = diff.point(lambda v: 255 if v >= 26 else 0)
    walls = walls.filter(ImageFilter.MaxFilter(3))
    field = walls.copy()
    for xy in (
        (2, 2),
        (w - 3, 2),
        (2, h - 3),
        (w - 3, h - 3),
        (w // 2, 2),
        (w // 2, h - 3),
        (2, h // 2),
        (w - 3, h // 2),
    ):
        if field.getpixel(xy) == 0:
            ImageDraw.floodfill(field, xy, 64)
    outer = field.point(lambda v: 255 if v == 64 else 0)
    outer = outer.filter(ImageFilter.GaussianBlur(1.4))
    keep = ImageChops.invert(outer)
    r, g, b, a = rgba.split()
    a = ImageChops.multiply(a, keep)
    out = Image.merge("RGBA", (r, g, b, a))
    out = _keep_main_silhouette(out)
    bbox = out.getbbox()
    if not bbox:
        return out
    pad = 4
    return out.crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(out.width, bbox[2] + pad),
            min(out.height, bbox[3] + pad),
        )
    )


def _keep_main_silhouette(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    opaque = rgba.split()[-1].point(lambda v: 255 if v >= 40 else 0)
    seed = (w // 2, h // 2)
    if opaque.getpixel(seed) < 255:
        return rgba
    ImageDraw.floodfill(opaque, seed, 64)
    keep = opaque.point(lambda v: 255 if v == 64 else 0)
    r, g, b, a = rgba.split()
    a = ImageChops.multiply(a, keep)
    return Image.merge("RGBA", (r, g, b, a))


def _trim_near_white_margin(img: Image.Image) -> Image.Image:
    """Crop near-white canvas padding around atelier cards."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    gray = rgb.convert("L")
    content = gray.point(lambda v: 0 if v >= 248 else 255)
    bbox = content.getbbox()
    if not bbox:
        return img.convert("RGBA")
    pad = 8
    return img.convert("RGBA").crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad),
        )
    )


def _round_card(img: Image.Image, radius: int) -> Image.Image:
    rgba = img.convert("RGBA")
    mask = Image.new("L", rgba.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *rgba.size), radius=radius, fill=255)
    existing = rgba.split()[-1]
    rgba.putalpha(ImageChops.multiply(existing, mask))
    return rgba


def _filled(card: dict) -> Image.Image:
    source = card["source"]
    base = Image.open(source).convert("RGB")
    base = _cover_resize(base, (CARD_W, CARD_H))
    m = max(14, int(min(base.size) * 0.018))
    base = base.crop((m, m, base.width - m, base.height - m))
    base = base.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
    base = _wipe_text_well(base, aggressive=card.get("cut") != "silhouette")
    base = _grade(base, card["grade"])
    painted = render_invitation_layout(
        base,
        card["blocks"],
        style_tags=card["tags"],
        language="uz-latn",
        corner_guard=False,
        wash_text_area=False,
    )
    painted = ImageEnhance.Contrast(painted.convert("RGB")).enhance(1.06)
    painted = ImageEnhance.Sharpness(painted).enhance(1.14)
    if card.get("cut") == "silhouette":
        return _knockout_outer_paper(painted)
    painted = _trim_near_white_margin(painted)
    return _round_card(painted, radius=max(36, min(painted.size) // 26))


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for card in CARDS:
        src = card["source"]
        if not src.exists():
            raise SystemExit(f"Missing source: {src}")
        img = _filled(card)
        dest = PUBLIC / card["out"]
        img.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest} {img.size} ({dest.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
