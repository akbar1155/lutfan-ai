import { pickTranslation } from "../i18n/lang";

export type SubtypeMode = "none" | "single" | "multi";

export type EventSubtype = { slug: string; names: Record<string, string> };

type EventLike = {
  subtypes?: EventSubtype[];
  fields_schema?: { subtype_mode?: string };
} | null | undefined;

const HAYIT_FALLBACK: Record<string, Record<string, string>> = {
  ramazon_hayiti: {
    "uz-latn": "Ramazon hayiti",
    "uz-cyrl": "Рамазон ҳайти",
    ru: "Рамазан-хаит",
  },
  qurbon_hayiti: {
    "uz-latn": "Qurbon hayiti",
    "uz-cyrl": "Қурбон ҳайти",
    ru: "Курбан-хаит",
  },
};

export function getSubtypeMode(event: EventLike): SubtypeMode {
  const listed = (event?.subtypes || []).filter((s) => s?.slug);
  if (!listed.length) return "none";
  const raw = String(event?.fields_schema?.subtype_mode || "")
    .trim()
    .toLowerCase();
  if (raw === "single" || raw === "multi") return raw;
  return "multi";
}

export function subtypeLabel(
  event: EventLike,
  slug: string,
  language: string,
): string {
  const meta = event?.subtypes?.find((s) => s.slug === slug);
  const fromEvent = meta ? pickTranslation(meta.names, language) : "";
  if (fromEvent) return fromEvent;
  const fallback = HAYIT_FALLBACK[slug];
  return (fallback && pickTranslation(fallback, language)) || slug;
}

export function hayitOccasionName(
  event: EventLike,
  slugs: string[],
  language: string,
): string {
  const slug = slugs[0] || "";
  if (slug) return subtypeLabel(event, slug, language);
  return pickTranslation(
    { "uz-latn": "Hayit", "uz-cyrl": "Ҳайт", ru: "Хаит" },
    language,
    "Hayit",
  );
}

export function applyHayitOccasion(text: string, occasion: string): string {
  const occ = (occasion || "").trim();
  let out = (text || "").replace(/\{hayit_occasion\}/g, occ || "Hayit");
  if (!occ) return out;
  if (out.toLowerCase().includes(occ.toLowerCase())) return out;
  const pairs: Array<[RegExp, string]> = [
    [/oilaviy hayit ziyofatimiz/i, `oilaviy ${occ} ziyofatimiz`],
    [/hayit ziyofatimiz/i, `${occ} ziyofatimiz`],
    [/hayit ziyofatini/i, `${occ} ziyofatini`],
    [/hayit ziyofati/i, `${occ} ziyofati`],
    [/hayit bayrami/i, occ],
    [/оилавий ҳайт зиёфатимиз/i, `оилавий ${occ} зиёфатимиз`],
    [/ҳайт зиёфатимиз/i, `${occ} зиёфатимиз`],
    [/ҳайт зиёфатини/i, `${occ} зиёфатини`],
    [/ҳайт зиёфати/i, `${occ} зиёфати`],
    [/ҳайт байрами/i, occ],
    [/семейный праздник Хаит/i, occ],
    [/праздника Хаит/i, occ],
    [/праздник Хаит/i, occ],
  ];
  for (const [re, repl] of pairs) {
    const next = out.replace(re, repl);
    if (next !== out) return next;
  }
  return out;
}
