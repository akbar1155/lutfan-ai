import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type EventConfig, type Invitation } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PhoneAuthForm from "../auth/PhoneAuthForm";
import { loginHintKey, showDevLogin } from "../auth/flags";
import {
  IconCalendar,
  IconClock,
  IconPalette,
  IconPin,
  IconTag,
} from "../components/ActionIcons";
import { EmptyState, PageLoader } from "../components/UiStates";
import { EventIcon } from "../components/EventIcons";
import { eventDisplayName, normalizeUiLang } from "../i18n/lang";
import { subtypeLabel } from "../utils/eventSubtypes";
import { formatDisplayDateTimeStamp } from "../utils/date";
import { invitationContinuePath } from "../utils/wizardResume";

const PAGE_SIZE = 8;

function venueFromInvitation(inv: Invitation): string {
  const fields = (inv.event_data?.structured_fields || {}) as Record<string, unknown>;
  const name = String(fields.venue_name || "").trim();
  const address = String(fields.venue_address || "").trim();
  return [name, address].filter(Boolean).join(", ");
}

function pathLabel(inv: Invitation, t: (k: string) => string): string {
  if (inv.generation_path === "template") return t("accountPathJpg");
  if (inv.generation_path === "ai_from_scratch") return t("accountPathAi");
  return "";
}

function statusTone(status: string): "ok" | "muted" | "warn" | "danger" {
  if (status === "ready") return "ok";
  if (status === "failed") return "danger";
  if (status === "generating" || status === "queued") return "warn";
  return "muted";
}

function pageNumbers(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  if (page > 3) pages.push("…");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p += 1) {
    pages.push(p);
  }
  if (page < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

function MetaRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="account-invite-meta">
      <span className="account-meta-icon" aria-hidden>
        {icon}
      </span>
      <span className="account-meta-text">{children}</span>
    </span>
  );
}

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, loginDev, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Invitation[]>([]);
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const lang = normalizeUiLang(i18n.language);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setEvents([]);
      return;
    }
    setLoading(true);
    void Promise.all([api.myInvitations(), api.events()])
      .then(([invites, eventList]) => {
        setItems(invites);
        setEvents(eventList);
        setPage(1);
      })
      .catch(() => {
        setItems([]);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const eventsBySlug = useMemo(() => {
    const map = new Map<string, EventConfig>();
    for (const e of events) map.set(e.slug, e);
    return map;
  }, [events]);

  const stats = useMemo(() => {
    const total = items.length;
    const ready = items.filter((i) => i.status === "ready").length;
    const draft = items.filter((i) => i.status === "draft").length;
    const generating = items.filter(
      (i) => i.status === "generating" || i.status === "queued",
    ).length;
    const failed = items.filter((i) => i.status === "failed").length;
    return { total, ready, draft, generating, failed };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);
  const rangeStart = items.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, items.length);

  if (authLoading) {
    return (
      <main className="page account-page">
        <PageLoader label={t("loading")} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page narrow">
        <header className="page-head">
          <h1>{t("account")}</h1>
          <p className="hint">{t(loginHintKey())}</p>
        </header>
        <div className="login-block">
          <PhoneAuthForm />
          {showDevLogin && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void loginDev(false).catch(() => undefined);
              }}
            >
              {t("loginDev")}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page account-page">
      <div className="row-between">
        <h1>{t("account")}</h1>
        <div className="row-actions">
          <Link className="cta" to="/create">
            {t("cta")}
          </Link>
        </div>
      </div>

      {!loading && items.length ? (
        <div className="account-stats" aria-label={t("accountStats")}>
          <div className="account-stat">
            <strong>{stats.total}</strong>
            <span>{t("accountStatTotal")}</span>
          </div>
          <div className="account-stat">
            <strong>{stats.ready}</strong>
            <span>{t("status_ready")}</span>
          </div>
          <div className="account-stat">
            <strong>{stats.draft}</strong>
            <span>{t("status_draft")}</span>
          </div>
          {stats.generating ? (
            <div className="account-stat">
              <strong>{stats.generating}</strong>
              <span>{t("status_generating")}</span>
            </div>
          ) : null}
          {stats.failed ? (
            <div className="account-stat">
              <strong>{stats.failed}</strong>
              <span>{t("status_failed")}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <PageLoader label={t("loading")} />
      ) : items.length ? (
        <>
          <div className="list account-list">
            {pageItems.map((inv) => {
              const venue = venueFromInvitation(inv);
              const path = pathLabel(inv, t);
              const event = eventsBySlug.get(inv.event_slug);
              const subtypeSlugs = (
                inv.subtype_slugs?.length
                  ? inv.subtype_slugs
                  : inv.subtype_slug
                    ? [inv.subtype_slug]
                    : []
              ).filter(Boolean);
              const subtypeNames = subtypeSlugs
                .map((slug) => subtypeLabel(event, slug, lang))
                .filter(Boolean);
              const statusText = t(`status_${inv.status}`, {
                defaultValue: inv.status,
              });

              return (
                <Link
                  key={inv.id}
                  to={invitationContinuePath(inv)}
                  className="account-invite-card"
                >
                  {inv.final_image_url ? (
                    <img
                      className="account-invite-thumb"
                      src={inv.final_image_url}
                      alt=""
                    />
                  ) : (
                    <div className="account-invite-thumb empty" aria-hidden>
                      <EventIcon slug={inv.event_slug} size={24} />
                    </div>
                  )}

                  <div className="account-invite-main">
                    <div className="account-invite-top">
                      <strong className="account-invite-title">
                        <EventIcon slug={inv.event_slug} size={18} />
                        {eventDisplayName(inv.event_slug, lang)}
                      </strong>
                      <div className="account-invite-chips">
                        <span
                          className={`account-invite-badge tone-${statusTone(inv.status)}`}
                        >
                          {statusText}
                        </span>
                        {path ? (
                          <span className="account-invite-badge tone-path">
                            <IconPalette />
                            {path}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="account-invite-meta-list">
                      {subtypeNames.length ? (
                        <MetaRow icon={<IconTag />}>
                          {subtypeNames.join(" · ")}
                        </MetaRow>
                      ) : null}
                      {inv.event_date ? (
                        <MetaRow icon={<IconCalendar />}>
                          {inv.event_date}
                        </MetaRow>
                      ) : null}
                      {venue ? (
                        <MetaRow icon={<IconPin />}>{venue}</MetaRow>
                      ) : null}
                      <MetaRow icon={<IconClock />}>
                        {formatDisplayDateTimeStamp(inv.created_at)}
                      </MetaRow>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <footer className="account-pagination">
            <span className="account-page-info">
              {t("accountPageInfo", {
                start: rangeStart,
                end: rangeEnd,
                total: items.length,
              })}
            </span>
            {totalPages > 1 ? (
              <nav className="account-page-nav" aria-label={t("adminPagination")}>
                <button
                  type="button"
                  className="account-page-btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t("adminPrevPage")}
                >
                  ‹
                </button>
                {pageNumbers(safePage, totalPages).map((p, idx) =>
                  p === "…" ? (
                    <span key={`e-${idx}`} className="account-page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`account-page-btn${p === safePage ? " is-current" : ""}`}
                      onClick={() => setPage(p)}
                      aria-current={p === safePage ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="account-page-btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={t("adminNextPage")}
                >
                  ›
                </button>
              </nav>
            ) : null}
          </footer>
        </>
      ) : (
        <EmptyState
          title={t("accountEmpty")}
          body={t("accountEmptyHint")}
          actionTo="/create"
          actionLabel={t("cta")}
        />
      )}
    </main>
  );
}
