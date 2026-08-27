from __future__ import annotations

import io
import logging
import re
import textwrap
from typing import Any, Optional

from django.conf import settings
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .fonts import SANS_PATHS, SERIF_PATHS, load_font

logger = logging.getLogger(__name__)

FORMAT_SIZES = {
    "4:5": (2400, 3000),
    "9:16": (1080, 1920),
    "1:1": (2000, 2000),
}

_TIME_KEEP = re.compile(
    r"(soat\s+\d{1,2}:\d{2}\s+da|соат\s+\d{1,2}:\d{2}\s+да)",
    re.IGNORECASE,
)


class GenerationResult:
    def __init__(
        self,
        data: bytes,
        *,
        source: str = "gemini",
        width: int = 0,
        height: int = 0,
        text_overlay: bool = False,
    ):
        self.data = data
        self.source = source
        self.width = width
        self.height = height
        self.file_size_bytes = len(data)
        self.text_overlay = text_overlay


def _load_font(size: int, *, serif: bool = False) -> ImageFont.ImageFont:
    paths = SERIF_PATHS if serif else SANS_PATHS
    return load_font(paths, size)


def _font_size(font: ImageFont.ImageFont, fallback: int = 32) -> int:
    return int(getattr(font, "size", fallback) or fallback)


def _protect_time_phrases(text: str) -> str:
    """Keep 'soat HH:mm da' on one line when wrapping."""
    return _TIME_KEEP.sub(lambda m: m.group(0).replace(" ", "\u00a0"), text or "")


def _wrap_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    text = _protect_time_phrases((text or "").strip())
    if not text:
        return []
    avg = max(int(_font_size(font) * 0.52), 8)
    width_chars = max(int(max_width / avg), 14)
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            continue
        # Prefer natural breaks at " - " for multi-ceremony rows
        chunks = [paragraph]
        if " - " in paragraph and draw.textlength(paragraph, font=font) > max_width:
            chunks = [paragraph]  # still wrap as one paragraph; textwrap handles spaces
        for line in textwrap.wrap(
            chunks[0],
            width=width_chars,
            break_long_words=True,
            break_on_hyphens=False,
        ) or [paragraph]:
            while line and draw.textlength(line, font=font) > max_width and len(line) > 8:
                # Prefer last space before overflow
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
    return [ln.replace("\u00a0", " ") for ln in lines]


