import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type EventConfig, type JpgTemplate } from "../api/client";
import { EmptyState, PageLoader } from "../components/UiStates";
import { eventDisplayName, normalizeUiLang, pickTranslation } from "../i18n/lang";

export function HowItWorksPage() {
  const { t } = useTranslation();
  return (
    <main className="page narrow">
      <header className="page-head">
        <h1>{t("how")}</h1>
        <p className="hint">{t("howIntro")}</p>
      </header>
      <ol className="steps how-steps">
        <li>
          <strong>{t("howStep1Title")}</strong>
          <span>{t("howStep1")}</span>
        </li>
        <li>
          <strong>{t("howStep2Title")}</strong>
          <span>{t("howStep2")}</span>
        </li>
        <li>
          <strong>{t("howStep3Title")}</strong>
          <span>{t("howStep3")}</span>
        </li>
      </ol>
      <div className="page-cta">
        <Link className="cta" to="/create">
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}

export function FaqPage() {
  const { t } = useTranslation();
  return (
    <main className="page narrow">
      <header className="page-head">
        <h1>{t("faq")}</h1>
        <p className="hint">{t("faqIntro")}</p>
      </header>
      <div className="faq-list">
        <details>
          <summary>{t("faqQ1")}</summary>
          <p>{t("faqA1")}</p>
        </details>
        <details>
          <summary>{t("faqQ2")}</summary>
          <p>{t("faqA2")}</p>
        </details>
        <details>
          <summary>{t("faqQ3")}</summary>
          <p>{t("faqA3")}</p>
        </details>
      </div>
    </main>
  );
}

export function GalleryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = normalizeUiLang(i18n.language);
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [templates, setTemplates] = useState<JpgTemplate[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const evs = await api.events();
        const all: JpgTemplate[] = [];
        for (const ev of evs) {
          const part = await api.templates(ev.slug).catch(() => [] as JpgTemplate[]);
          all.push(
            ...part.map((tpl) => ({
              ...tpl,
              event_slug: tpl.event_slug || ev.slug,
            })),
          );
        }
        if (!cancelled) {
          setEvents(evs);
          setTemplates(all.filter(Boolean));
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
          setTemplates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return templates.filter((tpl) => tpl.is_featured);
    return templates.filter((tpl) => tpl.event_slug === filter);
  }, [templates, filter]);

  return (
    <main className="page">
      <header className="page-head">
        <h1>{t("gallery")}</h1>
        <p className="hint">{t("galleryIntro")}</p>
      </header>
      {!loading && events.length > 0 && (
        <div className="choice-row gallery-filters" role="tablist" aria-label={t("gallery")}>
          <button
            type="button"
            className={filter === "all" ? "choice-pill active" : "choice-pill"}
            onClick={() => setFilter("all")}
          >
            {t("galleryAll")}
          </button>
          {events.map((ev) => (
            <button
              key={ev.slug}
              type="button"
              className={filter === ev.slug ? "choice-pill active" : "choice-pill"}
              onClick={() => setFilter(ev.slug)}
            >
              {pickTranslation(ev.name_translations, lang) ||
                eventDisplayName(ev.slug, lang)}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <PageLoader label={t("loading")} />
      ) : filtered.length ? (
        <div className="gallery-grid">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="gallery-item"
              onClick={() =>
                navigate("/create", {
                  state: {
                    eventSlug: tpl.event_slug,
                    templateId: tpl.id,
                  },
                })
              }
            >
              <img src={tpl.bg_url_preview} alt={tpl.theme_name} />
              <span>{tpl.theme_name}</span>
              <small>{t("galleryUseThis")}</small>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("galleryEmpty")}
          actionTo="/create"
          actionLabel={t("cta")}
        />
      )}
    </main>
  );
}

export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <main className="page narrow">
      <header className="page-head">
        <h1>{t("privacyTitle")}</h1>
      </header>
      <div className="prose">
        {t("privacyBody")
          .split("\n\n")
          .map((para) => (
            <p key={para.slice(0, 24)}>{para}</p>
          ))}
      </div>
      <Link className="text-link" to="/">
        {t("backHome")}
      </Link>
    </main>
  );
}

export function TermsPage() {
  const { t } = useTranslation();
  return (
    <main className="page narrow">
      <header className="page-head">
        <h1>{t("termsTitle")}</h1>
      </header>
      <div className="prose">
        {t("termsBody")
          .split("\n\n")
          .map((para) => (
            <p key={para.slice(0, 24)}>{para}</p>
          ))}
      </div>
      <Link className="text-link" to="/">
        {t("backHome")}
      </Link>
    </main>
  );
}

export function PublicInvitationPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .publicInvitation(id)
      .then((data) => setImageUrl(data.image_url))
      .catch((err: Error) => setError(err.message || t("publicInviteMissing")));
  }, [id, t]);

  return (
    <main className="page narrow public-invite">
      <header className="page-head">
        <h1>{t("brand")}</h1>
        <p className="hint">{t("tagline")}</p>
      </header>
      {error ? (
        <EmptyState
          title={t("publicInviteMissing")}
          body={error}
          actionTo="/create"
          actionLabel={t("cta")}
        />
      ) : imageUrl ? (
        <div className="result-stage">
          <img className="result-img" src={imageUrl} alt={t("resultAlt")} />
        </div>
      ) : (
        <PageLoader label={t("loading")} />
      )}
      <div className="page-cta">
        <Link className="cta" to="/create">
          {t("publicInviteCta")}
        </Link>
      </div>
    </main>
  );
}
