export const showDevLogin =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === "true";

/** Telegram Login Widget rejects localhost — hide it there. */
export function canShowTelegramLoginWidget(): boolean {
  if (import.meta.env.VITE_FORCE_TELEGRAM_WIDGET === "true") return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

export type LoginHintKey = "loginLocalHint" | "loginTelegramHint" | "loginDevHint";

export function loginHintKey(): LoginHintKey {
  const telegram = canShowTelegramLoginWidget();
  if (showDevLogin && telegram) return "loginDevHint";
  if (telegram) return "loginTelegramHint";
  return "loginLocalHint";
}
