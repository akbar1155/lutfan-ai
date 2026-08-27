import { formatDisplayDateTime } from "./date";
import { pickTranslation } from "../i18n/lang";

export type CeremonySlot = { date: string; time: string };
export type CeremonySchedule = Record<string, CeremonySlot>;

const PRIMARY_SLUG_RE = /nikoh_oqshomi|vechir|nikoh/i;

export function getSelectedSubtypeSlugs(invitation: {
  subtype_slugs?: string[] | null;
  subtype_slug?: string | null;
}): string[] {
  if (invitation.subtype_slugs && invitation.subtype_slugs.length) {
    return invitation.subtype_slugs.filter(Boolean);
  }
  if (invitation.subtype_slug) return [invitation.subtype_slug];
  return [];
}

export function loadCeremonySchedule(
  eventData: Record<string, unknown> | null | undefined,
  subtypeSlugs: string[],
): CeremonySchedule {
  const structured =
    (eventData?.structured_fields as Record<string, string> | undefined) || {};
  const existing =
    (eventData?.ceremony_schedule as CeremonySchedule | undefined) || {};
  const out: CeremonySchedule = {};
  for (const slug of subtypeSlugs) {
    const slot = existing[slug] || {};
    out[slug] = {
      date: String(slot.date || structured.event_date || "").trim(),
      time: String(slot.time || structured.event_time || "").trim(),
    };
  }
  return out;
}

export function primaryEventDate(schedule: CeremonySchedule): string | null {
  const dates = Object.values(schedule)
    .map((s) => s.date)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  return dates[0] || null;
}

/** Chronological order; primary nikoh parts first when date+time tie. */
export function sortedCeremonySlugs(schedule: CeremonySchedule): string[] {
  return Object.keys(schedule).sort((a, b) => {
    const sa = schedule[a] || { date: "", time: "" };
    const sb = schedule[b] || { date: "", time: "" };
    const ka = `${sa.date || "9999-99-99"}T${sa.time || "99:99"}`;
    const kb = `${sb.date || "9999-99-99"}T${sb.time || "99:99"}`;
    if (ka !== kb) return ka.localeCompare(kb);
    const pa = PRIMARY_SLUG_RE.test(a) ? 0 : 1;
    const pb = PRIMARY_SLUG_RE.test(b) ? 0 : 1;
    return pa - pb || a.localeCompare(b);
  });
}

/** Build invitation date_time block lines for one or many ceremonies. */
export function buildCeremonyDateTimeText(
  schedule: CeremonySchedule,
  subtypes: Array<{ slug: string; names: Record<string, string> }> | undefined,
  language: string,
  fallbackDate?: string,
  fallbackTime?: string,
): string {
  const slugs = sortedCeremonySlugs(schedule);
  if (slugs.length >= 2) {
    const lines: string[] = [];
    for (const slug of slugs) {
      const slot = schedule[slug];
      if (!slot?.date && !slot?.time) continue;
      const meta = subtypes?.find((s) => s.slug === slug);
      const label =
        (meta && pickTranslation(meta.names, language)) || slug;
      const when = formatDisplayDateTime(slot.date, slot.time, language);
      if (when) lines.push(`${label} | ${when}`);
    }
    return lines.join("\n");
  }

  const only = slugs[0] ? schedule[slugs[0]] : null;
  if (only?.date || only?.time) {
    return formatDisplayDateTime(only.date, only.time, language);
  }
  return formatDisplayDateTime(fallbackDate, fallbackTime, language);
}
