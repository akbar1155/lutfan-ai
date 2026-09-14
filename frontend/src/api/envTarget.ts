/** Dev-only: point the local UI at production API. */

export type ApiTarget = "local" | "prod";

const TARGET_KEY = "lutfan_api_target";
export const PROD_ORIGIN = "https://lutfanai.uz";

export function isApiTargetSwitchEnabled(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function getApiTarget(): ApiTarget {
  if (!isApiTargetSwitchEnabled()) return "local";
  try {
    return localStorage.getItem(TARGET_KEY) === "prod" ? "prod" : "local";
  } catch {
    return "local";
  }
}

export function setApiTarget(target: ApiTarget): void {
  if (!isApiTargetSwitchEnabled()) return;
  localStorage.setItem(TARGET_KEY, target);
  window.dispatchEvent(new Event("api-target:changed"));
}

export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api/v1";
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (!isLocal && /localhost|127\.0\.0\.1/.test(fromEnv)) {
      return "/api/v1";
    }
  }
  if (isApiTargetSwitchEnabled() && getApiTarget() === "prod") {
    return "/prod-api/v1";
  }
  return fromEnv;
}

/** Rewrite relative media paths so prod assets load while UI is on localhost. */
export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (isApiTargetSwitchEnabled() && getApiTarget() === "prod" && url.startsWith("/")) {
    return `${PROD_ORIGIN}${url}`;
  }
  return url;
}

function scopedKey(base: "access_token" | "refresh_token"): string {
  return getApiTarget() === "prod" ? `${base}:prod` : base;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(scopedKey("access_token"));
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(scopedKey("refresh_token"));
}

export function setAuthTokens(access: string, refresh?: string | null): void {
  localStorage.setItem(scopedKey("access_token"), access);
  if (refresh) localStorage.setItem(scopedKey("refresh_token"), refresh);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(scopedKey("access_token"));
  localStorage.removeItem(scopedKey("refresh_token"));
}
