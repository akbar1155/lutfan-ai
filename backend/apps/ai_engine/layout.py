"""Premium invitation typography & layout for PIL text overlay."""

from __future__ import annotations

import re
import textwrap
from dataclasses import dataclass
from typing import Sequence

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .fonts import (
    SANS_BOLD_PATHS,
    SANS_PATHS,
    SERIF_BOLD_PATHS,
    SERIF_PATHS,
    load_font,
)

_PRIMARY_LABEL_RE = re.compile(
    r"nikoh|никах|vechir|oqshom|оқшом|вечерн",
    re.IGNORECASE,
)

_MONTH_INDEX = {
    "yanvar": 1,
    "fevral": 2,
    "mart": 3,
    "aprel": 4,
    "may": 5,
    "iyun": 6,
    "iyul": 7,
    "avgust": 8,
    "sentabr": 9,
    "oktabr": 10,
    "noyabr": 11,
    "dekabr": 12,
    "январ": 1,
    "феврал": 2,
    "март": 3,
    "апрел": 4,
    "май": 5,
    "июн": 6,
    "июл": 7,
    "август": 8,
    "сентабр": 9,
    "октабр": 10,
    "ноябр": 11,
    "декабр": 12,
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}

_DATE_TIME_RE = re.compile(
    r"^(?P<label>.+?)\s*[-–—|]\s*(?P<rest>.+)$",
)
_DATETIME_BODY_RE = re.compile(
    r"^(?P<date>\d{1,2}-[^\s,|]+|"
    r"\d{1,2}\s+[^\s,|]+|"
    r"\d{1,2}\.[^\s,|]+)"
    r"(?:,?\s*(?:soat|соат|в)?\s*(?P<time>\d{1,2}:\d{2})\s*(?:da|да)?)?$",
    re.IGNORECASE,
)
_PLAIN_DT_RE = re.compile(
    r"^(?P<date>\d{1,2}-[A-Za-z‘’ʻА-Яа-яЁёЎўҚқҒғҲҳ]+|"
    r"\d{1,2}\s+[A-Za-zА-Яа-яЁё]+)"
    r",?\s*(?:soat|соат)?\s*(?P<time>\d{1,2}:\d{2})\s*(?:da|да)?$",
    re.IGNORECASE,
)


@dataclass
class SafeRegion:
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0

    @property
    def height(self) -> int:
        return self.y1 - self.y0

    @property
    def cx(self) -> int:
        return (self.x0 + self.x1) // 2


@dataclass
class FontPlan:
    header: ImageFont.ImageFont
    body: ImageFont.ImageFont
    date_label: ImageFont.ImageFont
    date_meta: ImageFont.ImageFont
    date_primary: ImageFont.ImageFont
    address: ImageFont.ImageFont
    host: ImageFont.ImageFont
    header_size: int
    body_size: int
    date_size: int
    address_size: int
    host_size: int


def _truetype(paths: Sequence[str], size: int) -> ImageFont.ImageFont:
    return load_font(paths, size)


def _font_size(font: ImageFont.ImageFont, fallback: int = 28) -> int:
    return int(getattr(font, "size", fallback) or fallback)


def analyze_safe_region(
    img: Image.Image, *, corner_guard: bool = False
) -> SafeRegion:
    """
    Estimate the inner text-safe rectangle.
    Keeps outer band for frames/florals while maximizing usable type area.
    corner_guard: extra inset for Gemini florals that bleed into the title.
    """
    w, h = img.size
    tall = h / max(w, 1) > 1.5
    if corner_guard:
        side = 0.168 if tall else 0.155
        top = 0.195
        bottom = 0.188
    else:
        side = 0.118 if tall else 0.108
        top = 0.132
        bottom = 0.128
    return SafeRegion(
        x0=int(w * side),
        y0=int(h * top),
        x1=int(w * (1 - side)),
        y1=int(h * (1 - bottom)),
    )


def _sample_paper(img: Image.Image, safe: SafeRegion) -> tuple[int, int, int]:
    boxes = [
        (
            safe.x0 + int(safe.width * 0.35),
            safe.y0 + int(safe.height * 0.08),
            safe.x0 + int(safe.width * 0.65),
            safe.y0 + int(safe.height * 0.16),
        ),
        (
            safe.x0 + int(safe.width * 0.40),
            safe.y0 + int(safe.height * 0.45),
            safe.x0 + int(safe.width * 0.60),
            safe.y0 + int(safe.height * 0.52),
        ),
    ]
    samples: list[tuple[int, int, int]] = []
    for box in boxes:
        try:
            px = img.crop(box).resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
            samples.append(px[:3])
        except Exception:
            continue
    if not samples:
        return (253, 248, 238)
    return (
        sum(s[0] for s in samples) // len(samples),
        sum(s[1] for s in samples) // len(samples),
        sum(s[2] for s in samples) // len(samples),
    )


