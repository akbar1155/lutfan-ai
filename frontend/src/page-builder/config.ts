import type { CatalogItem } from "./types";

export const COLORS: CatalogItem[] = [
  { id: "ivory", name: "Fil suyagi", description: "Iliq ochiq qog‘oz", swatch: "#f6f0e2", accent: "#c4a265" },
  { id: "beige", name: "Bej", description: "Yumshoq qum tusi", swatch: "#eadfcb", accent: "#b08955" },
  { id: "gold", name: "Oltin", description: "Iliq metall nur", swatch: "#f0e0b6", accent: "#c9a227" },
  { id: "burgundy", name: "Bordo", description: "Chuqqur qizil hashamat", swatch: "#5a1d28", accent: "#d4a056" },
  { id: "emerald", name: "Zumrad", description: "Tungi yashil", swatch: "#143026", accent: "#c9b37a" },
  { id: "navy", name: "To‘q ko‘k", description: "Saroyona kecha", swatch: "#161d33", accent: "#c8b27a" },
  { id: "rose", name: "Pushti", description: "Nozik atirgul", swatch: "#f3dde2", accent: "#b76e79" },
  { id: "black", name: "Qora", description: "Oltin bilan qora", swatch: "#141414", accent: "#d4af37" },
  { id: "white", name: "Oq", description: "Sovuq toza varaq", swatch: "#fafaf6", accent: "#8a7a5a" },
];

export const PATTERNS: CatalogItem[] = [
  { id: "oriental", name: "Sharqona", description: "O‘simliksimon naqsh" },
  { id: "uzbek-national", name: "O‘zbek milliy", description: "Adras / atlas ruhida" },
  { id: "floral", name: "Gulli", description: "Yumshoq gul naqshi" },
  { id: "arabesque", name: "Arabesk", description: "Chiroqli o‘simlik chiziq" },
  { id: "geometric", name: "Geometrik", description: "Sokin yulduz to‘ri" },
  { id: "minimal", name: "Minimal", description: "Juda nozik chiziq" },
  { id: "royal", name: "Shohona", description: "Damask naqshi" },
  { id: "elegant", name: "Nafis", description: "Ingichka ornament" },
];

export const FLOWERS: CatalogItem[] = [
  { id: "rose", name: "Atirgul" },
  { id: "tulip", name: "Lola" },
  { id: "peony", name: "Pion" },
  { id: "jasmine", name: "Yasemin" },
  { id: "lotus", name: "Nilufar" },
  { id: "botanical", name: "Botanik" },
  { id: "none", name: "Gulsiz" },
];

export const TEXTURES: CatalogItem[] = [
  { id: "handmade-paper", name: "Qo‘lda yasalgan" },
  { id: "premium-paper", name: "Premium qog‘oz" },
  { id: "silk", name: "Ipak" },
  { id: "parchment", name: "Pergament" },
  { id: "marble", name: "Marmar" },
  { id: "textured", name: "Relyef" },
  { id: "clean", name: "Tekis" },
];

export const FRAMES: CatalogItem[] = [
  { id: "gold-ornamental", name: "Oltin ornament" },
  { id: "floral", name: "Gulli ramka" },
  { id: "thin-elegant", name: "Ingichka nafis" },
  { id: "double", name: "Ikki qator" },
  { id: "royal", name: "Shohona" },
  { id: "minimal", name: "Minimal" },
  { id: "none", name: "Ramkasiz" },
];

export const FONTS: CatalogItem[] = [
  { id: "elegant", name: "Nafis", description: "Cormorant" },
  { id: "classic", name: "Klassik", description: "Source Serif" },
  { id: "modern", name: "Zamonaviy", description: "Outfit" },
  { id: "oriental", name: "Sharqona", description: "Cinzel + serif" },
  { id: "luxury", name: "Hashamatli", description: "Playfair" },
  { id: "minimal", name: "Minimal", description: "Inter" },
];

