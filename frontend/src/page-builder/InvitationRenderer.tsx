import type { CSSProperties, ReactNode } from "react";
import { formatDisplayDate, formatDisplayTime } from "../utils/date";
import type { DesignConfig } from "./types";

type Content = {
  title: string;
  mainText: string;
  date: string;
  time: string;
  address: string;
};

type Props = {
  content: Content;
  design: DesignConfig;
  opened?: boolean;
  compact?: boolean;
};

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
      <path
        d="M40 36c8-14 22-18 34-10-10 4-16 14-20 24-8-4-14-8-14-14z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

function FlowerMotif({ kind }: { kind: string }) {
  if (kind === "none") return null;
  const paths: Record<string, ReactNode> = {
    rose: (
      <>
        <circle cx="24" cy="24" r="4" />
        <path d="M24 10c6 6 6 12 0 18-6-6-6-12 0-18zm14 14c-6 6-12 6-18 0 6-6 12-6 18 0zM10 24c6-6 12-6 18 0-6 6-12 6-18 0zm14 14c-6-6-6-12 0-18 6 6 6 12 0 18z" />
      </>
    ),
    tulip: <path d="M24 40V18c0-8 6-14 0-16-6 2 0 8 0 16-8-2-14 8-10 16 6 2 10-2 10-2s4 4 10 2c4-8-2-18-10-16z" />,
    peony: (
      <>
        <circle cx="24" cy="24" r="6" />
        <path d="M24 6c8 8 8 16 0 24C16 22 16 14 24 6zm18 18c-8 8-16 8-24 0 8-8 16-8 24 0z" />
      </>
    ),
    jasmine: (
      <>
        <circle cx="24" cy="24" r="3" />
        <path d="M24 8l3 10 10-3-7 8 7 8-10-3-3 10-3-10-10 3 7-8-7-8 10 3z" />
      </>
    ),
    dried: <path d="M24 42V8m0 0c6 8 10 14 4 22M24 8c-6 8-10 14-4 22M16 20h16" fill="none" stroke="currentColor" strokeWidth="1.4" />,
    botanical: <path d="M10 38c10-4 16-14 14-28 8 10 16 16 14 28-10-6-18-6-28 0zm14-28v32" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  };
  return (
    <svg className="ip-flower" viewBox="0 0 48 48" aria-hidden>
      {paths[kind] || paths.rose}
    </svg>
  );
}

export default function InvitationRenderer({
  content,
  design,
  opened = true,
  compact = false,
}: Props) {
  const dateLabel = content.date
    ? formatDisplayDate(content.date, "uz-latn")
    : "";
  const timeLabel = content.time ? formatDisplayTime(content.time) : "";
  const when = [dateLabel, timeLabel ? `soat ${timeLabel}` : ""]
    .filter(Boolean)
    .join(" · ");

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
      data-animation={design.animation}
      data-density={design.decorationDensity}
      style={style}
    >
      <div className="ip-paper">
        <div className="ip-texture" />
        <div className="ip-pattern" />
        <div className="ip-particles" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        <div className="ip-floaters" aria-hidden>
          <FlowerMotif kind={design.flower} />
          <FlowerMotif kind={design.flower} />
          <FlowerMotif kind={design.flower} />
        </div>
        <CornerFlourish className="ip-corner tl" />
        <CornerFlourish className="ip-corner tr" />
        <CornerFlourish className="ip-corner bl" />
        <CornerFlourish className="ip-corner br" />
        <div className="ip-frame" />
        <div className="ip-content">
          <p className="ip-kicker">Taklifnoma</p>
          <h1 className="ip-title">{content.title || "Sarlavha"}</h1>
          <div className="ip-rule" />
          <p className="ip-body">{content.mainText || "Asosiy matn shu yerda ko‘rinadi."}</p>
          {when ? <p className="ip-when">{when}</p> : null}
          {content.address ? <p className="ip-place">{content.address}</p> : null}
        </div>
      </div>
    </article>
  );
}
