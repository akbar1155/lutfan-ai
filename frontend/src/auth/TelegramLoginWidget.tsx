import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiBase } from "../api/envTarget";
import { setAuthTokens } from "../api/envTarget";
import { canShowTelegramLoginWidget } from "./flags";

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

export default function TelegramLoginWidget() {
  const { t } = useTranslation();
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as
    | string
    | undefined;
  const enabled = canShowTelegramLoginWidget();

  const callbackName = useMemo(
    () => `__lutfanTelegramWidgetAuth_${Math.random().toString(16).slice(2)}`,
    [],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !botUsername) return;
    if (!containerRef.current) return;

    setError(null);
    const container = containerRef.current;
    container.innerHTML = "";

    (window as Record<string, unknown>)[callbackName] = async (user: unknown) => {
      try {
        const payload = user || {};
        const res = await fetch(`${getApiBase()}/auth/telegram`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`Telegram auth failed (${res.status})`);
        }
        const data = (await res.json()) as { access?: string; refresh?: string };
        if (!data.access) {
          throw new Error("Missing access token from backend");
        }
        setAuthTokens(data.access, data.refresh);
        window.dispatchEvent(new Event("auth:changed"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Telegram login failed");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?7";
    script.async = true;

    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    script.setAttribute("data-request-access", "write");

    script.onerror = () => {
      setError(t("loginTelegramUnavailable"));
    };
    container.appendChild(script);

    const timer = window.setTimeout(() => {
      if (!container.querySelector("iframe")) {
        setError(t("loginTelegramUnavailable"));
      }
    }, 2500);

    return () => {
      window.clearTimeout(timer);
      delete (window as Record<string, unknown>)[callbackName];
      container.innerHTML = "";
    };
  }, [enabled, botUsername, callbackName, t]);

  if (!enabled || !botUsername) return null;

  return (
    <div ref={containerRef} className="telegram-login" aria-label="telegram-login-widget">
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}
