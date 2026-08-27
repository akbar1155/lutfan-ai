"""Invitation dates: "20-noyabr, soat 05:00 da". Admin stamps stay DD.MM.YYYY."""

from __future__ import annotations

import re
from datetime import date, datetime, time
from typing import Any

_ISO_DATE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
_DISPLAY_DATE = re.compile(r"^\d{1,2}\.\s*\d{1,2}\.\s*\d{4}$")
_DOTTED_DATE_IN_TEXT = re.compile(r"\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b")
_DOTTED_DATETIME_IN_TEXT = re.compile(
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*,\s*(\d{1,2}):\s*(\d{2})(?::\s*(\d{2}))?"
)
_SPACED_TIME = re.compile(r"\b(\d{1,2}):\s+(\d{2})\b")
_TIME_12 = re.compile(
    r"\b(\d{1,2}):\s*(\d{2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?\b"
)
_TIME_24 = re.compile(r"^(\d{1,2}):\s*(\d{2})(?::(\d{2}))?$")

_MONTHS = {
    "uz-latn": [
        "yanvar",
        "fevral",
        "mart",
        "aprel",
        "may",
        "iyun",
        "iyul",
        "avgust",
        "sentabr",
        "oktabr",
        "noyabr",
        "dekabr",
    ],
    "uz-cyrl": [
        "январ",
        "феврал",
        "март",
        "апрел",
        "май",
        "июн",
        "июл",
        "август",
        "сентабр",
        "октабр",
        "ноябр",
        "декабр",
    ],
    "ru": [
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    ],
}


def _normalize_lang(lang: str | None = None) -> str:
    if lang in ("uz-cyrl", "ru"):
        return lang
    return "uz-latn"


def format_display_time(value: Any, with_seconds: bool = False) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, time):
        if with_seconds or value.second:
            return value.strftime("%H:%M:%S")
        return value.strftime("%H:%M")
    if isinstance(value, datetime):
        return format_display_time(value.time(), with_seconds=with_seconds)

    text = str(value).strip()
    m12 = _TIME_12.fullmatch(text) or _TIME_12.search(text)
    if m12 and m12.group(0) == text:
        hour = int(m12.group(1)) % 12
        if m12.group(4).lower() == "p":
            hour += 12
        minute = m12.group(2)
        second = m12.group(3) or "00"
        if with_seconds or m12.group(3):
            return f"{hour:02d}:{minute}:{second}"
        return f"{hour:02d}:{minute}"

    m24 = _TIME_24.match(text)
    if m24:
        hour = int(m24.group(1))
        if 0 <= hour <= 23:
            minute = m24.group(2)
            second = m24.group(3) or "00"
            if with_seconds or m24.group(3):
                return f"{hour:02d}:{minute}:{second}"
            return f"{hour:02d}:{minute}"
    return re.sub(r"\s+", "", text)


def _ymd_from_value(value: Any) -> tuple[int, int, int] | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.year, value.month, value.day

    text = str(value).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))

    m = re.match(r"^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$", text)
    if m:
        return int(m.group(3)), int(m.group(2)), int(m.group(1))

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.year, parsed.month, parsed.day
    except ValueError:
        return None


def format_numeric_date(value: Any) -> str:
    """Admin/CSV style: DD.MM.YYYY."""
    return format_display_date(value, numeric=True)


def format_display_date(
    value: Any,
    language: str | None = None,
    *,
    numeric: bool = False,
) -> str:
    parts = _ymd_from_value(value)
    if not parts:
        return "" if value is None or value == "" else str(value).strip()

    year, month, day = parts
    if numeric:
        return f"{day:02d}.{month:02d}.{year}"

    lang = _normalize_lang(language)
    months = _MONTHS[lang]
    if month < 1 or month > 12:
        return f"{day:02d}.{month:02d}.{year}"
    month_name = months[month - 1]
    if lang == "ru":
        return f"{day} {month_name}"
    return f"{day}-{month_name}"


def format_display_datetime(
    date_value: Any = None,
    time_value: Any = None,
    language: str | None = None,
) -> str:
    lang = _normalize_lang(language)
    date_part = format_display_date(date_value, lang) if date_value else ""
    time_part = format_display_time(time_value) if time_value else ""
    if date_part and time_part:
        if lang == "ru":
            return f"{date_part}, в {time_part}"
        if lang == "uz-cyrl":
            return f"{date_part}, соат {time_part} да"
        return f"{date_part}, soat {time_part} da"
    return ", ".join(p for p in (date_part, time_part) if p)


def format_display_datetime_stamp(value: Any) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, datetime):
        local = value
        return f"{local.strftime('%d.%m.%Y')}, {local.strftime('%H:%M:%S')}"
    if isinstance(value, date):
        return value.strftime("%d.%m.%Y")

    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return f"{parsed.strftime('%d.%m.%Y')}, {parsed.strftime('%H:%M:%S')}"
    except ValueError:
        return format_dates_in_text(text) or text


def ensure_time_da_suffix(text: str, language: str | None = None) -> str:
    """Ensure 'soat HH:mm da' / 'соат HH:mm да' on invitation time phrases."""
    lang = _normalize_lang(language)
    if not text or lang == "ru":
        return text or ""
    out = text
    if lang == "uz-cyrl":
        out = re.sub(
            r"(соат\s+\d{1,2}:\d{2})(?!\s*да)\b",
            r"\1 да",
            out,
            flags=re.IGNORECASE,
        )
        out = re.sub(
            r"(\d{1,2}-[^\s,]+),\s*(?!соат)(\d{1,2}:\d{2})(?!\s*да)\b",
            r"\1, соат \2 да",
            out,
            flags=re.IGNORECASE,
        )
        return out

    out = re.sub(
        r"(soat\s+\d{1,2}:\d{2})(?!\s*da)\b",
        r"\1 da",
        out,
        flags=re.IGNORECASE,
    )
    out = re.sub(
        r"(\d{1,2}-[A-Za-z‘’ʻ']+),\s*(?!soat)(\d{1,2}:\d{2})(?!\s*da)\b",
        r"\1, soat \2 da",
        out,
        flags=re.IGNORECASE,
    )
    return out


def format_dates_in_text(text: str, language: str | None = None) -> str:
    lang = _normalize_lang(language)

    def _datetime_repl(match: re.Match[str]) -> str:
        d, m, y, hh, mm = (
            match.group(1),
            match.group(2),
            match.group(3),
            match.group(4),
            match.group(5),
        )
        return format_display_datetime(
            f"{y}-{int(m):02d}-{int(d):02d}",
            f"{int(hh):02d}:{mm}",
            language=lang,
        )

    def _date_repl(match: re.Match[str]) -> str:
        d, m, y = match.group(1), match.group(2), match.group(3)
        return format_display_date(f"{y}-{int(m):02d}-{int(d):02d}", language=lang)

    def _iso_repl(match: re.Match[str]) -> str:
        y, m, d = match.group(1), match.group(2), match.group(3)
        return format_display_date(f"{y}-{m}-{d}", language=lang)

    def _time_repl(match: re.Match[str]) -> str:
        return format_display_time(match.group(0), with_seconds=bool(match.group(3)))

    out = text or ""
    out = _DOTTED_DATETIME_IN_TEXT.sub(_datetime_repl, out)
    out = _ISO_DATE.sub(_iso_repl, out)
    out = _DOTTED_DATE_IN_TEXT.sub(_date_repl, out)
    out = _SPACED_TIME.sub(lambda m: f"{int(m.group(1)):02d}:{m.group(2)}", out)
    out = _TIME_12.sub(_time_repl, out)
    return ensure_time_da_suffix(out, lang)
