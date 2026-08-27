import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
} from "./date";
import { cleanFieldValue, isJunkFieldValue } from "./fieldQuality";

const DATETIME_LINE_RE =
  /(?:\d{1,2}\s*[-./]\s*[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ‘']+|\d{1,2}\.\d{1,2}\.\d{4}).*\d{1,2}\s*:\s*\d{2}|soat\s+\d{1,2}\s*:\s*\d{2}|соат\s+\d{1,2}\s*:\s*\d{2}/i;

export function looksLikeDateTimeLine(text: string): boolean {
  const t = (text || "").trim();
  if (!t || t.includes("\n") || t.length > 90) return false;
  return DATETIME_LINE_RE.test(t);
}

export function substituteTextVars(
  text: string,
  vars: Record<string, string>,
  language?: string,
): string {
  return text
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const v = cleanFieldValue(vars[key]);
      if (!v) return "";
      if (key === "event_date") return formatDisplayDate(v, language);
      if (key === "event_time") return formatDisplayTime(v);
      return String(v);
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/**
 * Split a ready-text template into header / body / date / address.
 * Date and address always come from structured fields so a junk venue
 * or a filtered body line cannot shuffle the date into "Asosiy matn".
 */
export function splitTemplateBlocks(
  preview: string,
  vars: Record<string, string>,
  language?: string,
  options?: { skipDate?: boolean; fallbackBody?: string },
): { header: string; body: string; date_time: string; address: string } {
  const dateTime = options?.skipDate
    ? ""
    : formatDisplayDateTime(vars.event_date, vars.event_time, language);
  const venueAddress = cleanFieldValue(
    [vars.venue_name, vars.venue_address]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(", "),
  );

  const keepNames = new Set(
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
  const bodyLines: string[] = [];
  for (const line of raw.slice(1)) {
    if (looksLikeDateTimeLine(line)) continue;
    if (venueAddress && line === venueAddress) continue;
    if (/\{[a-z_]+\}/i.test(line) && line.length < 80) continue;
    if (/^[,.\-–—|/]+$/.test(line)) continue;
    if (isJunkFieldValue(line)) continue;
    if (
      line.split(/\s+/).length <= 3 &&
      line.length < 40 &&
      !/\d/.test(line) &&
      !/[.!?…]/.test(line) &&
      !keepNames.has(line.toLowerCase())
    ) {
      continue;
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join(" ").replace(/\s{2,}/g, " ").trim();
  return {
    header,
    body: ensureChildNameInBody(
      body || (options?.fallbackBody || "").trim(),
      vars.child_name || vars.childName,
      language,
    ),
    date_time: dateTime,
    address: venueAddress,
  };
}

/** Keep aqiqa/sunnat child name in the body when templates omit it. */
export function ensureChildNameInBody(
  body: string,
  childName?: string,
  language?: string,
): string {
  const child = (childName || "").trim();
  if (!child) return body;
  if ((body || "").toLowerCase().includes(child.toLowerCase())) return body;
  const trimmed = (body || "").trim();
  if (!trimmed) return child;
  if ((language || "").startsWith("ru")) {
    return `${trimmed.replace(/[.]+$/, "")} — ${child}.`;
  }
  return `${trimmed.replace(/[.]+$/, "")} ${child}.`;
}
