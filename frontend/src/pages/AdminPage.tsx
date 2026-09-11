import { useCallback, useEffect, useMemo, useRef, useState, Children, cloneElement, isValidElement, type FormEvent, type ReactElement, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  IconBan,
  IconBtn,
  IconEdit,
  IconExternal,
  IconPower,
} from "../components/ActionIcons";
import { EmptyState } from "../components/UiStates";
import UiSelect from "../components/UiSelect";
import { formatDisplayDateTimeStamp, isIsoDateTime } from "../utils/date";
import AdminUsersSection, { type AdminUsersSectionHandle } from "./AdminUsersSection";
import AdminDashboardSection from "./AdminDashboardSection";

function AdminSkeleton() {
  return (
    <div className="admin-skeleton" aria-hidden>
      <div className="admin-skeleton-row lg" />
      <div className="admin-skeleton-row" />
      <div className="admin-skeleton-row" />
      <div className="admin-skeleton-row" />
      <div className="admin-skeleton-row" />
      <div className="admin-skeleton-row" />
    </div>
  );
}

type Tab =
  | "dashboard"
  | "users"
  | "invitations"
  | "events"
  | "texts"
  | "templates"
  | "moods"
  | "presets"
  | "limits"
  | "generations"
  | "logs";

const NAV: Array<{
  titleKey: string;
  items: Array<{ id: Tab; labelKey: string }>;
}> = [
  {
    titleKey: "adminGroupOverview",
    items: [
      { id: "dashboard", labelKey: "adminNavDashboard" },
      { id: "users", labelKey: "adminNavUsers" },
      { id: "invitations", labelKey: "adminNavInvitations" },
    ],
  },
  {
    titleKey: "adminGroupContent",
    items: [
      { id: "events", labelKey: "adminNavEvents" },
      { id: "texts", labelKey: "adminNavTexts" },
      { id: "templates", labelKey: "adminNavTemplates" },
      { id: "moods", labelKey: "adminNavMoods" },
      { id: "presets", labelKey: "adminNavPresets" },
    ],
  },
  {
    titleKey: "adminGroupOps",
    items: [
      { id: "limits", labelKey: "adminNavLimits" },
      { id: "generations", labelKey: "adminNavGenerations" },
      { id: "logs", labelKey: "adminNavLogs" },
    ],
  },
];

const TAB_META: Record<Tab, { titleKey: string; descKey: string }> = {
  dashboard: { titleKey: "adminNavDashboard", descKey: "adminDescDashboard" },
  users: { titleKey: "adminNavUsers", descKey: "adminDescUsers" },
  invitations: { titleKey: "adminNavInvitations", descKey: "adminDescInvitations" },
  events: { titleKey: "adminNavEvents", descKey: "adminDescEvents" },
  texts: { titleKey: "adminNavTexts", descKey: "adminDescTexts" },
  templates: { titleKey: "adminNavTemplates", descKey: "adminDescTemplates" },
  moods: { titleKey: "adminNavMoods", descKey: "adminDescMoods" },
  presets: { titleKey: "adminNavPresets", descKey: "adminDescPresets" },
  limits: { titleKey: "adminNavLimits", descKey: "adminDescLimits" },
  generations: { titleKey: "adminNavGenerations", descKey: "adminDescGenerations" },
  logs: { titleKey: "adminNavLogs", descKey: "adminDescLogs" },
};

function extractVars(text: string) {
  return Array.from(new Set((text.match(/\{([a-zA-Z0-9_]+)\}/g) || []).map((v) => v.slice(1, -1))));
}

function formatCell(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (isIsoDateTime(value) || value instanceof Date) {
    return formatDisplayDateTimeStamp(value);
  }
  if (typeof value === "string" && value.length > 90) return `${value.slice(0, 90)}…`;
  return String(value);
}

