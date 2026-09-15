import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import PhoneAuthForm from "../auth/PhoneAuthForm";
import { useAuth } from "../auth/AuthContext";
import { copyTextToClipboard } from "../utils/share";
import { pageBuilderApi, type PageWrite } from "./api";
import {
  ANIMATIONS,
  COLORS,
  DENSITIES,
  FLOWERS,
  FONTS,
  FRAMES,
  MUSIC_PRESETS,
  PATTERNS,
  SITE_COPY,
  TEXTURES,
  presetMusicUrl,
} from "./config";
import InvitationRenderer from "./InvitationRenderer";
import "./page-builder.css";
import {
  IconCheck,
  IconComputer,
  IconCopy,
  IconDensity,
  IconDice,
  IconFlower,
  IconFrame,
  IconInfo,
  IconMotion,
  IconMusic,
  IconPalette,
  IconPaper,
  IconPattern,
  IconPause,
  IconPhone,
  IconPlay,
  IconPrev,
  IconNext,
  IconSend,
  IconSparkle,
  IconTelegram,
  IconTrash,
  IconType,
  IconUpload,
} from "./icons";
import EventDetailsForm from "./EventDetailsForm";
import { inviteHeading, pageBuilderBody, pageBuilderHeader } from "./eventFields";
import { DEFAULT_DESIGN, DEFAULT_MUSIC, type CatalogItem, type DesignConfig, type InvitationPagePayload, type MusicConfig } from "./types";
import { normalizeUiLang } from "../i18n/lang";

const FONT_PREVIEW: Record<string, string> = {
  elegant: '"Cormorant Garamond", serif',
  classic: '"Source Serif 4", serif',
  modern: "Outfit, sans-serif",
  oriental: "Cinzel, serif",
  luxury: '"Playfair Display", serif',
  minimal: "Inter, sans-serif",
};

function isDarkHex(hex?: string) {
  if (!hex) return false;
  const n = hex.replace("#", "");
  if (n.length < 6) return false;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}

function localizeCatalog(
  items: CatalogItem[],
  t: (key: string, opts?: { defaultValue?: string }) => string,
  prefix: string,
  withDesc = true,
): CatalogItem[] {
  return items.map((item) => {
    const key = item.id.replace(/-/g, "_");
    return {
      ...item,
      name: t(`${prefix}_${key}`, { defaultValue: item.name }),
      description:
        withDesc && item.description
          ? t(`${prefix}Desc_${key}`, { defaultValue: item.description })
          : item.description,
    };
  });
}

