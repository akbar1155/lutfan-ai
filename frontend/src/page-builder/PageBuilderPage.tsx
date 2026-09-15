import { useCallback, useEffect, useRef, useState } from "react";
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
  TEXTURES,
  presetMusicUrl,
} from "./config";
import InvitationRenderer from "./InvitationRenderer";
import "./page-builder.css";
import { DEFAULT_DESIGN, DEFAULT_MUSIC, type CatalogItem, type DesignConfig, type InvitationPagePayload, type MusicConfig } from "./types";

function ChoiceGrid({
  items,
  value,
  onChange,
  swatch,
}: {
  items: CatalogItem[];
  value: string;
  onChange: (id: string) => void;
  swatch?: boolean;
}) {
  return (
    <div className="pb-choices">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`pb-choice${value === item.id ? " is-on" : ""}`}
          onClick={() => onChange(item.id)}
          aria-pressed={value === item.id}
        >
          {swatch ? (
            <span
              className="pb-swatch"
              style={{
                background: `linear-gradient(135deg, ${item.swatch}, ${item.accent})`,
              }}
            />
          ) : null}
          <b>{item.name}</b>
          {item.description ? <small>{item.description}</small> : null}
        </button>
      ))}
    </div>
  );
}

function toWrite(page: InvitationPagePayload): PageWrite {
  return {
    title: page.title,
    mainText: page.mainText,
    date: page.date || null,
    time: page.time || null,
    address: page.address,
    designConfig: page.designConfig,
    musicConfig: page.musicConfig,
    designPrompt: page.designPrompt || "",
  };
}

