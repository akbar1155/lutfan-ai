import { eventDisplayName, pickTranslation, type UiLang } from "../i18n/lang";
import type { CeremonySchedule } from "../utils/ceremonySchedule";
import {
  buildLocalReadyTemplates,
  listReadyTextStyles,
} from "../utils/readyTexts";
import { splitTemplateBlocks } from "../utils/textBlocks";

export type PageEventSlug =
  | "nikoh"
  | "aqiqa"
  | "sunnat"
  | "birthday"
  | "hudoyi";

export const PAGE_EVENT_SLUGS: PageEventSlug[] = [
  "nikoh",
  "aqiqa",
  "sunnat",
  "birthday",
  "hudoyi",
];

export const NIKOH_SUBTYPES: Array<{
  slug: string;
  names: Record<string, string>;
}> = [
  {
    slug: "nikoh_oqshomi",
    names: {
      "uz-latn": "Nikoh oqshomi",
      "uz-cyrl": "Никоҳ оқшоми",
      ru: "Свадебный вечер",
    },
  },
  {
    slug: "nahorgi_osh",
    names: {
      "uz-latn": "Nahorga osh",
      "uz-cyrl": "Наҳорга ош",
      ru: "Утренний плов",
    },
  },
  {
    slug: "maslahat_oshi",
    names: {
      "uz-latn": "Maslahat oshi",
      "uz-cyrl": "Маслаҳат оши",
      ru: "Плов-маслахат",
    },
  },
  {
    slug: "qiz_bazmi",
    names: {
      "uz-latn": "Qiz bazmi",
      "uz-cyrl": "Қиз базми",
      ru: "Девичий вечер",
    },
  },
];

export function isPageEvent(
  value: string | undefined | null,
): value is PageEventSlug {
  return PAGE_EVENT_SLUGS.includes(String(value || "") as PageEventSlug);
}

export const DEFAULT_READY_STYLE = "classic1";

export const READY_TEXT_STYLES = listReadyTextStyles();

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function defaultMainText(eventSlug: string, t: Translate): string {
  return t(`defaultBody_${eventSlug}`, { defaultValue: t("defaultBody") });
}

type CatalogOpts = {
  eventSlug: string;
  language: string;
  subtypeSlugs?: string[] | null;
  styleId?: string;
};

function pageBuilderBlocks(opts: CatalogOpts): {
  header: string;
  body: string;
} {
  const styleId = opts.styleId || DEFAULT_READY_STYLE;
  const templates = buildLocalReadyTemplates(
    () => "",
    opts.eventSlug || "nikoh",
    opts.language,
    opts.subtypeSlugs,
  );
  const tpl =
    templates.find((item) => item.id.endsWith(`-${styleId}`)) || templates[0];
  if (!tpl?.preview_text) return { header: "", body: "" };
  const blocks = splitTemplateBlocks(tpl.preview_text, {}, opts.language);
  return { header: blocks.header.trim(), body: blocks.body.trim() };
}

function joinNames(names: string[], lang: string): string {
  if (names.length <= 1) return names[0] || "";
  const and = lang === "ru" ? " и " : lang === "uz-cyrl" ? " ва " : " va ";
  return `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}`;
}

function ceremonyLine(slugs: string[] | undefined, lang: string): string {
  if (!slugs || slugs.length < 2) return "";
  const names = slugs.map((slug) => subtypeLabel(slug, lang));
  const list = joinNames(names, lang);
  if (lang === "ru") return `Церемонии: ${list}.`;
  if (lang === "uz-cyrl") return `Маросимлар: ${list}.`;
  return `Marosimlar: ${list}.`;
}

export function pageBuilderBody(opts: CatalogOpts): string {
  const body = pageBuilderBlocks(opts).body;
  const extra = opts.eventSlug === "nikoh" ? ceremonyLine(opts.subtypeSlugs, opts.language) : "";
  if (!extra || !body) return extra || body;
  if (body.includes(extra)) return body;
  return `${body}\n\n${extra}`;
}

export function pageBuilderHeader(opts: CatalogOpts): string {
  return pageBuilderBlocks(opts).header;
}

const DEFAULT_GREETINGS = [
  "Assalomu alaykum!",
  "Ассалому алайкум!",
  "Ассаламу алейкум!",
];

let catalogCopies: { bodies: Set<string>; headers: Set<string> } | null = null;