export type SiteLayout =
  | "ceremony"
  | "editorial"
  | "stack"
  | "ornate"
  | "luxe"
  | "air";

export function siteLayoutFromFont(font?: string): SiteLayout {
  switch (font) {
    case "classic":
      return "editorial";
    case "modern":
      return "stack";
    case "oriental":
      return "ornate";
    case "luxury":
      return "luxe";
    case "minimal":
      return "air";
    default:
      return "ceremony";
  }
}

export const SITE_COPY: Record<
  string,
  {
    venue: string;
    when: string;
    until: string;
    unitMonth: string;
    unitDay: string;
    unitHour: string;
    unitMinute: string;
    unitSecond: string;
    host: string;
    open: string;
    kicker: string;
    bodyPlaceholder: string;
    pause: string;
    play: string;
  }
> = {
  "uz-latn": {
    venue: "Marosim joyi",
    when: "Sana va vaqt",
    until: "Tadbirgacha",
    unitMonth: "Oy",
    unitDay: "Kun",
    unitHour: "Soat",
    unitMinute: "Minut",
    unitSecond: "Sekund",
    host: "Hurmat bilan",
    open: "Taklifnomani ochish",
    kicker: "Taklifnoma",
    bodyPlaceholder: "Asosiy matn shu yerda ko‘rinadi.",
    pause: "Pauza",
    play: "Ijro",
  },
  "uz-cyrl": {
    venue: "Маросим жойи",
    when: "Сана ва вақт",
    until: "Тадбиргача",
    unitMonth: "Ой",
    unitDay: "Кун",
    unitHour: "Соат",
    unitMinute: "Минут",
    unitSecond: "Секунд",
    host: "Ҳурмат билан",
    open: "Таклифномани очиш",
    kicker: "Таклифнома",
    bodyPlaceholder: "Асосий матн шу ерда кўринади.",
    pause: "Пауза",
    play: "Ижро",
  },
  ru: {
    venue: "Место",
    when: "Дата и время",
    until: "До события",
    unitMonth: "Мес",
    unitDay: "Дн",
    unitHour: "Час",
    unitMinute: "Мин",
    unitSecond: "Сек",
    host: "С уважением",
    open: "Открыть приглашение",
    kicker: "Приглашение",
    bodyPlaceholder: "Основной текст появится здесь.",
    pause: "Пауза",
    play: "Играть",
  },
};

export const ANIMATIONS: CatalogItem[] = [
  { id: "gentle", name: "Yumshoq" },
  { id: "elegant-reveal", name: "Nafis ochilish" },
  { id: "floating-flowers", name: "Suzuvchi gullar" },
  { id: "golden-particles", name: "Oltin zarralar" },
  { id: "ornament-reveal", name: "Naqsh ochilishi" },
  { id: "soft-fade", name: "Sokin so‘nish" },
  { id: "none", name: "Animatsiyasiz" },
];

export const DENSITIES: CatalogItem[] = [
  { id: "minimal", name: "Minimal", description: "Toza, nafis" },
  { id: "balanced", name: "Muvozanat", description: "O‘rtacha bezak" },
  { id: "rich", name: "Boy", description: "To‘la hashamat" },
];

export const MUSIC_PRESETS: CatalogItem[] = [
  { id: "elegant", name: "Nafis", description: "Instrumental" },
  { id: "romantic", name: "Romantik", description: "Iliq ohang" },
  { id: "traditional", name: "An’anaviy", description: "Milliy ruh" },
  { id: "oriental", name: "Sharqona", description: "Maqom kayfiyati" },
  { id: "calm", name: "Sokin", description: "Yengil fon" },
  { id: "celebration", name: "Bayramona", description: "Quvnoq" },
  { id: "piano", name: "Pianino", description: "Yakka cholg‘u" },
  { id: "instrumental", name: "Instrumental", description: "Yumshoq simlar" },
];

export function presetMusicUrl(id: string): string {
  return `/pb-music/${id}.wav?v=3`;
}