def _draw_frame(draw: ImageDraw.ImageDraw, width: int, height: int) -> None:
    margin = int(min(width, height) * 0.065)
    gold = (197, 160, 89)
    draw.rectangle(
        (margin, margin, width - margin, height - margin),
        outline=gold,
        width=max(3, width // 450),
    )
    pad = int(min(width, height) * 0.014)
    draw.rectangle(
        (margin + pad, margin + pad, width - margin - pad, height - margin - pad),
        outline=gold,
        width=max(1, width // 900),
    )
    flourish = max(40, width // 28)
    for cx, cy in (
        (margin + flourish, margin + flourish),
        (width - margin - flourish, margin + flourish),
        (margin + flourish, height - margin - flourish),
        (width - margin - flourish, height - margin - flourish),
    ):
        draw.ellipse(
            (cx - flourish, cy - flourish, cx + flourish, cy + flourish),
            outline=(180, 150, 100),
            width=max(1, width // 900),
        )


def _decorative_background(fmt: str = "4:5") -> Image.Image:
    width, height = FORMAT_SIZES.get(fmt, (2400, 3000))
    img = Image.new("RGB", (width, height), color=(253, 248, 238))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(height - 1, 1)
        edge = abs(t - 0.5) * 2
        r = int(253 - edge * 8 + t * 4)
        g = int(248 - edge * 14)
        b = int(238 - edge * 10 + t * 6)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    _draw_frame(draw, width, height)
    return img



def overlay_exact_invitation_text(
    image_bytes: bytes,
    blocks: dict | None,
    *,
    fmt: str = "4:5",
    style_tags: list[str] | None = None,
    language: str | None = None,
    corner_guard: bool = False,
) -> bytes:
    """Typeset invitation copy with premium centered hierarchy."""
    from .layout import render_invitation_layout

    blocks = blocks or {}
    if not any((blocks.get(k) or "").strip() for k in blocks):
        return image_bytes

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        logger.exception("overlay: could not open image")
        return image_bytes

    width, height = img.size
    target_w, target_h = FORMAT_SIZES.get(fmt, (width, height))
    if abs(width - target_w) > 40 or abs(height - target_h) > 40:
        img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    img = render_invitation_layout(
        img,
        blocks,
        style_tags=style_tags,
        language=language,
        corner_guard=corner_guard,
    )

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=94, optimize=True)
    return buf.getvalue()


def compose_from_template_bytes(
    template_bytes: bytes,
    blocks: dict | None,
    *,
    fmt: str = "4:5",
    style_tags: list[str] | None = None,
    language: str | None = None,
) -> GenerationResult:
    """Use the JPG template as background and typeset exact copy on top."""
    width, height = FORMAT_SIZES.get(fmt, (2400, 3000))
    try:
        img = Image.open(io.BytesIO(template_bytes)).convert("RGB")
        img = img.resize((width, height), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=93, optimize=False)
        data = buf.getvalue()
    except Exception:
        logger.exception("compose_from_template: bad template bytes")
        return _placeholder_image("", fmt=fmt, blocks=blocks)

    data = overlay_exact_invitation_text(
        data,
        blocks,
        fmt=fmt,
        style_tags=style_tags,
        language=language,
    )
    try:
        out = Image.open(io.BytesIO(data))
        width, height = out.width, out.height
    except Exception:
        pass
    return GenerationResult(
        data,
        source="template",
        width=width,
        height=height,
        text_overlay=True,
    )


def _placeholder_image(
    prompt: str,
    fmt: str = "4:5",
    blocks: Optional[dict] = None,
    style_tags: list[str] | None = None,
    language: str | None = None,
) -> GenerationResult:
    del prompt
    img = _decorative_background(fmt)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=94, optimize=True)
    data = buf.getvalue()
    if blocks:
        data = overlay_exact_invitation_text(
            data,
            blocks,
            fmt=fmt,
            style_tags=style_tags,
            language=language,
        )
    width, height = FORMAT_SIZES.get(fmt, (2400, 3000))
    try:
        out = Image.open(io.BytesIO(data))
        width, height = out.width, out.height
    except Exception:
        pass
    return GenerationResult(
        data,
        source="placeholder",
        width=width,
        height=height,
        text_overlay=bool(blocks),
    )


def _prepare_style_reference(data: bytes, *, max_side: int = 1024) -> bytes:
    """Downscale style board before Gemini — same look, far less upload/latency."""
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        w, h = img.size
        longest = max(w, h)
        if longest > max_side:
            scale = max_side / float(longest)
            img = img.resize(
                (max(1, int(w * scale)), max(1, int(h * scale))),
                Image.Resampling.LANCZOS,
            )
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=84, optimize=False)
        return buf.getvalue()
    except Exception:
        return data


def _extract_image_bytes(response) -> bytes | None:
    if not response or not getattr(response, "candidates", None):
        return None
    for candidate in response.candidates:
        content = getattr(candidate, "content", None)
        if not content or not getattr(content, "parts", None):
            continue
        for part in content.parts:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                return inline.data
            if hasattr(part, "as_image"):
                try:
                    img = part.as_image()
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=92, optimize=False)
                    return buf.getvalue()
                except Exception:
                    pass
    return None


def _normalize_jpeg(data: bytes, *, width: int, height: int) -> bytes:
    """Ensure RGB JPEG; light sharpen only when needed — avoid slow optimize pass."""
    del width, height
    try:
        img = Image.open(io.BytesIO(data))
        if img.mode != "RGB":
            img = img.convert("RGB")
        # Skip re-encode when already a reasonably sized JPEG
        fmt = (img.format or "").upper()
        if fmt == "JPEG" and len(data) < 4_500_000:
            return data
        img = img.filter(ImageFilter.UnsharpMask(radius=0.8, percent=105, threshold=3))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92, optimize=False)
        return buf.getvalue()
    except Exception:
        return data


def _normalize_compare(text: str) -> str:
    return "".join(
        ch.lower()
        for ch in (text or "")
        if ch.isalnum() or ("\u0400" <= ch <= "\u04FF")
    )


