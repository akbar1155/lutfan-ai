import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const { user, loginDev, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const current = normalizeUiLang(i18n.language);
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isAdminAuthed = user?.role === "admin";
  // Admin chrome only on /admin — never bleed into user pages when role is admin.
  const showAdminShell = isAdminRoute && isAdminAuthed;
  const isAdmin = isAdminRoute;
  const isWizard = location.pathname.startsWith("/create");
  const isHome = location.pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const leavingWizard = useRef(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onWizardStep = location.pathname.startsWith("/create/");
    if (!onWizardStep) return;
    if (leavingWizard.current || (!loading && !user)) {
      navigate("/", { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  const setLang = (code: (typeof UI_LANGS)[number]) => {
    void i18n.changeLanguage(code);
    localStorage.setItem("ui_lang", code);
  };

  const handleLogout = () => {
    leavingWizard.current = true;
    navigate("/", { replace: true });
    void logout().finally(() => {
      window.setTimeout(() => {
        leavingWizard.current = false;
      }, 800);
    });
  };

  return (
    <div
      className={[
        "shell",
        showAdminShell ? "shell-admin" : "",
        isAdminRoute && !isAdminAuthed ? "shell-admin-gate" : "",
        isHome ? "shell-home" : "",
        isWizard ? "shell-wizard" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header
        className={[
          "top",
          isHome ? "top-home" : "",
          showAdminShell ? "top-admin" : "",
          isAdminRoute && !isAdminAuthed ? "top-admin-gate" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="top-inner">
          <div className="top-brand-cluster">
            <Link to="/" className="brand">
              {t("brand")}
            </Link>
          </div>

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
              <NavLink to="/how-it-works">{t("how")}</NavLink>
              <NavLink to="/faq">{t("faq")}</NavLink>
              {user && <NavLink to="/account">{t("account")}</NavLink>}
              {user?.role === "admin" && <NavLink to="/admin">{t("admin")}</NavLink>}
              <div className="nav-lang" role="group" aria-label={t("languageLabel")}>
                <span className="nav-lang-label">{t("languageLabel")}</span>
                <div className="lang">
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
              </div>
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
              <button type="button" className="ghost top-logout" onClick={handleLogout}>
                {t("logout")}
              </button>
            ) : (
              !isWizard &&
              !isAdminRoute &&
              showDevLogin && (
                <button
                  type="button"
                  className="top-login"
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
      {!isAdminRoute && (
        <footer className="footer">
          <span className="brand footer-brand">{t("brand")}</span>
          <Link to="/privacy-policy">{t("privacy")}</Link>
          <Link to="/terms">{t("terms")}</Link>
        </footer>
      )}
    </div>
  );
}
