import { useTranslation } from "react-i18next";
import { DateField, TimeField } from "../components/DateTimePickers";
import UiSelect from "../components/UiSelect";
import { normalizeUiLang, pickTranslation } from "../i18n/lang";
import type { CeremonySchedule } from "../utils/ceremonySchedule";
import {
  DEFAULT_READY_STYLE,
  NIKOH_SUBTYPES,
  PAGE_EVENT_SLUGS,
  READY_TEXT_STYLES,
  eventLabel,
  fieldsForEvent,
  isCatalogMainText,
  isCatalogTitle,
  pageBuilderBody,
  pageBuilderHeader,
  subtypeLabel,
  type PageEventSlug,
} from "./eventFields";
import VenueMapField from "./VenueMapField";
import type { InvitationPagePayload } from "./types";

type Props = {
  page: InvitationPagePayload;
  patch: (partial: Partial<InvitationPagePayload>) => void;
};

export default function EventDetailsForm({ page, patch }: Props) {
  const { t, i18n } = useTranslation();
  const uiLang = normalizeUiLang(i18n.language);
  const contentLang = normalizeUiLang(page.displayLang || uiLang);
  const eventSlug = (page.eventSlug || "nikoh") as PageEventSlug;
  const keys = fieldsForEvent(eventSlug);
  const subtypes = page.subtypeSlugs || [];
  const schedule = page.ceremonySchedule || {};
  const styleId = page.readyTextId || DEFAULT_READY_STYLE;

  const catalogOpts = (
    nextEvent = eventSlug,
    nextSubtypes = subtypes,
    nextStyle = styleId,
  ) => ({
    eventSlug: nextEvent,
    language: contentLang,
    subtypeSlugs: nextSubtypes,
    styleId: nextStyle,
  });

  const catalogBody = (nextEvent = eventSlug, nextSubtypes = subtypes, nextStyle = styleId) =>
    pageBuilderBody(catalogOpts(nextEvent, nextSubtypes, nextStyle));

  const catalogHeader = (nextEvent = eventSlug, nextSubtypes = subtypes, nextStyle = styleId) =>
    pageBuilderHeader(catalogOpts(nextEvent, nextSubtypes, nextStyle));

  const catalogPatch = (
    nextEvent = eventSlug,
    nextSubtypes = subtypes,
    nextStyle = styleId,
  ): Partial<InvitationPagePayload> => {
    const out: Partial<InvitationPagePayload> = {};
    if (isCatalogMainText(page.mainText, t)) {
      out.mainText = pageBuilderBody(catalogOpts(nextEvent, nextSubtypes, nextStyle));
    }
    if (isCatalogTitle(page.title, eventSlug, t)) {
      out.title =
        pageBuilderHeader(catalogOpts(nextEvent, nextSubtypes, nextStyle)) ||
        t("defaultGreeting", { lng: contentLang });
    }
    return out;
  };

  const setEvent = (next: PageEventSlug) => {
    const nextSubtypes = next === "nikoh" ? (subtypes.length ? subtypes : ["nikoh_oqshomi"]) : [];
    const nextSchedule: CeremonySchedule = {};
    let nextDate = page.date;
    let nextTime = page.time;
    if (next === "nikoh") {
      for (const slug of nextSubtypes) {
        nextSchedule[slug] = schedule[slug] || {
          date: page.date || "",
          time: page.time || "",
        };
      }
      nextDate = nextSchedule[nextSubtypes[0]]?.date || page.date;
      nextTime = nextSchedule[nextSubtypes[0]]?.time || page.time;
    } else if (eventSlug === "nikoh") {
      const primary = schedule[subtypes[0]];
      nextDate = primary?.date || page.date;
      nextTime = primary?.time || page.time;
    }
    patch({
      eventSlug: next,
      subtypeSlugs: nextSubtypes,
      ceremonySchedule: nextSchedule,
      date: nextDate,
      time: nextTime,
      readyTextId: styleId,
      personName: next === "birthday" ? page.personName : "",
      childName: next === "aqiqa" || next === "sunnat" ? page.childName : "",
      childGender: next === "aqiqa" ? page.childGender : "",
      ...catalogPatch(next, nextSubtypes, styleId),
    });
  };

  const toggleSubtype = (slug: string) => {
    const on = subtypes.includes(slug);
    const next = on ? subtypes.filter((item) => item !== slug) : [...subtypes, slug];
    if (!next.length) return;
    const nextSchedule: CeremonySchedule = { ...schedule };
    if (!on) {
      nextSchedule[slug] = nextSchedule[slug] || { date: page.date || "", time: page.time || "" };
    } else {
      delete nextSchedule[slug];
    }
    patch({
      subtypeSlugs: next,
      ceremonySchedule: nextSchedule,
      date: nextSchedule[next[0]]?.date || page.date,
      time: nextSchedule[next[0]]?.time || page.time,
      readyTextId: styleId,
      ...catalogPatch(eventSlug, next, styleId),
    });
  };

  const setSlot = (slug: string, key: "date" | "time", value: string) => {
    const current = schedule[slug] || { date: "", time: "" };
    const nextSchedule = { ...schedule, [slug]: { ...current, [key]: value } };
    const primary = nextSchedule[subtypes[0]];
    patch({
      ceremonySchedule: nextSchedule,
      date: primary?.date || page.date,
      time: primary?.time || page.time,
    });
  };

  return (
    <>
      <div className="pb-field">
        <span>{t("chooseEvent")}</span>
        <div className="pb-chip-row">
          {PAGE_EVENT_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              className={`pb-chip${eventSlug === slug ? " is-on" : ""}`}
              onClick={() => setEvent(slug)}
            >
              {eventLabel(slug, uiLang)}
            </button>
          ))}
        </div>
      </div>

      {eventSlug === "nikoh" ? (
        <div className="pb-field">
          <span>
            {t("subtype")}
            {" *"}
          </span>
          <p className="pb-field-hint">{t("subtypeMultiHint")}</p>
          <div className="pb-chip-row">
            {NIKOH_SUBTYPES.map((item) => {
              const on = subtypes.includes(item.slug);
              return (
                <button
                  key={item.slug}
                  type="button"
                  className={`pb-chip${on ? " is-on" : ""}`}
                  onClick={() => toggleSubtype(item.slug)}
                >
                  {subtypeLabel(item.slug, uiLang)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {keys.includes("family_signature") ? (
        <label className="pb-field" data-pb-required="familySignature">
          <span>{t("field_family_signature")} *</span>
          <input
            value={page.familySignature || ""}
            maxLength={80}
            placeholder={t("field_family_signature_ph")}
            onChange={(e) => patch({ familySignature: e.target.value })}
          />
        </label>
      ) : null}

      {keys.includes("child_gender") ? (
        <div data-pb-required="childGender">
        <UiSelect
          label={`${t("field_child_gender")} *`}
          value={page.childGender || ""}
          onChange={(e) => patch({ childGender: e.target.value })}
        >
          <option value="">—</option>
          <option value="boy">{t("opt_boy")}</option>
          <option value="girl">{t("opt_girl")}</option>
        </UiSelect>
        </div>
      ) : null}

      {keys.includes("child_name") ? (
        <label className="pb-field" data-pb-required="childName">
          <span>{t("field_child_name")} *</span>
          <input
            value={page.childName || ""}
            maxLength={50}
            onChange={(e) => patch({ childName: e.target.value })}
          />
        </label>
      ) : null}

      {keys.includes("person_name") ? (
        <label className="pb-field" data-pb-required="personName">
          <span>{t("field_person_name")} *</span>
          <input
            value={page.personName || ""}
            maxLength={80}
            placeholder={t("field_person_name")}
            onChange={(e) => patch({ personName: e.target.value })}
          />
        </label>
      ) : null}

      {eventSlug === "nikoh"
        ? subtypes.map((slug) => {
          const slot = schedule[slug] || { date: "", time: "" };
          return (
            <div key={slug} className="pb-ceremony" data-pb-required={`slot-${slug}`}>
              <strong>{subtypeLabel(slug, uiLang)}</strong>
              <div className="pb-grid">
                <DateField
                  label={t("field_event_date")}
                  required
                  minToday
                  language={uiLang}
                  value={slot.date}
                  onChange={(value) => setSlot(slug, "date", value)}
                />
                <TimeField
                  label={t("field_event_time")}
                  required
                  language={uiLang}
                  value={slot.time}
                  onChange={(value) => setSlot(slug, "time", value)}
                />
              </div>
            </div>
          );
        })
        : null}

      {keys.includes("event_date") ? (
        <div className="pb-grid" data-pb-required="datetime">
          <DateField
            label={t("field_event_date")}
            required
            minToday
            language={uiLang}
            value={page.date}
            onChange={(value) => patch({ date: value })}
          />
          <TimeField
            label={t("field_event_time")}
            required
            language={uiLang}
            value={page.time}
            onChange={(value) => patch({ time: value })}
          />
        </div>
      ) : null}

      {keys.includes("venue_name") ? (
        <label className="pb-field" data-pb-required="venueName">
          <span>{t("field_venue_name")} *</span>
          <input
            value={page.venueName || ""}
            maxLength={100}
            onChange={(e) => patch({ venueName: e.target.value })}
          />
        </label>
      ) : null}

      {keys.includes("venue_address") ? (
        <label className="pb-field" data-pb-required="address">
          <span>{t("field_venue_address")} *</span>
          <input
            value={page.address}
            maxLength={240}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </label>
      ) : null}

      <VenueMapField
        mapLat={page.mapLat}
        mapLng={page.mapLng}
        address={page.address}
        language={contentLang}
        onChange={(point) => patch(point)}
      />

      <div className="pb-field">
        <span>{t("readyTexts")}</span>
        <p className="pb-field-hint">{t("textHint")}</p>
        <div className="pb-chip-row">
          {READY_TEXT_STYLES.map((item) => {
            const on = styleId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`pb-chip${on ? " is-on" : ""}`}
                onClick={() =>
                  patch({
                    readyTextId: item.id,
                    mainText: pageBuilderBody({
                      eventSlug,
                      language: contentLang,
                      subtypeSlugs: subtypes,
                      styleId: item.id,
                    }),
                    ...(isCatalogTitle(page.title, eventSlug, t)
                      ? {
                        title:
                          pageBuilderHeader({
                            eventSlug,
                            language: contentLang,
                            subtypeSlugs: subtypes,
                            styleId: item.id,
                          }) || t("defaultGreeting", { lng: contentLang }),
                      }
                      : {}),
                  })
                }
              >
                {pickTranslation(item.title, uiLang)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="pb-field">
        <span>{t("block_header")}</span>
        <textarea
          className="pb-sarlavha"
          rows={2}
          value={page.title}
          maxLength={120}
          placeholder={catalogHeader() || t("defaultGreeting")}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>

      <label className="pb-field" data-pb-required="mainText">
        <span>{t("block_body")}</span>
        <textarea
          value={page.mainText}
          maxLength={2000}
          placeholder={catalogBody()}
          onChange={(e) => patch({ mainText: e.target.value })}
        />
      </label>
    </>
  );
}