export default function PageBuilderPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [page, setPage] = useState<InvitationPagePayload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [previewingMusic, setPreviewingMusic] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveTimer = useRef<number | null>(null);

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
          designConfig: DEFAULT_DESIGN,
          musicConfig: DEFAULT_MUSIC,
        });
        if (!cancelled) {
          setPage(created);
          navigate(`/page-builder/${created.id}`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Yuklab bo‘lmadi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, routeId, navigate]);

  useEffect(() => {
    if (!page?.id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void pageBuilderApi.save(page.id, toWrite(page)).catch(() => {
        /* draft autosave is best-effort */
      });
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [page]);

  const playPreview = (src: string, id: string) => {
    audioRef.current?.pause();
    const audio = new Audio(src);
    audioRef.current = audio;
    setPreviewingMusic(id);
    void audio.play().catch(() => setError("Musiqani ijro etib bo‘lmadi"));
    audio.onended = () => setPreviewingMusic("");
  };

  const publish = async () => {
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      const next = await pageBuilderApi.publish(page.id, toWrite(page));
      setPage(next);
      setNotice(`Havola tayyor: ${window.location.origin}/p/${next.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nashr qilinmadi");
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
      setError(err instanceof Error ? err.message : "AI uslubi olinmadi");
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
      setError(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="pb-root pb-gate">Yuklanmoqda…</div>;
  }
  if (!user) {
    return (
      <div className="pb-root pb-gate">
        <div className="pb-gate-card">
          <h1>Sahifa builder</h1>
          <p>Davom etish uchun kiring.</p>
          <PhoneAuthForm />
        </div>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="pb-root pb-gate">
        <p>{error || "Sahifa tayyorlanmoqda…"}</p>
      </div>
    );
  }

  const publicLink = `${window.location.origin}/p/${page.slug}`;
  const design: DesignConfig = page.designConfig || DEFAULT_DESIGN;
  const music: MusicConfig = page.musicConfig || DEFAULT_MUSIC;

  return (
    <div className={`pb-root${full ? " pb-full" : ""}`}>
      <div className="pb-shell">
        <aside className="pb-side">
          <div className="pb-brand">
            <strong>Interactive invitation</strong>
            <span>{page.status}</span>
          </div>

          <section className="pb-section">
            <h2>Ma’lumot</h2>
            <label className="pb-field">
              <span>Sarlavha</span>
              <input
                value={page.title}
                maxLength={120}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label className="pb-field">
              <span>Asosiy matn</span>
              <textarea
                value={page.mainText}
                maxLength={1200}
                onChange={(e) => patch({ mainText: e.target.value })}
              />
            </label>
            <div className="pb-grid">
              <label className="pb-field">
                <span>Sana</span>
                <input
                  type="date"
                  value={page.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </label>
              <label className="pb-field">
                <span>Vaqt</span>
                <input
                  type="time"
                  value={page.time}
                  onChange={(e) => patch({ time: e.target.value })}
                />
              </label>
            </div>
            <label className="pb-field">
              <span>Manzil</span>
              <input
                value={page.address}
                maxLength={240}
                onChange={(e) => patch({ address: e.target.value })}
              />
            </label>
          </section>

          <section className="pb-section">
            <h2>Asosiy rang</h2>
            <ChoiceGrid items={COLORS} value={design.primaryColor} onChange={(id) => patchDesign("primaryColor", id)} swatch />
          </section>
          <section className="pb-section">
            <h2>Naqsh</h2>
            <ChoiceGrid items={PATTERNS} value={design.pattern} onChange={(id) => patchDesign("pattern", id)} />
          </section>
          <section className="pb-section">
            <h2>Gullar</h2>
            <ChoiceGrid items={FLOWERS} value={design.flower} onChange={(id) => patchDesign("flower", id)} />
          </section>
          <section className="pb-section">
            <h2>Qog‘oz / tekstura</h2>
            <ChoiceGrid items={TEXTURES} value={design.texture} onChange={(id) => patchDesign("texture", id)} />
          </section>
          <section className="pb-section">
            <h2>Ramka</h2>
            <ChoiceGrid items={FRAMES} value={design.frame} onChange={(id) => patchDesign("frame", id)} />
          </section>
          <section className="pb-section">
            <h2>Shrift</h2>
            <ChoiceGrid items={FONTS} value={design.font} onChange={(id) => patchDesign("font", id)} />
          </section>
          <section className="pb-section">
            <h2>Animatsiya</h2>
            <ChoiceGrid items={ANIMATIONS} value={design.animation} onChange={(id) => patchDesign("animation", id)} />
          </section>
          <section className="pb-section">
            <h2>Bezak zichligi</h2>
            <ChoiceGrid items={DENSITIES} value={design.decorationDensity} onChange={(id) => patchDesign("decorationDensity", id)} />
          </section>

          <section className="pb-section">
            <h2>AI uslub</h2>
            <label className="pb-field">
              <span>Qo‘shimcha dizayn so‘rovi</span>
              <textarea
                value={page.designPrompt || ""}
                maxLength={500}
                placeholder="Masalan: nafis, sharqona naqsh, oltin, ochiq fon"
                onChange={(e) => patch({ designPrompt: e.target.value })}
              />
            </label>
            <div className="pb-actions">
              <button type="button" className="pb-btn" disabled={busy} onClick={() => void runAi("prompt")}>
                So‘rovni qo‘llash
              </button>
              <button type="button" className="pb-btn" disabled={busy} onClick={() => void runAi("style")}>
                ✨ AI Style
              </button>
              <button type="button" className="pb-btn" disabled={busy} onClick={() => void runAi("surprise")}>
                🎲 Surprise Me
              </button>
            </div>
          </section>

          <section className="pb-section">
            <h2>Musiqa</h2>
            {MUSIC_PRESETS.map((item) => (
              <div key={item.id} className="pb-music-row">
                <button
                  type="button"
                  className="pb-btn"
                  onClick={() => playPreview(presetMusicUrl(item.id), item.id)}
                >
                  {previewingMusic === item.id ? "⏸" : "▶"}
                </button>
                <button
                  type="button"
                  className={`pb-choice${music.source === "preset" && music.presetId === item.id ? " is-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() =>
                    patch({
                      musicConfig: { source: "preset", presetId: item.id, url: "" },
                    })
                  }
                >
                  <b>{item.name}</b>
                  <small>{item.description}</small>
                </button>
              </div>
            ))}
            <label className="pb-field">
              <span>O‘z musiqangiz (MP3 / M4A / WAV, 8 MB gacha)</span>
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac,.mp3,.m4a,.wav"
                onChange={(e) => void onUpload(e.target.files?.[0])}
              />
            </label>
            {music.source === "upload" && music.url ? (
              <div className="pb-actions">
                <button type="button" className="pb-btn" onClick={() => playPreview(music.url, "upload")}>
                  🎵 Mening musiqam
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
                  Olib tashlash
                </button>
              </div>
            ) : null}
          </section>

          {error ? <p className="pb-error">{error}</p> : null}
          {notice ? <p className="pb-ok">{notice}</p> : null}

          <div className="pb-actions">
            <button type="button" className="pb-btn primary" disabled={busy} onClick={() => void publish()}>
              Nashr qilish
            </button>
          </div>
          {page.status === "published" ? (
            <div className="pb-share">
              <input readOnly value={publicLink} />
              <div className="pb-actions">
                <button
                  type="button"
                  className="pb-btn"
                  onClick={() =>
                    void copyTextToClipboard(publicLink).then(() => setNotice("Havola nusxalandi"))
                  }
                >
                  Havolani nusxalash
                </button>
                <a
                  className="pb-btn"
                  href={`https://t.me/share/url?url=${encodeURIComponent(publicLink)}&text=${encodeURIComponent(page.title || "Taklifnoma")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Telegram
                </a>
              </div>
            </div>
          ) : null}
        </aside>

        <main className={`pb-stage${full ? " pb-full" : ""}`}>
          <div className="pb-toolbar">
            <button type="button" className="pb-btn" onClick={() => setFull(false)}>
              Telefon
            </button>
            <button type="button" className="pb-btn" onClick={() => setFull(true)}>
              To‘liq ekran
            </button>
          </div>
          <div className="pb-phone">
            <div className="pb-phone-screen">
              <InvitationRenderer
                content={{
                  title: page.title,
                  mainText: page.mainText,
                  date: page.date,
                  time: page.time,
                  address: page.address,
                }}
                design={design}
                opened
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
