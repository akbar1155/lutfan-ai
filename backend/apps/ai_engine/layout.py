"""Premium invitation typography & layout for PIL text overlay."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

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

_META_LINE_RE = re.compile(
    r"^(Sana|Сана|Дата|Vaqt|Вақт|Время|Manzil|Манзил|Адрес)\s*:",
    re.IGNORECASE,
)
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
    # Keep generous side/bottom inset so type never sits on corner florals.
    if corner_guard:
        side = 0.205 if tall else 0.190
        top = 0.215
        bottom = 0.228
    else:
        side = 0.148 if tall else 0.138
        top = 0.138
        bottom = 0.134
    return SafeRegion(
        x0=int(w * side),
        y0=int(h * top),
        x1=int(w * (1 - side)),
        y1=int(h * (1 - bottom)),
    )


def _sample_paper(img: Image.Image, safe: SafeRegion) -> tuple[int, int, int]:
    """Cream from the true center — not the floral corners."""
    w, h = img.size
    pw, ph = max(24, w // 36), max(24, h // 36)
    cx, cy = w // 2, (safe.y0 + safe.y1) // 2
    patch = img.crop((cx - pw, cy - ph, cx + pw, cy + ph)).convert("RGB")
    return patch.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))[:3]


def clear_safe_text_area(
    img: Image.Image, safe: SafeRegion, *, corner_guard: bool = False
) -> Image.Image:
    """
    Wash only décor that has invaded the type column back to paper color.

    Center cream/paper texture is left untouched so this does not read as a
    floating white card. Florals, gold filigree, and leaves under the copy
    are blended toward the sampled paper.
    """
    rgb = img.convert("RGB")
    paper = _sample_paper(rgb, safe)
    w, h = rgb.size
    pad_x = int(safe.width * (0.06 if corner_guard else 0.03))
    pad_y = int(safe.height * (0.05 if corner_guard else 0.02))
    x0 = max(0, safe.x0 - pad_x)
    y0 = max(0, safe.y0 - pad_y)
    x1 = min(w, safe.x1 + pad_x)
    y1 = min(h, safe.y1 + pad_y)
    region = rgb.crop((x0, y0, x1, y1))
    if region.size[0] < 8 or region.size[1] < 8:
        return rgb

    paper_img = Image.new("RGB", region.size, paper)
    diff = ImageChops.difference(region, paper_img).convert("L")
    # 0–16 ≈ paper grain; 16–52 ramp; 52+ almost full wash
    lut = []
    strength = 236 if corner_guard else 210
    for v in range(256):
        if v < 16:
            lut.append(0)
        elif v > 52:
            lut.append(strength)
        else:
            lut.append(int(strength * (v - 16) / 36))
    floral = diff.point(lut)
    floral = floral.filter(
        ImageFilter.GaussianBlur(radius=min(10, max(4, min(region.size) // 140)))
    )

    # Soft mask at low-res so HD cards don't stall on a huge Gaussian radius.
    sw = max(48, region.size[0] // 4)
    sh = max(48, region.size[1] // 4)
    feather = Image.new("L", (sw, sh), 0)
    fd = ImageDraw.Draw(feather)
    sx = max(4, int((max(12, min(region.size) // 22) / max(region.size[0], 1)) * sw))
    sy = max(4, int((max(12, min(region.size) // 22) / max(region.size[1], 1)) * sh))
    rad = max(8, min(sw, sh) // 6)
    box = (sx, sy, sw - 1 - sx, sh - 1 - sy)
    try:
        fd.rounded_rectangle(box, radius=rad, fill=255)
    except Exception:
        fd.rectangle(box, fill=255)
    feather = feather.filter(ImageFilter.GaussianBlur(8)).resize(
        region.size, Image.Resampling.BILINEAR
    )
    mask = ImageChops.multiply(floral, feather)
    cleaned = Image.composite(paper_img, region, mask)
    rgb.paste(cleaned, (x0, y0))
    return rgb


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
        accent = (18, 52, 48)
    elif "blush" in tags or "romance" in tags or "rose_gold" in tags:
        accent = (78, 42, 50)
    elif "champagne" in tags or "warm" in tags or "ivory" in tags:
        accent = (72, 44, 28)
    else:
        accent = (16, 42, 38)
    return {
        "title": accent,
        # Body matches title ink — avoid washed-out / faded copy
        "body": accent,
        "meta": accent,
        "primary": accent,
        "venue": accent,
        "muted": (
            min(255, accent[0] + 18),
            min(255, accent[1] + 18),
            min(255, accent[2] + 18),
        ),
        "gold": (168, 132, 72),
        "rule": (158, 128, 70),
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


def _meta_labels(language: str | None) -> dict[str, str]:
    if language == "uz-cyrl":
        return {"date": "Сана", "time": "Вақт", "address": "Манзил"}
    if language == "ru":
        return {"date": "Дата", "time": "Время", "address": "Адрес"}
    return {"date": "Sana", "time": "Vaqt", "address": "Manzil"}


def format_card_datetime(raw: str, language: str | None = None) -> str:
    """Turn datetime text into labeled lines: 'Sana: …\nVaqt: …'."""
    text = (raw or "").strip()
    if not text:
        return ""
    labels = _meta_labels(language)

    # Already labeled
    if re.search(r"^(Sana|Сана|Дата)\s*:", text, re.IGNORECASE | re.M):
        return text

    # Pipe form: date | Soat HH:mm  or  date | HH:mm
    if " | " in text:
        left, right = [p.strip() for p in text.split(" | ", 1)]
        tm = re.search(r"(\d{1,2}:\d{2})", right)
        time = tm.group(1) if tm else ""
        date = left
        if not re.search(r"\d", date) and re.search(r"\d", right):
            m = _PLAIN_DT_RE.match(right) or _DATETIME_BODY_RE.match(right)
            if m:
                date = (m.group("date") or "").strip()
                time = (m.groupdict().get("time") or time or "").strip()
        lines = []
        if date:
            lines.append(f"{labels['date']}: {date}")
        if time:
            lines.append(f"{labels['time']}: {time}")
        return "\n".join(lines) if lines else text

    m = _PLAIN_DT_RE.match(text) or _DATETIME_BODY_RE.match(text)
    if m:
        date = (m.group("date") or "").strip()
        time = (m.groupdict().get("time") or "").strip()
        lines = []
        if date:
            lines.append(f"{labels['date']}: {date}")
        if time:
            lines.append(f"{labels['time']}: {time}")
        return "\n".join(lines) if lines else text

    # Fallback: rewrite known patterns then re-parse
    out = re.sub(
        r",\s*soat\s+(\d{1,2}:\d{2})\s*da\b",
        r" | \1",
        text,
        flags=re.IGNORECASE,
    )
    out = re.sub(
        r",\s*соат\s+(\d{1,2}:\d{2})\s*да\b",
        r" | \1",
        out,
        flags=re.IGNORECASE,
    )
    out = re.sub(r"\s{2,}", " ", out).strip(" ,")
    if out != text and " | " in out:
        return format_card_datetime(out, language)
    return text


def ensure_address_label(address: str, language: str | None = None) -> str:
    text = (address or "").strip()
    if not text:
        return ""
    labels = _meta_labels(language)
    if re.match(
        rf"^({re.escape(labels['address'])}|Manzil|Манзил|Адрес)\s*:",
        text,
        re.IGNORECASE,
    ):
        return text
    return f"{labels['address']}: {text}"


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
        if (
            m
            and not re.match(r"^\d", m.group("label").strip())
            and not _META_LINE_RE.match(paragraph)
            and not _META_LINE_RE.match(m.group("label").strip())
        ):
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
    out = re.sub(
        r"(soat\s+\d{1,2}:\d{2}(?:\s+da)?|соат\s+\d{1,2}:\d{2}(?:\s+да)?|"
        r"Soat\s+\d{1,2}:\d{2}|Соат\s+\d{1,2}:\d{2})",
        lambda m: m.group(0).replace(" ", "\u00a0"),
        text or "",
        flags=re.IGNORECASE,
    )
    # Keep "10-sentabr" as one token so wrap does not split the month.
    return re.sub(
        r"(\d{1,2})-([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘’ʻ]+)",
        lambda m: f"{m.group(1)}\u2011{m.group(2)}",
        out,
    )


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    """Pixel-accurate wrap so lines stay even and premium."""
    text = _protect_phrases((text or "").strip())
    if not text:
        return []
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        words = paragraph.split()
        if not words:
            continue
        current = words[0]
        for word in words[1:]:
            trial = f"{current} {word}"
            slack = max_width * (1.08 if "\u2011" in trial or "\u00a0" in trial else 1.0)
            if draw.textlength(trial, font=font) <= slack:
                current = trial
                continue
            lines.append(current)
            current = word
            # Hard-break oversized tokens, but never split dates like 10-sentabr.
            while (
                draw.textlength(current, font=font) > max_width
                and len(current) > 8
                and not re.match(r"^\d{1,2}\u2011", current)
            ):
                approx = max(
                    8,
                    int(
                        len(current)
                        * max_width
                        / max(draw.textlength(current, font=font), 1)
                    ),
                )
                lines.append(current[:approx].rstrip("-"))
                current = current[approx:].lstrip("-")
        if current:
            lines.append(current)
    cleaned = [ln.replace("\u00a0", " ").replace("\u2011", "-") for ln in lines]
    return _merge_orphan_lines(draw, cleaned, font, max_width)


def _merge_orphan_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    """Avoid lonely last lines like 'kutamiz.' / short Russian tails."""
    if len(lines) < 2:
        return lines
    lines = list(lines)
    # 1) Try merging a short final line into the previous one
    last = lines[-1].strip()
    if last and last.count(" ") <= 2 and len(last) <= 28:
        merged = f"{lines[-2].rstrip()} {last}"
        if draw.textlength(merged, font=font) <= max_width * 1.06:
            return lines[:-2] + [merged]
    # 2) Rebalance: move trailing words down so the last line isn't tiny
    for _ in range(4):
        if len(lines) < 2:
            break
        last = lines[-1].strip()
        prev = lines[-2].strip()
        if len(last) > 26 or last.count(" ") > 3:
            break
        parts = prev.rsplit(" ", 1)
        if len(parts) != 2:
            break
        new_prev, word = parts
        new_last = f"{word} {last}"
        if draw.textlength(new_prev, font=font) < max_width * 0.42:
            break
        if draw.textlength(new_last, font=font) > max_width:
            break
        lines[-2] = new_prev
        lines[-1] = new_last
    return lines


def _base_sizes(safe_w: int, dense: bool, *, packed: bool = False) -> dict[str, int]:
    """
    Target sizes relative to safe width.
    Date/venue must stay near body size — they are the practical details.
    """
    unit = safe_w / 900.0
    if packed:
        return {
            "header": int(50 * unit),
            "body": int(30 * unit),
            "date": int(30 * unit),
            "address": int(29 * unit),
            "host": int(32 * unit),
        }
    if dense:
        return {
            "header": int(52 * unit),
            "body": int(31 * unit),
            "date": int(31 * unit),
            "address": int(30 * unit),
            "host": int(34 * unit),
        }
    return {
        "header": int(56 * unit),
        "body": int(33 * unit),
        "date": int(33 * unit),
        "address": int(32 * unit),
        "host": int(40 * unit),
    }


def _clamp_sizes(sizes: dict[str, int], safe_w: int) -> dict[str, int]:
    unit = safe_w / 900.0
    body = max(int(24 * unit), min(int(38 * unit), sizes["body"]))
    date_floor = max(int(28 * unit), int(body * 0.90))
    addr_floor = max(int(27 * unit), int(body * 0.88))
    return {
        "header": max(int(40 * unit), min(int(78 * unit), sizes["header"])),
        "body": body,
        "date": max(date_floor, min(int(40 * unit), sizes["date"])),
        "address": max(addr_floor, min(int(38 * unit), sizes["address"])),
        "host": max(int(26 * unit), min(int(48 * unit), sizes["host"])),
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
        date_label=_truetype(body_paths, sizes["date"]),
        date_meta=_truetype(SERIF_PATHS, sizes["date"]),
        date_primary=_truetype(SERIF_BOLD_PATHS, sizes["date"] + 2),
        address=_truetype(SERIF_PATHS + SANS_PATHS, sizes["address"]),
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
    Hierarchy: greeting → body → ornament → schedule → venue → host
    """
    # Narrower column when AI florals crowd the sides / footer.
    content_w = int(safe.width * (0.74 if narrow else 0.82))
    body_w = int(safe.width * (0.72 if narrow else 0.80))
    host_w = int(safe.width * (0.62 if narrow else 0.72))
    meta_w = int(safe.width * (0.90 if narrow else 0.94))
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
    packed = len(schedule) >= 3

    if header:
        for line in wrap_text(draw, header, plan.header, content_w):
            ops.append(("text", line, plan.header, "title", y))
            y += int(plan.header_size * 1.22)
        gap(0.030 if multi else 0.038)

    if body:
        # One flowing paragraph reads more like a classic invitation
        body_lead = plan.body_size * (1.55 if multi else 1.62)
        for line in wrap_text(draw, body, plan.body, body_w):
            ops.append(("text", line, plan.body, "body", y))
            y += int(body_lead)
        gap(0.038 if multi else 0.046)

    # Decorative rule before schedule / address
    if schedule or address or host:
        ops.append(("rule", y))
        y += int(safe.height * 0.022 * gap_scale) + 12
        gap(0.020 if multi else 0.024)

    for i, row in enumerate(schedule):
        primary = row.get("primary") == "1" or is_primary_ceremony_label(
            row.get("label") or ""
        )
        label_font = plan.date_label
        meta_font = plan.date_primary if primary else plan.date_meta
        label_color = "primary" if primary else "muted"
        meta_color = "primary" if primary else "meta"
        label_lead = plan.date_size * (1.18 if primary else 1.08)
        meta_lead = plan.date_size * (1.36 if primary else 1.24)

        if row["label"]:
            label_draw_font = plan.date_meta if primary else label_font
            for line in wrap_text(draw, row["label"], label_draw_font, content_w):
                ops.append(("text", line, label_draw_font, label_color, y))
                y += int(label_lead)
            gap(0.004 if packed else 0.007)
        if row["line"]:
            line = row["line"]
            # Prefer labeled Sana/Vaqt stack; keep left-aligned column.
            meta_lines: list[str] = []
            for part in line.split("\n"):
                part = part.strip()
                if not part:
                    continue
                if " | " in part and not re.search(
                    r"^(Sana|Сана|Дата|Vaqt|Вақт|Время)\s*:", part, re.I
                ):
                    part = format_card_datetime(part, language)
                meta_lines.extend(
                    ln.strip() for ln in part.split("\n") if ln.strip()
                )
            if not meta_lines and " | " in line:
                meta_lines = [
                    ln.strip()
                    for ln in format_card_datetime(line, language).split("\n")
                    if ln.strip()
                ]
            drawn: list[str] = []
            for part in meta_lines:
                drawn.extend(wrap_text(draw, part, meta_font, meta_w) or [part])
            if drawn:
                ops.append(("meta_stack", drawn, meta_font, meta_color, y))
                y += int(meta_lead) * len(drawn)
        if primary and i < len(schedule) - 1:
            gap(0.010)
            ops.append(("rule_small", y))
            y += int(safe.height * 0.012 * gap_scale) + 6
            gap(0.014 if packed else 0.016)
        elif i < len(schedule) - 1:
            gap(0.026 if packed else 0.030)
        else:
            gap(0.032)

    if address:
        address = ensure_address_label(address, language)
        addr_lines = wrap_text(draw, address, plan.address, meta_w)
        if addr_lines:
            ops.append(("meta_stack", addr_lines, plan.address, "venue", y))
            y += int(plan.address_size * 1.40) * len(addr_lines)
        gap(0.028)

    if host:
        ops.append(("rule_small", y))
        y += int(safe.height * 0.018 * gap_scale) + 8
        for line in wrap_text(draw, host, plan.host, host_w):
            ops.append(("text", line, plan.host, "title", y))
            y += int(plan.host_size * 1.28)

    return ops, y


