import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { IconBan, IconBtn, IconEye, IconPower, IconSearch, IconSessions } from "../components/ActionIcons";
import {
  formatDisplayDateTimeStamp,
  formatRelativeTime,
  formatSessionActivity,
} from "../utils/date";
import UiSelect from "../components/UiSelect";

const PAGE_SIZE = 20;

type UserRow = Record<string, unknown>;
type UserDetail = {
  user: Record<string, unknown>;
  sessions?: Array<Record<string, unknown>>;
  invitations: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
};
type DrawerTab = "profile" | "sessions" | "invitations" | "history";

export type AdminUsersSectionHandle = { refresh: () => void };

type Props = {
  onError: (message: string | null) => void;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function userDisplayName(u: UserRow): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || "—";
}

function userInitials(u: UserRow): string {
  const first = String(u.first_name || "").trim();
  const last = String(u.last_name || "").trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (u.username) return String(u.username).slice(0, 2).toUpperCase();
  return "?";
}

function parseUserAgent(ua: string): { browser: string; os: string } {
  if (!ua) return { browser: "—", os: "" };
  let browser = "—";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  let os = "";
  if (/iPhone|iPad/i.test(ua)) os = /iPad/i.test(ua) ? "iPad" : "iPhone";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";
  return { browser, os };
}

function langLabel(code: unknown, t: (k: string) => string): string {
  const map: Record<string, string> = {
    "uz-latn": t("adminLangUzLatn"),
    "uz-cyrl": t("adminLangUzCyrl"),
    ru: t("adminLangRu"),
  };
  return map[String(code || "")] || String(code || "—");
}

function userStatus(u: UserRow): "banned" | "inactive" | "active" {
  if (u.is_banned) return "banned";
  if (u.is_active === false) return "inactive";
  return "active";
}

function lastActivityAt(u: UserRow): unknown {
  return u.last_login_at || u.updated_at || u.created_at;
}

