import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  IconBtn,
  IconEdit,
  IconExternal,
  IconPower,
  IconTrash,
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

export default function AdminPage() {
  const { t } = useTranslation();
  const { user, loginDev, loginAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const [editingEvent, setEditingEvent] = useState<Record<string, unknown> | null>(null);
  const [editingText, setEditingText] = useState<Record<string, unknown> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Record<string, unknown> | null>(null);
  const [editingMood, setEditingMood] = useState<Record<string, unknown> | null>(null);
  const [editingPreset, setEditingPreset] = useState<Record<string, unknown> | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

  useEffect(() => {
    if (tab !== "texts") return;
    if (textsEventSlug) return;
    if (!eventOptions.length) return;
    // Default to first available event for a “single list” UX.
    setTextsEventSlug(eventOptions[0]);
  }, [tab, textsEventSlug, eventOptions]);

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
      {sidebarOpen && (
        <button
          type="button"
          className="admin-backdrop"
          aria-label="Close"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
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
                      setSidebarOpen(false);
                      setShowCreate(false);
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <span>{user.first_name || user.username || "Admin"}</span>
          <small>{t("adminRoleBadge")}</small>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-btn ghost"
              onClick={() => setSidebarOpen(true)}
              aria-label="Menu"
            >
              <span className="admin-menu-icon" aria-hidden />
            </button>
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
                  ["language", t("adminColLang")],
                  ["created_at", t("adminColCreated")],
                ]}
                renderExtra={(row) =>
                  row.final_image_url ? (
                    <a
                      className="icon-btn"
                      href={String(row.final_image_url)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("adminOpenImage")}
                      title={t("adminOpenImage")}
                    >
                      <IconExternal />
                    </a>
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
                          {e.is_active ? <IconTrash /> : <IconPower />}
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
                            {row.is_active ? <IconTrash /> : <IconPower />}
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
                <TemplateForm
                  initial={editingTemplate}
                  eventOptions={eventOptions}
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
              )}
              {templates.length ? (
                <div className="admin-card-grid">
                  {templates.map((tpl) => (
                    <article key={String(tpl.id)} className="admin-media-card">
                      {tpl.bg_url_preview ? (
                        <img src={String(tpl.bg_url_preview)} alt={String(tpl.theme_name)} />
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
                                window.open(res.result_url, "_blank");
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
                            {tpl.is_active ? <IconTrash /> : <IconPower />}
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
                      {row.is_active ? <IconTrash /> : <IconPower />}
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
                          window.open(res.result_url, "_blank");
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
                      {row.is_active ? <IconTrash /> : <IconPower />}
                    </IconBtn>
                  </div>
                )}
              />
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
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasData ? (
            children
          ) : (
            <tr>
              <td colSpan={headers.length}>
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
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map(([, label]) => (
              <th key={label}>{label}</th>
            ))}
            {renderExtra ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={String(row.id || idx)}>
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
              <td colSpan={columns.length + (renderExtra ? 1 : 0)}>
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
        <button type="button" className="ghost" onClick={onCancel}>
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
        <button type="button" className="ghost" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}

function TemplateForm({
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
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    setForm(initial);
    setFile(null);
  }, [initial]);

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          {
            event_slug: form.event_slug,
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
      <h3>{form.id ? t("adminEdit") : t("adminCreate")} — JPG</h3>
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
        <Field label={t("adminColTheme")}>
          <input
            required
            value={String(form.theme_name || "")}
            onChange={(e) => setForm({ ...form, theme_name: e.target.value })}
          />
        </Field>
        <Field label="bg_url">
          <input
            required
            value={String(form.bg_url || "")}
            onChange={(e) => setForm({ ...form, bg_url: e.target.value })}
          />
        </Field>
        <Field label="bg_url_preview">
          <input
            value={String(form.bg_url_preview || "")}
            onChange={(e) => setForm({ ...form, bg_url_preview: e.target.value })}
          />
        </Field>
        <Field label="JPG file (multipart)">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Field>
      </div>
      <Field label="ai_composition_prompt">
        <textarea
          rows={4}
          value={String(form.ai_composition_prompt || "")}
          onChange={(e) => setForm({ ...form, ai_composition_prompt: e.target.value })}
        />
      </Field>
      <div className="admin-actions">
        <button type="submit" className="admin-btn primary" disabled={busy}>
          {t("adminSave")}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
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
        <button type="button" className="ghost" onClick={onCancel}>
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
        <button type="button" className="ghost" onClick={onCancel}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}
