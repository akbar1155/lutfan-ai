"""Light Uzbek Latin/Cyrillic spelling fixes before invitation text overlay."""

from __future__ import annotations

import re

from apps.core.dates import ensure_time_da_suffix


def normalize_invitation_spelling(text: str, language: str | None = None) -> str:
    if not text:
        return ""
    out = text
    # Unify apostrophe-like marks used in o‘ / g‘
    out = re.sub(r"[ʻ’`´']", "‘", out)
    out = re.sub(r"[—–]", "-", out)
    # Normalize spaced separators (word - word) but keep date hyphens: 6-avgust
    out = re.sub(r"(?<!\d)\s+-\s+(?!\d)", " - ", out)
    out = re.sub(r"(\d)\s+-\s+([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘']+)", r"\1-\2", out)
    out = re.sub(r"[ \t]{2,}", " ", out)

    if language == "uz-cyrl":
        fixes = [
            (r"\bкутамис\b", "кутамиз"),
            (r"\bбўбслин\b", "бўлсин"),
            (r"\bбўслин\b", "бўлсин"),
            (r"\bкутмохлда\b", "кутмоқда"),
            (r"\bкутмодда\b", "кутмоқда"),
        ]
    elif language == "ru":
        fixes = [
            (r"\bприглашаем вас\s+приглашаем\b", "приглашаем вас"),
        ]
    else:
        # Default: Uzbek Latin (also cleans AI-garbled copy)
        fixes = [
            (r"\bkoring\b", "ko‘ring"),
            (r"\bkoringiz\b", "ko‘ringiz"),
            (r"\bkutamis\b", "kutamiz"),
            (r"\bb[o‘']?bslin\b", "bo‘lsin"),
            (r"\bboslin\b", "bo‘lsin"),
            (r"\bbulsin\b", "bo‘lsin"),
            (r"\btashrifving\b", "tashrifingiz"),
            (r"\btashrifying\b", "tashrifingiz"),
            (r"\btashrifing\b", "tashrifingiz"),
            (r"\bbayraminizni\b", "bayramimizni"),
            (r"\byarada\b", "yanada"),
            (r"\bgozal\b", "go‘zal"),
            (r"\bgo‘zal\b", "go‘zal"),
            (r"\bfayzli\b", "fayzli"),
            (r"\bqiiladi\b", "qiladi"),
            (r"\bgilladi\b", "qiladi"),
            (r"\bqiladi\b", "qiladi"),
            (r"\bKelins\b", "Keling"),
            (r"\bbirgalldda\b", "birgalikda"),
            (r"\bbirgaldd[ak]\b", "birgalikda"),
            (r"\bbirgalikda\b", "birgalikda"),
            (r"\bununitlmaris\b", "unutilmas xotiralar"),
            (r"\bunutilmaris\b", "unutilmas xotiralar"),
            (r"\bxottaralyis\b", "xotiralar"),
            (r"\byaratatlyik\b", "yarataylik"),
            (r"\byaratalyik\b", "yarataylik"),
            (r"\bkundardini\b", "kunlarini"),
            (r"\bkundran\b", "kunlardan"),
            (r"\bsirn\b", "sirini"),
            (r"\bbahan\s+disian\b", "baham ko‘raylik"),
            (r"\bbahoishdan\b", "baham ko‘rishdan"),
            (r"\bdavra\s+an\b", "davra va"),
            (r"\bmannum\b", "mamnun"),
            (r"\bbolamuuis\b", "bo‘lamiz"),
            (r"\bSaminiy\b", "Samimiy"),
            (r"\bquvonuylm\b", "quvonchli"),
            (r"\bquvonclli\b", "quvonchli"),
            (r"\blahham\s+koluzalar\b", "lahzalar"),
            (r"\bsiizni\b", "sizni"),
            (r"\bkutmoxlda\b", "kutmoqda"),
            (r"\bkutmodda\b", "kutmoqda"),
            (r"\bbuini\b", "birini"),
            (r"\bsiu\b", "siz"),
            (r"\baгust\b", "avgust"),
            (r"\bagust\b", "avgust"),
            (r"\bагust\b", "avgust"),
            (r"\bавгust\b", "avgust"),
        ]

    for pattern, repl in fixes:
        out = re.sub(pattern, repl, out, flags=re.IGNORECASE)

    # Mid-sentence polite pronoun casing (Latin)
    if language != "uz-cyrl" and language != "ru":
        mid = [
            (r"(?<=[\w‘ʻ’,;:])\sSizni\b", " sizni"),
            (r"(?<=[\w‘ʻ’,;:])\sSizning\b", " sizning"),
            (r"(?<=[\w‘ʻ’,;:])\sSizga\b", " sizga"),
            (r"(?<=[\w‘ʻ’,;:])\sSiz bilan\b", " siz bilan"),
            (r"(?<=[\w‘ʻ’,;:])\sSiz\b", " siz"),
        ]
        for pattern, repl in mid:
            out = re.sub(pattern, repl, out)

    out = re.sub(r" +([,.!?;:])", r"\1", out)
    # Space after punctuation, but never inside times (01:10) or "sh.,"
    out = re.sub(r"([,.!?;])([^\s\n,.!?;])", r"\1 \2", out)
    out = re.sub(r"(\d)\s*:\s*(\d)", r"\1:\2", out)
    # "Sardor ning" → "Sardorning" (Uzbek possessive suffix)
    out = re.sub(
        r"([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘ʻ’])\s+ning\b",
        r"\1ning",
        out,
        flags=re.IGNORECASE,
    )
    out = re.sub(
        r"([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘ʻ’])\s+нинг\b",
        r"\1нинг",
        out,
        flags=re.IGNORECASE,
    )
    out = re.sub(r" +\n", "\n", out)
    return ensure_time_da_suffix(out.strip(), language)


