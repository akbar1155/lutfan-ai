import type { CSSProperties } from "react";
import { pickTranslation } from "../i18n/lang";
import { formatDisplayDate, formatDisplayTime } from "../utils/date";
import { formatFamilyFooter } from "../utils/familySignature";
import {
  sortedCeremonySlugs,
  type CeremonySchedule,
} from "../utils/ceremonySchedule";
import { ensureEventNameInBody } from "../utils/textBlocks";
import { SITE_COPY, siteLayoutFromFont } from "./config";
import { NIKOH_SUBTYPES, eventLabel, inviteHeading } from "./eventFields";
import type { DesignConfig } from "./types";

type Content = {
  title: string;
  mainText: string;
  date: string;
  time: string;
  venueName?: string;
  address: string;
  familySignature?: string;
  eventSlug?: string;
  childName?: string;
  personName?: string;
  schedule?: CeremonySchedule;
  subtypeSlugs?: string[];
  language?: string;
};

type Props = {
  content: Content;
  design: DesignConfig;
  opened?: boolean;
  compact?: boolean;
};

function Ornament() {
  return (
    <span className="ip-ornament" aria-hidden>
      <i />
    </span>
  );
}

function HeroArc({ className = "" }: { className?: string }) {
  return (
    <svg className={`ip-hero-arc${className ? ` ${className}` : ""}`} viewBox="0 0 320 72" aria-hidden>
      <path
        d="M18 64C74 10 246 10 302 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path
        d="M48 58C92 22 228 22 272 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
        opacity="0.55"
      />
      <circle cx="160" cy="14" r="2.3" fill="currentColor" />
      <path d="M160 8.2l1.6 3.4 3.8.4-2.8 2.6.8 3.7-3.4-1.9-3.4 1.9.8-3.7-2.8-2.6 3.8-.4z" fill="currentColor" />
    </svg>
  );
}

type ProgramItem = { label: string; date: string; time: string };

function timeCaption(time: string, lang: string) {
  if (!time) return "";
  if (lang === "ru") return `в ${time}`;
  if (lang === "uz-cyrl") return `соат ${time}`;
  return `soat ${time}`;
}

function buildProgram(
  schedule: CeremonySchedule,
  eventSlug: string,
  lang: string,
  fallbackDate?: string,
  fallbackTime?: string,
): ProgramItem[] {
  if (eventSlug === "nikoh") {
    const items = sortedCeremonySlugs(schedule).flatMap((slug) => {
      const slot = schedule[slug];
      if (!slot?.date && !slot?.time) return [];
      const meta = NIKOH_SUBTYPES.find((item) => item.slug === slug);
      return [
        {
          label: pickTranslation(meta?.names, lang, slug),
          date: formatDisplayDate(slot.date, lang),
          time: formatDisplayTime(slot.time),
        },
      ];
    });
    if (items.length) return items;
  }
  const date = formatDisplayDate(fallbackDate, lang);
  const time = formatDisplayTime(fallbackTime);
  if (!date && !time) return [];
  return [{ label: "", date, time }];
}

