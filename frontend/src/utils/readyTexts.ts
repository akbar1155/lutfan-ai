import type { TextTemplate } from "../api/client";
import catalogData from "../data/readyTexts.json";

type Lang = "uz-latn" | "uz-cyrl" | "ru";

type I18nText = Record<Lang, string>;

type CatalogItem = {
  id: string;
  title: I18nText;
};

type EventTopic = {
  latn: string;
  cyrl: string;
  ru: string;
  aboutLatn: string;
  aboutCyrl: string;
  aboutRu: string;
  warmLatn: string;
  warmCyrl: string;
  warmRu: string;
  duaLatn: string;
  duaCyrl: string;
  duaRu: string;
};

type ReadyTextsFile = {
  catalog: CatalogItem[];
  nikohTopics?: Record<string, EventTopic>;
  eventTopics: Record<string, EventTopic>;
  templates: Record<string, I18nText>;
};

const data = catalogData as ReadyTextsFile;

const FALLBACK_TOPIC: EventTopic = {
  latn: "tadbirimiz",
  cyrl: "тадбиримиз",
  ru: "наше торжество",
  aboutLatn: "tadbirimiz",
  aboutCyrl: "тадбиримиз",
  aboutRu: "наше торжество",
  warmLatn: "oilaviy tadbirimiz",
  warmCyrl: "оилавий тадбиримиз",
  warmRu: "наше семейное торжество",
  duaLatn: "oilamizga baraka va tinchlik",
  duaCyrl: "оиламизга барака ва тинчлик",
  duaRu: "благословения и мира нашей семье",
};

function normalizeLang(language: string): Lang {
  return (["uz-latn", "uz-cyrl", "ru"].includes(language)
    ? language
    : "uz-latn") as Lang;
}

function cap(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function fillTemplate(tpl: string, topic: EventTopic): string {
  const vars: Record<string, string> = {
    ...topic,
    Latn: cap(topic.latn),
    Cyrl: cap(topic.cyrl),
    Ru: cap(topic.ru),
    AboutLatn: cap(topic.aboutLatn),
    AboutCyrl: cap(topic.aboutCyrl),
    AboutRu: cap(topic.aboutRu),
  };
  return tpl.replace(/\{([A-Za-z]+)\}/g, (_, key: string) =>
    vars[key] != null ? vars[key] : `{${key}}`,
  );
}

/** Pick wording topic for nikoh subtypes (qiz bazmi ≠ nikoh oqshomi). */
export function primaryNikohSubtype(subtypeSlugs?: string[] | null): string {
  const slugs = (subtypeSlugs || []).filter(Boolean);
  if (!slugs.length) return "nikoh_oqshomi";
  if (slugs.length === 1) return slugs[0];
  if (slugs.includes("nikoh_oqshomi")) return "nikoh_oqshomi";
  return slugs[0];
}

function topicFor(
  eventSlug: string,
  subtypeSlugs?: string[] | null,
): EventTopic {
  if (eventSlug === "nikoh") {
    const key = primaryNikohSubtype(subtypeSlugs);
    return (
      data.nikohTopics?.[key] ||
      data.nikohTopics?.nikoh_oqshomi ||
      FALLBACK_TOPIC
    );
  }
  return data.eventTopics[eventSlug] || FALLBACK_TOPIC;
}

function bodyFor(
  eventSlug: string,
  styleId: string,
  lang: Lang,
  subtypeSlugs?: string[] | null,
): string {
  const topic = topicFor(eventSlug, subtypeSlugs);
  const tpl = data.templates[styleId]?.[lang] || "";
  return fillTemplate(tpl, topic).trim();
}

function pack(
  eventSlug: string,
  language: string,
  subtypeSlugs?: string[] | null,
): TextTemplate[] {
  const lang = normalizeLang(language);
  const nameLine =
    eventSlug === "aqiqa" || eventSlug === "sunnat"
      ? "{child_name}\n"
      : eventSlug === "birthday"
        ? "{person_name}\n"
        : "";
  const withDate = eventSlug !== "hayit";
  const dateLine = withDate
    ? lang === "ru"
      ? "{event_date}, в {event_time}\n"
      : lang === "uz-cyrl"
        ? "{event_date}, соат {event_time} да\n"
        : "{event_date}, soat {event_time} da\n"
    : "";
  const subtypeKey =
    eventSlug === "nikoh" ? primaryNikohSubtype(subtypeSlugs) : "all";

  return data.catalog.map((item) => {
    const body = bodyFor(eventSlug, item.id, lang, subtypeSlugs);
    return {
      id: `local-${eventSlug}-${subtypeKey}-${lang}-${item.id}`,
      title: item.title[lang],
      language: lang,
      tone: "classic",
      preview_text: `${body}\n${nameLine}${dateLine}{venue_name}, {venue_address}`,
    };
  });
}

/** Style list (id + titles) from readyTexts.json */
export function listReadyTextStyles(): CatalogItem[] {
  return data.catalog;
}

export function buildLocalReadyTemplates(
  _t: (key: string, options?: Record<string, unknown>) => string,
  eventSlug: string,
  language: string,
  subtypeSlugs?: string[] | null,
): TextTemplate[] {
  return pack(eventSlug, language, subtypeSlugs);
}

export function mergeReadyTextTemplates(
  _serverTemplates: TextTemplate[],
  localTemplates: TextTemplate[],
): TextTemplate[] {
  // Local catalog is the source of truth per event — never mix server/legacy
  // templates (e.g. nikoh wording showing up under aqiqa).
  if (localTemplates.length) return localTemplates;
  return _serverTemplates;
}