_JUNK_WORDS = re.compile(
    r"^(test|asdf|qwerty|xxx+|n/?a|null|undefined|placeholder|lorem|ipsum)$",
    re.IGNORECASE,
)


def is_junk_field_value(value: str | None) -> bool:
    """Detect unfinished placeholder junk like 'aaaa' or 'a, a'."""
    text = (value or "").strip()
    if not text:
        return True
    if len(text) == 1:
        return True
    if _JUNK_WORDS.match(text):
        return True
    # "a, a" / "а, а"
    if re.fullmatch(r"[aаAА]\s*,\s*[aаAА]", text):
        return True
    # Real invitation sentences — never treat as placeholder junk
    words = [w for w in text.split() if w]
    if len(text) >= 36 and len(words) >= 5:
        return False
    # Same character repeated: aaaa, ----- 
    compact = re.sub(r"[\s.,\-_/·•]+", "", text)
    if len(compact) >= 2 and re.fullmatch(r"(.)\1+", compact, flags=re.IGNORECASE):
        return True
    # Mostly one letter with light punctuation
    letters = re.findall(r"[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]", text)
    if letters and len(set(ch.lower() for ch in letters)) == 1 and len(letters) >= 2:
        return True
    # Keyboard smash / nonsense (e.g. "ewd, ewewfwf", "dresw")
    letter_count = len(letters)
    if letter_count >= 5:
        vowels = re.findall(
            r"[aeiouаеёиоуыэюяўʻ‘']",
            text,
            flags=re.IGNORECASE,
        )
        if len(vowels) / letter_count < 0.22:
            return True
        unique = len({ch.lower() for ch in letters})
        # Keyboard smash is short with few distinct letters.
        # Real Uzbek/Russian sentences have ~15–25 unique letters over 60+ chars
        # (unique <= length/3 would wipe every invitation body).
        if letter_count < 32 and unique <= 3:
            return True
    # Very short comma parts ("ewd, …") — not short real words like boy / Ali
    parts = [p.strip() for p in re.split(r"\s*,\s*", text) if p.strip()]
    if len(parts) >= 2 and any(
        len(p) < 4 and re.fullmatch(r"[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]+", p)
        for p in parts
    ):
        return True
    # "saom, dresw" — comma-separated short lowercase blobs, not "Palace, Toshkent"
    if (
        len(parts) >= 2
        and all(" " not in p for p in parts)
        and all(
            3 <= len(re.sub(r"[^A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]", "", p)) <= 12
            for p in parts
        )
        and all(p == p.lower() or p == p.upper() for p in parts)
    ):
        return True
    return False


def sanitize_overlay_field(value: str | None) -> str:
    text = (value or "").strip()
    if is_junk_field_value(text):
        return ""
    return text


def scrub_junk_lines(text: str | None) -> str:
    """Drop placeholder-only lines from multi-line blocks."""
    if not text:
        return ""
    kept: list[str] = []
    for line in str(text).split("\n"):
        piece = line.strip()
        if not piece:
            continue
        if is_junk_field_value(piece):
            continue
        # Strip trailing junk tokens: "... taklif etamiz. aaaa"
        cleaned = re.sub(
            r"(?:^|\s+)(?:[aаAА]{3,}|(?:[aаAА]\s*,\s*[aаAА]))\s*$",
            "",
            piece,
        ).strip(" ,;")
        if cleaned and not is_junk_field_value(cleaned):
            kept.append(cleaned)
    return "\n".join(kept)
