import i18n from "../i18n";
import {
  getAccessToken,
  getApiBase,
  getRefreshToken,
  setAuthTokens,
} from "../api/envTarget";
import type { DesignConfig, InvitationPagePayload, MusicConfig } from "./types";

type ApiError = {
  error?: { message?: string; details?: Record<string, unknown> };
};

const SERVER_ERROR_KEYS: Record<string, string> = {
  "Asosiy matn kerak": "pbNeedBody",
  "Joy nomi kerak": "pbNeedVenue",
  "Manzil kerak": "pbNeedAddress",
  "Oila familiyasi kerak": "pbNeedFamily",
  "Har bir marosim uchun sana va vaqt kerak": "pbNeedSchedule",
  "Sana va vaqt kerak": "pbNeedDateTime",
  "Bola jinsini tanlang": "pbNeedChildGender",
  "Bola ismi kerak": "pbNeedChildName",
  "Ism kerak": "pbNeedPersonName",
  "Musiqa fayli kerak": "pbNeedMusicFile",
  "Musiqa 8 MB dan oshmasin": "pbMusicTooBig",
  "Faqat MP3, M4A yoki WAV": "pbMusicType",
  "Fayl bo‘sh": "pbFileEmpty",
};

function translateServerMessage(message: string, fallback: string): string {
  const key = SERVER_ERROR_KEYS[message];
  return key ? i18n.t(key) : message || fallback;
}

function formatError(body: ApiError, fallback: string): string {
  const details = body.error?.details;
  if (details && typeof details === "object") {
    for (const value of Object.values(details)) {
      if (Array.isArray(value) && value.length)
        return translateServerMessage(String(value[0]), fallback);
      if (typeof value === "string" && value)
        return translateServerMessage(value, fallback);
    }
  }
  return translateServerMessage(body.error?.message || "", fallback);
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

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
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
    let message = i18n.t("pbHttpError", { status: res.status });
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
  familySignature?: string;
  personName?: string;
  childName?: string;
  childGender?: string;
  venueName?: string;
  address?: string;
  mapLat?: number | null;
  mapLng?: number | null;
  eventSlug?: string;
  subtypeSlugs?: string[];
  ceremonySchedule?: Record<string, { date: string; time: string }>;
  displayLang?: string;
  readyTextId?: string;
  designConfig?: DesignConfig;
  musicConfig?: MusicConfig;
  designPrompt?: string;
};

export type GeocodeHit = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export const pageBuilderApi = {
  create(data: PageWrite = {}) {
    return request<InvitationPagePayload>("/pages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  list() {
    return request<InvitationPagePayload[]>("/pages");
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
  remove(id: string) {
    return request<void>(`/pages/${id}`, { method: "DELETE" });
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
  aiStyle(payload: {
    prompt?: string;
    current?: DesignConfig;
    id?: string;
    suggest?: boolean;
    lang?: string;
  }) {
    const path = payload.id
      ? `/pages/${payload.id}/ai-style`
      : "/pages/ai-style";
    return request<
      { designConfig?: DesignConfig; designPrompt?: string } & Partial<InvitationPagePayload>
    >(path, {
      method: "POST",
      body: JSON.stringify({
        prompt: payload.prompt || "",
        current: payload.current,
        suggest: Boolean(payload.suggest),
        lang: payload.lang || "",
      }),
    });
  },
  uploadMusic(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<InvitationPagePayload>(`/pages/${id}/music`, {
      method: "POST",
      body,
    });
  },
  geocode(query: string) {
    return request<{ results: GeocodeHit[] }>(
      `/pages/geocode?q=${encodeURIComponent(query)}`,
    );
  },
  publicBySlug(slug: string) {
    return request<InvitationPagePayload>(`/public/pages/${slug}`);
  },
};
