import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
} from "./date";
import { cleanFieldValue, isJunkFieldValue } from "./fieldQuality";
import { formatFamilySignature } from "./familySignature";
import { FOOTER_MARK } from "./readyTexts";

const DATETIME_LINE_RE =
  /(?:\d{1,2}\s*[-./]\s*[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘']+|\d{1,2}\.\d{1,2}\.\d{4}).*\d{1,2}\s*:\s*\d{2}|soat\s+\d{1,2}\s*:\s*\d{2}|соат\s+\d{1,2}\s*:\s*\d{2}/i;

export function looksLikeDateTimeLine(text: string): boolean {
  const t = (text || "").trim();
  if (!t || t.includes("\n") || t.length > 90) return false;
  return DATETIME_LINE_RE.test(t);
}

const NAME_KEYS = ["child_name", "childName", "person_name", "personName"] as const;

function barePersonalName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/(?:ning|нинг)$/i, "")
    .trim();
}

export function substituteTextVars(
  text: string,
  vars: Record<string, string>,
  language?: string,
): string {
  let out = text;
  for (const key of NAME_KEYS) {
    const v = barePersonalName(cleanFieldValue(vars[key] || ""));
    out = out.replace(
      new RegExp(`\\{${key}\\}\\s*(ning|нинг)?`, "gi"),
      v ? `${v}$1` : "",
    );
  }
  return out
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const v = cleanFieldValue(vars[key]);
      if (!v) return "";
      if (key === "event_date") return formatDisplayDate(v, language);
      if (key === "event_time") return formatDisplayTime(v);
      if (key === "family_signature") {
        return formatFamilySignature(v, language);
      }
      return String(v);
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/**
 * Split a ready-text template into header / body / date / address / footer.
 * Date and address always come from structured fields so a junk venue
 * or a filtered body line cannot shuffle the date into "Asosiy matn".
 */
export function splitTemplateBlocks(
  preview: string,
  vars: Record<string, string>,
  language?: string,
  options?: { skipDate?: boolean; fallbackBody?: string },
): {
  header: string;
  body: string;
  date_time: string;
  address: string;
  footer: string;
} {
  const dateTime = options?.skipDate
    ? ""
    : formatDisplayDateTime(vars.event_date, vars.event_time, language);
  const venueAddress = cleanFieldValue(
    [vars.venue_name, vars.venue_address]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(", "),
  );

  const standaloneNames = new Set(
    [vars.child_name, vars.childName, vars.person_name, vars.personName]
      .map((v) => cleanFieldValue(String(v || "")))
      .filter(Boolean)
      .map((v) => v.toLowerCase()),
  );

  const text = substituteTextVars(preview, vars, language);
  const raw = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const header = raw[0] || "";
  let footer = "";
  const bodyLines: string[] = [];
  for (const line of raw.slice(1)) {
    if (line.startsWith(FOOTER_MARK)) {
      footer = line.slice(FOOTER_MARK.length).trim();
      // Drop trailing comma/space when family_signature was empty.
      footer = footer.replace(/[,;\s]+$/g, "").trim();
      continue;
    }
    if (looksLikeDateTimeLine(line)) continue;
    if (venueAddress && line === venueAddress) continue;
    if (/\{[a-z_]+\}/i.test(line) && line.length < 80) continue;
    if (/^[,.\-–—|/]+$/.test(line)) continue;
    if (isJunkFieldValue(line)) continue;
    if (standaloneNames.has(line.toLowerCase())) continue;
    if (
      line.split(/\s+/).length <= 3 &&
      line.length < 40 &&
      !/\d/.test(line) &&
      !/[.!?…]/.test(line)
    ) {
      continue;
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join(" ").replace(/\s{2,}/g, " ").trim();
  return {
    header,
    body: ensurePersonNameInBody(
      ensureChildNameInBody(
        body || (options?.fallbackBody || "").trim(),
        vars.child_name || vars.childName,
        language,
      ),
      vars.person_name || vars.personName,
      language,
    ),
    date_time: dateTime,
    address: venueAddress,
    footer,
  };
}

/** Keep aqiqa/sunnat child name in the body when templates omit it. */
export function ensureChildNameInBody(
  body: string,
  childName?: string,
  language?: string,
): string {
  return weaveNameIntoBody(body, childName, language, "child");
}

/** Keep birthday honoree name inside the sentence, not as a dangling extra word. */
export function ensurePersonNameInBody(
  body: string,
  personName?: string,
  language?: string,
): string {
  return weaveNameIntoBody(body, personName, language, "person");
}

function uzGenitive(name: string, cyrillic: boolean): string {
  if (/(ning|нинг)$/i.test(name)) return name;
  return `${name}${cyrillic ? "нинг" : "ning"}`;
}

function isCyrillic(text: string): boolean {
  return /[А-Яа-яЁёЎўҚқҒғҲҳ]/.test(text);
}

function stripDanglingName(body: string, name: string): string {
  if (!body || !name) return body || "";
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body
    .trim()
    .replace(new RegExp(`(?:(?<=[.!?…])\\s*|\\s+)${escaped}(?:\\s*[.])?\\s*$`, "i"), "")
    .trim();
}

function weaveNameIntoBody(
  body: string,
  rawName: string | undefined,
  language: string | undefined,
  role: "child" | "person",
): string {
  const name = barePersonalName(rawName || "");
  let text = (body || "").trim();
  if (!name) return text;
  const stripped = stripDanglingName(text, name);
  if (stripped) text = stripped;
  if (text.toLowerCase().includes(name.toLowerCase())) return text;

  const lang = (language || "").toLowerCase();
  const cyr = lang === "uz-cyrl" || isCyrillic(text);
  const ru = lang.startsWith("ru");
  const gen = uzGenitive(name, cyr);
  const rest = text.length > 1 ? text[0].toLowerCase() + text.slice(1) : text;
  const apos = "[ʻʼ''`‘’]";

  const patterns: Array<[RegExp, string]> =
    role === "person"
      ? [
          [new RegExp(`tug${apos}?ilgan\\s+kunni`, "i"), `${gen} tug‘ilgan kunini`],
          [/туғилган\s+кунни/i, `${gen} туғилган кунини`],
          [new RegExp(`tug${apos}?ilgan\\s+kun\\s+bayramimizga`, "i"), `${gen} tug‘ilgan kun bayramiga`],
          [/туғилган\s+кун\s+байрамимизга/i, `${gen} туғилган кун байрамига`],
          [new RegExp(`tug${apos}?ilgan\\s+kun\\s+bayramimiz`, "i"), `${gen} tug‘ilgan kun bayrami`],
          [/туғилган\s+кун\s+байрамимиз/i, `${gen} туғилган кун байрами`],
          [/tavallud\s+ayyomimizni/i, `${gen} tavallud ayyomini`],
          [/таваллуд\s+айёмимизни/i, `${gen} таваллуд айёмини`],
          [/tavallud\s+ayyomi/i, `${gen} tavallud ayyomi`],
          [/таваллуд\s+айёми/i, `${gen} таваллуд айёми`],
          [new RegExp(`tug${apos}?ilgan\\s+kuni`, "i"), `${gen} tug‘ilgan kuni`],
          [/туғилган\s+куни/i, `${gen} туғилган куни`],
          [new RegExp(`tug${apos}?ilgan\\s+kun`, "i"), `${gen} tug‘ilgan kun`],
          [/туғилган\s+кун/i, `${gen} туғилган кун`],
          [/дня рождения/i, `дня рождения ${name}`],
          [/день рождения/i, `день рождения ${name}`],
        ]
      : [
          [/jajji\s+dilbandimizning/i, "stem"],
          [/жажжи\s+дилбандимизнинг/i, "stem"],
          [/jajji\s+farzandimiz(?!ning|нинг)/i, "name"],
          [/жажжи\s+фарзандимиз(?!нинг|ning)/i, "name"],
          [/farzandimizning/i, "stem"],
          [/фарзандимизнинг/i, "stem"],
          [/dilbandimizning/i, "stem"],
          [/дилбандимизнинг/i, "stem"],
          [/qahramonimizning/i, "stem"],
          [/қаҳрамонимизнинг/i, "stem"],
          [new RegExp(`o${apos}?g${apos}?limizning`, "i"), "stem"],
          [/ўғлимизнинг/i, "stem"],
          [/qizimizning/i, "stem"],
          [/қизимизнинг/i, "stem"],
          [/farzandimizga/i, "dative-latn"],
          [/фарзандимизга/i, "dative-cyrl"],
          [/farzandimiz(?=\s+(?:aqiqa|sunnat))/i, "plus-gen"],
          [/фарзандимиз(?=\s+(?:ақиқа|суннат))/i, "plus-gen"],
          [/нашего ребёнка/i, "name"],
          [/нашего сына/i, "name"],
          [/our (?:child|son)/i, "name"],
          [
            new RegExp(
              `((?:aqiqa|ақиқа)\\s+(?:marosimi|маросими|to${apos}?yi|тўйи|dasturxoniga|дастурхонига))`,
              "i",
            ),
            `${gen} $1`,
          ],
          [new RegExp(`((?:sunnat|суннат)\\s+to${apos}?yi)`, "i"), `${gen} $1`],
          [/обряд акика/i, "name"],
          [/суннат той/i, "name"],
        ];

  const applyKinship = (full: string, mode: string) => {
    if (mode === "stem") {
      const low = full.toLowerCase();
      for (const suf of ["ning", "нинг"]) {
        if (low.endsWith(suf)) return `${full.slice(0, -suf.length)} ${gen}`;
      }
      return `${full} ${gen}`;
    }
    if (mode === "name") return `${full} ${name}`;
    if (mode === "plus-gen") return `${full} ${gen}`;
    if (mode === "dative-latn") return `${full.slice(0, -2)} ${name}ga`;
    if (mode === "dative-cyrl") return `${full.slice(0, -2)} ${name}га`;
    return full;
  };

  for (const [pat, repl] of patterns) {
    if (!pat.test(text)) continue;
    if (
      repl === "stem" ||
      repl === "name" ||
      repl === "plus-gen" ||
      repl === "dative-latn" ||
      repl === "dative-cyrl"
    ) {
      return text.replace(pat, (full) => applyKinship(full, repl));
    }
    return text.replace(pat, repl);
  }
  if (!text) return name;
  if (ru) {
    const honor = role === "person" ? "именинника" : "ребёнка";
    return `${text.replace(/[.]+$/, "")} в честь ${honor} ${name}.`;
  }
  if (role === "person") {
    const lead = cyr
      ? `${gen} тантанаси муносабати билан `
      : `${gen} tantanasi munosabati bilan `;
    return lead + rest;
  }
  const lead = cyr
    ? `Фарзандимиз ${gen} тантанаси муносабати билан `
    : `Farzandimiz ${gen} tantanasi munosabati bilan `;
  return lead + rest;
}

export function ensureEventNameInBody(
  body: string,
  fields: Record<string, string | undefined> | undefined,
  eventSlug?: string,
  language?: string,
): string {
  const data = fields || {};
  if (eventSlug === "birthday") {
    return ensurePersonNameInBody(
      body,
      data.person_name || data.personName,
      language,
    );
  }
  if (eventSlug === "aqiqa" || eventSlug === "sunnat") {
    return ensureChildNameInBody(
      body,
      data.child_name || data.childName,
      language,
    );
  }
  return body;
}

/** Append optional personal message without duplicating it. */
export function ensurePersonalMessageInBody(
  body: string,
  message?: string,
): string {
  const msg = cleanFieldValue(String(message || "")).trim();
  if (!msg) return body;
  const trimmed = (body || "").trim();
  if (!trimmed) return msg;
  if (trimmed.toLowerCase().includes(msg.toLowerCase())) return trimmed;
  return `${trimmed}\n\n${msg}`;
}

/** Split stored preview_text for admin editing (header / body / yakun). */
export function parseTextTemplatePreview(preview: string): {
  header: string;
  body: string;
  footer: string;
} {
  const raw = String(preview || "").replace(/\r\n/g, "\n");
  let main = raw;
  let footer = "";
  const markAt = raw.indexOf(FOOTER_MARK);
  if (markAt >= 0) {
    main = raw.slice(0, markAt).replace(/\n+$/, "");
    footer = raw.slice(markAt + FOOTER_MARK.length).replace(/^\n+/, "").trim();
  }
  const lines = main.split("\n");
  const header = (lines[0] || "").trimEnd();
  const body = lines.slice(1).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  return { header, body, footer };
}

/** Recompose preview_text with optional @@FOOTER@@ yakun line. */
export function composeTextTemplatePreview(
  header: string,
  body: string,
  footer: string,
): string {
  const parts = [header.trimEnd(), body.replace(/^\n+/, "").replace(/\n+$/, "")].filter(
    (p) => p.length > 0,
  );
  let text = parts.join("\n");
  const closing = footer.trim();
  if (closing) {
    text = text ? `${text}\n${FOOTER_MARK}${closing}` : `${FOOTER_MARK}${closing}`;
  }
  return text;
}