def clear_safe_text_area(
    img: Image.Image, safe: SafeRegion, *, corner_guard: bool = False
) -> Image.Image:
    """
    Do not paint a floating white card / shadow plate.

    AI and JPG templates already leave a cream center; a blurred rectangle
    creates the dark halo users see as a broken 'frame behind the text'.
    Only apply a near-invisible lightening when the center is truly dark.
    """
    paper = _sample_paper(img, safe)
    try:
        region = img.crop((safe.x0, safe.y0, safe.x1, safe.y1))
        avg = region.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))[:3]
        paper = (
            (paper[0] + avg[0]) // 2,
            (paper[1] + avg[1]) // 2,
            (paper[2] + avg[2]) // 2,
        )
    except Exception:
        pass

    luminance = 0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2]
    # Light stationery — keep AI décor continuous under the type
    if luminance >= 195 and not corner_guard:
        return img

    base = img.convert("RGBA")
    wipe = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(wipe)
    pad_x = int(safe.width * 0.12)
    pad_y = int(safe.height * 0.14)
    # Soft oval, tiny alpha — no rectangular silhouette, no dark edge
    draw.ellipse(
        (
            safe.x0 + pad_x,
            safe.y0 + pad_y,
            safe.x1 - pad_x,
            safe.y1 - pad_y,
        ),
        fill=(*paper, 88 if corner_guard else 40),
    )
    soft = wipe.filter(ImageFilter.GaussianBlur(radius=max(48, img.width // 18)))
    return Image.alpha_composite(base, soft).convert("RGB")


def typography_mode(style_tags: Sequence[str] | None) -> str:
    tags = {str(t).lower() for t in (style_tags or [])}
    name = " ".join(tags)
    if any(k in tags or k in name for k in ("minimal", "modern", "clean", "ivory")):
        return "modern"
    if any(
        k in tags or k in name
        for k in ("premium", "blush", "romance", "romantic", "script", "champagne")
    ):
        return "premium"
    return "classic"


def _ink_colors(style_tags: Sequence[str] | None) -> dict[str, tuple[int, int, int]]:
    tags = {str(t).lower() for t in (style_tags or [])}
    if "emerald" in tags or "formal" in tags:
        accent = (26, 69, 64)
    elif "blush" in tags or "romance" in tags:
        accent = (110, 60, 70)
    elif "champagne" in tags or "warm" in tags:
        accent = (90, 55, 35)
    else:
        accent = (20, 55, 48)
    return {
        "title": accent,
        "body": (
            min(255, accent[0] + 28),
            min(255, accent[1] + 28),
            min(255, accent[2] + 28),
        ),
        "meta": accent,
        "primary": accent,
        "venue": accent,
        "muted": (
            min(255, accent[0] + 40),
            min(255, accent[1] + 40),
            min(255, accent[2] + 40),
        ),
        "gold": (180, 145, 85),
        "rule": (170, 140, 80),
    }


def is_primary_ceremony_label(label: str) -> bool:
    return bool(_PRIMARY_LABEL_RE.search(label or ""))


def _schedule_sort_key(row: dict[str, str]) -> tuple:
    """Sort key from display line like '5-avgust | Soat 05:20'."""
    line = row.get("line") or ""
    label = row.get("label") or ""
    m = re.search(
        r"(\d{1,2})[-.\s]+([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘’ʻ]+)",
        line,
        re.IGNORECASE,
    )
    month = 99
    day = 99
    if m:
        day = int(m.group(1))
        month = _MONTH_INDEX.get(m.group(2).lower(), 99)
    tm = re.search(r"(\d{1,2}):(\d{2})", line)
    hour = int(tm.group(1)) if tm else 99
    minute = int(tm.group(2)) if tm else 99
    primary = 0 if is_primary_ceremony_label(label) else 1
    return (month, day, hour, minute, primary, label.lower())


def sort_schedule_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    if len(rows) < 2:
        return rows
    return sorted(rows, key=_schedule_sort_key)


def condense_invite_body(
    body: str,
    *,
    max_chars: int = 140,
    max_sentences: int = 1,
) -> str:
    """Keep invite body short so date/venue stay the visual focus."""
    text = re.sub(r"\s+", " ", (body or "").strip())
    if not text or len(text) <= max_chars:
        # Still cap to one sentence when multi-ceremony layout calls us
        parts = re.split(r"(?<=[.!?…])\s+", text)
        if max_sentences == 1 and len(parts) > 1 and len(text) > 90:
            return parts[0].strip()
        return text
    parts = re.split(r"(?<=[.!?…])\s+", text)
    if len(parts) > max_sentences:
        text = " ".join(parts[:max_sentences]).strip()
    if len(text) > max_chars:
        cut = text[: max_chars - 1].rsplit(" ", 1)[0].rstrip(".,;: ")
        text = f"{cut}…" if cut else text[:max_chars]
    return text


def format_card_datetime(raw: str, language: str | None = None) -> str:
    """Turn '5-avgust, soat 02:10 da' into '5-avgust | Soat 02:10'."""
    text = (raw or "").strip()
    if not text:
        return ""
    # Already pipe-formatted
    if " | " in text and re.search(r"\d{1,2}:\d{2}", text):
        return text

    m = _PLAIN_DT_RE.match(text) or _DATETIME_BODY_RE.match(text)
    if m:
        date = (m.group("date") or "").strip()
        time = (m.groupdict().get("time") or "").strip()
        if date and time:
            if language == "uz-cyrl":
                return f"{date} | Соат {time}"
            if language == "ru":
                return f"{date} | {time}"
            return f"{date} | Soat {time}"
        return date or text

    # Fallback: rewrite known patterns
    out = re.sub(
        r",\s*soat\s+(\d{1,2}:\d{2})\s*da\b",
        r" | Soat \1",
        text,
        flags=re.IGNORECASE,
    )
    out = re.sub(
        r",\s*соат\s+(\d{1,2}:\d{2})\s*да\b",
        r" | Соат \1",
        out,
        flags=re.IGNORECASE,
    )
    out = re.sub(r"\s{2,}", " ", out).strip(" ,")
    return out


def parse_schedule_blocks(date_time: str, language: str | None = None) -> list[dict[str, str]]:
    """
    Parse date_time into [{label, line, primary}] for premium rendering.
    Supports:
      - single: '5-avgust, soat 02:10 da'
      - multi: 'Nikoh oqshomi - 5-avgust, soat 02:10 da'
    Rows are returned in chronological order.
    """
    raw = (date_time or "").strip()
    if not raw:
        return []
    rows: list[dict[str, str]] = []
    for paragraph in raw.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        m = _DATE_TIME_RE.match(paragraph)
        if m and not re.match(r"^\d", m.group("label").strip()):
            label = m.group("label").strip()
            rest = format_card_datetime(m.group("rest").strip(), language)
            rows.append(
                {
                    "label": label,
                    "line": rest,
                    "primary": "1" if is_primary_ceremony_label(label) else "0",
                }
            )
        else:
            rows.append(
                {
                    "label": "",
                    "line": format_card_datetime(paragraph, language),
                    "primary": "0",
                }
            )
    return sort_schedule_rows(rows)


def _protect_phrases(text: str) -> str:
    return re.sub(
        r"(soat\s+\d{1,2}:\d{2}(?:\s+da)?|соат\s+\d{1,2}:\d{2}(?:\s+да)?|"
        r"Soat\s+\d{1,2}:\d{2}|Соат\s+\d{1,2}:\d{2})",
        lambda m: m.group(0).replace(" ", "\u00a0"),
        text or "",
        flags=re.IGNORECASE,
    )


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    text = _protect_phrases((text or "").strip())
    if not text:
        return []
    avg = max(int(_font_size(font) * 0.50), 8)
    width_chars = max(int(max_width / avg), 12)
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            continue
        for line in textwrap.wrap(
            paragraph,
            width=width_chars,
            break_long_words=True,
            break_on_hyphens=False,
        ) or [paragraph]:
            while line and draw.textlength(line, font=font) > max_width and len(line) > 8:
                approx = max(
                    8,
                    int(len(line) * max_width / max(draw.textlength(line, font=font), 1)),
                )
                cut = line.rfind(" ", 0, approx + 1)
                if cut < 6:
                    cut = approx
                lines.append(line[:cut].rstrip())
                line = line[cut:].lstrip()
            if line:
                lines.append(line)
    cleaned = [ln.replace("\u00a0", " ") for ln in lines]
    return _merge_orphan_lines(draw, cleaned, font, max_width)


def _merge_orphan_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    """Pull a dangling last word (нас / Вами.) up onto the previous line."""
    if len(lines) < 2:
        return lines
    last = lines[-1].strip()
    if not last or last.count(" ") > 0 or len(last) > 16:
        return lines
    merged = f"{lines[-2].rstrip()} {last}"
    if draw.textlength(merged, font=font) <= max_width * 1.04:
        return lines[:-2] + [merged]
    return lines


def _base_sizes(safe_w: int, dense: bool) -> dict[str, int]:
    """
    Target sizes relative to safe width.
    Anchored to ~900px design: title 48–78, body 22–32, meta 20–28.
    Dense (multi-ceremony): smaller body, stronger date + venue.
    """
    unit = safe_w / 900.0
    if dense:
        return {
            "header": int(48 * unit),
            "body": int(24 * unit),
            "date": int(28 * unit),
            "address": int(26 * unit),
            "host": int(34 * unit),
        }
    return {
        "header": int(56 * unit),
        "body": int(28 * unit),
        "date": int(30 * unit),
        "address": int(26 * unit),
        "host": int(40 * unit),
    }


def _clamp_sizes(sizes: dict[str, int], safe_w: int) -> dict[str, int]:
    unit = safe_w / 900.0
    return {
        "header": max(int(40 * unit), min(int(82 * unit), sizes["header"])),
        "body": max(int(20 * unit), min(int(40 * unit), sizes["body"])),
        "date": max(int(20 * unit), min(int(36 * unit), sizes["date"])),
        "address": max(int(18 * unit), min(int(34 * unit), sizes["address"])),
        "host": max(int(28 * unit), min(int(54 * unit), sizes["host"])),
    }


def make_font_plan(
    sizes: dict[str, int],
    mode: str,
) -> FontPlan:
    # Bundled Noto only — macOS script fonts are missing in Docker and
    # silently fall back to a 10px bitmap (unreadable on 2400px cards).
    if mode == "modern":
        title_paths = SERIF_BOLD_PATHS
        body_paths = SANS_PATHS
        host_paths = SANS_BOLD_PATHS
    elif mode == "premium":
        title_paths = SERIF_BOLD_PATHS
        body_paths = SERIF_PATHS
        host_paths = SERIF_BOLD_PATHS
    else:
        title_paths = SERIF_BOLD_PATHS
        body_paths = SERIF_PATHS
        host_paths = SERIF_BOLD_PATHS

    return FontPlan(
        header=_truetype(title_paths, sizes["header"]),
        body=_truetype(body_paths, sizes["body"]),
        date_label=_truetype(body_paths, max(sizes["date"] - 1, 18)),
        date_meta=_truetype(SERIF_PATHS, sizes["date"] + 2),
        date_primary=_truetype(SERIF_BOLD_PATHS, sizes["date"] + 10),
        address=_truetype(SERIF_PATHS + SANS_PATHS, sizes["address"] + 3),
        host=_truetype(host_paths, sizes["host"]),
        header_size=sizes["header"],
        body_size=sizes["body"],
        date_size=sizes["date"],
        address_size=sizes["address"],
        host_size=sizes["host"],
    )


def _draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    cx: int,
    y: int,
    fill: tuple[int, int, int],
) -> int:
    lw = draw.textlength(text, font=font)
    draw.text((cx - lw / 2, y), text, fill=fill, font=font)
    return int(_font_size(font) * 1.28)


def _draw_ornament_rule(
    draw: ImageDraw.ImageDraw,
    cx: int,
    y: int,
    width: int,
    color: tuple[int, int, int],
) -> int:
    half = int(width * 0.16)
    stroke = max(2, width // 700)
    draw.line((cx - half, y, cx - 14, y), fill=color, width=stroke)
    draw.line((cx + 14, y, cx + half, y), fill=color, width=stroke)
    # Small diamond
    d = max(5, width // 220)
    draw.polygon(
        [(cx, y - d), (cx + d, y), (cx, y + d), (cx - d, y)],
        outline=color,
    )
    return d * 2 + 8


def measure_and_layout(
    draw: ImageDraw.ImageDraw,
    blocks: dict[str, str],
    plan: FontPlan,
    safe: SafeRegion,
    *,
    language: str | None,
    gap_scale: float,
    narrow: bool = False,
) -> tuple[list[tuple], int]:
    """
    Build draw ops and total height for vertical centering.
    Returns (ops, total_height) where ops are callable-like tuples.
    Hierarchy: greeting → short body → ornament → schedule → venue → host
    """
    content_w = int(safe.width * (0.82 if narrow else 0.92))
    cx = safe.cx
    ops: list[tuple] = []
    y = 0

    def gap(frac: float) -> None:
        nonlocal y
        y += int(safe.height * frac * gap_scale)

    header = (blocks.get("header") or "").strip()
    body = (blocks.get("body") or "").strip()
    address = (blocks.get("address") or "").strip()
    host = (blocks.get("footer") or "").strip()
    schedule = parse_schedule_blocks(blocks.get("date_time") or "", language)
    multi = len(schedule) >= 2
    if multi:
        body = condense_invite_body(body)

    if header:
        for line in wrap_text(draw, header, plan.header, content_w):
            ops.append(("text", line, plan.header, "title", y))
            y += int(plan.header_size * 1.18)
        gap(0.026 if multi else 0.034)

    if body:
        for line in wrap_text(draw, body, plan.body, content_w):
            ops.append(("text", line, plan.body, "body", y))
            y += int(plan.body_size * (1.38 if multi else 1.48))
        gap(0.028 if multi else 0.038)

    # Decorative rule before schedule / address
    if schedule or address or host:
        ops.append(("rule", y))
        y += int(safe.height * 0.028 * gap_scale) + 14
        gap(0.018 if multi else 0.022)

    for i, row in enumerate(schedule):
        primary = row.get("primary") == "1" or is_primary_ceremony_label(
            row.get("label") or ""
        )
        label_font = plan.date_label
        meta_font = plan.date_primary if primary else plan.date_meta
        label_color = "primary" if primary else "muted"
        meta_color = "primary" if primary else "meta"
        label_lead = plan.date_size * (1.22 if primary else 1.12)
        meta_lead = plan.date_size * (1.42 if primary else 1.30)

        if row["label"]:
            label_draw_font = plan.date_meta if primary else label_font
            for line in wrap_text(draw, row["label"], label_draw_font, content_w):
                ops.append(("text", line, label_draw_font, label_color, y))
                y += int(label_lead * (1.08 if primary else 1.0))
            gap(0.006)
        if row["line"]:
            line = row["line"]
            if " | " in line:
                left, right = line.split(" | ", 1)
                ops.append(("dt_pair", left.strip(), right.strip(), meta_font, meta_color, y))
                y += int(meta_lead)
            else:
                for wrapped in wrap_text(draw, line, meta_font, content_w):
                    ops.append(("text", wrapped, meta_font, meta_color, y))
                    y += int(meta_lead)
        if primary and i < len(schedule) - 1:
            ops.append(("rule_small", y))
            y += int(safe.height * 0.016 * gap_scale) + 8
            gap(0.012)
        elif i < len(schedule) - 1:
            gap(0.028 if multi else 0.024)
        else:
            gap(0.036)

    if address:
        for line in wrap_text(draw, address, plan.address, content_w):
            ops.append(("text", line, plan.address, "venue", y))
            y += int(plan.address_size * 1.42)
        gap(0.032)

    if host:
        ops.append(("rule_small", y))
        y += int(safe.height * 0.020 * gap_scale) + 10
        for line in wrap_text(draw, host, plan.host, content_w):
            ops.append(("text", line, plan.host, "title", y))
            y += int(plan.host_size * 1.30)

    return ops, y


def render_invitation_layout(
    img: Image.Image,
    blocks: dict[str, str] | None,
    *,
    style_tags: Sequence[str] | None = None,
    language: str | None = None,
    corner_guard: bool = False,
) -> Image.Image:
    """
    Premium centered layout:
    Title → body → ornament → date/time → address → host
    Scales type up/down to fill the safe region without top-clustering.
    """
    from .spelling import (
        normalize_invitation_spelling,
        sanitize_overlay_field,
        scrub_junk_lines,
    )

    blocks = dict(blocks or {})
    for key in ("header", "body", "date_time", "address", "footer"):
        raw = normalize_invitation_spelling(blocks.get(key) or "", language)
        if key in ("body", "date_time"):
            blocks[key] = scrub_junk_lines(raw)
        else:
            blocks[key] = sanitize_overlay_field(raw)

    if not any((blocks.get(k) or "").strip() for k in blocks):
        return img

    safe = analyze_safe_region(img, corner_guard=corner_guard)
    img = clear_safe_text_area(img, safe, corner_guard=corner_guard)
    draw = ImageDraw.Draw(img)
    colors = _ink_colors(style_tags)
    mode = typography_mode(style_tags)

    schedule = parse_schedule_blocks(blocks.get("date_time") or "", language)
    multi = len(schedule) >= 2
    # Always keep body short so date + venue stay primary
    blocks["body"] = condense_invite_body(
        blocks.get("body") or "",
        max_chars=150 if multi else 180,
        max_sentences=1 if multi else 2,
    )
    if multi:
        rebuilt: list[str] = []
        for row in schedule:
            if row["label"] and row["line"]:
                rebuilt.append(f"{row['label']} | {row['line']}")
            elif row["line"]:
                rebuilt.append(row["line"])
        if rebuilt:
            blocks["date_time"] = "\n".join(rebuilt)

    body_len = len((blocks.get("body") or "").strip())
    dense = body_len > 180 or multi

    sizes = _clamp_sizes(_base_sizes(safe.width, dense), safe.width)
    # Fit: grow or shrink so content occupies ~58–72% of safe height
    best_plan: FontPlan | None = None
    best_ops: list[tuple] = []
    best_h = 0
    gap_scale = 1.05 if dense else 1.12
    prev_key: tuple | None = None

    for step in range(12):
        plan = make_font_plan(sizes, mode)
        ops, total_h = measure_and_layout(
            draw,
            blocks,
            plan,
            safe,
            language=language,
            gap_scale=gap_scale,
            narrow=corner_guard,
        )
        target_min = int(safe.height * (0.62 if dense else 0.66))
        target_max = int(safe.height * 0.88)
        best_plan, best_ops, best_h = plan, ops, total_h
        key = (sizes["header"], sizes["body"], sizes["date"], round(gap_scale, 3))
        if key == prev_key:
            # Still short? stretch gaps only
            if total_h < target_min and gap_scale < 1.45:
                gap_scale = min(1.45, gap_scale * 1.05)
                prev_key = None
                continue
            break
        prev_key = key

        if total_h < target_min and step < 10:
            # Prefer growing date/address over body for hierarchy
            bump = {
                "header": int(sizes["header"] * 1.04),
                "body": int(sizes["body"] * 1.06),
                "date": int(sizes["date"] * 1.10),
                "address": int(sizes["address"] * 1.10),
                "host": int(sizes["host"] * 1.04),
            }
            sizes = _clamp_sizes(bump, safe.width)
            gap_scale = min(1.45, gap_scale * 1.02)
            continue
        if total_h > target_max:
            sizes = _clamp_sizes(
                {k: int(v * 0.90) for k, v in sizes.items()},
                safe.width,
            )
            gap_scale = max(0.88, gap_scale * 0.94)
            continue
        break

    assert best_plan is not None
    text_ops = sum(1 for op in best_ops if op[0] == "text")
    # Greeting + date only: center in the panel instead of hugging the top
    if text_ops <= 3:
        bias = 0.42
    elif dense:
        bias = 0.14
    else:
        bias = 0.28
    start_y = safe.y0 + max(0, int((safe.height - best_h) * bias))

    cx = safe.cx
    for op in best_ops:
        kind = op[0]
        if kind == "text":
            _, text, font, color_key, rel_y = op
            _draw_centered(
                draw, text, font, cx, start_y + rel_y, colors[color_key]
            )
        elif kind == "dt_pair":
            _, left, right, font, color_key, rel_y = op
            y = start_y + rel_y
            fill = colors[color_key]
            pipe = "  |  "
            pipe_w = draw.textlength(pipe, font=font)
            left_w = draw.textlength(left, font=font)
            pipe_x = cx - pipe_w / 2
            draw.text((pipe_x - left_w, y), left, fill=fill, font=font)
            draw.text((pipe_x, y), pipe, fill=fill, font=font)
            draw.text((pipe_x + pipe_w, y), right, fill=fill, font=font)
        elif kind == "rule":
            _, rel_y = op
            _draw_ornament_rule(
                draw, cx, start_y + rel_y + 6, safe.width, colors["rule"]
            )
        elif kind == "rule_small":
            _, rel_y = op
            half = int(safe.width * 0.08)
            y = start_y + rel_y + 4
            stroke = max(1, img.width // 900)
            draw.line((cx - half, y, cx + half, y), fill=colors["gold"], width=stroke)

    return img