function ChoiceGrid({
  items,
  value,
  onChange,
  variant = "default",
}: {
  items: CatalogItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: "default" | "color" | "font";
}) {
  return (
    <div className={`pb-choices${variant === "color" ? " is-colors" : ""}`}>
      {items.map((item) => {
        const on = value === item.id;
        const dark = variant === "color" && isDarkHex(item.swatch);
        return (
          <button
            key={item.id}
            type="button"
            className={`pb-choice pb-choice-${variant}${on ? " is-on" : ""}`}
            onClick={() => onChange(item.id)}
            aria-pressed={on}
            style={
              variant === "color" && item.swatch
                ? {
                    background: item.swatch,
                    color: dark ? "#f6efe4" : "#2c261e",
                    borderColor: on ? item.accent : "transparent",
                    boxShadow: on ? `0 0 0 2px ${item.accent}` : undefined,
                  }
                : variant === "font"
                  ? { fontFamily: FONT_PREVIEW[item.id] }
                  : undefined
            }
          >
            {on ? (
              <span className="pb-choice-check" aria-hidden>
                <IconCheck />
              </span>
            ) : null}
            <b>{item.name}</b>
            {variant !== "color" && item.description ? <small>{item.description}</small> : null}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pb-section">
      <h2>
        <span className="pb-section-icon">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function toWrite(page: InvitationPagePayload, lang?: string): PageWrite {
  return {
    title: page.title,
    mainText: page.mainText,
    date: page.date || null,
    time: page.time || null,
    familySignature: page.familySignature || "",
    personName: page.personName || "",
    childName: page.childName || "",
    childGender: page.childGender || "",
    venueName: page.venueName || "",
    address: page.address,
    eventSlug: page.eventSlug || "nikoh",
    subtypeSlugs: page.subtypeSlugs || [],
    ceremonySchedule: page.ceremonySchedule || {},
    displayLang: page.displayLang || lang || "uz-latn",
    readyTextId: page.readyTextId || "classic1",
    designConfig: page.designConfig,
    musicConfig: page.musicConfig,
    designPrompt: page.designPrompt || "",
  };
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type PlayTrack = { id: string; name: string; src: string };

export default function PageBuilderPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const lang = normalizeUiLang(i18n.language);
  const [page, setPage] = useState<InvitationPagePayload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [previewingMusic, setPreviewingMusic] = useState("");
  const [playerTime, setPlayerTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPreviewIdRef = useRef("");
  const playlistRef = useRef<PlayTrack[]>([]);
  const applyTrackRef = useRef<(track: PlayTrack) => void>(() => undefined);
  const saveTimer = useRef<number | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  const patch = useCallback((partial: Partial<InvitationPagePayload>) => {
    setPage((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const patchDesign = useCallback((key: keyof DesignConfig, value: string) => {
    setPage((prev) =>
      prev
        ? { ...prev, designConfig: { ...prev.designConfig, [key]: value } }
        : prev,
    );
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        if (routeId) {
          const existing = await pageBuilderApi.get(routeId);
          if (!cancelled) setPage(existing);
          return;
        }
        const created = await pageBuilderApi.create({
          eventSlug: "nikoh",
          subtypeSlugs: ["nikoh_oqshomi"],
          readyTextId: "classic1",
          title: pageBuilderHeader({
            eventSlug: "nikoh",
            language: langRef.current,
            subtypeSlugs: ["nikoh_oqshomi"],
            styleId: "classic1",
          }),
          mainText: pageBuilderBody({
            eventSlug: "nikoh",
            language: langRef.current,
            subtypeSlugs: ["nikoh_oqshomi"],
            styleId: "classic1",
          }),
          displayLang: langRef.current,
          designConfig: DEFAULT_DESIGN,
          musicConfig: DEFAULT_MUSIC,
        });
        if (!cancelled) {
          setPage(created);
          navigate(`/page-builder/${created.id}`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("pbLoadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, routeId, navigate]);

  useEffect(() => {
    if (!page) return;
    if (page.displayLang === lang) return;
    patch({ displayLang: lang });
  }, [lang, page, patch]);

  useEffect(() => {
    if (!page?.id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void pageBuilderApi.save(page.id, toWrite(page, lang)).catch(() => {
        /* draft autosave is best-effort */
      });
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [page, lang]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const bindAudio = (audio: HTMLAudioElement, id: string) => {
    audio.ontimeupdate = () => setPlayerTime(audio.currentTime);
    audio.onloadedmetadata = () => setPlayerDuration(audio.duration || 0);
    audio.onended = () => {
      const list = playlistRef.current;
      const idx = list.findIndex((item) => item.id === id);
      const next = list[(idx + 1 + list.length) % list.length];
      if (next) applyTrackRef.current(next);
    };
  };

  const playPreview = (src: string, id: string) => {
    const current = audioRef.current;
    if (lastPreviewIdRef.current === id && current) {
      if (!current.paused) {
        current.pause();
        setPreviewingMusic("");
        return;
      }
      setPreviewingMusic(id);
      void current.play().catch(() => {
        setPreviewingMusic("");
        setError(t("pbPlayFailed"));
      });
      return;
    }
    current?.pause();
    const audio = new Audio(src);
    audioRef.current = audio;
    lastPreviewIdRef.current = id;
    setPlayerTime(0);
    setPlayerDuration(0);
    bindAudio(audio, id);
    setPreviewingMusic(id);
    void audio.play().catch(() => {
      setPreviewingMusic("");
      setError(t("pbPlayFailed"));
    });
  };

  const publish = async () => {
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      const next = await pageBuilderApi.publish(page.id, toWrite(page, lang));
      setPage(next);
      setNotice(`${t("pbLinkReady")}: ${window.location.origin}/p/${next.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pbPublishFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runAi = async (mode: "prompt" | "style" | "surprise") => {
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      const res =
        mode === "surprise"
          ? await pageBuilderApi.surprise({ id: page.id, current: page.designConfig })
          : await pageBuilderApi.aiStyle({
              id: page.id,
              prompt: mode === "prompt" ? page.designPrompt : "",
              current: page.designConfig,
            });
      if (res.designConfig) {
        patch({
          designConfig: res.designConfig,
          designPrompt: res.designPrompt ?? page.designPrompt,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pbAiFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File | undefined) => {
    if (!page || !file) return;
    setBusy(true);
    setError("");
    try {
      const next = await pageBuilderApi.uploadMusic(page.id, file);
      setPage(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pbUploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="pb-root pb-gate">{t("loading")}</div>;
  }
  if (!user) {
    return (
      <div className="pb-root pb-gate">
        <div className="pb-gate-card">
          <h1>{t("pbGateTitle")}</h1>
          <p>{t("pbGateLogin")}</p>
          <PhoneAuthForm />
        </div>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="pb-root pb-gate">
        <div className="pb-gate-card">
          <h1>{t("pbGateTitle")}</h1>
          <p>{error || t("pbPreparing")}</p>
        </div>
      </div>
    );
  }

  const publicLink = `${window.location.origin}/p/${page.slug}`;
  const design: DesignConfig = page.designConfig || DEFAULT_DESIGN;
  const music: MusicConfig = page.musicConfig || DEFAULT_MUSIC;
  const colors = localizeCatalog(COLORS, t, "pbColor");
  const patterns = localizeCatalog(PATTERNS, t, "pbPattern");
  const flowers = localizeCatalog(FLOWERS, t, "pbFlower", false);
  const textures = localizeCatalog(TEXTURES, t, "pbTexture", false);
  const frames = localizeCatalog(FRAMES, t, "pbFrame", false);
  const fonts = localizeCatalog(FONTS, t, "pbFont", false);
  const animations = localizeCatalog(ANIMATIONS, t, "pbAnim", false);
  const densities = localizeCatalog(DENSITIES, t, "pbDensity");
  const musicPresets = localizeCatalog(MUSIC_PRESETS, t, "pbMusic");
  const playlist: PlayTrack[] = [
    ...musicPresets.map((item) => ({
      id: item.id,
      name: item.name,
      src: presetMusicUrl(item.id),
    })),
    ...(music.source === "upload" && music.url
      ? [{ id: "upload", name: t("pbMyMusic"), src: music.url }]
      : []),
  ];
  playlistRef.current = playlist;
  const currentTrack =
    playlist.find((item) => item.id === lastPreviewIdRef.current) ||
    playlist.find((item) =>
      music.source === "upload" ? item.id === "upload" : item.id === music.presetId,
    ) ||
    playlist[0];

  const applyTrack = (track: PlayTrack) => {
    if (track.id === "upload") {
      patch({
        musicConfig: {
          source: "upload",
          presetId: music.presetId || "elegant",
          url: music.url,
        },
      });
    } else {
      patch({
        musicConfig: { source: "preset", presetId: track.id, url: "" },
      });
    }
    playPreview(track.src, track.id);
  };
  applyTrackRef.current = applyTrack;

  const skipTrack = (delta: number) => {
    if (!playlist.length) return;
    const idx = Math.max(
      0,
      playlist.findIndex((item) => item.id === (lastPreviewIdRef.current || currentTrack?.id)),
    );
    const next = playlist[(idx + delta + playlist.length) % playlist.length];
    if (next) applyTrack(next);
  };

  const seekTrack = (value: number) => {
    let audio = audioRef.current;
    if ((!audio || lastPreviewIdRef.current !== currentTrack?.id) && currentTrack) {
      audio?.pause();
      audio = new Audio(currentTrack.src);
      audioRef.current = audio;
      lastPreviewIdRef.current = currentTrack.id;
      bindAudio(audio, currentTrack.id);
    }
    if (!audio || !Number.isFinite(value)) return;
    audio.currentTime = value;
    setPlayerTime(value);
  };

  const preview = (
    <InvitationRenderer
      key={design.animation}
      content={{
        title: inviteHeading({
          title: page.title,
          eventSlug: page.eventSlug,
          childName: page.childName,
          personName: page.personName,
          familySignature: page.familySignature,
          lang,
        }),
        mainText: page.mainText,
        date: page.date,
        time: page.time,
        venueName: page.venueName,
        address: page.address,
        familySignature: page.familySignature,
        eventSlug: page.eventSlug,
        childName: page.childName,
        personName: page.personName,
        schedule: page.ceremonySchedule,
        subtypeSlugs: page.subtypeSlugs,
        language: lang,
      }}
      design={design}
      opened
    />
  );

  return (
    <div className={`pb-root${full ? " is-desktop" : " is-phone"}`}>
      <div className="pb-shell">
        <aside className="pb-side">
          <header className="pb-brand">
            <div className="pb-brand-top">
              <strong>{t("pbTitle")}</strong>
              <span className={`pb-status is-${page.status}`}>
                {page.status === "published"
                  ? t("pbStatusPublished")
                  : page.status === "unpublished"
                    ? t("pbStatusHidden")
                    : t("status_draft")}
              </span>
            </div>
            <p>{t("pbSubtitle")}</p>
          </header>

          <div className="pb-side-scroll">
            <Section title={t("data")} icon={<IconInfo />}>
              <EventDetailsForm page={page} patch={patch} />
            </Section>

            <Section title={t("pbPrimaryColor")} icon={<IconPalette />}>
              <ChoiceGrid
                items={colors}
                value={design.primaryColor}
                onChange={(id) => patchDesign("primaryColor", id)}
                variant="color"
              />
            </Section>
            <Section title={t("pbPattern")} icon={<IconPattern />}>
              <ChoiceGrid items={patterns} value={design.pattern} onChange={(id) => patchDesign("pattern", id)} />
            </Section>
            <Section title={t("mood_flowers")} icon={<IconFlower />}>
              <ChoiceGrid items={flowers} value={design.flower === "dried" ? "lotus" : design.flower} onChange={(id) => patchDesign("flower", id)} />
            </Section>
            <Section title={t("pbTexture")} icon={<IconPaper />}>
              <ChoiceGrid items={textures} value={design.texture} onChange={(id) => patchDesign("texture", id)} />
            </Section>
            <Section title={t("pbFrame")} icon={<IconFrame />}>
              <ChoiceGrid items={frames} value={design.frame} onChange={(id) => patchDesign("frame", id)} />
            </Section>
            <Section title={t("pbFont")} icon={<IconType />}>
              <ChoiceGrid
                items={fonts}
                value={design.font}
                onChange={(id) => patchDesign("font", id)}
                variant="font"
              />
            </Section>
            <Section title={t("pbAnimation")} icon={<IconMotion />}>
              <ChoiceGrid items={animations} value={design.animation} onChange={(id) => patchDesign("animation", id)} />
            </Section>
            <Section title={t("pbDensity")} icon={<IconDensity />}>
              <ChoiceGrid
                items={densities}
                value={design.decorationDensity}
                onChange={(id) => patchDesign("decorationDensity", id)}
              />
            </Section>

            <Section title={t("pbAiStyle")} icon={<IconSparkle />}>
              <label className="pb-field">
                <span>{t("pbAiPrompt")}</span>
                <textarea
                  value={page.designPrompt || ""}
                  maxLength={500}
                  placeholder={t("pbAiPromptPh")}
                  onChange={(e) => patch({ designPrompt: e.target.value })}
                />
              </label>
              <div className="pb-actions">
                <button type="button" className="pb-btn" disabled={busy} onClick={() => void runAi("prompt")}>
                  <IconSend /> {t("pbApplyPrompt")}
                </button>
                <button type="button" className="pb-btn" disabled={busy} onClick={() => void runAi("style")}>
                  <IconSparkle /> {t("pbAiStyleBtn")}
                </button>
                <button type="button" className="pb-btn" disabled={busy} onClick={() => void runAi("surprise")}>
                  <IconDice /> {t("pbSurprise")}
                </button>
              </div>
            </Section>

            <Section title={t("pbMusic")} icon={<IconMusic />}>
              {musicPresets.map((item) => {
                const selected = music.source === "preset" && music.presetId === item.id;
                const playing = previewingMusic === item.id;
                return (
                  <div key={item.id} className={`pb-music-row${selected ? " is-on" : ""}`}>
                    <button
                      type="button"
                      className="pb-icon-btn"
                      aria-label={playing ? t("pbPause") : t("pbListen")}
                      onClick={() => applyTrack({ id: item.id, name: item.name, src: presetMusicUrl(item.id) })}
                    >
                      {playing ? <IconPause /> : <IconPlay />}
                    </button>
                    <button
                      type="button"
                      className="pb-music-pick"
                      onClick={() =>
                        patch({
                          musicConfig: { source: "preset", presetId: item.id, url: "" },
                        })
                      }
                    >
                      <b>{item.name}</b>
                      {item.description ? <small>{item.description}</small> : null}
                    </button>
                  </div>
                );
              })}
              <label className="pb-upload">
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac,.mp3,.m4a,.wav"
                  onChange={(e) => void onUpload(e.target.files?.[0])}
                />
                <span className="pb-btn">
                  <IconUpload /> {t("pbUploadMusic")}
                </span>
                <small>{t("pbUploadHint")}</small>
              </label>
              {music.source === "upload" && music.url ? (
                <div className="pb-actions">
                  <button
                    type="button"
                    className="pb-btn"
                    onClick={() => applyTrack({ id: "upload", name: t("pbMyMusic"), src: music.url })}
                  >
                    {previewingMusic === "upload" ? <IconPause /> : <IconMusic />} {t("pbMyMusic")}
                  </button>
                  <button
                    type="button"
                    className="pb-btn"
                    onClick={() =>
                      patch({
                        musicConfig: { source: "preset", presetId: music.presetId || "elegant", url: "" },
                      })
                    }
                  >
                    <IconTrash /> {t("pbRemove")}
                  </button>
                </div>
              ) : null}
              {currentTrack ? (
                <div className="pb-player">
                  <div className="pb-player-top">
                    <button
                      type="button"
                      className="pb-icon-btn"
                      aria-label={t("pbPrevTrack")}
                      onClick={() => skipTrack(-1)}
                    >
                      <IconPrev />
                    </button>
                    <button
                      type="button"
                      className="pb-icon-btn is-play"
                      aria-label={previewingMusic === currentTrack.id ? t("pbPause") : t("pbPlay")}
                      onClick={() => applyTrack(currentTrack)}
                    >
                      {previewingMusic === currentTrack.id ? <IconPause /> : <IconPlay />}
                    </button>
                    <button
                      type="button"
                      className="pb-icon-btn"
                      aria-label={t("pbNextTrack")}
                      onClick={() => skipTrack(1)}
                    >
                      <IconNext />
                    </button>
                    <div className="pb-player-meta">
                      <b>{currentTrack.name}</b>
                      <small>{t("pbPlayerHint")}</small>
                    </div>
                  </div>
                  <div className="pb-player-seek">
                    <span>{formatClock(playerTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={playerDuration || 0}
                      step={0.1}
                      value={Math.min(playerTime, playerDuration || 0)}
                      disabled={!playerDuration}
                      aria-label={t("pbSeek")}
                      onChange={(e) => seekTrack(Number(e.target.value))}
                    />
                    <span>{formatClock(playerDuration)}</span>
                  </div>
                </div>
              ) : null}
            </Section>

            {error ? <p className="pb-error">{error}</p> : null}
            {notice ? <p className="pb-ok">{notice}</p> : null}
          </div>

          <footer className="pb-dock">
            <button type="button" className="pb-btn primary" disabled={busy} onClick={() => void publish()}>
              <IconSend /> {t("pbPublish")}
            </button>
            {page.status === "published" ? (
              <div className="pb-share">
                <input readOnly value={publicLink} />
                <div className="pb-actions">
                  <button
                    type="button"
                    className="pb-btn"
                    onClick={() =>
                      void copyTextToClipboard(publicLink).then(() => setNotice(t("pbLinkCopied")))
                    }
                  >
                    <IconCopy /> {t("pbCopy")}
                  </button>
                  <a
                    className="pb-btn"
                    href={`https://t.me/share/url?url=${encodeURIComponent(publicLink)}&text=${encodeURIComponent(page.title || SITE_COPY[lang]?.kicker || t("pbTitle"))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconTelegram /> Telegram
                  </a>
                </div>
              </div>
            ) : null}
          </footer>
        </aside>

        <main className="pb-stage">
          <div className="pb-toolbar" role="tablist" aria-label={t("pbView")}>
            <button
              type="button"
              className={`pb-btn${!full ? " is-on" : ""}`}
              aria-pressed={!full}
              onClick={() => setFull(false)}
            >
              <IconPhone /> {t("pbPhone")}
            </button>
            <button
              type="button"
              className={`pb-btn${full ? " is-on" : ""}`}
              aria-pressed={full}
              onClick={() => setFull(true)}
            >
              <IconComputer /> {t("pbDesktop")}
            </button>
          </div>
          <div className={`pb-device ${full ? "is-desktop" : "is-phone"}`}>
            {full ? <span className="pb-device-cam" aria-hidden /> : null}
            {!full ? (
              <>
                <span className="pb-phone-btn silent" aria-hidden />
                <span className="pb-phone-btn vol-up" aria-hidden />
                <span className="pb-phone-btn vol-down" aria-hidden />
                <span className="pb-phone-btn power" aria-hidden />
              </>
            ) : null}
            <div className="pb-device-screen">{preview}</div>
            {full ? <span className="pb-device-base" aria-hidden /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
