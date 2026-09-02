function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api/v1";
  // Public tunnels (ngrok etc.): never call the developer's localhost from the visitor's browser.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (!isLocal && /localhost|127\.0\.0\.1/.test(fromEnv)) {
      return "/api/v1";
    }
  }
  return fromEnv;
}

const API_BASE = resolveApiBase();

type ApiError = {
  error?: { code?: string; message?: string };
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const storedRefresh = localStorage.getItem("refresh_token");
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: storedRefresh ? JSON.stringify({ refresh: storedRefresh }) : undefined,
    });
    if (!res.ok) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return false;
    }
    const data = (await res.json()) as { access?: string; refresh?: string };
    if (!data.access) return false;
    localStorage.setItem("access_token", data.access);
    if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
    window.dispatchEvent(new Event("auth:changed"));
    return true;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  opts?: { skipAuthRefresh?: boolean },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    if (
      !opts?.skipAuthRefresh &&
      res.status === 401 &&
      !path.startsWith("/auth/refresh") &&
      !path.startsWith("/auth/logout") &&
      !path.startsWith("/auth/telegram") &&
      localStorage.getItem("access_token")
    ) {
      const ok = await refreshAccessToken();
      if (ok) {
        return request<T>(path, init, { skipAuthRefresh: true });
      }
    }
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as ApiError;
      message = body.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as ApiError;
      message = body.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function patchForm<T>(path: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as ApiError;
      message = body.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type HealthResponse = {
  status: string;
  database: string;
  redis: string;
  service: string;
  debug: boolean;
};

export type User = {
  id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  language: string;
  role: string;
};

export type EventConfig = {
  id: string;
  slug: string;
  icon_url?: string;
  name_translations: Record<string, string>;
  description_translations?: Record<string, string>;
  subtypes?: Array<{ slug: string; names: Record<string, string> }>;
  fields_schema: {
    required: Array<Record<string, unknown>>;
    optional?: Array<Record<string, unknown>>;
    subtype_mode?: "single" | "multi";
  };
};

export type Invitation = {
  id: string;
  status: string;
  event_slug: string;
  subtype_slug?: string;
  subtype_slugs?: string[];
  inviter_type?: string;
  language: string;
  event_data: Record<string, unknown>;
  generation_path?: string;
  template_id?: string;
  ai_preset_id?: string;
  selected_mood_tags?: string[];
  custom_style_note?: string;
  primary_format: string;
  final_image_url?: string;
  additional_formats?: Record<string, string>;
  event_date?: string;
  last_error?: string;
  expires_at: string;
  created_at: string;
  updated_at?: string;
};

export type TextTemplate = {
  id: string;
  title: string;
  preview_text: string;
  language: string;
  tone?: string;
};

export type JpgTemplate = {
  id: string;
  theme_name: string;
  bg_url_preview: string;
  bg_url: string;
  style_tags: string[];
  event_slug?: string;
  is_featured?: boolean;
};

export const api = {
  health: () => request<HealthResponse>("/health"),
  events: () => request<EventConfig[]>("/events"),
  event: (slug: string) => request<EventConfig>(`/events/${slug}`),
  devLogin: (payload?: {
    telegram_id?: number;
    as_admin?: boolean;
    first_name?: string;
    username?: string;
  }) =>
    request<{ user: User; access: string; refresh?: string }>("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  adminLogin: (payload: { username: string; password: string }) =>
    request<{ user: User; access: string; refresh?: string }>("/auth/admin-login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request<User>("/auth/me"),
  logout: () => {
    const refresh = localStorage.getItem("refresh_token");
    return request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: refresh ? JSON.stringify({ refresh }) : undefined,
    });
  },
  updateProfile: (data: Partial<User>) =>
    request<User>("/user/profile", { method: "PATCH", body: JSON.stringify(data) }),
  textTemplates: (
    eventSlug: string,
    language: string,
    opts?: { subtype_slug?: string },
  ) => {
    const q = new URLSearchParams({
      event_slug: eventSlug,
      language,
    });
    if (opts?.subtype_slug) q.set("subtype_slug", opts.subtype_slug);
    return request<TextTemplate[]>(`/text-templates?${q.toString()}`);
  },
  templates: (eventSlug: string) =>
    request<JpgTemplate[]>(`/templates?event_slug=${eventSlug}`),
  moodTags: () =>
    request<Record<string, Array<{ slug: string; name_translations: Record<string, string>; prompt_snippet: string }>>>(
      "/mood-tags",
    ),
  aiPresets: (eventSlug: string) =>
    request<Array<{ id: string; name: string }>>(`/ai-presets?event_slug=${eventSlug}`),
  createInvitation: (body: {
    event_slug: string;
    subtype_slug?: string;
    language?: string;
  }) =>
    request<Invitation>("/invitations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getInvitation: (id: string) => request<Invitation>(`/invitations/${id}`),
  patchInvitation: (id: string, body: Record<string, unknown>) =>
    request<Invitation>(`/invitations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  generate: (id: string) =>
    request<{ job_id: string }>(`/invitations/${id}/generate`, { method: "POST" }),
  status: (id: string) =>
    request<{
      status: string;
      image_url?: string;
      error?: string;
    }>(`/invitations/${id}/status`),
  myInvitations: () => request<Invitation[]>("/user/invitations"),
  share: (id: string, platform: string) =>
    request<{ ok: boolean }>(`/invitations/${id}/share`, {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),
  download: (id: string, aspect = "4:5") =>
    request<{ url: string }>(
      `/invitations/${id}/download?aspect=${encodeURIComponent(aspect)}`,
    ),
  generateFormat: (id: string, format: "9:16" | "1:1") =>
    request<{ job_id: string }>(`/invitations/${id}/formats`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
  publicInvitation: (id: string) =>
    request<{ id: string; event_slug: string; language: string; image_url: string }>(
      `/public/invitations/${id}`,
    ),
  adminDashboard: () => request<Record<string, unknown>>("/admin/dashboard"),
  adminUsers: (params?: {
    search?: string;
    role?: string;
    status?: string;
    is_banned?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.role) q.set("role", params.role);
    if (params?.status) q.set("status", params.status);
    if (params?.is_banned) q.set("is_banned", params.is_banned);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{
      count: number;
      page: number;
      limit: number;
      results: Array<Record<string, unknown>>;
    }>(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  adminGetUser: (id: string) =>
    request<{
      user: Record<string, unknown>;
      sessions?: Array<Record<string, unknown>>;
      invitations: Array<Record<string, unknown>>;
      history: Array<Record<string, unknown>>;
    }>(`/admin/users/${id}`),
  adminPatchUser: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminEvents: () => request<Array<Record<string, unknown>>>("/admin/events"),
  adminCreateEvent: (body: Record<string, unknown>) =>
    request<{ id: string; slug: string }>("/admin/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPatchEvent: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/admin/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteEvent: (id: string) =>
    request<{ ok: boolean }>(`/admin/events/${id}`, { method: "DELETE" }),
  adminTextTemplates: (eventSlug?: string) =>
    request<Array<Record<string, unknown>>>(
      `/admin/text-templates${eventSlug ? `?event_slug=${eventSlug}` : ""}`,
    ),
  adminCreateTextTemplate: (body: Record<string, unknown>) =>
    request<{ id: string }>("/admin/text-templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPatchTextTemplate: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/admin/text-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteTextTemplate: (id: string) =>
    request<{ ok: boolean }>(`/admin/text-templates/${id}`, { method: "DELETE" }),
  adminTemplates: (eventSlug?: string) =>
    request<Array<Record<string, unknown>>>(
      `/admin/templates${eventSlug ? `?event_slug=${eventSlug}` : ""}`,
    ),
  adminCreateTemplate: (body: Record<string, unknown>) =>
    request<{ id: string }>("/admin/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPatchTemplate: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/admin/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteTemplate: (id: string) =>
    request<{ ok: boolean }>(`/admin/templates/${id}`, { method: "DELETE" }),
  adminCreateTemplateMultipart: (formData: FormData) =>
    requestForm<{ id: string }>("/admin/templates", formData),
  adminPatchTemplateMultipart: (id: string, formData: FormData) =>
    patchForm<{ ok: boolean }>(`/admin/templates/${id}`, formData),
  adminTestTemplate: (id: string, blocks?: Record<string, string>) =>
    request<{ ok: boolean; result_url: string }>(`/admin/templates/${id}/test`, {
      method: "POST",
      body: JSON.stringify({ blocks: blocks || {} }),
    }),
  adminMoodTags: () => request<Array<Record<string, unknown>>>("/admin/mood-tags"),
  adminCreateMoodTag: (body: Record<string, unknown>) =>
    request<{ id: string }>("/admin/mood-tags", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPatchMoodTag: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/admin/mood-tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteMoodTag: (id: string) =>
    request<{ ok: boolean }>(`/admin/mood-tags/${id}`, { method: "DELETE" }),
  adminAiPresets: () => request<Array<Record<string, unknown>>>("/admin/ai-presets"),
  adminCreateAiPreset: (body: Record<string, unknown>) =>
    request<{ id: string }>("/admin/ai-presets", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPatchAiPreset: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/admin/ai-presets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteAiPreset: (id: string) =>
    request<{ ok: boolean }>(`/admin/ai-presets/${id}`, { method: "DELETE" }),
  adminTestAiPreset: (
    id: string,
    body?: { blocks?: Record<string, string>; mood_snippets?: string; model_params?: Record<string, unknown> },
  ) =>
    request<{ ok: boolean; result_url: string; example_output_url: string }>(
      `/admin/ai-presets/${id}/test`,
      {
        method: "POST",
        body: JSON.stringify(body || {}),
      },
    ),
  adminInvitations: (params?: { status?: string; event_slug?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.event_slug) q.set("event_slug", params.event_slug);
    const qs = q.toString();
    return request<Array<Record<string, unknown>>>(
      `/admin/invitations${qs ? `?${qs}` : ""}`,
    );
  },
  adminAiGenerations: (status?: string) =>
    request<Array<Record<string, unknown>>>(
      `/admin/ai-generations${status ? `?status=${status}` : ""}`,
    ),
  adminSystemLogs: (level?: string) =>
    request<Array<Record<string, unknown>>>(
      `/admin/system-logs${level ? `?level=${level}` : ""}`,
    ),
  adminAnalyticsExportUrl: () => `${API_BASE}/admin/analytics/export`,
};
