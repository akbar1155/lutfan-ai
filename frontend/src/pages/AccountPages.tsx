import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type Invitation } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PhoneAuthForm from "../auth/PhoneAuthForm";
import { loginHintKey, showDevLogin } from "../auth/flags";
import { EmptyState, PageLoader } from "../components/UiStates";
import { eventDisplayName, normalizeUiLang } from "../i18n/lang";
import { EventIcon } from "../components/EventIcons";
import { formatDisplayDateTimeStamp } from "../utils/date";
import { invitationContinuePath } from "../utils/wizardResume";

function venueFromInvitation(inv: Invitation): string {
  const fields = (inv.event_data?.structured_fields || {}) as Record<string, unknown>;
  const name = String(fields.venue_name || "").trim();
  const address = String(fields.venue_address || "").trim();
  return [name, address].filter(Boolean).join(", ");
}

function pathLabel(inv: Invitation, t: (k: string) => string): string {
  if (inv.generation_path === "template") return t("pathTemplate");
  if (inv.generation_path === "ai_from_scratch") return t("pathAi");
  return "";
}

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, loginDev, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const lang = normalizeUiLang(i18n.language);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    void api
      .myInvitations()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

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
        <div className="list account-list">
          {items.map((inv) => {
            const venue = venueFromInvitation(inv);
            const path = pathLabel(inv, t);
            const subtypes = (inv.subtype_slugs || []).filter(Boolean);
            return (
              <Link
                key={inv.id}
                to={invitationContinuePath(inv)}
                className="list-item account-invite-card"
              >
                {inv.final_image_url ? (
                  <img
                    className="account-invite-thumb"
                    src={inv.final_image_url}
                    alt=""
                  />
                ) : (
                  <div className="account-invite-thumb empty" aria-hidden>
                    <EventIcon slug={inv.event_slug} size={22} />
                  </div>
                )}
                <div className="account-invite-body">
                  <strong>
                    <EventIcon slug={inv.event_slug} size={18} />
                    {eventDisplayName(inv.event_slug, lang)}
                  </strong>
                  <span className="account-invite-status">
                    {t(`status_${inv.status}`, { defaultValue: inv.status })}
                    {path ? ` · ${path}` : ""}
                  </span>
                  {inv.event_date ? (
                    <span className="account-invite-meta">
                      {t("accountEventDate")}: {inv.event_date}
                    </span>
                  ) : null}
                  {venue ? (
                    <span className="account-invite-meta">{venue}</span>
                  ) : null}
                  {subtypes.length ? (
                    <span className="account-invite-meta">
                      {subtypes.join(", ")}
                    </span>
                  ) : null}
                  <span className="account-invite-meta muted">
                    {formatDisplayDateTimeStamp(inv.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
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