function formatDate(value: unknown) {
  return formatDisplayDateTimeStamp(value);
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "ok" | "danger" | "accent" | "muted";
}) {
  return <span className={`admin-badge ${tone}`}>{children}</span>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AdminModal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`admin-modal ${wide ? "is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="ghost admin-modal-close"
            aria-label={t("adminCloseDrawer")}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}

function AdminImageModal({
  src,
  title,
  onClose,
}: {
  src: string;
  title?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AdminModal title={title || t("adminPreview")} onClose={onClose} wide>
      <div className="admin-image-modal">
        <img src={src} alt={title || ""} />
        <a className="admin-btn" href={src} target="_blank" rel="noreferrer">
          {t("adminOpenImage")}
        </a>
      </div>
    </AdminModal>
  );
}

const ALL_TABS: Tab[] = NAV.flatMap((group) => group.items.map((item) => item.id));

function isAdminTab(value: string | null): value is Tab {
  return Boolean(value && ALL_TABS.includes(value as Tab));
}

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading, loginDev, loginAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = isAdminTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as Tab)
    : "dashboard";
  const setTab = useCallback(
    (next: Tab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "dashboard") params.delete("tab");
          else params.set("tab", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const usersSectionRef = useRef<AdminUsersSectionHandle>(null);

  const [invitations, setInvitations] = useState<Array<Record<string, unknown>>>([]);
  const [invStatus, setInvStatus] = useState("");
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [texts, setTexts] = useState<Array<Record<string, unknown>>>([]);
  const [textsLang, setTextsLang] = useState<string>("uz-latn");
  const [textsEventSlug, setTextsEventSlug] = useState<string>("");
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [moods, setMoods] = useState<Array<Record<string, unknown>>>([]);
  const [presets, setPresets] = useState<Array<Record<string, unknown>>>([]);
  const [generations, setGenerations] = useState<Array<Record<string, unknown>>>([]);
  const [genStatus, setGenStatus] = useState("");
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [limitsHour, setLimitsHour] = useState("20");
  const [limitsDay, setLimitsDay] = useState("50");
  const [limitsSavedAt, setLimitsSavedAt] = useState<string | null>(null);

  const [editingEvent, setEditingEvent] = useState<Record<string, unknown> | null>(null);
  const [editingText, setEditingText] = useState<Record<string, unknown> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Record<string, unknown> | null>(null);
  const [editingMood, setEditingMood] = useState<Record<string, unknown> | null>(null);
  const [editingPreset, setEditingPreset] = useState<Record<string, unknown> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; title?: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    if (tab === "users") {
      usersSectionRef.current?.refresh();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (tab === "dashboard") setDashboard(await api.adminDashboard());
      if (tab === "invitations") {
        setInvitations(
          await api.adminInvitations({ status: invStatus || undefined }),
        );
      }
      if (tab === "events") setEvents(await api.adminEvents());
      if (tab === "texts" || tab === "templates" || tab === "presets") {
        const [eventList, ...rest] = await Promise.all([
          api.adminEvents(),
          ...(tab === "texts" ? [api.adminTextTemplates()] : []),
          ...(tab === "templates" ? [api.adminTemplates()] : []),
          ...(tab === "presets" ? [api.adminAiPresets()] : []),
        ]);
        setEvents(eventList);
        if (tab === "texts") setTexts(rest[0] || []);
        if (tab === "templates") setTemplates(rest[0] || []);
        if (tab === "presets") setPresets(rest[0] || []);
      }
      if (tab === "moods") setMoods(await api.adminMoodTags());
      if (tab === "limits") {
        const limits = await api.adminGenerationLimits();
        setLimitsHour(String(limits.per_hour ?? 0));
        setLimitsDay(String(limits.per_day ?? 0));
        setLimitsSavedAt(limits.updated_at ? String(limits.updated_at) : null);
      }
      if (tab === "generations") setGenerations(await api.adminAiGenerations(genStatus || undefined));
      if (tab === "logs") setLogs(await api.adminSystemLogs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin load failed");
    } finally {
      setBusy(false);
    }
  }, [tab, user, invStatus, genStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setActionBusy(key);
    setError(null);
    try {
      await fn();
      setShowCreate(false);
      setEditingEvent(null);
      setEditingText(null);
      setEditingTemplate(null);
      setEditingMood(null);
      setEditingPreset(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  const exportCsv = () => {
    const token = localStorage.getItem("access_token");
    void fetch(api.adminAnalyticsExportUrl(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "daily_metrics.csv";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err: Error) => setError(err.message));
  };

  const eventOptions = useMemo(
    () => events.map((e) => String(e.slug)).filter(Boolean),
    [events],
  );

  const eventLabels = useMemo(() => {
    const lang = (i18n.language || "uz-latn") as string;
    const map: Record<string, string> = {};
    for (const e of events) {
      const slug = String(e.slug || "");
      if (!slug) continue;
      const names = (e.name_translations || {}) as Record<string, string>;
      map[slug] =
        names[lang] || names["uz-latn"] || names["uz-cyrl"] || names.ru || slug;
    }
    return map;
  }, [events, i18n.language]);

  useEffect(() => {
    if (tab !== "texts") return;
    if (textsEventSlug) return;
    if (!eventOptions.length) return;
    // Default to first available event for a “single list” UX.
    setTextsEventSlug(eventOptions[0]);
  }, [tab, textsEventSlug, eventOptions]);

  // Wait for session restore so refresh never flashes the login gate,
  // and keep the URL tab (e.g. ?tab=templates) after auth resolves.
  if (authLoading && !user) {
    return (
      <main className="admin-login-gate" aria-busy="true">
        <section className="admin-login-panel">
          <div className="admin-login-brand">
            <span className="admin-login-badge">{t("brand")}</span>
            <h1>{t("admin")}</h1>
            <p>{t("loading")}</p>
          </div>
          <AdminSkeleton />
        </section>
      </main>
    );
  }

  if (!user || user.role !== "admin") {
    const canSubmit = Boolean(adminUsername.trim() && adminPassword);
    return (
      <main className="admin-login-gate">
        <section className="admin-login-panel" aria-labelledby="admin-login-title">
          <div className="admin-login-brand">
            <span className="admin-login-badge">{t("brand")}</span>
            <h1 id="admin-login-title">{t("admin")}</h1>
            <p>{t("adminLoginHint")}</p>
          </div>
          <form
            className="admin-login-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit || loginBusy) return;
              setLoginBusy(true);
              setLoginError(null);
              void loginAdmin(adminUsername.trim(), adminPassword)
                .catch((err: Error) => {
                  setLoginError(err.message || t("adminLoginFailed"));
                })
                .finally(() => setLoginBusy(false));
            }}
          >
            <label>
              <span>{t("adminUsername")}</span>
              <input
                autoComplete="username"
                autoFocus
                placeholder="admin"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("adminPassword")}</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </label>
            {loginError ? (
              <p className="admin-login-error" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              className="admin-login-submit"
              disabled={loginBusy || !canSubmit}
            >
              {loginBusy ? t("loading") : t("adminLogin")}
            </button>
          </form>
          {import.meta.env.DEV ? (
            <button
              type="button"
              className="admin-login-dev"
              onClick={() => void loginDev(true).catch(() => undefined)}
            >
              {t("adminDevLogin")}
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const meta = TAB_META[tab];

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-kicker">{t("brand")}</span>
          <strong>{t("admin")}</strong>
        </div>
        <nav className="admin-nav" aria-label="Admin">
          {NAV.map((group, groupIdx) => (
            <div
              key={group.titleKey}
              className={`admin-nav-group ${groupIdx === 0 ? "is-first" : ""}`}
            >
              <p className="admin-nav-label">{t(group.titleKey)}</p>
              <div className="admin-nav-children" role="group" aria-label={t(group.titleKey)}>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-nav-item ${tab === item.id ? "active" : ""}`}
                    onClick={() => {
                      setTab(item.id);
                      setShowCreate(false);
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="admin-nav-group">
            <p className="admin-nav-label">{t("adminGroupSystem")}</p>
            <div className="admin-nav-children" role="group" aria-label={t("adminGroupSystem")}>
              <a
                className="admin-nav-item"
                href="/django-admin/"
                target="_blank"
                rel="noreferrer"
              >
                {t("adminNavDjango")}
              </a>
            </div>
          </div>
        </nav>
        <div className="admin-sidebar-foot">
          <span>{user.first_name || user.username || "Admin"}</span>
          <small>{t("adminRoleBadge")}</small>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <div>
              <h1>{t(meta.titleKey)}</h1>
              <p>{t(meta.descKey)}</p>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-btn"
              onClick={() => void load()}
              disabled={busy}
            >
              {busy ? t("loading") : t("adminRefresh")}
            </button>
          </div>
        </header>

        {error && (
          <div className="banner error admin-banner">
            <span>{error}</span>
            <button type="button" className="ghost" onClick={() => setError(null)} aria-label="Close">
              ×
            </button>
          </div>
        )}

        <div className={`admin-content ${busy ? "is-loading" : ""}`}>
          {busy && tab === "dashboard" && !dashboard ? (
            <div className="admin-dash admin-dash-skeleton" aria-busy="true">
              <AdminSkeleton />
            </div>
          ) : null}
          {busy && tab !== "dashboard" && tab !== "users" && (
            <div className="admin-section" aria-busy="true">
              <AdminSkeleton />
            </div>
          )}

          {tab === "dashboard" && dashboard && (
            <AdminDashboardSection
              dashboard={dashboard as never}
              onNavigate={setTab}
              onExport={exportCsv}
            />
          )}

          {tab === "users" && (
            <AdminUsersSection ref={usersSectionRef} onError={setError} />
          )}

          {tab === "invitations" && (
            <section className="admin-section">
              <div className="admin-filters">
                <UiSelect
                  size="sm"
                  aria-label={t("adminColStatus")}
                  value={invStatus}
                  onChange={(e) => setInvStatus(e.target.value)}
                >
                  <option value="">{t("adminColStatus")}</option>
                  <option value="draft">draft</option>
                  <option value="generating">generating</option>
                  <option value="ready">ready</option>
                  <option value="failed">failed</option>
                </UiSelect>
                <button type="button" className="admin-btn" onClick={() => void load()}>
                  {t("adminSearch")}
                </button>
              </div>
              <SimpleTable
                empty={t("adminEmpty")}
                rows={invitations}
                columns={[
                  ["event_slug", t("adminColEvent")],
                  ["status", t("adminColStatus")],
                  ["user_name", t("adminColUser")],
                  ["telegram_id", "TG"],
                  ["custom_style_note", t("adminStylePrompt")],
                  ["language", t("adminColLang")],
                  ["created_at", t("adminColCreated")],
                ]}
                renderExtra={(row) =>
                  row.final_image_url ? (
                    <IconBtn
                      label={t("adminOpenImage")}
                      onClick={() =>
                        setPreviewImage({
                          src: String(row.final_image_url),
                          title: String(row.event_slug || t("adminOpenImage")),
                        })
                      }
                    >
                      <IconExternal />
                    </IconBtn>
                  ) : (
                    "—"
                  )
                }
              />
            </section>
          )}

          {tab === "events" && (
            <section className="admin-section">
              <div className="admin-toolbar-row">
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={() => {
                    setShowCreate(true);
                    setEditingEvent({
                      slug: "",
                      sort_order: 0,
                      is_active: true,
                      name_uz_cyrl: "",
                      name_uz_latn: "",
                      name_ru: "",
                      subtypes: "[]",
                      fields_schema: '{"required":[],"optional":[]}',
                    });
                  }}
                >
                  {t("adminCreate")}
                </button>
              </div>
              {(showCreate || editingEvent) && editingEvent && (
                <AdminModal
                  title={`${editingEvent.id ? t("adminEdit") : t("adminCreate")} — ${t("adminNavEvents")}`}
                  onClose={() => {
                    setShowCreate(false);
                    setEditingEvent(null);
                  }}
                >
                  <EventForm
                    initial={editingEvent}
                    busy={!!actionBusy}
                    onCancel={() => {
                      setShowCreate(false);
                      setEditingEvent(null);
                    }}
                    onSubmit={(body, id) =>
                      void run("event", () =>
                        id ? api.adminPatchEvent(id, body) : api.adminCreateEvent(body),
                      )
                    }
                  />
                </AdminModal>
              )}
              <AdminTable
                empty={t("adminEmpty")}
                hasData={events.length > 0}
                headers={["Slug", t("adminColName"), t("adminColStatus"), t("adminColOrder"), t("adminColActions")]}
              >
                {events.map((e) => {
                  const names = (e.name_translations || {}) as Record<string, string>;
                  return (
                    <tr key={String(e.id)}>
                      <td className="mono">{String(e.slug)}</td>
                      <td>{names["uz-latn"] || names["uz-cyrl"] || names.ru || "—"}</td>
                      <td>
                        <StatusBadge tone={e.is_active ? "ok" : "muted"}>
                          {e.is_active ? t("adminActive") : t("adminInactive")}
                        </StatusBadge>
                      </td>
                      <td>{String(e.sort_order)}</td>
                      <td className="admin-actions">
                        <IconBtn
                          label={t("adminEdit")}
                          onClick={() => {
                            setShowCreate(false);
                            setEditingEvent({
                              id: e.id,
                              slug: e.slug,
                              sort_order: e.sort_order,
                              is_active: e.is_active,
                              name_uz_cyrl: names["uz-cyrl"] || "",
                              name_uz_latn: names["uz-latn"] || "",
                              name_ru: names.ru || "",
                              subtypes: JSON.stringify(e.subtypes || [], null, 2),
                              fields_schema: JSON.stringify(e.fields_schema || {}, null, 2),
                              icon_url: e.icon_url || "",
                            });
                          }}
                        >
                          <IconEdit />
                        </IconBtn>
                        <IconBtn
                          label={e.is_active ? t("adminDisable") : t("adminEnable")}
                          tone={e.is_active ? "danger" : "ok"}
                          onClick={() =>
                            void run(String(e.id), () =>
                              e.is_active
                                ? api.adminDeleteEvent(String(e.id))
                                : api.adminPatchEvent(String(e.id), { is_active: true }),
                            )
                          }
                        >
                          {e.is_active ? <IconBan /> : <IconPower />}
                        </IconBtn>
                      </td>
                    </tr>
                  );
                })}
              </AdminTable>
            </section>
          )}

          {tab === "texts" && (
            <section className="admin-section">
              <div className="admin-toolbar-row">
                <UiSelect
                  label={t("adminColEvent")}
                  size="sm"
                  value={textsEventSlug}
                  onChange={(e) => setTextsEventSlug(e.target.value)}
                >
                  {eventOptions.map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </UiSelect>
                <UiSelect
                  label={t("adminColLang")}
                  size="sm"
                  value={textsLang}
                  onChange={(e) => setTextsLang(e.target.value)}
                >
                  <option value="uz-cyrl">uz-cyrl</option>
                  <option value="uz-latn">uz-latn</option>
                  <option value="ru">ru</option>
                </UiSelect>
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={() => {
                    setEditingText({
                      event_slug: textsEventSlug || eventOptions[0] || "nikoh",
                      subtype_slug: "",
                      language: textsLang,
                      title: "",
                      preview_text: "",
                      tone: "classic",
                    });
                    setShowCreate(true);
                  }}
                >
                  {t("adminCreate")}
                </button>
              </div>
              {editingText && (
                <AdminModal
                  title={
                    editingText.id ? t("adminEdit") : t("adminNewText")
                  }
                  onClose={() => {
                    setEditingText(null);
                    setShowCreate(false);
                  }}
                >
                  <TextForm
                    initial={editingText}
                    eventOptions={eventOptions}
                    busy={!!actionBusy}
                    onCancel={() => {
                      setEditingText(null);
                      setShowCreate(false);
                    }}
                    onSubmit={(body, id) =>
                      void run("text", () =>
                        id
                          ? api.adminPatchTextTemplate(id, body)
                          : api.adminCreateTextTemplate(body),
                      )
                    }
                  />
                </AdminModal>
              )}
              {(() => {
                const visibleTexts = texts.filter(
                  (row) =>
                    String(row.language || "") === textsLang &&
                    (!textsEventSlug || String(row.event_slug || "") === textsEventSlug),
                );
                return (
                  <AdminTable
                empty={t("adminEmpty")}
                hasData={visibleTexts.length > 0}
                headers={[
                  t("adminColEvent"),
                  t("adminColLang"),
                  t("adminColTitle"),
                  t("adminColStatus"),
                  t("adminColActions"),
                ]}
              >
                    {visibleTexts.map((row) => (
                      <tr key={String(row.id)}>
                        <td>{String(row.event_slug)}</td>
                        <td>{String(row.language)}</td>
                        <td>{String(row.title)}</td>
                        <td>
                          <StatusBadge tone={row.is_active ? "ok" : "muted"}>
                            {row.is_active ? t("adminActive") : t("adminInactive")}
                          </StatusBadge>
                        </td>
                        <td className="admin-actions">
                          <IconBtn
                            label={t("adminEdit")}
                            onClick={() =>
                              setEditingText({
                                id: row.id,
                                event_slug: row.event_slug,
                                subtype_slug: row.subtype_slug || "",
                                language: row.language,
                                title: row.title,
                                preview_text: row.preview_text,
                                tone: row.tone || "classic",
                              })
                            }
                          >
                            <IconEdit />
                          </IconBtn>
                          <IconBtn
                            label={
                              row.is_active ? t("adminDisable") : t("adminEnable")
                            }
                            tone={row.is_active ? "danger" : "ok"}
                            onClick={() =>
                              void run(String(row.id), () =>
                                api.adminPatchTextTemplate(String(row.id), {
                                  is_active: !row.is_active,
                                }),
                              )
                            }
                          >
                            {row.is_active ? <IconBan /> : <IconPower />}
                          </IconBtn>
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                );
              })()}
            </section>
          )}

          {tab === "templates" && (
            <section className="admin-section">
              <div className="admin-toolbar-row">
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={() =>
                    setEditingTemplate({
                      event_slugs: [...eventOptions],
                      event_slug: eventOptions[0] || "nikoh",
                      theme_name: "",
                      bg_url: "",
                      bg_url_preview: "",
                      ai_composition_prompt:
                        "Place invitation text elegantly with generous margins.",
                    })
                  }
                >
                  {t("adminCreate")}
                </button>
              </div>
              {editingTemplate && (
                <AdminModal
                  title={`${editingTemplate.id ? t("adminEdit") : t("adminCreate")} — JPG`}
                  onClose={() => setEditingTemplate(null)}
                >
                  <TemplateForm
                    initial={editingTemplate}
                    eventOptions={eventOptions}
                    eventLabels={eventLabels}
                    busy={!!actionBusy}
                    onCancel={() => setEditingTemplate(null)}
                    onSubmit={(body, id) =>
                      void run("tpl", () =>
                        body.__file instanceof File
                          ? (() => {
                              const fd = new FormData();
                              Object.entries(body).forEach(([k, v]) => {
                                if (k === "__file") return;
                                if (v == null) return;
                                fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
                              });
                              fd.append("file", body.__file);
                              return id
                                ? api.adminPatchTemplateMultipart(id, fd)
                                : api.adminCreateTemplateMultipart(fd);
                            })()
                          : id
                            ? api.adminPatchTemplate(id, body)
                            : api.adminCreateTemplate(body),
                      )
                    }
                  />
                </AdminModal>
              )}
              {templates.length ? (
                <div className="admin-card-grid">
                  {templates.map((tpl, idx) => (
                    <article key={String(tpl.id)} className="admin-media-card">
                      <span className="admin-list-index" aria-hidden>
                        {idx + 1}
                      </span>
                      {tpl.bg_url_preview || tpl.bg_url ? (
                        <button
                          type="button"
                          className="admin-media-thumb"
                          onClick={() =>
                            setPreviewImage({
                              src: String(tpl.bg_url || tpl.bg_url_preview),
                              title: String(tpl.theme_name || ""),
                            })
                          }
                          aria-label={t("adminOpenImage")}
                        >
                          <img
                            src={String(tpl.bg_url_preview || tpl.bg_url)}
                            alt={String(tpl.theme_name)}
                          />
                        </button>
                      ) : (
                        <div className="admin-media-fallback">{t("adminEmpty")}</div>
                      )}
                      <div className="admin-media-body">
                        <strong>{String(tpl.theme_name)}</strong>
                        <span className="hint">
                          {String(tpl.event_slug)} ·{" "}
                          {tpl.is_active ? t("adminActive") : t("adminInactive")}
                        </span>
                        <div className="admin-actions">
                          <IconBtn
                            label="Test generate"
                            onClick={() =>
                              void run(`tpl-test-${String(tpl.id)}`, async () => {
                                const res = await api.adminTestTemplate(String(tpl.id));
                                setPreviewImage({
                                  src: res.result_url,
                                  title: String(tpl.theme_name || "Test"),
                                });
                              })
                            }
                          >
                            <IconExternal />
                          </IconBtn>
                          <IconBtn
                            label={t("adminEdit")}
                            onClick={() => setEditingTemplate({ ...tpl })}
                          >
                            <IconEdit />
                          </IconBtn>
                          <IconBtn
                            label={tpl.is_active ? t("adminDisable") : t("adminEnable")}
                            tone={tpl.is_active ? "danger" : "ok"}
                            onClick={() =>
                              void run(String(tpl.id), () =>
                                api.adminPatchTemplate(String(tpl.id), {
                                  is_active: !tpl.is_active,
                                }),
                              )
                            }
                          >
                            {tpl.is_active ? <IconBan /> : <IconPower />}
                          </IconBtn>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title={t("adminEmpty")} />
              )}
            </section>
          )}

          {tab === "moods" && (
            <section className="admin-section">
              <div className="admin-toolbar-row">
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={() =>
                    setEditingMood({
                      slug: "",
                      category: "style",
                      name_uz_latn: "",
                      name_uz_cyrl: "",
                      name_ru: "",
                      prompt_snippet: "",
                      sort_order: 0,
                    })
                  }
                >
                  {t("adminCreate")}
                </button>
              </div>
              {editingMood && (
                <AdminModal
                  title={`${editingMood.id ? t("adminEdit") : t("adminCreate")} — Mood`}
                  onClose={() => setEditingMood(null)}
                >
                  <MoodForm
                    initial={editingMood}
                    busy={!!actionBusy}
                    onCancel={() => setEditingMood(null)}
                    onSubmit={(body, id) =>
                      void run("mood", () =>
                        id ? api.adminPatchMoodTag(id, body) : api.adminCreateMoodTag(body),
                      )
                    }
                  />
                </AdminModal>
              )}
              <SimpleTable
                empty={t("adminEmpty")}
                rows={moods}
                columns={[
                  ["slug", "Slug"],
                  ["category", t("adminColCategory")],
                  ["prompt_snippet", "Prompt"],
                  ["is_active", t("adminColStatus")],
                ]}
                renderExtra={(row) => (
                  <div className="admin-actions">
                    <IconBtn
                      label={t("adminEdit")}
                      onClick={() => {
                        const names = (row.name_translations || {}) as Record<string, string>;
                        setEditingMood({
                          id: row.id,
                          slug: row.slug,
                          category: row.category,
                          prompt_snippet: row.prompt_snippet,
                          sort_order: row.sort_order,
                          icon_url: row.icon_url || "",
                          name_uz_latn: names["uz-latn"] || "",
                          name_uz_cyrl: names["uz-cyrl"] || "",
                          name_ru: names.ru || "",
                        });
                      }}
                    >
                      <IconEdit />
                    </IconBtn>
                    <IconBtn
                      label={row.is_active ? t("adminDisable") : t("adminEnable")}
                      tone={row.is_active ? "danger" : "ok"}
                      onClick={() =>
                        void run(String(row.id), () =>
                          api.adminPatchMoodTag(String(row.id), { is_active: !row.is_active }),
                        )
                      }
                    >
                      {row.is_active ? <IconBan /> : <IconPower />}
                    </IconBtn>
                  </div>
                )}
              />
            </section>
          )}

          {tab === "presets" && (
            <section className="admin-section">
              <div className="admin-toolbar-row">
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={() =>
                    setEditingPreset({
                      name: "",
                      event_slug: eventOptions[0] || "",
                      base_prompt: "",
                      negative_prompt: "",
                      model_params: '{"aspect_ratio":"4:5"}',
                    })
                  }
                >
                  {t("adminCreate")}
                </button>
              </div>
              {editingPreset && (
                <AdminModal
                  title={`${editingPreset.id ? t("adminEdit") : t("adminCreate")} — AI`}
                  onClose={() => setEditingPreset(null)}
                >
                  <PresetForm
                    initial={editingPreset}
                    eventOptions={eventOptions}
                    busy={!!actionBusy}
                    onCancel={() => setEditingPreset(null)}
                    onSubmit={(body, id) =>
                      void run("preset", () =>
                        id ? api.adminPatchAiPreset(id, body) : api.adminCreateAiPreset(body),
                      )
                    }
                  />
                </AdminModal>
              )}
              <SimpleTable
                empty={t("adminEmpty")}
                rows={presets}
                columns={[
                  ["name", t("adminColName")],
                  ["event_slug", t("adminColEvent")],
                  ["version", "Ver"],
                  ["is_active", t("adminColStatus")],
                ]}
                renderExtra={(row) => (
                  <div className="admin-actions">
                    <IconBtn
                      label="Test generate"
                      onClick={() =>
                        void run(`preset-test-${String(row.id)}`, async () => {
                          const res = await api.adminTestAiPreset(String(row.id));
                          setPreviewImage({
                            src: res.result_url,
                            title: String(row.name || "Test"),
                          });
                          await load();
                        })
                      }
                    >
                      <IconExternal />
                    </IconBtn>
                    <IconBtn
                      label={t("adminEdit")}
                      onClick={() =>
                        setEditingPreset({
                          id: row.id,
                          name: row.name,
                          event_slug: row.event_slug || "",
                          base_prompt: row.base_prompt || "",
                          negative_prompt: row.negative_prompt || "",
                          model_params: JSON.stringify(row.model_params || {}, null, 2),
                        })
                      }
                    >
                      <IconEdit />
                    </IconBtn>
                    <IconBtn
                      label={row.is_active ? t("adminDisable") : t("adminEnable")}
                      tone={row.is_active ? "danger" : "ok"}
                      onClick={() =>
                        void run(String(row.id), () =>
                          api.adminPatchAiPreset(String(row.id), { is_active: !row.is_active }),
                        )
                      }
                    >
                      {row.is_active ? <IconBan /> : <IconPower />}
                    </IconBtn>
                  </div>
                )}
              />
            </section>
          )}

          {tab === "limits" && (
            <section className="admin-section">
              <form
                className="admin-form admin-limits-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const perHour = Number(limitsHour);
                  const perDay = Number(limitsDay);
                  if (!Number.isFinite(perHour) || perHour < 0 || !Number.isInteger(perHour)) {
                    setError(t("adminLimitsInvalid"));
                    return;
                  }
                  if (!Number.isFinite(perDay) || perDay < 0 || !Number.isInteger(perDay)) {
                    setError(t("adminLimitsInvalid"));
                    return;
                  }
                  void run("limits", async () => {
                    const res = await api.adminPatchGenerationLimits({
                      per_hour: perHour,
                      per_day: perDay,
                    });
                    setLimitsHour(String(res.per_hour));
                    setLimitsDay(String(res.per_day));
                    setLimitsSavedAt(res.updated_at ? String(res.updated_at) : null);
                  });
                }}
              >
                <p className="hint">{t("adminLimitsHint")}</p>
                <div className="admin-form-grid">
                  <Field label={t("adminLimitsPerHour")}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={limitsHour}
                      onChange={(e) => setLimitsHour(e.target.value)}
                    />
                  </Field>
                  <Field label={t("adminLimitsPerDay")}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={limitsDay}
                      onChange={(e) => setLimitsDay(e.target.value)}
                    />
                  </Field>
                </div>
                {limitsSavedAt ? (
                  <p className="hint">
                    {t("adminLimitsUpdated")}: {formatDate(limitsSavedAt)}
                  </p>
                ) : null}
                <div className="admin-actions">
                  <button
                    type="submit"
                    className="admin-btn primary"
                    disabled={!!actionBusy}
                  >
                    {actionBusy === "limits" ? t("loading") : t("adminSave")}
                  </button>
                </div>
              </form>
            </section>
          )}

          {tab === "generations" && (
            <section className="admin-section">
              <div className="admin-filters">
                <UiSelect
                  size="sm"
                  aria-label={t("adminColStatus")}
                  value={genStatus}
                  onChange={(e) => setGenStatus(e.target.value)}
                >
                  <option value="">{t("adminColStatus")}</option>
                  <option value="success">success</option>
                  <option value="failed">failed</option>
                  <option value="processing">processing</option>
                </UiSelect>
                <button type="button" className="admin-btn" onClick={() => void load()}>
                  {t("adminSearch")}
                </button>
              </div>
              <SimpleTable
                empty={t("adminEmpty")}
                rows={generations}
                columns={[
                  ["status", t("adminColStatus")],
                  ["model", "Model"],
                  ["generation_path", "Path"],
                  ["provider_cost_usd", t("adminColCost")],
                  ["duration_ms", "ms"],
                  ["created_at", t("adminColCreated")],
                ]}
              />
            </section>
          )}

          {tab === "logs" && (
            <SimpleTable
              empty={t("adminEmpty")}
              rows={logs}
              columns={[
                ["level", "Level"],
                ["module", "Module"],
                ["message", t("adminColMessage")],
                ["created_at", t("adminColCreated")],
              ]}
            />
          )}

          {previewImage && (
            <AdminImageModal
              src={previewImage.src}
              title={previewImage.title || t("adminPreview")}
              onClose={() => setPreviewImage(null)}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function AdminTable({
  headers,
  children,
  empty,
  hasData,
}: {
  headers: string[];
  children: ReactNode;
  empty: string;
  hasData: boolean;
}) {
  const { t } = useTranslation();
  const allHeaders = [t("adminColIndex"), ...headers];
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {allHeaders.map((label) => (
              <th key={label} className={label === t("adminColIndex") ? "col-index" : undefined}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasData ? (
            Children.map(children, (child, idx) => {
              if (!isValidElement<{ children?: ReactNode }>(child)) return child;
              return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
                children: (
                  <>
                    <td className="col-index">{idx + 1}</td>
                    {child.props.children}
                  </>
                ),
              });
            })
          ) : (
            <tr>
              <td colSpan={allHeaders.length}>
                <div className="admin-empty">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({
  rows,
  columns,
  renderExtra,
  empty,
}: {
  rows: Array<Record<string, unknown>>;
  columns: Array<[string, string]>;
  renderExtra?: (row: Record<string, unknown>) => ReactNode;
  empty: string;
}) {
  const { t } = useTranslation();
  const colCount = columns.length + (renderExtra ? 1 : 0) + 1;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th className="col-index">{t("adminColIndex")}</th>
            {columns.map(([, label]) => (
              <th key={label}>{label}</th>
            ))}
            {renderExtra ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={String(row.id || idx)}>
              <td className="col-index">{idx + 1}</td>
              {columns.map(([key]) => (
                <td key={key}>
                  {key === "created_at" || key === "updated_at" || key === "expires_at"
                    ? formatDate(row[key])
                    : key === "status" || key === "is_active"
                      ? (
                          <StatusBadge
                            tone={
                              row[key] === true ||
                              row[key] === "ready" ||
                              row[key] === "success" ||
                              row[key] === "succeeded"
                                ? "ok"
                                : row[key] === false || row[key] === "failed"
                                  ? "danger"
                                  : "muted"
                            }
                          >
                            {formatCell(row[key])}
                          </StatusBadge>
                        )
                      : formatCell(row[key])}
                </td>
              ))}
              {renderExtra ? <td>{renderExtra(row)}</td> : null}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={colCount}>
                <div className="admin-empty">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EventForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: Record<string, unknown>;
  onSubmit: (body: Record<string, unknown>, id?: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let subtypes = [];
    let fields_schema = { required: [], optional: [] };
    try {
      subtypes = JSON.parse(String(form.subtypes || "[]"));
      fields_schema = JSON.parse(String(form.fields_schema || "{}"));
    } catch {
      return;
    }
    const body = {
      slug: form.slug,
      sort_order: Number(form.sort_order || 0),
      is_active: Boolean(form.is_active),
      icon_url: form.icon_url || null,
      name_translations: {
        "uz-cyrl": form.name_uz_cyrl || "",
        "uz-latn": form.name_uz_latn || "",
        ru: form.name_ru || "",
      },
      subtypes,
      fields_schema,
    };
    onSubmit(body, form.id ? String(form.id) : undefined);
  };

  return (
    <form className="admin-form" onSubmit={submit}>
      <h3>{form.id ? t("adminEdit") : t("adminCreate")} — {t("adminNavEvents")}</h3>
      <div className="admin-form-grid">
        <Field label="Slug">
          <input
            required
            disabled={!!form.id}
            value={String(form.slug || "")}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </Field>
        <Field label={t("adminColOrder")}>
          <input
            type="number"
            value={String(form.sort_order ?? 0)}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
          />
        </Field>
        <Field label="UZ Cyrl">
          <input
            value={String(form.name_uz_cyrl || "")}
            onChange={(e) => setForm({ ...form, name_uz_cyrl: e.target.value })}
          />
        </Field>
        <Field label="UZ Latn">
          <input
            value={String(form.name_uz_latn || "")}
            onChange={(e) => setForm({ ...form, name_uz_latn: e.target.value })}
          />
        </Field>
        <Field label="RU">
          <input
            value={String(form.name_ru || "")}
            onChange={(e) => setForm({ ...form, name_ru: e.target.value })}
          />
        </Field>
        <Field label="Icon URL">
          <input
            value={String(form.icon_url || "")}
            onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
          />
        </Field>
      </div>
      <Field label="subtypes (JSON)">
        <textarea
          rows={4}
          value={String(form.subtypes || "[]")}
          onChange={(e) => setForm({ ...form, subtypes: e.target.value })}
        />
      </Field>
      <Field label="fields_schema (JSON)">
        <textarea
          rows={5}
          value={String(form.fields_schema || "{}")}
          onChange={(e) => setForm({ ...form, fields_schema: e.target.value })}
        />
      </Field>
      <div className="admin-actions">
        <button type="submit" className="admin-btn primary" disabled={busy}>
          {t("adminSave")}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

function TextForm({
  initial,
  eventOptions,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: Record<string, unknown>;
  eventOptions: string[];
  onSubmit: (body: Record<string, unknown>, id?: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const vars = extractVars(String(form.preview_text || ""));
  const preview = String(form.preview_text || "")
    .replace(/\{event_date\}/g, "20.08.2026")
    .replace(/\{venue_name\}/g, "Navruz Hall")
    .replace(/\{venue_address\}/g, "Toshkent")
    .replace(/\{child_name\}/g, "Ali")
    .replace(/\{person_name\}/g, "Dilnoza");

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          {
            event_slug: form.event_slug,
            subtype_slug: form.subtype_slug || null,
            language: form.language,
            title: form.title,
            preview_text: form.preview_text,
            tone: form.tone || null,
          },
          form.id ? String(form.id) : undefined,
        );
      }}
    >
      <h3>{form.id ? t("adminEdit") : t("adminNewText")}</h3>
      <div className="admin-form-grid">
        <Field label={t("adminColEvent")}>
          <UiSelect
            value={String(form.event_slug || "")}
            onChange={(e) => setForm({ ...form, event_slug: e.target.value })}
          >
            {eventOptions.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </UiSelect>
        </Field>
        <Field label="subtype_slug">
          <input
            value={String(form.subtype_slug || "")}
            onChange={(e) => setForm({ ...form, subtype_slug: e.target.value })}
            placeholder="optional"
          />
        </Field>
        <Field label={t("adminColLang")}>
          <UiSelect
            value={String(form.language || "uz-latn")}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          >
            <option value="uz-cyrl">uz-cyrl</option>
            <option value="uz-latn">uz-latn</option>
            <option value="ru">ru</option>
          </UiSelect>
        </Field>
        <Field label={t("adminColTitle")}>
          <input
            required
            value={String(form.title || "")}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>
        <Field label="Tone">
          <input
            value={String(form.tone || "")}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("adminPreviewText")}>
        <textarea
          required
          rows={5}
          value={String(form.preview_text || "")}
          onChange={(e) => setForm({ ...form, preview_text: e.target.value })}
        />
      </Field>
      <p className="hint">
        variables: {vars.length ? vars.map((v) => `{${v}}`).join(", ") : "—"}
      </p>
      <div className="admin-preview-box">
        <strong>{t("adminPreview")}</strong>
        <pre>{preview}</pre>
      </div>
      <div className="admin-actions">
        <button type="submit" className="admin-btn primary" disabled={busy}>
          {t("adminSave")}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

function TemplateForm({
  initial,
  eventOptions,
  eventLabels,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: Record<string, unknown>;
  eventOptions: string[];
  eventLabels?: Record<string, string>;
  onSubmit: (body: Record<string, unknown>, id?: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const isCreate = !initial.id;
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eventSlugs, setEventSlugs] = useState<string[]>(() => {
    if (Array.isArray(initial.event_slugs)) {
      return initial.event_slugs.map(String);
    }
    return initial.event_slug ? [String(initial.event_slug)] : [];
  });

  useEffect(() => {
    setForm(initial);
    setFile(null);
    if (Array.isArray(initial.event_slugs)) {
      setEventSlugs(initial.event_slugs.map(String));
    } else {
      setEventSlugs(initial.event_slug ? [String(initial.event_slug)] : []);
    }
  }, [initial]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const toggleEvent = (slug: string) => {
    setEventSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const allSelected =
    eventOptions.length > 0 && eventOptions.every((s) => eventSlugs.includes(s));

  const labelFor = (slug: string) => eventLabels?.[slug] || slug;
  const existingPreview =
    previewUrl ||
    (typeof form.bg_url_preview === "string" && form.bg_url_preview
      ? form.bg_url_preview
      : typeof form.bg_url === "string" && form.bg_url
        ? form.bg_url
        : null);

  const canSave =
    !busy &&
    Boolean(String(form.theme_name || "").trim()) &&
    (isCreate ? eventSlugs.length > 0 : Boolean(form.event_slug)) &&
    (Boolean(file) || Boolean(String(form.bg_url || "").trim()));

  return (
    <form
      className="admin-form admin-tpl-form"
      onSubmit={(e) => {
        e.preventDefault();
        const selected = isCreate
          ? eventSlugs.filter((s) => eventOptions.includes(s))
          : [String(form.event_slug || "")].filter(Boolean);
        if (!selected.length) return;
        onSubmit(
          {
            event_slug: selected[0],
            event_slugs: selected,
            subtype_slug: form.subtype_slug || null,
            theme_name: form.theme_name,
            bg_url: form.bg_url,
            bg_url_preview: form.bg_url_preview || form.bg_url,
            ai_composition_prompt: form.ai_composition_prompt,
            style_tags: form.style_tags || [],
            color_palette: form.color_palette || [],
            mood_tags: form.mood_tags || [],
            dominant_colors: form.dominant_colors || [],
            supported_formats: form.supported_formats || ["4:5", "9:16", "1:1"],
            is_featured: Boolean(form.is_featured),
            is_active: form.is_active !== false,
            __file: file,
          },
          form.id ? String(form.id) : undefined,
        );
      }}
    >
      <div className="admin-tpl-stack">
        <div className="admin-tpl-upload">
          <button
            type="button"
            className={`admin-tpl-dropzone ${existingPreview ? "has-preview" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {existingPreview ? (
              <img src={existingPreview} alt="" className="admin-tpl-drop-preview" />
            ) : (
              <div className="admin-tpl-drop-empty">
                <strong>{t("adminTplUploadTitle")}</strong>
                <span>{t("adminTplUploadHint")}</span>
              </div>
            )}
            <span className="admin-tpl-drop-cta">
              {file ? t("adminTplChangeFile") : t("adminTplChooseFile")}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="admin-tpl-file-input"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <p className="admin-tpl-file-name">{file.name}</p>
          ) : null}
        </div>

        <Field label={t("adminColTheme")}>
          <input
            required
            value={String(form.theme_name || "")}
            onChange={(e) => setForm({ ...form, theme_name: e.target.value })}
            placeholder={t("adminTplThemePlaceholder")}
          />
        </Field>

        <div className="admin-tpl-section">
          <div className="admin-tpl-section-head">
            <span>{t("adminColEvent")}</span>
            {isCreate ? (
              <button
                type="button"
                className="admin-tpl-link"
                onClick={() => setEventSlugs(allSelected ? [] : [...eventOptions])}
              >
                {allSelected ? t("adminClearEvents") : t("adminSelectAllEvents")}
              </button>
            ) : null}
          </div>
          {isCreate ? (
            <>
              <div
                className="admin-event-multi-list"
                role="group"
                aria-label={t("adminColEvent")}
              >
                {eventOptions.map((slug) => {
                  const checked = eventSlugs.includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      className={`admin-event-pill ${checked ? "is-on" : ""}`}
                      aria-pressed={checked}
                      onClick={() => toggleEvent(slug)}
                    >
                      {labelFor(slug)}
                    </button>
                  );
                })}
              </div>
              {!eventSlugs.length ? (
                <p className="admin-event-multi-hint">{t("adminPickEvents")}</p>
              ) : (
                <p className="hint admin-tpl-count">
                  {t("adminTplEventsPicked", {
                    count: eventSlugs.length,
                    total: eventOptions.length,
                  })}
                </p>
              )}
            </>
          ) : (
            <UiSelect
              value={String(form.event_slug || "")}
              onChange={(e) => setForm({ ...form, event_slug: e.target.value })}
            >
              {eventOptions.map((slug) => (
                <option key={slug} value={slug}>
                  {labelFor(slug)}
                </option>
              ))}
            </UiSelect>
          )}
        </div>

        <Field label={t("adminTplPrompt")}>
          <textarea
            rows={3}
            value={String(form.ai_composition_prompt || "")}
            onChange={(e) =>
              setForm({ ...form, ai_composition_prompt: e.target.value })
            }
          />
        </Field>
        <Field label={t("adminTplBgUrl")}>
          <input
            value={String(form.bg_url || "")}
            onChange={(e) => setForm({ ...form, bg_url: e.target.value })}
            placeholder="/media/…"
          />
        </Field>
        <Field label={t("adminTplPreviewUrl")}>
          <input
            value={String(form.bg_url_preview || "")}
            onChange={(e) =>
              setForm({ ...form, bg_url_preview: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="admin-actions">
        <button type="submit" className="admin-btn primary" disabled={!canSave}>
          {busy ? t("loading") : t("adminSave")}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

function MoodForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: Record<string, unknown>;
  onSubmit: (body: Record<string, unknown>, id?: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          {
            slug: form.slug,
            category: form.category,
            prompt_snippet: form.prompt_snippet,
            sort_order: Number(form.sort_order || 0),
            name_translations: {
              "uz-cyrl": form.name_uz_cyrl || "",
              "uz-latn": form.name_uz_latn || "",
              ru: form.name_ru || "",
            },
            icon_url: form.icon_url || null,
          },
          form.id ? String(form.id) : undefined,
        );
      }}
    >
      <h3>{form.id ? t("adminEdit") : t("adminCreate")} — Mood</h3>
      <div className="admin-form-grid">
        <Field label="Slug">
          <input
            required
            value={String(form.slug || "")}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </Field>
        <Field label={t("adminColCategory")}>
          <UiSelect
            value={String(form.category || "style")}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="color">color</option>
            <option value="flowers">flowers</option>
            <option value="style">style</option>
            <option value="texture">texture</option>
          </UiSelect>
        </Field>
        <Field label="UZ Latn">
          <input
            value={String(form.name_uz_latn || "")}
            onChange={(e) => setForm({ ...form, name_uz_latn: e.target.value })}
          />
        </Field>
        <Field label="UZ Cyrl">
          <input
            value={String(form.name_uz_cyrl || "")}
            onChange={(e) => setForm({ ...form, name_uz_cyrl: e.target.value })}
          />
        </Field>
        <Field label="RU">
          <input
            value={String(form.name_ru || "")}
            onChange={(e) => setForm({ ...form, name_ru: e.target.value })}
          />
        </Field>
        <Field label={t("adminColOrder")}>
          <input
            type="number"
            value={String(form.sort_order ?? 0)}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
          />
        </Field>
        <Field label="icon_url">
          <input
            value={String(form.icon_url || "")}
            onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
          />
        </Field>
      </div>
      <Field label="prompt_snippet">
        <textarea
          required
          rows={3}
          value={String(form.prompt_snippet || "")}
          onChange={(e) => setForm({ ...form, prompt_snippet: e.target.value })}
        />
      </Field>
      <div className="admin-actions">
        <button type="submit" className="admin-btn primary" disabled={busy}>
          {t("adminSave")}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

function PresetForm({
  initial,
  eventOptions,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: Record<string, unknown>;
  eventOptions: string[];
  onSubmit: (body: Record<string, unknown>, id?: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        let model_params = {};
        try {
          model_params = JSON.parse(String(form.model_params || "{}"));
        } catch {
          return;
        }
        onSubmit(
          {
            name: form.name,
            event_slug: form.event_slug || null,
            base_prompt: form.base_prompt,
            negative_prompt: form.negative_prompt || null,
            model_params,
          },
          form.id ? String(form.id) : undefined,
        );
      }}
    >
      <h3>{form.id ? t("adminEdit") : t("adminCreate")} — AI preset</h3>
      <div className="admin-form-grid">
        <Field label={t("adminColName")}>
          <input
            required
            value={String(form.name || "")}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t("adminColEvent")}>
          <UiSelect
            value={String(form.event_slug || "")}
            onChange={(e) => setForm({ ...form, event_slug: e.target.value })}
          >
            <option value="">—</option>
            {eventOptions.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </UiSelect>
        </Field>
      </div>
      <Field label="base_prompt">
        <textarea
          required
          rows={5}
          value={String(form.base_prompt || "")}
          onChange={(e) => setForm({ ...form, base_prompt: e.target.value })}
        />
      </Field>
      <p className="hint">
        Placeholders: {"{mood_snippets} {header_text} {body_text} {date_time_text} {address_text}"}
      </p>
      <Field label="negative_prompt">
        <textarea
          rows={2}
          value={String(form.negative_prompt || "")}
          onChange={(e) => setForm({ ...form, negative_prompt: e.target.value })}
        />
      </Field>
      <Field label="model_params (JSON)">
        <textarea
          rows={3}
          value={String(form.model_params || "{}")}
          onChange={(e) => setForm({ ...form, model_params: e.target.value })}
        />
      </Field>
      <div className="admin-actions">
        <button type="submit" className="admin-btn primary" disabled={busy}>
          {t("adminSave")}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}
