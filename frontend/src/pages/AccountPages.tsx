import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type Invitation } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import TelegramLoginWidget from "../auth/TelegramLoginWidget";
import { loginHintKey, showDevLogin } from "../auth/flags";
import UiSelect from "../components/UiSelect";
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
          <TelegramLoginWidget />
          {showDevLogin && (
            <button
              type="button"
              className="cta"
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
          <Link className="ghost" to="/account/settings">
            {t("settings")}
          </Link>
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

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshMe, loginDev, loading: authLoading } = useAuth();
  const current = normalizeUiLang(i18n.language);

  if (authLoading) {
    return (
      <main className="page narrow">
        <PageLoader label={t("loading")} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page narrow">
        <header className="page-head">
          <h1>{t("settings")}</h1>
          <p className="hint">{t(loginHintKey())}</p>
        </header>
        <div className="login-block">
          <TelegramLoginWidget />
          {showDevLogin && (
            <button type="button" className="cta" onClick={() => void loginDev(false)}>
              {t("loginDev")}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <div className="row-between">
        <h1>{t("settings")}</h1>
        <Link className="ghost" to="/account">
          {t("back")}
        </Link>
      </div>
      <p className="hint">{t("settingsHint")}</p>
      <UiSelect
        label={t("languageLabel")}
        name="ui_language"
        value={current}
        onChange={(e) => {
          const lang = normalizeUiLang(e.target.value);
          void i18n.changeLanguage(lang);
          localStorage.setItem("ui_lang", lang);
          void api.updateProfile({ language: lang }).then(() => refreshMe());
        }}
      >
        <option value="uz-latn">{t("langUzLatn")}</option>
        <option value="uz-cyrl">{t("langUzCyrl")}</option>
        <option value="ru">{t("langRu")}</option>
      </UiSelect>
    </main>
  );
}
