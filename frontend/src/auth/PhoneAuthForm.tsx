import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";

type Mode = "login" | "register";

type Props = {
  onSuccess?: () => void;
};

export default function PhoneAuthForm({ onSuccess }: Props) {
  const { t } = useTranslation();
  const { loginPhone, registerPhone } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await registerPhone({ phone, password, first_name: firstName });
      } else {
        await loginPhone({ phone, password });
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="phone-auth-form" onSubmit={(e) => void submit(e)}>
      <div className="phone-auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={mode === "login" ? "active" : ""}
          aria-selected={mode === "login"}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          {t("authLoginTab")}
        </button>
        <button
          type="button"
          role="tab"
          className={mode === "register" ? "active" : ""}
          aria-selected={mode === "register"}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          {t("authRegisterTab")}
        </button>
      </div>

      {mode === "register" ? (
        <label className="field">
          <span>{t("authFirstName")}</span>
          <input
            name="first_name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            minLength={2}
            maxLength={128}
          />
        </label>
      ) : null}

      <label className="field">
        <span>{t("authPhone")}</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>{t("authPassword")}</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </label>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="cta" disabled={busy}>
        {busy
          ? t("loading")
          : mode === "register"
            ? t("authRegisterSubmit")
            : t("authLoginSubmit")}
      </button>
    </form>
  );
}
