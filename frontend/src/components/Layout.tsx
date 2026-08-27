import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { showDevLogin } from "../auth/flags";
import { normalizeUiLang, UI_LANGS } from "../i18n/lang";

const localeLabels: Record<(typeof UI_LANGS)[number], string> = {
  "uz-latn": "Oʻzb",
  "uz-cyrl": "Ўзб",
  ru: "Рус",
};

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, loginDev, logout } = useAuth();
  const location = useLocation();
  const current = normalizeUiLang(i18n.language);
  const isAdmin = location.pathname.startsWith("/admin");
  const isWizard = location.pathname.startsWith("/create");
  const isHome = location.pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const setLang = (code: (typeof UI_LANGS)[number]) => {
    void i18n.changeLanguage(code);
    localStorage.setItem("ui_lang", code);
  };

  return (
    <div
      className={[
        "shell",
        isAdmin ? "shell-admin" : "",
        isHome ? "shell-home" : "",
        isWizard ? "shell-wizard" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={`top ${isHome ? "top-home" : ""} ${isAdmin ? "top-admin" : ""}`}>
        <div className="top-inner">
          <Link to="/" className="brand">
            {t("brand")}
          </Link>

          {!isAdmin && (
            <button
              type="button"
              className={`nav-toggle ${menuOpen ? "open" : ""}`}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              aria-label={t("menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          )}

          {!isAdmin && (
            <nav
              id="main-nav"
              className={`nav ${menuOpen ? "nav-open" : ""}`}
              aria-label="Main"
            >
              <NavLink to="/gallery">{t("gallery")}</NavLink>
              <NavLink to="/how-it-works">{t("how")}</NavLink>
              <NavLink to="/faq">{t("faq")}</NavLink>
              {user && <NavLink to="/account">{t("account")}</NavLink>}
              {user?.role === "admin" && <NavLink to="/admin">{t("admin")}</NavLink>}
            </nav>
          )}

          {isAdmin && (
            <nav className="nav admin-site-nav" aria-label="Site">
              <Link to="/">{t("back")}</Link>
            </nav>
          )}

          <div className="top-actions">
            <div className="lang" role="group" aria-label={t("languageLabel")}>
              {UI_LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={current === code ? "active" : ""}
                  onClick={() => setLang(code)}
                >
                  {localeLabels[code]}
                </button>
              ))}
            </div>
            {user ? (
              <button type="button" className="ghost top-logout" onClick={() => void logout()}>
                {t("logout")}
              </button>
            ) : (
              !isWizard &&
              showDevLogin && (
                <button
                  type="button"
                  className="ghost top-login"
                  onClick={() => {
                    void loginDev(false).catch(() => undefined);
                  }}
                >
                  {t("loginDevShort")}
                </button>
              )
            )}
          </div>
        </div>
      </header>
      <Outlet />
      {!isAdmin && (
        <footer className="footer">
          <span className="brand footer-brand">{t("brand")}</span>
          <Link to="/privacy-policy">{t("privacy")}</Link>
          <Link to="/terms">{t("terms")}</Link>
        </footer>
      )}
    </div>
  );
}
