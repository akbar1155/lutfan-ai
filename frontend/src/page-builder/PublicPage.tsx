import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { SEO } from "../components/SEO";
import { pageBuilderApi } from "./api";
import { SITE_COPY, presetMusicUrl, siteLayoutFromFont } from "./config";
import { inviteHeading } from "./eventFields";
import InvitationRenderer from "./InvitationRenderer";
import "./page-builder.css";
import { DEFAULT_DESIGN, type InvitationPagePayload } from "./types";

export default function PublicInteractivePage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const [page, setPage] = useState<InvitationPagePayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    pageBuilderApi
      .publicBySlug(slug)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const src = useMemo(() => {
    if (!page) return "";
    if (page.musicConfig.source === "upload" && page.musicConfig.url) return page.musicConfig.url;
    return presetMusicUrl(page.musicConfig.presetId || "elegant");
  }, [page]);

  const toggleMusic = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const openInvite = async () => {
    setOpened(true);
    if (!audioRef.current && src) {
      audioRef.current = new Audio(src);
      audioRef.current.loop = true;
    }
    try {
      await audioRef.current?.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  if (missing || !slug) {
    return (
      <div className="ip-missing">
        <div>
          <h1>{t("publicInviteMissing")}</h1>
        </div>
      </div>
    );
  }

  if (!page) {
    return <div className="ip-missing">{t("loading")}</div>;
  }

  const design = page.designConfig || DEFAULT_DESIGN;
  const layout = siteLayoutFromFont(design.font);
  const lang = page.displayLang || "uz-latn";
  const copy = SITE_COPY[lang] || SITE_COPY["uz-latn"];
  const coverTitle =
    inviteHeading({
      title: page.title,
      personName: page.personName,
      childName: page.childName,
      familySignature: page.familySignature,
      eventSlug: page.eventSlug,
      lang,
    }) ||
    page.title ||
    copy.kicker;

  const seoTitle = `${coverTitle} — Lutfan AI`;
  const seoDescription = page.mainText || `${coverTitle}. ${copy.kicker}`;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        path={`/p/${slug}`}
        type="article"
      />
      <div
      className={`ip-public${opened ? " is-opened" : ""}`}
      data-font={design.font}
      data-color={design.primaryColor}
      data-layout={layout}
    >
      <div className="ip-open-layer" aria-hidden={opened}>
        <div className="ip-open-frame" aria-hidden />
        <div className="ip-open-cover">
          <p className="ip-open-kicker">{copy.kicker}</p>
          <span className="ip-ornament" aria-hidden>
            <i />
          </span>
          <h1>{coverTitle}</h1>
          <button type="button" className="ip-open-btn" onClick={() => void openInvite()}>
            {copy.open}
          </button>
        </div>
      </div>
      <InvitationRenderer
        key={`${page.designConfig?.animation || "gentle"}-${opened ? "open" : "shut"}`}
        content={{
          title: page.title,
          mainText: page.mainText,
          date: page.date,
          time: page.time,
          venueName: page.venueName,
          address: page.address,
          mapLat: page.mapLat,
          mapLng: page.mapLng,
          familySignature: page.familySignature,
          eventSlug: page.eventSlug,
          childName: page.childName,
          personName: page.personName,
          schedule: page.ceremonySchedule,
          subtypeSlugs: page.subtypeSlugs,
          language: page.displayLang || "uz-latn",
        }}
        design={design}
        opened={opened}
      />
      {opened ? (
        <button
          type="button"
          className={`ip-music-ctl${playing ? " is-on" : ""}`}
          onClick={() => void toggleMusic()}
          aria-label={playing ? copy.pause : copy.play}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5L8 5.5z" />
            </svg>
          )}
        </button>
      ) : null}
      </div>
    </>
  );
}
