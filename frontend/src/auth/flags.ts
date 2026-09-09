export const showDevLogin =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === "true";

/**
 * Telegram Login Widget — temporarily disabled in favor of phone/password auth.
 * Re-enable by returning true (or restoring host checks) when Telegram login returns.
 */
export function canShowTelegramLoginWidget(): boolean {
  // return true to re-enable Telegram widget in production:
  // if (import.meta.env.VITE_FORCE_TELEGRAM_WIDGET === "true") return true;
  // if (typeof window === "undefined") return false;
  // const host = window.location.hostname;
  // return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
  return false;
}

export type LoginHintKey =
  | "loginLocalHint"
  | "loginTelegramHint"
  | "loginDevHint"
  | "loginPhoneHint";

export function loginHintKey(): LoginHintKey {
  const telegram = canShowTelegramLoginWidget();
  if (telegram && showDevLogin) return "loginDevHint";
  if (telegram) return "loginTelegramHint";
  return "loginPhoneHint";
}
