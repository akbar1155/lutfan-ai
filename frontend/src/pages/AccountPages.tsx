import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type Invitation } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PhoneAuthForm from "../auth/PhoneAuthForm";
// Telegram temporarily disabled — phone/password auth instead.
// import TelegramLoginWidget from "../auth/TelegramLoginWidget";
import { loginHintKey, showDevLogin } from "../auth/flags";
import { EmptyState, PageLoader } from "../components/UiStates";
import { eventDisplayName, normalizeUiLang } from "../i18n/lang";
import { EventIcon } from "../components/EventIcons";
import { formatDisplayDateTimeStamp } from "../utils/date";
import { invitationContinuePath } from "../utils/wizardResume";

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
          {/* <TelegramLoginWidget /> */}
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
      {loading ? (
        <PageLoader label={t("loading")} />
      ) : items.length ? (
        <div className="list account-list">
          {items.map((inv) => (
            <Link key={inv.id} to={invitationContinuePath(inv)} className="list-item">
              <strong>
                <EventIcon slug={inv.event_slug} size={18} />
                {eventDisplayName(inv.event_slug, lang)}
              </strong>
              <span>{t(`status_${inv.status}`, { defaultValue: inv.status })}</span>
              <span>{formatDisplayDateTimeStamp(inv.created_at)}</span>
            </Link>
          ))}
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