function catalogCopySets() {
  if (catalogCopies) return catalogCopies;
  const bodies = new Set<string>(["Sizni tantanamizga taklif etamiz."]);
  const headers = new Set<string>(DEFAULT_GREETINGS);
  const langs = ["uz-latn", "uz-cyrl", "ru"];
  const styleIds = READY_TEXT_STYLES.map((item) => item.id);
  const nikohSlugs = NIKOH_SUBTYPES.map((row) => row.slug);
  const nikohSets: string[][] = [];
  for (let mask = 1; mask < 1 << nikohSlugs.length; mask += 1) {
    nikohSets.push(nikohSlugs.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  for (const lang of langs) {
    for (const event of PAGE_EVENT_SLUGS) {
      const groups = event === "nikoh" ? nikohSets : [[]];
      for (const slugs of groups) {
        for (const styleId of styleIds) {
          const opts = {
            eventSlug: event,
            language: lang,
            subtypeSlugs: slugs,
            styleId,
          };
          const { header, body } = pageBuilderBlocks(opts);
          if (body) bodies.add(body);
          const combined = pageBuilderBody(opts);
          if (combined) bodies.add(combined);
          if (header) headers.add(header);
        }
      }
    }
  }
  catalogCopies = { bodies, headers };
  return catalogCopies;
}

function catalogBodySet(): Set<string> {
  return catalogCopySets().bodies;
}

function catalogHeaderSet(): Set<string> {
  return catalogCopySets().headers;
}

export function isCatalogMainText(text: string, t?: Translate): boolean {
  const trimmed = (text || "").trim();
  if (!trimmed) return true;
  if (catalogBodySet().has(trimmed)) return true;
  if (!t) return false;
  if (trimmed === String(t("defaultBody") || "").trim()) return true;
  return PAGE_EVENT_SLUGS.some(
    (slug) => trimmed === defaultMainText(slug, t).trim(),
  );
}

export function isDefaultMainText(text: string, t: Translate): boolean {
  return isCatalogMainText(text, t);
}

export function isCatalogTitle(
  title: string,
  eventSlug?: string,
  t?: Translate,
): boolean {
  const trimmed = (title || "").trim();
  if (!trimmed) return true;
  if (catalogHeaderSet().has(trimmed)) return true;
  if (t && trimmed === String(t("defaultGreeting") || "").trim()) return true;
  if (eventSlug) {
    for (const lang of ["uz-latn", "uz-cyrl", "ru"]) {
      if (trimmed === eventLabel(eventSlug, lang)) return true;
    }
  }
  return false;
}

export function subtypeLabel(slug: string, lang: string): string {
  const meta = NIKOH_SUBTYPES.find((row) => row.slug === slug);
  return (meta && pickTranslation(meta.names, lang)) || slug;
}

export function eventLabel(slug: string, lang?: string | null): string {
  return eventDisplayName(slug, lang);
}

export function emptySchedule(slugs: string[]): CeremonySchedule {
  const out: CeremonySchedule = {};
  for (const slug of slugs) out[slug] = { date: "", time: "" };
  return out;
}

export type EventFieldKey =
  | "family_signature"
  | "child_gender"
  | "child_name"
  | "person_name"
  | "event_date"
  | "event_time"
  | "venue_name"
  | "venue_address";

export function fieldsForEvent(eventSlug: string): EventFieldKey[] {
  if (eventSlug === "nikoh") {
    return ["family_signature", "venue_name", "venue_address"];
  }
  if (eventSlug === "aqiqa") {
    return [
      "family_signature",
      "child_gender",
      "child_name",
      "event_date",
      "event_time",
      "venue_name",
      "venue_address",
    ];
  }
  if (eventSlug === "sunnat") {
    return [
      "family_signature",
      "child_name",
      "event_date",
      "event_time",
      "venue_name",
      "venue_address",
    ];
  }
  if (eventSlug === "birthday") {
    return [
      "family_signature",
      "person_name",
      "event_date",
      "event_time",
      "venue_name",
      "venue_address",
    ];
  }
  return [
    "family_signature",
    "event_date",
    "event_time",
    "venue_name",
    "venue_address",
  ];
}

export function previewTitle(opts: {
  eventSlug: string;
  childName?: string;
  personName?: string;
  familySignature?: string;
  title?: string;
  lang?: string | null;
}): string {
  const event = opts.eventSlug || "nikoh";
  if (event === "aqiqa" || event === "sunnat") {
    return opts.childName || eventLabel(event, opts.lang);
  }
  if (event === "birthday") {
    return opts.personName || eventLabel(event, opts.lang);
  }
  return eventLabel(event, opts.lang);
}

export function inviteHeading(opts: {
  title?: string;
  personName?: string;
  childName?: string;
  familySignature?: string;
  eventSlug?: string;
  lang?: string | null;
}): string {
  const custom = (opts.title || "").trim();
  if (custom) return custom;
  return (
    (opts.personName || "").trim() ||
    (opts.childName || "").trim() ||
    previewTitle({
      eventSlug: opts.eventSlug || "nikoh",
      childName: opts.childName,
      personName: opts.personName,
      familySignature: opts.familySignature,
      title: opts.title,
      lang: opts.lang,
    })
  );
}

export type { UiLang };
