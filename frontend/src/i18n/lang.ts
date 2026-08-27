export const UI_LANGS = ["uz-latn", "uz-cyrl", "ru"] as const;
export type UiLang = (typeof UI_LANGS)[number];

/** Default UI + invitation language (TZ). */
export const DEFAULT_UI_LANG: UiLang = "uz-latn";

const EVENT_NAMES: Record<string, Record<UiLang, string>> = {
  nikoh: {
    "uz-latn": "Nikoh",
    "uz-cyrl": "Никоҳ",
    ru: "Никах",
  },
  aqiqa: {
    "uz-latn": "Aqiqa",
    "uz-cyrl": "Ақиқа",
    ru: "Акика",
  },
  sunnat: {
    "uz-latn": "Sunnat toʻyi",
    "uz-cyrl": "Суннат тўйи",
    ru: "Суннат той",
  },
  birthday: {
    "uz-latn": "Tugʻilgan kun",
    "uz-cyrl": "Туғилган кун",
    ru: "День рождения",
  },
  hudoyi: {
    "uz-latn": "Hudoyi",
    "uz-cyrl": "Худойи",
    ru: "Худои",
  },
  hayit: {
    "uz-latn": "Hayit",
    "uz-cyrl": "Ҳайт",
    ru: "Хаит",
  },
};

/** Normalize any i18next/browser code to our 3 UI languages. */
export function normalizeUiLang(lang?: string | null): UiLang {
  const raw = (lang || DEFAULT_UI_LANG).toLowerCase().replace(/_/g, "-");
  if (raw === "ru" || raw.startsWith("ru-")) return "ru";
  if (raw.includes("latn") || raw === "uz-lat" || raw === "oz") return "uz-latn";
  if (raw.includes("cyrl") || raw === "uz-cyr") return "uz-cyrl";
  if (raw === "uz-latn") return "uz-latn";
  if (raw === "uz-cyrl") return "uz-cyrl";
  // Bare "uz" → Latin (default)
  if (raw === "uz" || raw.startsWith("uz-")) return "uz-latn";
  return DEFAULT_UI_LANG;
}

export function resolveStoredUiLang(): UiLang {
  const saved = localStorage.getItem("ui_lang");
  if (saved && (UI_LANGS as readonly string[]).includes(saved)) {
    return saved as UiLang;
  }
  return DEFAULT_UI_LANG;
}

export function pickTranslation(
  map: Record<string, string> | null | undefined,
  lang?: string | null,
  fallback = "",
): string {
  if (!map) return fallback;
  const ui = normalizeUiLang(lang);
  return (
    map[ui] ||
    map["uz-latn"] ||
    map["uz-cyrl"] ||
    map.ru ||
    Object.values(map)[0] ||
    fallback
  );
}

export function eventDisplayName(slug: string, lang?: string | null): string {
  const ui = normalizeUiLang(lang);
  return EVENT_NAMES[slug]?.[ui] || slug;
}