function formatCount(n: number): string {
  return n.toLocaleString("uz-UZ");
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

function UsersTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="admin-users-table-wrap" aria-hidden>
      <table className="admin-table admin-users-table">
        <thead>
          <tr>
            {Array.from({ length: 7 }).map((_, i) => (
              <th key={i}>
                <div className="admin-users-skeleton cell" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: 7 }).map((_, c) => (
                <td key={c}>
                  <div
                    className={`admin-users-skeleton cell ${c === 0 ? "wide" : ""}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="admin-users-drawer-body" aria-hidden>
      <div className="admin-users-skeleton block lg" />
      <div className="admin-users-skeleton block" />
      <div className="admin-users-skeleton block" />
      <div className="admin-users-skeleton block wide" />
    </div>
  );
}

function UserAvatar({ user }: { user: UserRow }) {
  const photo = user.photo_url ? String(user.photo_url) : "";
  if (photo) {
    return (
      <img
        className="admin-users-avatar"
        src={photo}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  return <span className="admin-users-avatar fallback">{userInitials(user)}</span>;
}

function RoleBadge({ role }: { role: unknown }) {
  const isAdmin = role === "admin";
  return (
    <span className={`admin-users-pill role ${isAdmin ? "admin" : "user"}`}>
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}

function StatusBadge({ status, t }: { status: "active" | "inactive" | "banned"; t: (k: string) => string }) {
  const labels = {
    active: t("adminStatusActive"),
    inactive: t("adminStatusInactive"),
    banned: t("adminStatusBanned"),
  };
  return (
    <span className={`admin-users-pill status ${status}`}>
      <span className="admin-users-status-dot" aria-hidden />
      {labels[status]}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-users-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function MetaCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-users-meta-card">
      <h3>{title}</h3>
      <dl className="admin-users-meta">{children}</dl>
    </section>
  );
}

function InviteStatusBadge({ status }: { status: unknown }) {
  const value = String(status || "—");
  const tone =
    value === "ready" || value === "success"
      ? "ok"
      : value === "failed" || value === "error"
        ? "danger"
        : "muted";
  return <span className={`admin-users-invite-pill ${tone}`}>{value}</span>;
}

function UsersEmptyBlock({
  filtersActive,
  t,
  onClear,
}: {
  filtersActive: boolean;
  t: (k: string) => string;
  onClear?: () => void;
}) {
  return (
    <div className="admin-users-empty">
      <div className="admin-users-empty-icon" aria-hidden>
        <IconSearch />
      </div>
      <strong>{filtersActive ? t("adminUsersNoResults") : t("adminUsersEmpty")}</strong>
      {filtersActive ? (
        <>
          <p>{t("adminUsersEmptyHint")}</p>
          {onClear ? (
            <button type="button" className="admin-btn" onClick={onClear}>
              {t("adminClearFilters")}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RowActions({
  user,
  onViewProfile,
  onViewSessions,
  onToggleBan,
  busy,
  t,
}: {
  user: UserRow;
  onViewProfile: () => void;
  onViewSessions: () => void;
  onToggleBan: () => void;
  busy: boolean;
  t: (k: string) => string;
}) {
  const banned = Boolean(user.is_banned);

  return (
    <div className="admin-users-row-actions">
      <IconBtn
        label={t("adminActionViewProfile")}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onViewProfile();
        }}
      >
        <IconEye />
      </IconBtn>
      <IconBtn
        label={t("adminActionViewSessions")}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onViewSessions();
        }}
      >
        <IconSessions />
      </IconBtn>
      <IconBtn
        label={banned ? t("adminActionUnban") : t("adminActionBan")}
        tone={banned ? "ok" : "danger"}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onToggleBan();
        }}
      >
        {banned ? <IconPower /> : <IconBan />}
      </IconBtn>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="admin-users-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-users-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-users-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="admin-users-confirm-title">{title}</h3>
        <p>{body}</p>
        <div className="admin-users-modal-actions">
          <button type="button" className="admin-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`admin-btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const AdminUsersSection = forwardRef<AdminUsersSectionHandle, Props>(function AdminUsersSection(
  { onError },
  ref,
) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("profile");
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmBan, setConfirmBan] = useState<UserRow | null>(null);
  const [confirmRole, setConfirmRole] = useState<UserRow | null>(null);

  const filtersActive = Boolean(searchInput || roleFilter || statusFilter);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const loadUsers = useCallback(async () => {
    setListLoading(true);
    onError(null);
    try {
      const data = await api.adminUsers({
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setUsers(data.results);
      setTotalCount(data.count);
      if (data.page !== page) setPage(data.page);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Admin load failed");
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, roleFilter, statusFilter, page, onError]);

  useImperativeHandle(ref, () => ({ refresh: () => void loadUsers() }), [loadUsers]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null);
      return;
    }
    setDetailLoading(true);
    void api
      .adminGetUser(selectedUserId)
      .then(setUserDetail)
      .catch((err: Error) => onError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedUserId, onError]);

  useEffect(() => {
    if (!selectedUserId) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setSelectedUserId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId && !confirmBan && !confirmRole) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedUserId, confirmBan, confirmRole]);

  const clearFilters = () => {
    setSearchInput("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const openUser = (id: string, tab: DrawerTab = "profile") => {
    setDrawerTab(tab);
    setSelectedUserId(id);
  };

  const patchUser = async (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) => {
    setActionBusy(key);
    onError(null);
    try {
      await api.adminPatchUser(id, body);
      await loadUsers();
      if (selectedUserId === id) {
        setUserDetail(await api.adminGetUser(id));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  const handleToggleRole = (u: UserRow) => {
    setConfirmRole(u);
  };

  const handleToggleBan = (u: UserRow) => {
    if (u.is_banned) {
      void patchUser(String(u.id), { is_banned: false, ban_reason: "" }, "ban");
      return;
    }
    setConfirmBan(u);
  };

  const drawerUser = userDetail?.user;
  const activeSessions = useMemo(
    () => (userDetail?.sessions || []).filter((s) => s.is_active),
    [userDetail?.sessions],
  );

  const tabCounts = useMemo(
    () => ({
      sessions: userDetail?.sessions?.length ?? 0,
      invitations: userDetail?.invitations.length ?? 0,
      history: userDetail?.history.length ?? 0,
    }),
    [userDetail],
  );

  const stopRowClick = (e: MouseEvent) => e.stopPropagation();

  return (
    <section className="admin-section admin-users-section">
      <div className="admin-users-summary">
        <div className="admin-users-summary-main">
          <strong>{formatCount(totalCount)}</strong>
          <span>{t("adminUsersTotalLabel")}</span>
        </div>
        {filtersActive && (
          <span className="admin-users-summary-filtered">{t("adminUsersFiltered")}</span>
        )}
        {listLoading && users.length > 0 && (
          <span className="admin-users-summary-loading">{t("loading")}</span>
        )}
      </div>

      <div className={`admin-users-toolbar ${filtersActive ? "has-filters" : ""}`}>
        <div className="admin-users-search">
          <span className="admin-users-search-icon" aria-hidden>
            <IconSearch />
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("adminUsersSearchPlaceholder")}
            aria-label={t("adminUsersSearchPlaceholder")}
          />
          {searchInput ? (
            <button
              type="button"
              className="admin-users-search-clear"
              aria-label={t("adminClearSearch")}
              onClick={() => setSearchInput("")}
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="admin-users-filter-group">
          <UiSelect
            size="sm"
            aria-label={t("adminColRole")}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={roleFilter ? "is-active" : undefined}
          >
            <option value="">{t("adminFilterAllRoles")}</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </UiSelect>
          <UiSelect
            size="sm"
            aria-label={t("adminColStatus")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={statusFilter ? "is-active" : undefined}
          >
            <option value="">{t("adminFilterAllStatus")}</option>
            <option value="active">{t("adminStatusActive")}</option>
            <option value="inactive">{t("adminStatusInactive")}</option>
            <option value="banned">{t("adminStatusBanned")}</option>
          </UiSelect>
        </div>
        {filtersActive && (
          <button type="button" className="admin-users-clear" onClick={clearFilters}>
            {t("adminClearFilters")}
          </button>
        )}
      </div>

      {filtersActive && (
        <div className="admin-users-chips" aria-label={t("adminColStatus")}>
          {searchInput ? (
            <button type="button" className="admin-users-chip" onClick={() => setSearchInput("")}>
              {searchInput} ×
            </button>
          ) : null}
          {roleFilter ? (
            <button type="button" className="admin-users-chip" onClick={() => setRoleFilter("")}>
              {t("adminColRole")}: {roleFilter} ×
            </button>
          ) : null}
          {statusFilter ? (
            <button type="button" className="admin-users-chip" onClick={() => setStatusFilter("")}>
              {t("adminColStatus")}:{" "}
              {statusFilter === "active"
                ? t("adminStatusActive")
                : statusFilter === "inactive"
                  ? t("adminStatusInactive")
                  : t("adminStatusBanned")}{" "}
              ×
            </button>
          ) : null}
        </div>
      )}

      <div className="admin-users-layout">
        <div className="admin-users-main">
          {listLoading && !users.length ? (
            <UsersTableSkeleton />
          ) : (
            <>
              <div className="admin-users-table-wrap">
                <table className="admin-table admin-users-table">
                  <thead>
                    <tr>
                      <th>{t("adminColUser")}</th>
                      <th className="hide-tablet">Telegram</th>
                      <th>{t("adminColRole")}</th>
                      <th>{t("adminColStatus")}</th>
                      <th>{t("adminColLastActivity")}</th>
                      <th className="num">{t("adminColInvites")}</th>
                      <th className="actions-col">{t("adminColActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length ? (
                      users.map((u) => {
                        const id = String(u.id);
                        const status = userStatus(u);
                        const activity = lastActivityAt(u);
                        const selected = selectedUserId === id;
                        return (
                          <tr
                            key={id}
                            className={selected ? "is-selected" : ""}
                            tabIndex={0}
                            onClick={() => openUser(id)}
                            onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openUser(id);
                              }
                            }}
                          >
                            <td>
                              <div className="admin-users-user-cell">
                                <UserAvatar user={u} />
                                <div>
                                  <strong>{userDisplayName(u)}</strong>
                                  {u.username ? (
                                    <span className="muted">@{String(u.username)}</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="admin-users-mobile-meta">
                                <span className="mono">{String(u.telegram_id)}</span>
                                <span>{String(u.invitation_count ?? 0)} {t("adminColInvites").toLowerCase()}</span>
                              </div>
                            </td>
                            <td className="mono muted hide-tablet">{String(u.telegram_id)}</td>
                            <td>
                              <RoleBadge role={u.role} />
                            </td>
                            <td>
                              <StatusBadge status={status} t={t} />
                            </td>
                            <td className="activity-col">
                              <span
                                className="admin-users-relative"
                                title={formatDisplayDateTimeStamp(activity)}
                              >
                                {activity ? formatRelativeTime(activity, lang) : "—"}
                              </span>
                              {activity ? (
                                <span className="admin-users-activity-exact">
                                  {formatDisplayDateTimeStamp(activity)}
                                </span>
                              ) : null}
                            </td>
                            <td className="num">
                              <span className="admin-users-count-pill">
                                {String(u.invitation_count ?? 0)}
                              </span>
                            </td>
                            <td className="actions-col" onClick={stopRowClick}>
                              <RowActions
                                user={u}
                                busy={!!actionBusy}
                                t={t}
                                onViewProfile={() => openUser(id, "profile")}
                                onViewSessions={() => openUser(id, "sessions")}
                                onToggleBan={() => handleToggleBan(u)}
                              />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7}>
                          <UsersEmptyBlock
                            filtersActive={filtersActive}
                            t={t}
                            onClear={clearFilters}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="admin-users-cards" aria-label={t("adminNavUsers")}>
                {users.length ? (
                  users.map((u) => {
                    const id = String(u.id);
                    const status = userStatus(u);
                    const activity = lastActivityAt(u);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`admin-users-card ${selectedUserId === id ? "is-selected" : ""}`}
                        onClick={() => openUser(id)}
                      >
                        <div className="admin-users-user-cell">
                          <UserAvatar user={u} />
                          <div>
                            <strong>{userDisplayName(u)}</strong>
                            {u.username ? (
                              <span className="muted">@{String(u.username)}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="admin-users-card-meta">
                          <RoleBadge role={u.role} />
                          <StatusBadge status={status} t={t} />
                        </div>
                        <div className="admin-users-card-foot">
                          <span title={formatDisplayDateTimeStamp(activity)}>
                            {activity ? formatRelativeTime(activity, lang) : "—"}
                          </span>
                          <span className="mono">
                            {String(u.invitation_count ?? 0)} · {String(u.telegram_id)}
                          </span>
                        </div>
                        <div className="admin-users-card-actions" onClick={stopRowClick}>
                          <RowActions
                            user={u}
                            busy={!!actionBusy}
                            t={t}
                            onViewProfile={() => openUser(id, "profile")}
                            onViewSessions={() => openUser(id, "sessions")}
                            onToggleBan={() => handleToggleBan(u)}
                          />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  !listLoading && (
                    <UsersEmptyBlock
                      filtersActive={filtersActive}
                      t={t}
                      onClear={clearFilters}
                    />
                  )
                )}
              </div>

              {totalCount > 0 && (
                <footer className="admin-users-pagination">
                  <span className="admin-users-page-info">
                    {t("adminUsersPageInfo", {
                      start: formatCount(rangeStart),
                      end: formatCount(rangeEnd),
                      total: formatCount(totalCount),
                    })}
                  </span>
                  {totalPages > 1 && (
                  <nav className="admin-users-page-nav" aria-label={t("adminPagination")}>
                    <button
                      type="button"
                      className="admin-users-page-btn"
                      disabled={page <= 1 || listLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label={t("adminPrevPage")}
                    >
                      ‹
                    </button>
                    {pageNumbers(page, totalPages).map((p, idx) =>
                      p === "…" ? (
                        <span key={`ellipsis-${idx}`} className="admin-users-ellipsis">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={`admin-users-page-btn ${p === page ? "is-current" : ""}`}
                          disabled={listLoading}
                          onClick={() => setPage(p)}
                          aria-current={p === page ? "page" : undefined}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      className="admin-users-page-btn"
                      disabled={page >= totalPages || listLoading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label={t("adminNextPage")}
                    >
                      ›
                    </button>
                  </nav>
                  )}
                </footer>
              )}
            </>
          )}
          {listLoading && users.length > 0 && (
            <div className="admin-users-loading-overlay" aria-hidden />
          )}
        </div>

        {selectedUserId && (
          <div
            className="admin-users-detail-overlay"
            role="presentation"
            onClick={() => setSelectedUserId(null)}
          >
            <aside
              className="admin-users-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-users-drawer-title"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="admin-users-drawer-head">
                <div className="admin-users-drawer-identity">
                  {drawerUser ? <UserAvatar user={drawerUser} /> : null}
                  <div>
                    <h2 id="admin-users-drawer-title">
                      {drawerUser ? userDisplayName(drawerUser) : "—"}
                    </h2>
                    <div className="admin-users-drawer-sub">
                      {drawerUser?.username ? (
                        <span className="hint">@{String(drawerUser.username)}</span>
                      ) : null}
                      {drawerUser ? (
                        <StatusBadge status={userStatus(drawerUser)} t={t} />
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="ghost admin-users-close"
                  aria-label={t("adminCloseDrawer")}
                  onClick={() => setSelectedUserId(null)}
                >
                  ×
                </button>
              </header>

              <div className="admin-users-tabs" role="tablist">
                {(
                  [
                    ["profile", "adminTabProfile", null],
                    ["sessions", "adminTabSessions", tabCounts.sessions],
                    ["invitations", "adminTabInvitations", tabCounts.invitations],
                    ["history", "adminTabHistory", tabCounts.history],
                  ] as Array<[DrawerTab, string, number | null]>
                ).map(([id, key, count]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === id}
                    className={drawerTab === id ? "is-active" : ""}
                    onClick={() => setDrawerTab(id)}
                  >
                    {t(key)}
                    {count != null && count > 0 ? (
                      <span className="admin-users-tab-count">{count}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              {detailLoading || !userDetail ? (
                <DrawerSkeleton />
              ) : (
                <div className="admin-users-drawer-body">
                  {drawerTab === "profile" && (
                    <>
                      <MetaCard title={t("adminSectionProfile")}>
                        <MetaRow label={t("adminColName")} value={userDisplayName(drawerUser!)} />
                        <MetaRow
                          label="Username"
                          value={
                            drawerUser?.username
                              ? `@${String(drawerUser.username)}`
                              : "—"
                          }
                        />
                        <MetaRow
                          label="Telegram ID"
                          value={String(drawerUser?.telegram_id ?? "—")}
                        />
                        <MetaRow
                          label={t("adminColPhone")}
                          value={String(drawerUser?.phone || "—")}
                        />
                        <MetaRow
                          label={t("adminColLang")}
                          value={langLabel(drawerUser?.language, t)}
                        />
                      </MetaCard>

                      <MetaCard title={t("adminSectionAccount")}>
                        <MetaRow label={t("adminColRole")} value={String(drawerUser?.role ?? "—")} />
                        <MetaRow
                          label={t("adminColStatus")}
                          value={
                            userStatus(drawerUser!) === "banned"
                              ? t("adminStatusBanned")
                              : userStatus(drawerUser!) === "inactive"
                                ? t("adminStatusInactive")
                                : t("adminStatusActive")
                          }
                        />
                        <MetaRow
                          label={t("adminColRegistered")}
                          value={formatDisplayDateTimeStamp(drawerUser?.created_at)}
                        />
                        <MetaRow
                          label={t("adminColLastLogin")}
                          value={
                            drawerUser?.last_login_at
                              ? formatDisplayDateTimeStamp(drawerUser.last_login_at)
                              : "—"
                          }
                        />
                        <MetaRow
                          label={t("adminColUpdated")}
                          value={formatDisplayDateTimeStamp(drawerUser?.updated_at)}
                        />
                      </MetaCard>

                      <div className="admin-users-drawer-actions">
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={!!actionBusy}
                          onClick={() => handleToggleRole(drawerUser!)}
                        >
                          {drawerUser?.role === "admin"
                            ? t("adminMakeUser")
                            : t("adminMakeAdmin")}
                        </button>
                        <button
                          type="button"
                          className={`admin-btn ${drawerUser?.is_banned ? "" : "danger"}`}
                          disabled={!!actionBusy}
                          onClick={() => handleToggleBan(drawerUser!)}
                        >
                          {drawerUser?.is_banned ? t("adminActionUnban") : t("adminActionBan")}
                        </button>
                      </div>
                    </>
                  )}

                  {drawerTab === "sessions" && (
                    <section className="admin-users-drawer-section">
                      <h3>{t("adminColSessions")}</h3>
                      {activeSessions.length ? (
                        <ul className="admin-users-session-list">
                          {activeSessions.map((s) => {
                            const { browser, os } = parseUserAgent(String(s.user_agent || ""));
                            const label = [browser, os].filter(Boolean).join(" · ");
                            return (
                              <li key={String(s.id)} className="admin-users-session-card">
                                <strong>{label || "—"}</strong>
                                <span className="mono muted">{String(s.ip_address || "—")}</span>
                                <span className="muted">
                                  {formatSessionActivity(s.created_at, lang)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="admin-users-tab-empty">{t("adminSessionsEmpty")}</p>
                      )}

                      {(userDetail.sessions || []).some((s) => !s.is_active) && (
                        <>
                          <h3 className="sub">{t("adminPastSessions")}</h3>
                          <ul className="admin-users-session-list muted-list">
                            {(userDetail.sessions || [])
                              .filter((s) => !s.is_active)
                              .map((s) => {
                                const { browser, os } = parseUserAgent(String(s.user_agent || ""));
                                const label = [browser, os].filter(Boolean).join(" · ");
                                return (
                                  <li key={String(s.id)} className="admin-users-session-card">
                                    <strong>{label || "—"}</strong>
                                    <span className="mono muted">{String(s.ip_address || "—")}</span>
                                    <span className="muted">
                                      {formatSessionActivity(s.created_at, lang)}
                                    </span>
                                  </li>
                                );
                              })}
                          </ul>
                        </>
                      )}
                    </section>
                  )}

                  {drawerTab === "invitations" && (
                    <section className="admin-users-drawer-section">
                      <div className="admin-users-stat">
                        <span>{t("adminColInvites")}</span>
                        <strong>{String(drawerUser?.invitation_count ?? 0)}</strong>
                      </div>
                      {userDetail.invitations.length ? (
                        <ul className="admin-users-invite-list">
                          {userDetail.invitations.map((inv) => (
                            <li key={String(inv.id)}>
                              <div className="admin-users-invite-head">
                                <strong>{String(inv.event_slug)}</strong>
                                <InviteStatusBadge status={inv.status} />
                              </div>
                              <span className="muted">
                                {formatDisplayDateTimeStamp(inv.created_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-users-tab-empty">{t("adminInvitesEmpty")}</p>
                      )}
                    </section>
                  )}

                  {drawerTab === "history" && (
                    <section className="admin-users-drawer-section">
                      {userDetail.history.length ? (
                        <ul className="admin-users-timeline">
                          {userDetail.history.map((h) => (
                            <li key={String(h.id)}>
                              <time>{formatDisplayDateTimeStamp(h.created_at)}</time>
                              <span>{String(h.action)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-users-tab-empty">{t("adminHistoryEmpty")}</p>
                      )}
                    </section>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {confirmBan && (
        <ConfirmDialog
          title={t("adminBanDialogTitle")}
          body={t("adminBanDialogBody")}
          confirmLabel={t("adminActionBan")}
          cancelLabel={t("adminCancel")}
          danger
          onCancel={() => setConfirmBan(null)}
          onConfirm={() => {
            const u = confirmBan;
            setConfirmBan(null);
            void patchUser(String(u.id), { is_banned: true, ban_reason: "Banned by admin" }, "ban");
          }}
        />
      )}

      {confirmRole && (
        <ConfirmDialog
          title={t("adminRoleDialogTitle")}
          body={
            confirmRole.role === "admin"
              ? t("adminRoleDialogDemote")
              : t("adminRoleDialogPromote")
          }
          confirmLabel={t("adminConfirm")}
          cancelLabel={t("adminCancel")}
          onCancel={() => setConfirmRole(null)}
          onConfirm={() => {
            const u = confirmRole;
            setConfirmRole(null);
            void patchUser(
              String(u.id),
              { role: u.role === "admin" ? "user" : "admin" },
              "role",
            );
          }}
        />
      )}
    </section>
  );
});

export default AdminUsersSection;
