import { getAccessToken, getApiBase, getRefreshToken, setAuthTokens } from "../api/envTarget";
import type { DesignConfig, InvitationPagePayload, MusicConfig } from "./types";

type ApiError = {
  error?: { message?: string; details?: Record<string, unknown> };
};

function formatError(body: ApiError, fallback: string): string {
  const details = body.error?.details;
  if (details && typeof details === "object") {
    for (const value of Object.values(details)) {
      if (Array.isArray(value) && value.length) return String(value[0]);
      if (typeof value === "string" && value) return value;
    }
  }
  return body.error?.message || fallback;
}

async function refreshAccess(): Promise<boolean> {
  try {
    const storedRefresh = getRefreshToken();
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(storedRefresh ? { refresh: storedRefresh } : {}),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access?: string; refresh?: string };
    if (!data.access) return false;
    setAuthTokens(data.access, data.refresh);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401 && !retried) {
    const ok = await refreshAccess();
    if (ok) return request<T>(path, init, true);
  }
  if (!res.ok) {
    let message = `Xatolik: ${res.status}`;
    try {
      message = formatError((await res.json()) as ApiError, message);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type PageWrite = {
  title?: string;
  mainText?: string;
  date?: string | null;
  time?: string | null;
  address?: string;
  designConfig?: DesignConfig;
  musicConfig?: MusicConfig;
  designPrompt?: string;
};

export const pageBuilderApi = {
  create(data: PageWrite = {}) {
    return request<InvitationPagePayload>("/pages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  get(id: string) {
    return request<InvitationPagePayload>(`/pages/${id}`);
  },
  save(id: string, data: PageWrite) {
    return request<InvitationPagePayload>(`/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  publish(id: string, data: PageWrite) {
    return request<InvitationPagePayload>(`/pages/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  unpublish(id: string) {
    return request<InvitationPagePayload>(`/pages/${id}/unpublish`, {
      method: "POST",
      body: "{}",
    });
  },
  aiStyle(payload: { prompt?: string; current?: DesignConfig; id?: string }) {
    const path = payload.id ? `/pages/${payload.id}/ai-style` : "/pages/ai-style";
    return request<{ designConfig: DesignConfig } & Partial<InvitationPagePayload>>(path, {
      method: "POST",
      body: JSON.stringify({ prompt: payload.prompt || "", current: payload.current }),
    });
  },
  surprise(payload: { current?: DesignConfig; id?: string }) {
    const path = payload.id ? `/pages/${payload.id}/surprise` : "/pages/surprise";
    return request<{ designConfig: DesignConfig } & Partial<InvitationPagePayload>>(path, {
      method: "POST",
      body: JSON.stringify({ current: payload.current }),
    });
  },
  uploadMusic(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<InvitationPagePayload>(`/pages/${id}/music`, { method: "POST", body });
  },
  publicBySlug(slug: string) {
    return request<InvitationPagePayload>(`/public/pages/${slug}`);
  },
};
