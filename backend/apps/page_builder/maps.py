"""Parse Yandex Maps links and geocode a venue for page-builder only."""

from __future__ import annotations

import json
import logging
import re
from urllib.error import URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

_NUM = r"-?\d+(?:\.\d+)?"
_PAIR = re.compile(rf"({_NUM})[,/\s]+({_NUM})")
_YANDEX_HOST = re.compile(r"(?:^|\.)yandex\.(?:uz|ru|com|by|kz)$", re.I)


def clean_coord(value, lo: float, hi: float) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not (lo <= number <= hi):
        return None
    return round(number, 6)


def _as_lat_lng(first: float, second: float, *, yandex_order: bool) -> tuple[float, float] | None:
    lat, lng = (second, first) if yandex_order else (first, second)
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return round(lat, 6), round(lng, 6)
    lat, lng = lng, lat
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return round(lat, 6), round(lng, 6)
    return None


def parse_map_point(text: str) -> tuple[float, float] | None:
    raw = unquote((text or "").strip())
    if not raw:
        return None

    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    is_yandex = bool(_YANDEX_HOST.search(host)) or "yandex." in raw
    if parsed.query or parsed.fragment:
        query = parse_qs(parsed.query) | parse_qs(parsed.fragment.lstrip("?"))
        for key in ("ll", "pt", "whatshere[point]"):
            values = query.get(key) or query.get(key.replace("[", "%5B").replace("]", "%5D"))
            if not values:
                continue
            match = _PAIR.search(str(values[0]))
            if match:
                point = _as_lat_lng(float(match.group(1)), float(match.group(2)), yandex_order=True)
                if point:
                    return point

    if is_yandex:
        for match in re.finditer(rf"(?:ll|pt)=({_NUM})%2C({_NUM})", raw, re.I):
            point = _as_lat_lng(float(match.group(1)), float(match.group(2)), yandex_order=True)
            if point:
                return point

    if parsed.scheme in ("http", "https"):
        return None

    match = _PAIR.search(raw)
    if not match:
        return None
    return _as_lat_lng(float(match.group(1)), float(match.group(2)), yandex_order=False)


def _http_json(url: str, timeout: int = 6) -> dict | list | None:
    req = Request(
        url,
        headers={"User-Agent": "LutfanAI/1.0 (page-builder maps)"},
    )
    try:
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
        logger.exception("page_builder geocode failed")
        return None


def _follow_yandex(url: str) -> str:
    req = Request(url, headers={"User-Agent": "LutfanAI/1.0 (page-builder maps)"})
    try:
        with urlopen(req, timeout=6) as resp:
            return resp.geturl() or url
    except (URLError, TimeoutError):
        return url


def _yandex_geocode(query: str) -> list[dict]:
    api_key = getattr(settings, "YANDEX_MAPS_API_KEY", "") or ""
    if not api_key:
        return []
    url = "https://geocode-maps.yandex.ru/1.x/?" + urlencode(
        {
            "apikey": api_key,
            "geocode": query,
            "format": "json",
            "results": 5,
            "lang": "uz_UZ",
        }
    )
    payload = _http_json(url)
    if not isinstance(payload, dict):
        return []
    members = (
        payload.get("response", {})
        .get("GeoObjectCollection", {})
        .get("featureMember", [])
    )
    out: list[dict] = []
    for item in members:
        geo = (item or {}).get("GeoObject") or {}
        pos = ((geo.get("Point") or {}).get("pos") or "").split()
        if len(pos) != 2:
            continue
        point = _as_lat_lng(float(pos[0]), float(pos[1]), yandex_order=True)
        if not point:
            continue
        meta = geo.get("metaDataProperty", {}).get("GeocoderMetaData", {})
        out.append(
            {
                "name": geo.get("name") or meta.get("text") or query,
                "address": meta.get("text") or geo.get("description") or "",
                "lat": point[0],
                "lng": point[1],
            }
        )
    return out


def _nominatim_geocode(query: str) -> list[dict]:
    url = "https://nominatim.openstreetmap.org/search?" + urlencode(
        {
            "q": query,
            "format": "json",
            "limit": 5,
            "addressdetails": 1,
        }
    )
    payload = _http_json(url)
    if not isinstance(payload, list):
        return []
    out: list[dict] = []
    for item in payload:
        lat = clean_coord(item.get("lat"), -90, 90)
        lng = clean_coord(item.get("lon"), -180, 180)
        if lat is None or lng is None:
            continue
        out.append(
            {
                "name": item.get("name") or item.get("display_name") or query,
                "address": item.get("display_name") or "",
                "lat": lat,
                "lng": lng,
            }
        )
    return out


def geocode_query(query: str) -> list[dict]:
    text = (query or "").strip()[:240]
    if not text:
        return []
    look = text
    if text.startswith("http") and "yandex." in text and "/maps/-/" in text:
        look = _follow_yandex(text)
    parsed = parse_map_point(look) or parse_map_point(text)
    if parsed:
        return [{"name": text, "address": "", "lat": parsed[0], "lng": parsed[1]}]
    return _yandex_geocode(text) or _nominatim_geocode(text)


def yandex_widget_src(lat: float, lng: float, lang: str = "uz-latn") -> str:
    locale = "ru_RU" if lang == "ru" else "uz_UZ"
    return (
        "https://yandex.uz/map-widget/v1/?"
        f"ll={lng},{lat}&z=16&pt={lng},{lat},pm2rdm&l=map&lang={locale}"
    )