def render_invitation_layout(
    img: Image.Image,
    blocks: dict[str, str] | None,
    *,
    style_tags: Sequence[str] | None = None,
    language: str | None = None,
    corner_guard: bool = False,
    wash_text_area: bool = True,
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
    if blocks.get("address"):
        blocks["address"] = ensure_address_label(blocks["address"], language)

    if not any((blocks.get(k) or "").strip() for k in blocks):
        return img

    safe = analyze_safe_region(img, corner_guard=corner_guard)
    if wash_text_area:
        img = clear_safe_text_area(img, safe, corner_guard=corner_guard)
    draw = ImageDraw.Draw(img)
    colors = _ink_colors(style_tags)
    mode = typography_mode(style_tags)

    schedule = parse_schedule_blocks(blocks.get("date_time") or "", language)
    multi = len(schedule) >= 2
    # Use the user's body as written; fit loop below shrinks type to fit.
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
    packed = len(schedule) >= 3
    dense = body_len > 160 or multi

    sizes = _clamp_sizes(
        _base_sizes(safe.width, dense, packed=packed),
        safe.width,
    )
    # Fit into the safe panel without crushing hierarchy
    best_plan: FontPlan | None = None
    best_ops: list[tuple] = []
    best_h = 0
    gap_scale = 0.98 if packed else (1.02 if dense else 1.12)
    prev_key: tuple | None = None

    for step in range(14):
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
        # Packed cards look better with air; don't force-fill into florals
        target_min = int(safe.height * (0.50 if packed else 0.56 if dense else 0.62))
        fill_hi = 0.80 if corner_guard else 0.88
        target_max = int(safe.height * (0.78 if packed else fill_hi))
        best_plan, best_ops, best_h = plan, ops, total_h
        key = (sizes["header"], sizes["body"], sizes["date"], round(gap_scale, 3))
        if key == prev_key:
            if total_h < target_min and gap_scale < 1.35:
                gap_scale = min(1.35, gap_scale * 1.04)
                prev_key = None
                continue
            break
        prev_key = key

        if total_h < target_min and step < 10:
            bump = {
                "header": int(sizes["header"] * 1.03),
                "body": int(sizes["body"] * 1.03),
                "date": int(sizes["date"] * (1.04 if packed else 1.07)),
                "address": int(sizes["address"] * 1.04),
                "host": int(sizes["host"] * 1.03),
            }
            sizes = _clamp_sizes(bump, safe.width)
            gap_scale = min(1.35, gap_scale * 1.02)
            continue
        if total_h > target_max:
            # Shrink greeting/body/gaps first; keep date & venue readable.
            sizes = _clamp_sizes(
                {
                    "header": int(sizes["header"] * 0.96),
                    "body": int(sizes["body"] * 0.97),
                    "date": int(sizes["date"] * 0.98),
                    "address": int(sizes["address"] * 0.98),
                    "host": int(sizes["host"] * 0.96),
                },
                safe.width,
            )
            gap_scale = max(0.78, gap_scale * 0.91)
            continue
        break

    assert best_plan is not None
    # Final guard: Sana / Vaqt / Manzil never drop far below body type.
    sizes["date"] = max(sizes["date"], int(sizes["body"] * 0.92))
    sizes["address"] = max(sizes["address"], int(sizes["body"] * 0.90))
    sizes = _clamp_sizes(sizes, safe.width)
    best_plan = make_font_plan(sizes, mode)
    best_ops, best_h = measure_and_layout(
        draw,
        blocks,
        best_plan,
        safe,
        language=language,
        gap_scale=gap_scale,
        narrow=corner_guard,
    )
    text_ops = sum(1 for op in best_ops if op[0] == "text")
    # Keep dense cards centered; avoid hugging the top floral corners
    if text_ops <= 3:
        bias = 0.42
    elif packed:
        bias = 0.22
    elif dense:
        bias = 0.26
    else:
        bias = 0.30
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
            # Legacy pipe layout — keep for safety; prefer meta_stack.
            _, left, right, font, color_key, rel_y = op
            y = start_y + rel_y
            fill = colors[color_key]
            lines = [left, right]
            widths = [draw.textlength(line, font=font) for line in lines]
            x0 = cx - max(widths) / 2
            lead = int(_font_size(font) * 1.28)
            for i, line in enumerate(lines):
                draw.text((x0, y + i * lead), line, fill=fill, font=font)
        elif kind == "meta_stack":
            _, lines, font, color_key, rel_y = op
            y = start_y + rel_y
            fill = colors[color_key]
            widths = [draw.textlength(line, font=font) for line in lines]
            x0 = cx - (max(widths) if widths else 0) / 2
            lead = int(_font_size(font) * 1.32)
            for i, line in enumerate(lines):
                draw.text((x0, y + i * lead), line, fill=fill, font=font)
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
