/** Invitation dates: "20-noyabr, soat 05:00 da". Admin stamps stay DD.MM.YYYY. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DISPLAY_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const DISPLAY_DATE_SPACED = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/;
const TIME_24 = /^(\d{1,2}):\s*(\d{2})(?::(\d{2}))?$/;
const TIME_12 = /^(\d{1,2}):\s*(\d{2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?$/;
const TIME_12_IN_TEXT =
  /\b(\d{1,2}):\s*(\d{2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?\b/g;

type UiLang = "uz-latn" | "uz-cyrl" | "ru";

const MONTHS: Record<UiLang, string[]> = {
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
  ru: [
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
};

function normalizeLang(lang?: string | null): UiLang {
  if (lang === "uz-cyrl" || lang === "ru") return lang;
  return "uz-latn";
}

function pad2(n: number | string): string {
  return String(n).padStart(2, "0");
}

function parseYmd(value: unknown): { y: number; m: number; d: number } | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();

  const iso = raw.match(ISO_DATE);
  if (iso) {
    return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  }

  const dotted = raw.match(DISPLAY_DATE) || raw.match(DISPLAY_DATE_SPACED);
  if (dotted) {
    return { y: Number(dotted[3]), m: Number(dotted[2]), d: Number(dotted[1]) };
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }
  return null;
}

/** Convert any clock time to 24h HH:mm (no stray spaces). */
export function formatDisplayTime(value: unknown, withSeconds = false): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();

  const twelve = raw.match(TIME_12);
  if (twelve) {
    let h = Number(twelve[1]) % 12;
    if (twelve[4].toLowerCase() === "p") h += 12;
    const mm = twelve[2];
    const ss = twelve[3] || "00";
    return withSeconds || twelve[3]
      ? `${pad2(h)}:${mm}:${ss}`
      : `${pad2(h)}:${mm}`;
  }

  const twentyFour = raw.match(TIME_24);
  if (twentyFour) {
    const h = Number(twentyFour[1]);
    if (h >= 0 && h <= 23) {
      const mm = twentyFour[2];
      const ss = twentyFour[3] || "00";
      return withSeconds || twentyFour[3]
        ? `${pad2(h)}:${mm}:${ss}`
        : `${pad2(h)}:${mm}`;
    }
  }

  return raw.replace(/\s+/g, "");
}

/** Invitation date: "20-noyabr" */
export function formatDisplayDate(
  value: unknown,
  language?: string | null,
): string {
  const parts = parseYmd(value);
  if (!parts) return value == null || value === "" ? "" : String(value).trim();

  const lang = normalizeLang(language);
  const month = MONTHS[lang][parts.m - 1];
  if (!month) return `${pad2(parts.d)}.${pad2(parts.m)}.${parts.y}`;

  if (lang === "ru") return `${parts.d} ${month}`;
  return `${parts.d}-${month}`;
}

/** Invitation datetime: "20-noyabr, soat 05:00 da" */
export function formatDisplayDateTime(
  date?: string | null,
  time?: string | null,
  language?: string | null,
): string {
  const lang = normalizeLang(language);
  const datePart = date ? formatDisplayDate(date, lang) : "";
  const timePart = time ? formatDisplayTime(time) : "";
  if (datePart && timePart) {
    if (lang === "ru") return `${datePart}, в ${timePart}`;
    if (lang === "uz-cyrl") return `${datePart}, соат ${timePart} да`;
    return `${datePart}, soat ${timePart} da`;
  }
  return [datePart, timePart].filter(Boolean).join(", ");
}

/** Ensure "soat HH:mm da" / "соат HH:mm да" on invitation time phrases. */
export function ensureTimeDaSuffix(
  text: string,
  language?: string | null,
): string {
  const lang = normalizeLang(language);
  if (!text) return text;
  let out = text;

  if (lang === "ru") {
    return out;
  }

  if (lang === "uz-cyrl") {
    // "соат 05:00" without "да"
    out = out.replace(/(соат\s+\d{1,2}:\d{2})(?!\s*да)\b/gi, "$1 да");
    // "29-ноябр, 05:00" → add соат … да
    out = out.replace(
      /(\d{1,2}-[^\s,]+),\s*(?!соат)(\d{1,2}:\d{2})(?!\s*да)\b/gi,
      "$1, соат $2 да",
    );
    return out;
  }

  // Latin: "soat 05:00" without "da"
  out = out.replace(/(soat\s+\d{1,2}:\d{2})(?!\s*da)\b/gi, "$1 da");
  // "20-noyabr, 05:00" → "20-noyabr, soat 05:00 da"
  out = out.replace(
    /(\d{1,2}-[A-Za-z‘’ʻ']+),\s*(?!soat)(\d{1,2}:\d{2})(?!\s*da)\b/gi,
    "$1, soat $2 da",
  );
  return out;
}

/** Replace ISO / dotted dates and 12h times in free text with invitation format. */
export function formatDatesInText(
  text: string,
  language?: string | null,
): string {
  const lang = normalizeLang(language);
  let out = String(text || "");

  // "20. 11. 2026, 05: 00" / "20.11.2026, 05:00" → invitation datetime
  out = out.replace(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*,\s*(\d{1,2}):\s*(\d{2})(?::\s*(\d{2}))?/g,
    (_m, d: string, m: string, y: string, hh: string, mm: string) =>
      formatDisplayDateTime(
        `${y}-${pad2(m)}-${pad2(d)}`,
        `${pad2(hh)}:${mm}`,
        lang,
      ),
  );

  // ISO date alone
  out = out.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (_m, y: string, m: string, d: string) =>
      formatDisplayDate(`${y}-${m}-${d}`, lang),
  );

  // Dotted date alone
  out = out.replace(
    /\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/g,
    (_m, d: string, m: string, y: string) =>
      formatDisplayDate(`${y}-${pad2(m)}-${pad2(d)}`, lang),
  );

  // Fix spaced times like "05: 00"
  out = out.replace(
    /\b(\d{1,2}):\s+(\d{2})\b/g,
    (_m, h: string, mm: string) => `${pad2(h)}:${mm}`,
  );

  out = out.replace(TIME_12_IN_TEXT, (match) =>
    formatDisplayTime(match, /:\d{2}:\d{2}/.test(match)),
  );

  return ensureTimeDaSuffix(out, lang);
}

/** Full timestamp for admin/account: 28.07.2026, 14:28:08 */
export function formatDisplayDateTimeStamp(value: unknown): string {
  if (value == null || value === "") return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return formatDatesInText(String(value)) || String(value);
  }
  const date = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return `${date}, ${time}`;
}

export function isIsoDateTime(value: unknown): boolean {
  return (
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  );
}
