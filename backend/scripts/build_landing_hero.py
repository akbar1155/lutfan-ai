"""Build a finished-looking home hero (invitations with text, not empty templates)."""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
PUBLIC = ROOT / "frontend" / "public"
MEDIA = BACKEND / "media" / "templates"
OUT = PUBLIC / "landing-hero.png"

sys.path.insert(0, str(BACKEND))

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from apps.ai_engine.generator import overlay_exact_invitation_text  # noqa: E402


CARDS = [
    {
        "stem": "aqiqa_soft_blush",
        "scale": 0.175,
        "rotate": -10,
        "xy": (70, 210),
        "blocks": {
            "header": "Assalomu alaykum!",
            "body": "Farzandimiz Sardor ning aqiqa marosimi munosabati bilan Sizni mehmon bo‘lishga taklif etamiz.",
            "date_time": "12 oktabr 2026, soat 11:00 da",
            "address": "Oilaviy dasturxon, Toshkent",
            "footer": "Sizni kutamiz",
        },
    },
    {
        "stem": "hayit_festive",
        "scale": 0.175,
        "rotate": 9,
        "xy": (980, 190),
        "blocks": {
            "header": "Hayit muborak!",
            "body": "Hayit bayrami munosabati bilan Sizni oilaviy dasturxonimizga taklif etamiz.",
            "date_time": "",
            "address": "Uyimiz, Toshkent",
            "footer": "Sizni kutamiz",
        },
    },
    {
        "stem": "nikoh_cream_gold",
        "scale": 0.22,
        "rotate": -1.5,
        "xy": (470, 40),
        "blocks": {
            "header": "Assalomu alaykum!",
            "body": "Aziz mehmonimiz, Sizni nikoh to‘yimizga taklif etamiz. Baxtli kunimizni Siz bilan birga nishonlash biz uchun katta sharaf.",
            "date_time": "20 sentabr 2026, soat 18:00 da",
            "address": "Hilton Tashkent",
            "footer": "Sizni kutamiz",
        },
    },
]


def _filled(stem: str, blocks: dict) -> Image.Image:
    raw = (MEDIA / f"{stem}.jpg").read_bytes()
    data = overlay_exact_invitation_text(raw, blocks, language="uz-latn")
    return Image.open(io.BytesIO(data)).convert("RGBA")


def _round(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def _with_shadow(img: Image.Image, blur: int = 12, dy: int = 10) -> Image.Image:
    pad = blur * 3
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2 + dy), (0, 0, 0, 0))
    shade = Image.new("RGBA", img.size, (20, 32, 29, 48))
    shade.putalpha(img.split()[-1].point(lambda a: min(a, 48)))
    canvas.paste(shade, (pad, pad + dy), shade)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(img, (pad, pad), img)
    return canvas


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    stage = Image.new("RGBA", (1600, 1100), (0, 0, 0, 0))
    for card in CARDS:
        img = _filled(card["stem"], card["blocks"])
        w = max(int(img.width * card["scale"]), 1)
        h = max(int(img.height * card["scale"]), 1)
        img = img.resize((w, h), Image.Resampling.LANCZOS)
        img = _round(img, radius=max(18, w // 28))
        img = img.rotate(card["rotate"], resample=Image.Resampling.BICUBIC, expand=True)
        img = _with_shadow(img)
        stage.alpha_composite(img, card["xy"])
    bbox = stage.getbbox()
    if bbox:
        pad = 12
        x0 = max(bbox[0] - pad, 0)
        y0 = max(bbox[1] - pad, 0)
        x1 = min(bbox[2] + pad, stage.width)
        y1 = min(bbox[3] + pad, stage.height)
        stage = stage.crop((x0, y0, x1, y1))
    stage.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} {stage.size} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
