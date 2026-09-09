import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { IconEye, IconEyeOff } from "../components/ActionIcons";
import {
  formatUzPhoneMask,
  toE164Uz,
  UZ_PHONE_PLACEHOLDER,
  uzLocalDigits,
} from "../utils/phone";
import { useAuth } from "./AuthContext";

type Mode = "login" | "register";

type Props = {
  onSuccess?: () => void;
};

function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  visible,
  onToggleVisible,
  showLabel,
  hideLabel,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-field">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggleVisible}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </label>
  );
}

export default function PhoneAuthForm({ onSuccess }: Props) {
  const { t } = useTranslation();
  const { loginPhone, registerPhone } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (phoneLocal.length !== 9) {
        setError(t("authPhoneInvalid"));
        setBusy(false);
        return;
      }
      const phone = toE164Uz(phoneLocal);
      if (mode === "register") {
        if (password !== passwordConfirm) {
          setError(t("authPasswordMismatch"));
          setBusy(false);
          return;
        }
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
          className="phone-mask-input"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={UZ_PHONE_PLACEHOLDER}
          value={formatUzPhoneMask(phoneLocal)}
          onChange={(e) => setPhoneLocal(uzLocalDigits(e.target.value))}
          required
          maxLength={19}
          aria-label={t("authPhone")}
        />
      </label>

      <PasswordField
        label={t("authPassword")}
        name="password"
        value={password}
        onChange={setPassword}
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        visible={showPassword}
        onToggleVisible={() => setShowPassword((v) => !v)}
        showLabel={t("authShowPassword")}
        hideLabel={t("authHidePassword")}
      />

      {mode === "register" ? (
        <PasswordField
          label={t("authPasswordConfirm")}
          name="password_confirm"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          autoComplete="new-password"
          visible={showPasswordConfirm}
          onToggleVisible={() => setShowPasswordConfirm((v) => !v)}
          showLabel={t("authShowPassword")}
          hideLabel={t("authHidePassword")}
        />
      ) : null}

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
