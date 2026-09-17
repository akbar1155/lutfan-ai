const PAIR = /(-?\d+(?:\.\d+)?)[,/\s]+(-?\d+(?:\.\d+)?)/;
const YANDEX_HOST = /(?:^|\.)yandex\.(?:uz|ru|com|by|kz)$/i;

function asLatLng(first: number, second: number, yandexOrder: boolean): { lat: number; lng: number } | null {
  let lat = yandexOrder ? second : first;
  let lng = yandexOrder ? first : second;
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat: round6(lat), lng: round6(lng) };
  }
  lat = yandexOrder ? first : second;
  lng = yandexOrder ? second : first;
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat: round6(lat), lng: round6(lng) };
  }
  return null;
}

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

export function parseMapPoint(text: string): { lat: number; lng: number } | null {
  const raw = decodeURIComponent((text || "").trim());
  if (!raw) return null;
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    url = null;
  }
  const host = (url?.hostname || "").toLowerCase();
  const isYandex = YANDEX_HOST.test(host) || raw.includes("yandex.");
  if (url) {
    const query = url.searchParams;
    for (const key of ["ll", "pt", "whatshere[point]"]) {
      const value = query.get(key);
      if (!value) continue;
      const match = value.match(PAIR);
      if (match) {
        const point = asLatLng(Number(match[1]), Number(match[2]), true);
        if (point) return point;
      }
    }
    if (isYandex) return null;
  }
  if (raw.startsWith("http")) return null;
  const match = raw.match(PAIR);
  if (!match) return null;
  return asLatLng(Number(match[1]), Number(match[2]), false);
}

export function yandexWidgetSrc(lat: number, lng: number, lang = "uz-latn") {
  const locale = lang === "ru" ? "ru_RU" : "uz_UZ";
  return `https://yandex.uz/map-widget/v1/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm&l=map&lang=${locale}`;
}

export function hasMapPoint(lat?: number | null, lng?: number | null) {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}
