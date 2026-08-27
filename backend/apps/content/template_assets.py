"""Build premium JPG stationery templates (full + preview)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


W, H = 1200, 1500
PW, PH = 600, 750


def _save_pair(img: Image.Image, dest_dir: Path, stem: str) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    full = img.resize((W, H), Image.Resampling.LANCZOS)
    preview = img.resize((PW, PH), Image.Resampling.LANCZOS)
    full.save(dest_dir / f"{stem}.jpg", quality=93, optimize=True)
    preview.save(dest_dir / f"{stem}_preview.jpg", quality=90, optimize=True)


def _paper(
    size: tuple[int, int],
    base: tuple[int, int, int],
    wash: tuple[int, int, int] | None = None,
    wash_alpha: float = 0.18,
) -> Image.Image:
    img = Image.new("RGB", size, base)
    if wash:
        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        a = int(255 * wash_alpha)
        r = int(min(size) * 0.55)
        corners = [
            (-r // 3, -r // 3),
            (size[0] - 2 * r // 3, -r // 3),
            (-r // 3, size[1] - 2 * r // 3),
            (size[0] - 2 * r // 3, size[1] - 2 * r // 3),
        ]
        for x, y in corners:
            draw.ellipse([x, y, x + r, y + r], fill=(*wash, a))
        layer = layer.filter(ImageFilter.GaussianBlur(90))
        img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    noise = Image.effect_noise(size, 10).convert("L")
    grain = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, grain, 0.035)


def _rect_frame(
    img: Image.Image,
    color: tuple[int, int, int],
    *,
    inset: int,
    width: int = 3,
    double: bool = False,
    gap: int = 12,
) -> None:
    draw = ImageDraw.Draw(img)
    x0, y0 = inset, inset
    x1, y1 = img.width - inset, img.height - inset
    for i in range(width):
        draw.rectangle([x0 + i, y0 + i, x1 - i, y1 - i], outline=color)
    if double:
        for i in range(max(1, width - 1)):
            draw.rectangle(
                [x0 + gap + i, y0 + gap + i, x1 - gap - i, y1 - gap - i],
                outline=color,
            )


def _corner_brackets(
    img: Image.Image,
    color: tuple[int, int, int],
    *,
    margin: int = 78,
    arm: int = 70,
    width: int = 3,
) -> None:
    draw = ImageDraw.Draw(img)
    w, h = img.size
    pts = [
        (margin, margin, 1, 1),
        (w - margin, margin, -1, 1),
        (margin, h - margin, 1, -1),
        (w - margin, h - margin, -1, -1),
    ]
    for x, y, sx, sy in pts:
        draw.line([(x, y), (x + sx * arm, y)], fill=color, width=width)
        draw.line([(x, y), (x, y + sy * arm)], fill=color, width=width)


def _rose_cluster(
    img: Image.Image,
    cx: int,
    cy: int,
    *,
    petal: tuple[int, int, int],
    leaf: tuple[int, int, int],
    scale: float = 1.0,
) -> None:
    """Soft stylized rose + leaves for corner accents."""
    draw = ImageDraw.Draw(img)
    s = scale
    # Leaves
    for dx, dy, rot in ((-38, 18, 0), (34, 22, 1), (-10, 40, 0)):
        x = cx + int(dx * s)
        y = cy + int(dy * s)
        rx, ry = int(22 * s), int(10 * s)
        draw.ellipse([x - rx, y - ry, x + rx, y + ry], fill=leaf)
        if rot:
            draw.ellipse([x - ry, y - rx, x + ry, y + rx], fill=leaf)
    # Petals
    for r, a in ((28, 1.0), (22, 0.92), (16, 0.85)):
        rr = int(r * s)
        shade = tuple(max(0, min(255, int(c * a))) for c in petal)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=shade, width=2)
        draw.ellipse(
            [cx - rr + 4, cy - rr + 4, cx + rr - 4, cy + rr - 4],
            outline=shade,
            width=1,
        )
    draw.ellipse(
        [cx - int(6 * s), cy - int(6 * s), cx + int(6 * s), cy + int(6 * s)],
        fill=petal,
    )


def _floral_dots(
    img: Image.Image,
    color: tuple[int, int, int],
    positions: list[tuple[int, int, int]],
) -> None:
    draw = ImageDraw.Draw(img)
    for x, y, r in positions:
        draw.ellipse([x - r, y - r, x + r, y + r], outline=color, width=2)
        draw.ellipse([x - r // 3, y - r // 3, x + r // 3, y + r // 3], fill=color)


def _arc_ornament(img: Image.Image, color: tuple[int, int, int], y: int) -> None:
    draw = ImageDraw.Draw(img)
    cx = img.width // 2
    draw.arc([cx - 70, y - 18, cx + 70, y + 18], 200, 340, fill=color, width=2)
    draw.ellipse([cx - 4, y - 4, cx + 4, y + 4], fill=color)


def make_cream_gold() -> Image.Image:
    """Classic cream paper, gold frame, balanced rose corners."""
    img = _paper((W, H), (253, 248, 238), wash=(184, 149, 74), wash_alpha=0.14)
    _rect_frame(img, (184, 149, 74), inset=52, width=3, double=False)
    rose = (235, 210, 160)
    leaf = (90, 120, 90)
    # Matching weight on both used corners (diagonal pair)
    _rose_cluster(img, 160, 170, petal=rose, leaf=leaf, scale=1.1)
    _rose_cluster(img, 1040, 1330, petal=rose, leaf=leaf, scale=1.1)
    _arc_ornament(img, (26, 69, 64), 250)
    _arc_ornament(img, (26, 69, 64), H - 250)
    return img


def make_soft_blush() -> Image.Image:
    """Soft blush wash, rose-gold frame, fine floral corners."""
    img = _paper((W, H), (255, 248, 246), wash=(220, 150, 150), wash_alpha=0.22)
    _rect_frame(img, (201, 138, 138), inset=48, width=2, double=False)
    petal = (230, 170, 170)
    leaf = (150, 170, 140)
    _rose_cluster(img, 150, 180, petal=petal, leaf=leaf, scale=1.0)
    _rose_cluster(img, 1050, 1320, petal=petal, leaf=leaf, scale=1.0)
    _floral_dots(
        img,
        (201, 138, 138),
        [(600, 160, 7), (600, 1340, 7)],
    )
    return img


def make_emerald_formal() -> Image.Image:
    """Emerald formal — cool sage paper, single gold frame, geometric corners."""
    img = _paper((W, H), (242, 246, 242), wash=(47, 106, 97), wash_alpha=0.16)
    _rect_frame(img, (184, 149, 74), inset=54, width=3, double=False)
    _corner_brackets(img, (26, 69, 64), margin=82, arm=88, width=3)
    _arc_ornament(img, (184, 149, 74), 210)
    _arc_ornament(img, (184, 149, 74), H - 210)
    return img


def make_ivory_minimal() -> Image.Image:
    """Ivory minimal — thin line frame, airy, delicate corner marks."""
    img = _paper((W, H), (252, 250, 245), wash=(200, 190, 170), wash_alpha=0.1)
    _rect_frame(img, (160, 150, 130), inset=78, width=1, double=True, gap=26)
    _corner_brackets(img, (160, 150, 130), margin=96, arm=48, width=2)
    _floral_dots(img, (184, 149, 74), [(600, 200, 5), (600, 1300, 5)])
    return img


def make_champagne_warm() -> Image.Image:
    """Champagne warm — peach paper, copper frame, soft accents."""
    img = _paper((W, H), (255, 248, 240), wash=(232, 180, 130), wash_alpha=0.2)
    _rect_frame(img, (196, 140, 90), inset=44, width=4, double=False)
    _floral_dots(
        img,
        (196, 140, 90),
        [
            (140, 160, 18),
            (1060, 190, 14),
            (160, 1320, 16),
            (1040, 1280, 18),
            (600, 140, 10),
            (600, 1360, 10),
        ],
    )
    petal = (240, 190, 140)
    leaf = (140, 150, 100)
    _rose_cluster(img, 180, 200, petal=petal, leaf=leaf, scale=0.85)
    _rose_cluster(img, 1020, 1300, petal=petal, leaf=leaf, scale=0.9)
    return img


def make_hayit_festive() -> Image.Image:
    """Hayit — warm cream paper, deep green frame, festive copper dots."""
    img = _paper((W, H), (253, 246, 232), wash=(140, 50, 40), wash_alpha=0.14)
    _rect_frame(img, (46, 90, 62), inset=48, width=3, double=True, gap=14)
    _floral_dots(
        img,
        (184, 120, 70),
        [
            (150, 170, 14),
            (1050, 180, 12),
            (160, 1310, 12),
            (1040, 1290, 14),
            (600, 150, 8),
            (600, 1350, 8),
        ],
    )
    _arc_ornament(img, (46, 90, 62), 200)
    _arc_ornament(img, (46, 90, 62), H - 200)
    return img


SHARED_DESIGNS = [
    {
        "stem": "shared_cream_gold",
        "theme_name": "Cream Gold Classic",
        "builder": make_cream_gold,
        "palette": ["#fdf8ee", "#b8954a", "#1a4540"],
        "tags": ["classic", "gold", "roses"],
        "look": (
            "cream ivory textured paper, thin gold double frame, soft rose clusters "
            "in corners, deep green accents, refined stationery"
        ),
    },
    {
        "stem": "shared_soft_blush",
        "theme_name": "Soft Blush Romance",
        "builder": make_soft_blush,
        "palette": ["#fff8f6", "#c98a8a", "#d4a574"],
        "tags": ["blush", "romantic", "soft"],
        "look": (
            "soft white-to-blush wash, rose-gold double frame, delicate floral corners, "
            "airy romantic mood"
        ),
    },
    {
        "stem": "shared_emerald_formal",
        "theme_name": "Emerald Formal",
        "builder": make_emerald_formal,
        "palette": ["#e8efe9", "#1a4540", "#b8954a"],
        "tags": ["formal", "emerald", "gold"],
        "look": (
            "cool sage-cream paper, gold double frame, emerald geometric corners, "
            "dignified formal mood"
        ),
    },
    {
        "stem": "shared_ivory_minimal",
        "theme_name": "Ivory Minimal",
        "builder": make_ivory_minimal,
        "palette": ["#fcfaf5", "#a09682", "#b8954a"],
        "tags": ["minimal", "ivory", "clean"],
        "look": (
            "warm ivory paper, thin double taupe frame, generous white space, "
            "clean minimal luxury"
        ),
    },
    {
        "stem": "shared_champagne_warm",
        "theme_name": "Champagne Warm",
        "builder": make_champagne_warm,
        "palette": ["#fff4ea", "#c48c5a", "#e8c9a8"],
        "tags": ["warm", "champagne", "festive"],
        "look": (
            "warm champagne-peach paper, copper-gold frame, soft festive accents, "
            "joyful premium celebration mood"
        ),
    },
]


# Per-event 3-card sets (key → theme, tags). Featured is always first.
EVENT_TEMPLATE_PICKS: dict[str, list[tuple[str, str, list[str]]]] = {
    "nikoh": [
        ("cream_gold", "Oq-oltin klassika", ["classic", "gold", "roses"]),
        ("soft_blush", "Atirgul romantik", ["blush", "romantic", "soft"]),
        ("ivory_minimal", "Filsuyak minimal", ["minimal", "ivory", "clean"]),
    ],
    "aqiqa": [
        ("soft_blush", "Mayin pushti", ["blush", "romantic", "soft"]),
        ("cream_gold", "Iliq krem", ["classic", "gold", "roses"]),
        ("champagne_warm", "Shampan issiq", ["warm", "champagne", "festive"]),
    ],
    "sunnat": [
        ("emerald_formal", "Zumrad rasmiy", ["formal", "emerald", "gold"]),
        ("ivory_minimal", "Och fil suyagi", ["minimal", "ivory", "clean"]),
        ("cream_gold", "Oltin ramka", ["classic", "gold", "roses"]),
    ],
    "birthday": [
        ("champagne_warm", "Bayram shampani", ["warm", "champagne", "festive"]),
        ("soft_blush", "Yengil pushti", ["blush", "romantic", "soft"]),
        ("ivory_minimal", "Zamonaviy ivory", ["minimal", "ivory", "clean"]),
    ],
    "hudoyi": [
        ("ivory_minimal", "Tinch ivory", ["minimal", "ivory", "clean"]),
        ("emerald_formal", "Sokin yashil", ["formal", "emerald", "gold"]),
        ("cream_gold", "Oddiy klassika", ["classic", "gold", "roses"]),
    ],
    "hayit": [
        ("festive", "Hayit bayrami", ["festive", "hayit", "green"]),
        ("champagne_warm", "Issiq dasturxon", ["warm", "champagne", "festive"]),
        ("cream_gold", "Krem-oltin", ["classic", "gold", "roses"]),
    ],
}


_DESIGN_BUILDERS = {
    "cream_gold": make_cream_gold,
    "soft_blush": make_soft_blush,
    "emerald_formal": make_emerald_formal,
    "ivory_minimal": make_ivory_minimal,
    "champagne_warm": make_champagne_warm,
    "festive": make_hayit_festive,
    "hayit_festive": make_hayit_festive,
}

_HAYIT_FESTIVE_META = {
    "palette": ["#fdf6e8", "#2e5a3e", "#b87846"],
    "look": (
        "warm cream paper, deep green double frame, festive copper dots, "
        "Eid / Hayit holiday mood — not a wedding card"
    ),
}


def design_meta(key: str) -> dict:
    """Palette + look for a design key used in EVENT_TEMPLATE_PICKS."""
    if key in ("hayit_festive", "festive"):
        return dict(_HAYIT_FESTIVE_META)
    stem = f"shared_{key}"
    for design in SHARED_DESIGNS:
        if design["stem"] == stem or design["stem"].endswith(key):
            return {"palette": design["palette"], "look": design["look"]}
    first = SHARED_DESIGNS[0]
    return {"palette": first["palette"], "look": first["look"]}


def build_all(assets_dir: Path, media_dir: Path) -> None:
    """Build shared catalog plus per-event stems so gallery cards are unique."""
    assets_dir.mkdir(parents=True, exist_ok=True)

    for design in SHARED_DESIGNS:
        _save_pair(design["builder"](), assets_dir, design["stem"])
    _save_pair(make_hayit_festive(), assets_dir, "hayit_festive")

    for event_slug, picks in EVENT_TEMPLATE_PICKS.items():
        for key, _theme, _tags in picks:
            builder = _DESIGN_BUILDERS.get(key) or make_cream_gold
            _save_pair(builder(), assets_dir, f"{event_slug}_{key}")

    media_dir.mkdir(parents=True, exist_ok=True)
    for src in assets_dir.glob("*.jpg"):
        target = media_dir / src.name
        data = src.read_bytes()
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