function FlowerShape({ kind }: { kind: string }) {
  if (kind === "none") return null;
  const motif = kind === "dried" ? "lotus" : kind;
  if (motif === "rose") {
    return (
      <g fill="currentColor">
        <path
          d="M33 61.5c-1.4-8.2-.6-14.5.4-20.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
        <path d="M32.6 50.5C22.5 48 14.2 41.2 13 32.8c9.2 1.6 15.8 8.6 19.6 17.7Z" opacity="0.88" />
        <path
          d="M32.4 50.2C24.8 45.4 20.6 38 22.4 30.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
          opacity="0.55"
        />
        <path d="M26.2 41.2c1.6-4.4 5.6-6.6 10.8-4.4L34 43.6l-4.6.6-3.2-3z" />
        <path
          d="M24.5 21.4c-1.8-9.2 6.6-15.6 13.2-11.8 5.4-3.8 12.8 2.4 9.6 10.4 4.8 5.2-.4 12.4-6.8 11.6-5.8 4.6-14.6-.2-16-10.2Z"
          opacity="0.48"
        />
        <path d="M17.6 29.2c-6.4-5.6-5.8-14.2 2.4-16.6 3.8 4.2 6.2 9.8 7.6 16.2-4.2 3.6-8.8 3.8-10 0.4Z" />
        <path d="M44.8 27.4c7.2-3.6 9.6-12.2 2.2-16.4-3.2 5.2-5.8 10.6-7.6 16.4 4.2 4.8 8.8 3.8 5.4 0Z" />
        <path d="M21.4 35.6c-4.2-4-2.4-11.2 3.8-12.4 4.2-2.2 10.4-.4 14.6 4.2 2.4 5.6-2.8 12.4-9.2 12.8-5.4.4-8.4-1.2-9.2-4.6Z" />
        <path d="M27.6 27.2c.2-6.2 6.4-8.8 9.6-4.6 2.6-4.4 8.2-1.8 6.2 3.4 3.6 2.6.6 8.4-5.2 8.8-5.4.4-10.6-2.4-10.6-7.6Z" />
        <path
          d="M32.4 26.2c1.4-2.8 5.4-2.8 6.2.2.8 2.8-1.6 4.6-4 4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (motif === "tulip") {
    return (
      <g fill="currentColor">
        <path
          d="M32 61.2C30.4 50.6 32.8 42 32 36.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M31.6 48.5C18.5 45.2 11.2 32.4 16.8 22.6 23.6 30.8 28.4 39.4 31.6 48.5Z" opacity="0.86" />
        <path d="M32.2 36.4c-7.6.6-13.2-4.2-14.8-11.8 5.2 1.5 10.2 5.4 14.8 11.8Z" opacity="0.78" />
        <path d="M32 36.4c7.6.6 13.2-4.2 14.8-11.8-5.2 1.5-10.2 5.4-14.8 11.8Z" opacity="0.78" />
        <path d="M20.4 24.6C19.2 14.4 25.4 6.6 32 3.6 30.4 11.6 30.8 18.6 32 25.4 33.2 18.6 33.6 11.6 32 3.6 38.6 6.6 44.8 14.4 43.6 24.6 42.6 32.2 38 37.2 32 37.2S21.4 32.2 20.4 24.6Z" />
        <path d="M27.4 22.2C26.6 14.8 29.2 8.4 32 5.2 31.4 12.4 31.2 17.6 32 22.8 32.8 17.6 32.6 12.4 32 5.2 34.8 8.4 37.4 14.8 36.6 22.2 35.8 27.4 34 30.8 32 30.8S28.2 27.4 27.4 22.2Z" opacity="0.38" />
      </g>
    );
  }
  if (motif === "peony") {
    return (
      <g fill="currentColor">
        <path
          d="M33 61C31.8 52.5 32.4 46 33.2 41"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M32.8 49C23 47.4 16.4 41 15.2 33.2 23.6 35.4 29.4 41.6 32.8 49Z" opacity="0.8" />
        <path d="M18 28c-7.4-2.8-8.6-12.2-1.6-16.4 1.8 5.4 4.6 10.2 8.4 14.2C21.4 28.6 19.2 29.2 18 28Z" />
        <path d="M46.6 26.8c6.8-4.2 5.2-13.8-2.4-16.2-1 5.8-3.6 10.6-7.2 14.6 3.8 2.2 7.2 2.4 9.6 1.6Z" />
        <path d="M22.2 18.4C18.6 10.2 26.2 3.4 33.4 7.2 30.8 12.6 29.6 17.8 29.8 22.8 27 21.6 24.2 20.2 22.2 18.4Z" opacity="0.72" />
        <path d="M41.6 17.8C45.8 10.2 37.4 3.6 30.8 8.2 33.6 13.2 35 18 35.2 22.8 37.8 21.4 40 19.6 41.6 17.8Z" opacity="0.72" />
        <path d="M16.8 33.6c-6.2 1.4-10.4-6.6-6-12.6 5.6 1.8 10.2 5.4 14 10.2-3.2 2.4-6.2 2.8-8 2.4Z" />
        <path d="M47.6 33.2c6.4.6 9.4-8.2 4.2-13.4-5.2 2.6-9.6 6.4-13 11.2 3.2 2.2 6.4 2.4 8.8 2.2Z" />
        <path d="M21.4 38.6C14.8 41.2 10.6 33.4 14.8 27.6c5.2 2.8 9.8 6.4 13.6 11.2-2.8 1.6-5.2 1.2-7 0Z" />
        <path d="M43.2 38.2c6.6 1.8 9.8-6.4 5.2-12-5 3.2-9.4 7-13 11.6 2.8 1.4 5.4 1.2 7.8.4Z" />
        <path d="M24.6 32.4c-3.6-8.4 3.8-15.6 11.8-12.8 7.2-3.2 14.2 4.4 10.2 12.2 4.8 6.2-1.6 13.6-9.6 12.8-6.6 4.4-14.6-1.2-12.4-12.2Z" />
        <path d="M28.8 30.6c.6-5.8 6.4-8.2 10-4.4 2.8-3.8 8.2-1.6 6.4 3.4 3.2 2.8.2 8-5.4 8.4-5.2.4-11.4-2.4-11-7.4Z" />
        <circle cx="33.4" cy="31.4" r="3.1" opacity="0.45" />
      </g>
    );
  }
  if (motif === "jasmine") {
    return (
      <g fill="currentColor">
        <path
          d="M18 58.5C22 48 28 40 36 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
        <path d="M24.5 46.5C16.2 45 10.6 38.4 11.4 30.6 18.8 33.2 23.2 39.4 24.5 46.5Z" />
        <path d="M31.2 38.4C24.6 34.8 22.4 26.8 26.8 21.2 31.2 26.6 33.4 32.8 31.2 38.4Z" opacity="0.88" />
        <path d="M28.6 22.8c-3.6-4.2-1.6-9.6 3.2-10.8.6 3.4 1.2 6.4 2 9.2-1.8 1.4-3.8 1.8-5.2 1.6Z" />
        <path d="M38.4 21.2c-2.2-5.2 2.2-9.6 7-8.4-.2 3.6-.8 6.6-1.8 9.4-1.8.4-3.8.2-5.2-1Z" />
        <path d="M36.2 18.5c-4.8-1.2-6.2-7.2-2.2-10.4 2.6 2.8 4.6 6 6 9.4-1.4.8-2.6 1.2-3.8 1Z" />
        <path d="M41.2 19.8c-1.2-5 3.6-9 8.2-7.2-1.2 3.4-2.6 6.2-4.2 8.8-1.6.2-3 .2-4-.1Z" />
        <path d="M39.6 24.6c-4.2 2.4-8.4-1.2-7.6-5.8 3.4.6 6.4 2 9 4.2-.4.8-1 .1-1.4 1.6Z" />
        <circle cx="37.6" cy="20.2" r="2.15" />
        <path d="M22.4 31.4c-3.2-3.6-1.2-8.4 3-9.4.6 2.8 1.2 5.2 2 7.4-1.6 1.2-3.4 1.8-5 2Z" opacity="0.9" />
        <path d="M29.8 29.8c-1.4-4.4 2.4-8 6.4-6.6-.4 2.8-1 5.2-1.8 7.4-1.6.2-3.2 0-4.6-.8Z" opacity="0.9" />
        <path d="M27.6 27.6c-3.8-.8-4.8-5.8-1.6-8.4 2 2.2 3.6 4.8 4.8 7.4-1.2.6-2.2 1-3.2 1Z" opacity="0.9" />
        <path d="M31.8 28.6c-1-4.2 2.8-7.4 6.6-5.8-1 2.6-2.2 5-3.4 7-1.2.1-2.2.1-3.2-.1Z" opacity="0.9" />
        <path d="M30.2 32.2c-3.4 1.8-6.6-1.2-5.8-4.8 2.6.6 5 1.6 7.2 3.4-.4.6-.8 1-1.4 1.4Z" opacity="0.9" />
        <circle cx="29.4" cy="28.8" r="1.7" />
        <path d="M42.8 34.2c1.4-3.8 5.8-4.2 8-1.4-2.4.8-4.4 2-6.2 3.6-.8-.6-1.4-1.4-1.8-2.2Z" opacity="0.75" />
      </g>
    );
  }
  if (motif === "lotus") {
    return (
      <g fill="currentColor">
        <path
          d="M32 61.2C31.2 54 32.4 48.4 32.2 43.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
        <path d="M14.5 44.8C8.4 42.2 6.2 34.6 12.4 28.2 18.6 33.8 24.8 39.6 32 43.4 24.6 45.8 18.4 46.4 14.5 44.8Z" opacity="0.55" />
        <path d="M49.6 44.6C55.8 41.6 57.6 34 51.4 28 45.4 33.8 39.2 39.4 32 43.4 39.4 45.8 45.6 46.4 49.6 44.6Z" opacity="0.55" />
        <path d="M32 43.2C20.4 41.4 13.6 30.2 18.8 18.4 24.6 25.6 28.8 34.2 32 43.2Z" />
        <path d="M32 43.2C43.6 41.4 50.4 30.2 45.2 18.4 39.4 25.6 35.2 34.2 32 43.2Z" />
        <path d="M32 43.2C24.8 39.4 21.2 27.6 27.6 15.2 30.4 24.2 31.4 33.6 32 43.2Z" opacity="0.9" />
        <path d="M32 43.2C39.2 39.4 42.8 27.6 36.4 15.2 33.6 24.2 32.6 33.6 32 43.2Z" opacity="0.9" />
        <path d="M27.2 42C25.4 24.6 28.8 9.4 32 5.2 35.2 9.4 38.6 24.6 36.8 42 35.4 46.2 28.6 46.2 27.2 42Z" />
        <path d="M29.2 41.4C28.6 31.2 30.2 20.4 32 16.2 33.8 20.4 35.4 31.2 34.8 41.4 34.2 44.6 29.8 44.6 29.2 41.4Z" opacity="0.38" />
        <path d="M26.8 43.6C28.4 37.2 35.6 37.2 37.2 43.6 35.6 47 28.4 47 26.8 43.6Z" />
      </g>
    );
  }
  return (
    <g fill="currentColor">
      <path
        d="M18.5 58.5C24.8 46.4 31.4 34.6 36.8 18.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M22.6 50.2C13.4 48.6 7.6 41.2 8.8 32.4 16.8 34.8 21.4 41.6 22.6 50.2Z" />
      <path d="M27.4 41.4C19.2 37.4 16.4 28.2 21.2 21.6 26.6 27.4 29.4 34.6 27.4 41.4Z" />
      <path d="M32.2 32.6C25.2 27.6 24.2 18.4 29.8 12.8 34.4 18.8 36.2 25.8 32.2 32.6Z" />
      <path d="M36.2 24.4C30.6 19.2 30.8 10.6 36.4 6.4 40.2 12.2 41 18.4 36.2 24.4Z" />
      <path d="M31.8 37.8C38.6 35.4 44.8 27.8 44.2 19.6 38.2 22.6 34.2 29.4 31.8 37.8Z" opacity="0.9" />
      <path d="M35.4 27.2C41.6 24.2 46.2 16.8 44.8 9.6 39.4 13 36.6 19.6 35.4 27.2Z" opacity="0.9" />
      <path d="M38.2 16.8C42.6 13.4 44.8 7.2 42.2 3.4 39.2 7.6 38.2 12.2 38.2 16.8Z" />
    </g>
  );
}

function CornerFlourish({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <path
        d="M8 112 C12 70 40 28 112 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M18 112 C22 78 48 40 112 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.7"
      />
      <circle cx="112" cy="18" r="2.2" fill="currentColor" />
    </svg>
  );
}

function FlowerMotif({ kind }: { kind: string }) {
  if (kind === "none") return null;
  return (
    <svg className="ip-flower" viewBox="0 0 64 64" aria-hidden>
      <FlowerShape kind={kind} />
    </svg>
  );
}

export default function InvitationRenderer({
  content,
  design,
  opened = true,
  compact = false,
}: Props) {
  const lang = content.language || "uz-latn";
  const eventSlug = content.eventSlug || "";
  const copy = SITE_COPY[lang] || SITE_COPY["uz-latn"];
  const layout = siteLayoutFromFont(design.font);
  const heading =
    inviteHeading({
      title: content.title,
      personName: content.personName,
      childName: content.childName,
      familySignature: content.familySignature,
      eventSlug,
      lang,
    }) || eventLabel(eventSlug, lang);
  const names = (content.personName || content.childName || "").trim();
  const customTitle = (content.title || "").trim();
  const body = ensureEventNameInBody(
    content.mainText,
    {
      child_name: content.childName,
      person_name: content.personName,
    },
    eventSlug,
    lang,
  );
  const schedule = content.schedule || {};
  const program = buildProgram(schedule, eventSlug, lang, content.date, content.time);
  const venueName = (content.venueName || "").trim();
  const address = (content.address || "").trim();
  const placeQuery = [venueName, address].filter(Boolean).join(", ");
  const host = formatFamilyFooter(content.familySignature, lang);
  const kicker = copy.kicker;

  const style = {
    "--ip-open": opened ? 1 : 0,
  } as CSSProperties;

  return (
    <article
      className={`ip-stage${compact ? " is-compact" : ""}${opened ? " is-open" : ""}`}
      data-color={design.primaryColor}
      data-pattern={design.pattern}
      data-flower={design.flower}
      data-texture={design.texture}
      data-frame={design.frame}
      data-font={design.font}
      data-layout={layout}
      data-animation={design.animation}
      data-density={design.decorationDensity}
      style={style}
    >
      <div className="ip-paper">
        <div className="ip-back" aria-hidden>
          <div className="ip-texture" />
          <div className="ip-pattern" />
          <div className="ip-particles">
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
          <div className="ip-floaters">
            {Array.from({ length: 2 }, (_, i) => (
              <span key={i} className="ip-floater">
                <FlowerMotif kind={design.flower} />
              </span>
            ))}
          </div>
          <div className="ip-glow" />
          <CornerFlourish className="ip-corner tl" />
          <CornerFlourish className="ip-corner tr" />
          <CornerFlourish className="ip-corner bl" />
          <CornerFlourish className="ip-corner br" />
          {design.flower && design.flower !== "none" ? (
            <>
              <span className="ip-corner-bloom tl">
                <FlowerMotif kind={design.flower} />
              </span>
              <span className="ip-corner-bloom tr">
                <FlowerMotif kind={design.flower} />
              </span>
              <span className="ip-corner-bloom bl">
                <FlowerMotif kind={design.flower} />
              </span>
              <span className="ip-corner-bloom br">
                <FlowerMotif kind={design.flower} />
              </span>
            </>
          ) : null}
          <div className="ip-frame" />
        </div>
        <div className="ip-content">
          <header className="ip-hero">
            <HeroArc />
            {customTitle ? null : <p className="ip-kicker">{kicker}</p>}
            <h1 className="ip-title">{heading || kicker}</h1>
            {names && names !== heading ? <p className="ip-names">{names}</p> : null}
            <Ornament />
          </header>
          <section className="ip-letter">
            <p className="ip-body">{body || copy.bodyPlaceholder}</p>
          </section>
          {program.length || placeQuery ? (
            <div className="ip-details">
              {program.length ? (
                <section className="ip-when-block">
                  <p className="ip-label">{copy.when}</p>
                  <div className={`ip-program${program.length > 1 ? " is-many" : ""}`}>
                    {program.map((item) => (
                      <article className="ip-slot" key={`${item.label}-${item.date}-${item.time}`}>
                        {item.label ? <h3 className="ip-slot-name">{item.label}</h3> : null}
                        {item.date ? <p className="ip-slot-date">{item.date}</p> : null}
                        {item.time ? (
                          <p className="ip-slot-time">{timeCaption(item.time, lang)}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              {placeQuery ? (
                <section className="ip-venue">
                  <p className="ip-label">{copy.venue}</p>
                  {venueName ? <h2 className="ip-venue-name">{venueName}</h2> : null}
                  {address ? <p className="ip-address">{address}</p> : null}
                </section>
              ) : null}
            </div>
          ) : null}
          {host ? (
            <footer className="ip-host">
              <p className="ip-label">{copy.host}</p>
              <p className="ip-host-name">{host}</p>
            </footer>
          ) : null}
        </div>
      </div>
    </article>
  );
}