def verify_invitation_text(
    image_bytes: bytes,
    blocks: dict[str, str] | None,
    *,
    language: str = "uz-latn",
) -> tuple[bool, str]:
    """
    OCR check via Gemini vision: confirm expected invitation lines appear
    with correct spelling (not gibberish / mixed alphabet).
    """
    api_key = settings.GOOGLE_AI_API_KEY
    if not api_key or not image_bytes or not blocks:
        return True, "skipped"

    expected_parts = [
        (blocks.get(key) or "").strip()
        for key in ("header", "body", "date_time", "address", "footer")
        if (blocks.get(key) or "").strip()
    ]
    if not expected_parts:
        return True, "no-text"

    snippets: list[str] = []
    for part in expected_parts:
        for piece in part.split("\n"):
            piece = piece.strip()
            if len(piece) >= 6:
                snippets.append(piece[:80])
        if len(snippets) >= 8:
            break
    if not snippets:
        return True, "short-text"

    expected_block = "\n".join(f"- {s}" for s in snippets)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=45_000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        check_prompt = (
            "You are a strict proofreader for invitation card OCR.\n"
            f"Language: {language}.\n"
            "Read ALL visible text on the image carefully.\n"
            "Reply with ONLY JSON:\n"
            '{"ok": true|false, "issues": ["..."], "ocr": "full visible text"}.\n'
            "Set ok=false if ANY of these happen:\n"
            "- expected words are missing\n"
            "- words are misspelled / garbled / gibberish\n"
            "- Latin words contain Cyrillic letters (or vice versa)\n"
            "- month names are wrong (e.g. агust instead of avgust)\n"
            "Allow only tiny apostrophe differences (o'/o‘).\n"
            "EXPECTED text snippets (must match closely):\n"
            f"{expected_block}"
        )
        ocr_model = getattr(settings, "GEMINI_OCR_MODEL", None) or "gemini-2.5-flash"
        response = client.models.generate_content(
            model=ocr_model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                check_prompt,
            ],
            config=types.GenerateContentConfig(response_modalities=["TEXT"]),
        )
        raw = ""
        if response and getattr(response, "candidates", None):
            for candidate in response.candidates:
                content = getattr(candidate, "content", None)
                if not content or not getattr(content, "parts", None):
                    continue
                for part in content.parts:
                    text = getattr(part, "text", None)
                    if text:
                        raw += text
        raw = (raw or "").strip()
        if not raw:
            # Fail closed so we retry once when OCR is empty.
            return False, "empty-ocr"

        import json
        import re

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            dump = _normalize_compare(raw)
            missing = [
                s for s in snippets if _normalize_compare(s)[:10] not in dump
            ]
            return (len(missing) == 0), ("heuristic:" + ",".join(missing[:3]))

        data = json.loads(match.group(0))
        ok = bool(data.get("ok"))
        issues = data.get("issues") or []
        reason = "ok" if ok else ("issues:" + ",".join(str(i) for i in issues[:4]))
        return ok, reason
    except Exception:
        logger.exception("Invitation text verify failed — treating as fail for retry")
        return False, "verify-error"


def generate_image_bytes(
    prompt: str,
    *,
    fmt: str = "4:5",
    base_image_bytes: bytes | None = None,
    blocks: dict | None = None,
    negative_prompt: str | None = None,
    model_params: dict | None = None,
    style_tags: list[str] | None = None,
    language: str | None = None,
) -> GenerationResult:
    api_key = settings.GOOGLE_AI_API_KEY
    model_name = settings.NANO_BANANA_MODEL
    width, height = FORMAT_SIZES.get(fmt, (2400, 3000))

    if not api_key:
        logger.warning("GOOGLE_AI_API_KEY missing — using placeholder image")
        return _placeholder_image(
            prompt,
            fmt=fmt,
            blocks=blocks,
            style_tags=style_tags,
            language=language,
        )

    full_prompt = prompt
    if negative_prompt:
        # Keep negative short — long avoid-lists slow the request with little gain
        neg = negative_prompt.strip()
        if len(neg) > 420:
            neg = neg[:417] + "..."
        full_prompt += f"\n\nAvoid: {neg}"

    aspect = fmt
    if model_params and model_params.get("aspect_ratio"):
        aspect = str(model_params["aspect_ratio"])

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=90_000,  # 90s — don't hang for 15 minutes behind ngrok
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

        contents: list[Any] = [full_prompt]
        if base_image_bytes:
            ref = _prepare_style_reference(base_image_bytes)
            contents = [
                types.Part.from_bytes(data=ref, mime_type="image/jpeg"),
                full_prompt,
            ]

        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect),
        )

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config,
        )

        data = _extract_image_bytes(response)
        if data and len(data) >= 8_000:
            data = _normalize_jpeg(data, width=width, height=height)
            if blocks:
                data = overlay_exact_invitation_text(
                    data,
                    blocks,
                    fmt=fmt,
                    style_tags=style_tags,
                    language=language,
                    corner_guard=True,
                )
            try:
                img = Image.open(io.BytesIO(data))
                return GenerationResult(
                    data,
                    source="gemini",
                    width=img.width,
                    height=img.height,
                    text_overlay=bool(blocks),
                )
            except Exception:
                return GenerationResult(
                    data,
                    source="gemini",
                    width=width,
                    height=height,
                    text_overlay=bool(blocks),
                )

        logger.warning("Gemini returned no usable image")
    except Exception:
        logger.exception("Gemini generation failed")

    return _placeholder_image(
        prompt,
        fmt=fmt,
        blocks=blocks,
        style_tags=style_tags,
        language=language,
    )
