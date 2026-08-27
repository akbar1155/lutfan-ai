import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  api,
  type EventConfig,
  type Invitation,
  type JpgTemplate,
  type TextTemplate,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import TelegramLoginWidget from "../auth/TelegramLoginWidget";
import { canShowTelegramLoginWidget, showDevLogin } from "../auth/flags";
import UiSelect from "../components/UiSelect";
import { DateField, TimeField } from "../components/DateTimePickers";
import GeneratingScene from "../components/GeneratingScene";
import { EmptyState, PageLoader } from "../components/UiStates";
import {
  eventDisplayName,
  normalizeUiLang,
  pickTranslation,
} from "../i18n/lang";
import {
  formatDatesInText,
  ensureTimeDaSuffix,
} from "../utils/date";
import {
  buildLocalReadyTemplates,
  mergeReadyTextTemplates,
} from "../utils/readyTexts";
import {
  buildCeremonyDateTimeText,
  getSelectedSubtypeSlugs,
  loadCeremonySchedule,
  primaryEventDate,
  type CeremonySchedule,
} from "../utils/ceremonySchedule";
import { looksLikeDateTimeLine, splitTemplateBlocks, ensureChildNameInBody } from "../utils/textBlocks";
import { cleanFieldValue, isJunkFieldValue } from "../utils/fieldQuality";
import { invitationContinuePath } from "../utils/wizardResume";
import { downloadImageFile } from "../utils/download";
import {
  IconClose,
  IconDownload,
  IconEdit,
  IconLink,
  IconPalette,
  IconPlus,
  IconRatio11,
  IconRatio916,
  IconRefresh,
  IconShare,
  IconUser,
} from "../components/ActionIcons";

type FieldDef = {
  key: string;
  type?: string;
  options?: string[];
  maxLength?: number;
  min?: string;
};

function isIsoDate(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isPastIsoDate(value?: string | null): boolean {
  return isIsoDate(value) && value < todayIsoDate();
}

function WizardChrome({
  step,
  title,
  hint,
  children,
  error,
  saveState,
  gated,
}: {
  step: number;
  title?: string;
  hint?: string;
  children: ReactNode;
  error?: string | null;
  saveState?: "idle" | "saving" | "saved" | "error";
  gated?: boolean;
}) {
  const { t } = useTranslation();
  const steps = [
    t("chooseEvent"),
    t("details"),
    t("data"),
    t("text"),
    t("style"),
    t("result"),
  ];

  const showHead = Boolean(title || hint || (saveState && saveState !== "idle"));

  return (
    <main className={`page narrow wizard ${gated ? "wizard-gated" : ""}`.trim()}>
      <div className="wizard-progress" aria-label={t("progressAria")}>
        <div
          className="wizard-progress-bar"
          style={{ width: `${((step - 1) / Math.max(steps.length - 1, 1)) * 100}%` }}
        />
        {steps.map((label, idx) => {
          const n = idx + 1;
          const state = n < step ? "done" : n === step ? "current" : "";
          return (
            <div key={label} className={`wizard-step ${state}`}>
              <span aria-hidden>{n < step ? "" : n}</span>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
      <p className="wizard-mobile-step">
        <span>
          {step}/{steps.length}
        </span>{" "}
        {steps[step - 1]}
      </p>
      {showHead ? (
        <header className="wizard-head reveal">
          {title ? <h1>{title}</h1> : null}
          {hint && <p className="hint">{hint}</p>}
          {saveState && saveState !== "idle" && (
            <p className={`save-pill ${saveState}`}>
              {saveState === "saving" && t("saving")}
              {saveState === "saved" && t("saved")}
              {saveState === "error" && t("saveError")}
            </p>
          )}
        </header>
      ) : null}
      {error && <div className="banner error">{error}</div>}
      <div className="wizard-body reveal reveal-delay">{children}</div>
    </main>
  );
}

function useRequireAuth() {
  const { user, loginDev, loading } = useAuth();
  // Do not auto-login here; user should be authenticated via Telegram widget.
  // For local/dev we still provide `loginDev` button inside the page UI.
  return { user, loading, loginDev };
}

function fieldLabelKey(key: string) {
  return `field_${key}`;
}

function optionLabelKey(value: string) {
  return `opt_${value}`;
}

function normalizeUzbekSpelling(text: string, language?: string): string {
  if (language !== "uz-latn" && language !== "uz-cyrl") return text;

  let out = text
    .replace(/[ʻ’`´]/g, "‘")
    .replace(/g['’`´]/gi, "g‘")
    .replace(/o['’`´]/gi, "o‘")
    // Use simple hyphen instead of long dashes in invitation copy.
    .replace(/\s*[—–]\s*/g, " - ");

  if (language === "uz-latn") {
    const fixes: Array<[RegExp, string]> = [
      [/\bkoring\b/gi, "ko‘ring"],
      [/\bkoringiz\b/gi, "ko‘ringiz"],
      [/\bkutamis\b/gi, "kutamiz"],
      [/\bb[o‘']?bslin\b/gi, "bo‘lsin"],
      [/\bboslin\b/gi, "bo‘lsin"],
      [/\bbulsin\b/gi, "bo‘lsin"],
      [/\bhayitingiz muborak bo‘lslin\b/gi, "Hayitingiz muborak bo‘lsin"],
    ];
    fixes.forEach(([from, to]) => {
      out = out.replace(from, to);
    });

    // Lowercase polite pronouns when they appear in the middle of a sentence.
    // Sentence starts keep uppercase.
    const midSentencePronouns: Array<[RegExp, string]> = [
      [/(?<=[\p{L}‘ʻ’,;:]\s)Sizni\b/gu, "sizni"],
      [/(?<=[\p{L}‘ʻ’,;:]\s)Sizning\b/gu, "sizning"],
      [/(?<=[\p{L}‘ʻ’,;:]\s)Sizga\b/gu, "sizga"],
      [/(?<=[\p{L}‘ʻ’,;:]\s)Sizdan\b/gu, "sizdan"],
      [/(?<=[\p{L}‘ʻ’,;:]\s)Sizda\b/gu, "sizda"],
      [/(?<=[\p{L}‘ʻ’,;:]\s)Siz bilan\b/gu, "siz bilan"],
      [/(?<=[\p{L}‘ʻ’,;:]\s)Siz\b/gu, "siz"],
    ];
    midSentencePronouns.forEach(([from, to]) => {
      out = out.replace(from, to);
    });
  } else {
    const fixes: Array<[RegExp, string]> = [
      [/\bкутамис\b/gi, "кутамиз"],
      [/\bбўбслин\b/gi, "бўлсин"],
      [/\bбўслин\b/gi, "бўлсин"],
    ];
    fixes.forEach(([from, to]) => {
      out = out.replace(from, to);
    });
  }

  return ensureTimeDaSuffix(
    out
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +([,.!?;])/g, "$1")
      .replace(/([,.!?;])([^\s,.!?;])/g, "$1 $2")
      .replace(/(\d)\s*:\s*(\d)/g, "$1:$2")
      .replace(/\s+\n/g, "\n")
      .trim(),
    language,
  );
}

export function CreateEventPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, loginDev } = useRequireAuth();
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locationState = location.state as
    | { eventSlug?: string; templateId?: string }
    | null;
  const preferredSlug = locationState?.eventSlug || null;
  const preferredTemplateId = locationState?.templateId || null;
  const lang = normalizeUiLang(i18n.language);
  const autoStarted = useRef(false);

  useEffect(() => {
    void api
      .events()
      .then(setEvents)
      .catch((err: Error) => setError(err.message))
      .finally(() => setEventsLoading(false));
  }, []);

  const startEvent = (event: EventConfig) => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    void api
      .createInvitation({
        event_slug: event.slug,
        language: lang,
      })
      .then(async (inv) => {
        if (preferredTemplateId) {
          await api.patchInvitation(inv.id, {
            generation_path: "template",
            template_id: preferredTemplateId,
          });
        }
        navigate(`/create/${inv.id}/details`, { replace: true });
      })
      .catch((err: Error) => {
        setError(err.message);
        setBusy(false);
      });
  };

  useEffect(() => {
    if (autoStarted.current || !preferredSlug || !user || eventsLoading || busy) {
      return;
    }
    const event = events.find((e) => e.slug === preferredSlug);
    if (!event) return;
    autoStarted.current = true;
    startEvent(event);
  }, [preferredSlug, user, events, eventsLoading, busy, lang]);

  if (loading) {
    return (
      <WizardChrome step={1} title={t("chooseEvent")}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  if (!user) {
    return (
      <WizardChrome step={1} error={error} gated>
        <div className="wizard-auth">
          <h1>{t("login")}</h1>
          <p className="hint">
            {t(canShowTelegramLoginWidget() ? "wizardLoginHint" : "loginLocalHint")}
          </p>
          <div className="login-block">
            <TelegramLoginWidget />
            {showDevLogin && (
              <button type="button" className="cta" onClick={() => void loginDev(false)}>
                {t("loginDev")}
              </button>
            )}
          </div>
        </div>
      </WizardChrome>
    );
  }

  return (
    <WizardChrome step={1} title={t("chooseEvent")} hint={t("chooseEventHint")} error={error}>
      {eventsLoading ? (
        <PageLoader label={t("loading")} />
      ) : events.length ? (
        <div className="grid event-grid">
          {events.map((event) => (
            <button
              key={event.slug}
              type="button"
              className={`card-link event-card ${preferredSlug === event.slug ? "is-preferred" : ""}`}
              disabled={busy}
              onClick={() => startEvent(event)}
            >
              <strong>
                {pickTranslation(event.name_translations, lang) ||
                  eventDisplayName(event.slug, lang)}
              </strong>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title={t("eventsEmpty")} body={t("eventsEmptyHint")} />
      )}
    </WizardChrome>
  );
}

export function DetailsPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const uiLang = normalizeUiLang(i18n.language);
  const [language, setLanguage] = useState(uiLang);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void api
      .getInvitation(id)
      .then((inv) => {
        setInvitation(inv);
        setLanguage(normalizeUiLang(inv.language));
        const multi =
          inv.subtype_slugs && inv.subtype_slugs.length
            ? inv.subtype_slugs
            : inv.subtype_slug
              ? [inv.subtype_slug]
              : [];
        setSubtypes(multi);
        return api.event(inv.event_slug);
      })
      .then(setEvent)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const toggleSubtype = (slug: string) => {
    setSubtypes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  if (!invitation || !event) {
    return (
      <WizardChrome step={2} title={t("details")} error={error}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  return (
    <WizardChrome
      step={2}
      title={t("details")}
      hint={event.subtypes?.length ? t("detailsHint") : t("detailsHintSimple")}
      error={error}
    >
      {!!event.subtypes?.length && (
        <fieldset className="check-group">
          <legend>{t("subtype")}</legend>
          <p className="hint">{t("subtypeMultiHint")}</p>
          <div className="check-list">
            {event.subtypes.map((s) => {
              const checked = subtypes.includes(s.slug);
              return (
                <label key={s.slug} className={`check-chip ${checked ? "active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSubtype(s.slug)}
                  />
                  <span>{pickTranslation(s.names, uiLang) || s.slug}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <UiSelect
        label={t("inviteLanguage")}
        name="invite_language"
        value={language}
        onChange={(e) => setLanguage(normalizeUiLang(e.target.value))}
      >
        <option value="uz-latn">{t("langUzLatn")}</option>
        <option value="uz-cyrl">{t("langUzCyrl")}</option>
        <option value="ru">{t("langRu")}</option>
      </UiSelect>
      <div className="wizard-actions">
        <Link className="ghost" to="/create">
          {t("back")}
        </Link>
        <button
          type="button"
          className="cta"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void api
              .patchInvitation(invitation.id, {
                subtype_slugs: subtypes,
                subtype_slug: subtypes[0] || null,
                language,
                event_data: {
                  ...(invitation.event_data || {}),
                  details_done: true,
                },
              })
              .then(() => navigate(`/create/${invitation.id}/data`))
              .catch((err: Error) => {
                setError(err.message);
                setBusy(false);
              });
          }}
        >
          {t("next")}
        </button>
      </div>
    </WizardChrome>
  );
}

export function DataPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const uiLang = normalizeUiLang(i18n.language);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<CeremonySchedule>({});
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [busy, setBusy] = useState(false);
  const skipAutosave = useRef(true);

  const subtypeSlugs = useMemo(
    () => (invitation ? getSelectedSubtypeSlugs(invitation) : []),
    [invitation],
  );
  const multiCeremony = subtypeSlugs.length >= 2;

  useEffect(() => {
    if (!id) return;
    void api
      .getInvitation(id)
      .then((inv) => {
        setInvitation(inv);
        const existing =
          (inv.event_data?.structured_fields as Record<string, string>) || {};
        setForm(existing);
        setSchedule(
          loadCeremonySchedule(inv.event_data, getSelectedSubtypeSlugs(inv)),
        );
        return api.event(inv.event_slug);
      })
      .then(setEvent)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const fields = useMemo(() => {
    if (!event) return [] as FieldDef[];
    const all = [
      ...((event.fields_schema.required || []) as FieldDef[]),
      ...((event.fields_schema.optional || []) as FieldDef[]),
    ];
    if (multiCeremony) {
      return all.filter(
        (f) => f.key !== "event_date" && f.key !== "event_time",
      );
    }
    return all;
  }, [event, multiCeremony]);

  const requiredKeys = useMemo(() => {
    if (!event) return new Set<string>();
    const keys = ((event.fields_schema.required || []) as FieldDef[])
      .map((f) => String(f.key))
      .filter((k) => !(multiCeremony && (k === "event_date" || k === "event_time")));
    return new Set(keys);
  }, [event, multiCeremony]);

  const skipJunkKeys = useMemo(() => {
    const skip = new Set<string>(["child_gender", "inviter", "event_date", "event_time"]);
    for (const f of fields) {
      const type = String(f.type || "string");
      if (type === "enum" || type === "date" || type === "time") {
        skip.add(String(f.key));
      }
    }
    return skip;
  }, [fields]);

  useEffect(() => {
    if (!invitation) return;
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      setSaveState("saving");
      const structured = { ...form };
      if (multiCeremony) {
        const primary = primaryEventDate(schedule);
        if (primary) structured.event_date = primary;
        const firstSlug = subtypeSlugs[0];
        if (firstSlug && schedule[firstSlug]?.time) {
          structured.event_time = schedule[firstSlug].time;
        }
      }
      const payload: Record<string, unknown> = {
        event_data: {
          ...(invitation.event_data || {}),
          structured_fields: structured,
          ceremony_schedule: multiCeremony ? schedule : {},
        },
      };
      const dateForInv = multiCeremony
        ? primaryEventDate(schedule)
        : isIsoDate(form.event_date)
          ? form.event_date
          : null;
      if (dateForInv && isIsoDate(dateForInv)) payload.event_date = dateForInv;
      else payload.event_date = null;

      void api
        .patchInvitation(invitation.id, payload)
        .then((updated) => {
          setInvitation(updated);
          setSaveState("saved");
          window.setTimeout(() => {
            setSaveState((prev) => (prev === "saved" ? "idle" : prev));
          }, 1800);
        })
        .catch(() => setSaveState("error"));
    }, 900);
    return () => window.clearTimeout(handle);
  }, [form, schedule, invitation?.id, multiCeremony, subtypeSlugs.join(",")]);

  if (!invitation || !event) {
    return (
      <WizardChrome step={3} title={t("data")} error={error}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    for (const key of requiredKeys) {
      if (!form[key]?.trim()) {
        setError(`${t(fieldLabelKey(key))} — ${t("required")}`);
        return;
      }
      if (!skipJunkKeys.has(key) && isJunkFieldValue(form[key])) {
        setError(`${t(fieldLabelKey(key))} — ${t("placeholderFieldError")}`);
        return;
      }
    }
    // Optional-but-present fields also must not be junk
    for (const [key, value] of Object.entries(form)) {
      if (!value?.trim() || requiredKeys.has(key) || skipJunkKeys.has(key)) continue;
      if (isJunkFieldValue(value)) {
        setError(`${t(fieldLabelKey(key))} — ${t("placeholderFieldError")}`);
        return;
      }
    }
    if (multiCeremony) {
      for (const slug of subtypeSlugs) {
        const slot = schedule[slug] || { date: "", time: "" };
        const label =
          pickTranslation(
            event.subtypes?.find((s) => s.slug === slug)?.names || {},
            uiLang,
          ) || slug;
        if (!isIsoDate(slot.date)) {
          setError(`${label}: ${t("dateFormatError")}`);
          return;
        }
        if (!slot.time?.trim()) {
          setError(`${label}: ${t(fieldLabelKey("event_time"))} — ${t("required")}`);
          return;
        }
      }
    } else if (form.event_date && !isIsoDate(form.event_date)) {
      setError(t("dateFormatError"));
      return;
    }
    if (multiCeremony) {
      for (const slug of subtypeSlugs) {
        if (isPastIsoDate(schedule[slug]?.date)) {
          setError(t("dateMinToday"));
          return;
        }
      }
    } else if (form.event_date && isPastIsoDate(form.event_date)) {
      setError(t("dateMinToday"));
      return;
    }
    setBusy(true);
    const structured = { ...form };
    if (multiCeremony) {
      const primary = primaryEventDate(schedule);
      if (primary) structured.event_date = primary;
      const firstSlug = subtypeSlugs[0];
      if (firstSlug && schedule[firstSlug]?.time) {
        structured.event_time = schedule[firstSlug].time;
      }
    }
    const payload: Record<string, unknown> = {
      event_data: {
        ...(invitation.event_data || {}),
        structured_fields: structured,
        ceremony_schedule: multiCeremony ? schedule : {},
        text_source: "pending",
      },
    };
    const dateForInv = multiCeremony
      ? primaryEventDate(schedule)
      : invitation.event_slug === "hayit"
        ? null
        : isIsoDate(form.event_date)
          ? form.event_date
          : null;
    if (dateForInv && isIsoDate(dateForInv)) payload.event_date = dateForInv;
    else payload.event_date = null;

    void api
      .patchInvitation(invitation.id, payload)
      .then(() => navigate(`/create/${invitation.id}/text`))
      .catch((err: Error) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <WizardChrome
      step={3}
      title={t("data")}
      hint={multiCeremony ? t("ceremonyScheduleHint") : t("dataHint")}
      error={error}
      saveState={saveState}
    >
      <form className="form-stack" noValidate onSubmit={submit}>
        {multiCeremony && (
          <section className="ceremony-schedule">
            <h3 className="ceremony-schedule-title">{t("ceremonySchedule")}</h3>
            <p className="hint">{t("ceremonyScheduleHint")}</p>
            {subtypeSlugs.map((slug) => {
              const label =
                pickTranslation(
                  event.subtypes?.find((s) => s.slug === slug)?.names || {},
                  uiLang,
                ) || slug;
              const slot = schedule[slug] || { date: "", time: "" };
              return (
                <fieldset key={slug} className="ceremony-slot">
                  <legend>{label}</legend>
                  <div className="ceremony-slot-row">
                    <DateField
                      label={t(fieldLabelKey("event_date"))}
                      required
                      minToday
                      value={slot.date}
                      onChange={(next) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [slug]: { ...slot, date: next },
                        }))
                      }
                    />
                    <TimeField
                      label={t(fieldLabelKey("event_time"))}
                      required
                      value={slot.time}
                      onChange={(next) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [slug]: { ...slot, time: next },
                        }))
                      }
                    />
                  </div>
                </fieldset>
              );
            })}
          </section>
        )}

        {fields.map((field) => {
          const key = String(field.key);
          const type = String(field.type || "string");
          const label = t(fieldLabelKey(key), { defaultValue: key });
          const required = requiredKeys.has(key);

          if (type === "enum" && field.options) {
            return (
              <UiSelect
                key={key}
                label={`${label}${required ? " *" : ""}`}
                name={key}
                value={form[key] || ""}
                required={required}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [key]: e.target.value }))
                }
              >
                <option value="">—</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(optionLabelKey(opt), { defaultValue: opt })}
                  </option>
                ))}
              </UiSelect>
            );
          }

          if (type === "date") {
            return (
              <DateField
                key={key}
                label={label}
                required={required}
                minToday={field.min === "today"}
                value={form[key] || ""}
                onChange={(next) =>
                  setForm((prev) => ({ ...prev, [key]: next }))
                }
              />
            );
          }

          if (type === "time") {
            return (
              <TimeField
                key={key}
                label={label}
                required={required}
                value={form[key] || ""}
                onChange={(next) =>
                  setForm((prev) => ({ ...prev, [key]: next }))
                }
              />
            );
          }

          if (type === "text") {
            return (
              <label key={key}>
                {label}
                {required ? " *" : ""}
                <textarea
                  rows={3}
                  maxLength={field.maxLength || 200}
                  value={form[key] || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </label>
            );
          }

          return (
            <label key={key}>
              {label}
              {required ? " *" : ""}
              <input
                type="text"
                maxLength={field.maxLength || 200}
                value={form[key] || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            </label>
          );
        })}

        <div className="wizard-actions">
          <Link className="ghost" to={`/create/${invitation.id}/details`}>
            {t("back")}
          </Link>
          <button type="submit" className="cta" disabled={busy}>
            {t("next")}
          </button>
        </div>
      </form>
    </WizardChrome>
  );
}

export function TextPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [structuredFields, setStructuredFields] = useState<Record<string, string>>(
    {},
  );
  const [blocks, setBlocks] = useState({
    header: "",
    body: "",
    date_time: "",
    address: "",
  });
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  useEffect(() => {
    if (!id) return;
    void api
      .getInvitation(id)
      .then(async (inv) => {
        setInvitation(inv);
        const fields =
          (inv.event_data?.structured_fields as Record<string, string>) || {};
        setStructuredFields(fields);
        const existing =
          (inv.event_data?.final_text_blocks as typeof blocks) || null;
        const slugs = getSelectedSubtypeSlugs(inv);
        const schedule = loadCeremonySchedule(inv.event_data, slugs);
        let subtypes: EventConfig["subtypes"];
        try {
          const ev = await api.event(inv.event_slug);
          subtypes = ev.subtypes;
        } catch {
          subtypes = undefined;
        }
        const dateTimeFromSchedule =
          inv.event_slug === "hayit"
            ? ""
            : buildCeremonyDateTimeText(
                schedule,
                subtypes,
                inv.language,
                fields.event_date,
                fields.event_time,
              );
        setScheduleDateTime(dateTimeFromSchedule);
        const multiSchedule = dateTimeFromSchedule.includes("\n");
        const defaultBody =
          fields.personal_message ||
          t(`defaultBody_${inv.event_slug}`, {
            defaultValue: t("defaultBody"),
          });
        const venueLine = cleanFieldValue(
          [fields.venue_name, fields.venue_address]
            .map((v) => String(v || "").trim())
            .filter(Boolean)
            .join(", "),
        );
        if (existing) {
          let body = formatDatesInText(existing.body || "", inv.language);
          let dateTime =
            inv.event_slug === "hayit"
              ? ""
              : formatDatesInText(
                  (multiSchedule
                    ? dateTimeFromSchedule
                    : existing.date_time || dateTimeFromSchedule) || "",
                  inv.language,
                );
          let address = existing.address || "";
          if (looksLikeDateTimeLine(body)) {
            if (!dateTime || isJunkFieldValue(dateTime)) {
              dateTime = dateTimeFromSchedule || body;
            }
            body = defaultBody;
          }
          if (!body.trim()) body = defaultBody;
          if (
            (inv.event_slug === "aqiqa" || inv.event_slug === "sunnat") &&
            fields.child_name
          ) {
            body = ensureChildNameInBody(body, fields.child_name, inv.language);
          }
          if (isJunkFieldValue(dateTime) && inv.event_slug !== "hayit") {
            dateTime = dateTimeFromSchedule;
          }
          if (isJunkFieldValue(address)) address = venueLine;
          setBlocks({
            header: formatDatesInText(existing.header || "", inv.language),
            body,
            date_time: dateTime,
            address,
          });
        } else {
          setBlocks({
            header: t("defaultGreeting"),
            body: ensureChildNameInBody(
              defaultBody,
              fields.child_name,
              inv.language,
            ),
            date_time: dateTimeFromSchedule,
            address: venueLine,
          });
        }
        return Promise.all([
          api.textTemplates(inv.event_slug, inv.language, {
            subtype_slug: inv.subtype_slug || inv.subtype_slugs?.[0] || undefined,
          }),
          Promise.resolve(inv),
        ]);
      })
      .then(([serverTemplates, inv]) => {
        setTemplates(
          mergeReadyTextTemplates(
            serverTemplates,
            buildLocalReadyTemplates(t, inv.event_slug, inv.language),
          ),
        );
      })
      .catch((err: Error) => setError(err.message));
  }, [id, t]);

  if (!invitation) {
    return (
      <WizardChrome step={4} title={t("text")} error={error}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  const classicCount = templates.filter((tpl) =>
    /classic|klassik|классик/i.test(tpl.title),
  ).length;
  let classicIndex = 0;

  return (
    <WizardChrome step={4} title={t("text")} hint={t("textHint")} error={error}>
      <div className="wizard-stack">
        {!!templates.length && (
          <section className="wizard-panel">
            <div className="wizard-panel-head">
              <h2>{t("readyTexts")}</h2>
            </div>
            <div className="choice-row" role="listbox" aria-label={t("readyTexts")}>
              {templates.map((tpl) => {
                const isClassic = /classic|klassik|классик/i.test(tpl.title);
                if (isClassic) classicIndex += 1;
                const label = isClassic
                  ? classicCount > 1
                    ? `${t("templateClassic")} ${classicIndex}`
                    : t("templateClassic")
                  : tpl.title;
                const active = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "choice-pill active" : "choice-pill"}
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      const vars = {
                        ...structuredFields,
                        child_name:
                          structuredFields.child_name ||
                          structuredFields.childName ||
                          "",
                        person_name:
                          structuredFields.person_name ||
                          structuredFields.personName ||
                          "",
                        personal_message:
                          structuredFields.personal_message ||
                          structuredFields.personalMessage ||
                          t(`defaultBody_${invitation.event_slug}`, {
                            defaultValue: t("defaultBody"),
                          }),
                      };
                      setBlocks(() => {
                        const next = splitTemplateBlocks(
                          tpl.preview_text,
                          vars,
                          invitation.language,
                          {
                            skipDate: invitation.event_slug === "hayit",
                            fallbackBody: t(`defaultBody_${invitation.event_slug}`, {
                              defaultValue: t("defaultBody"),
                            }),
                          },
                        );
                        // Keep per-ceremony schedule times if present
                        if (scheduleDateTime.includes("\n")) {
                          const shortBody = next.body
                            .split(/(?<=[.!?…])\s+/)
                            .slice(0, 2)
                            .join(" ")
                            .trim();
                          return {
                            ...next,
                            body:
                              shortBody.length > 40 && shortBody.length < next.body.length
                                ? shortBody
                                : next.body,
                            date_time: scheduleDateTime,
                          };
                        }
                        return next;
                      });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="wizard-panel">
          <div className="text-blocks">
            {(
              invitation.event_slug === "hayit"
                ? (["header", "body", "address"] as const)
                : (["header", "body", "date_time", "address"] as const)
            ).map((key) => (
              <label key={key} className={`text-block text-block-${key}`}>
                <span>{t(`block_${key}`)}</span>
                <textarea
                  rows={key === "body" ? 4 : 2}
                  value={blocks[key]}
                  onChange={(e) =>
                    setBlocks((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <div className="wizard-actions">
          <Link className="ghost" to={`/create/${invitation.id}/data`}>
            {t("back")}
          </Link>
          <button
            type="button"
            className="cta"
            disabled={busy || !blocks.body.trim()}
            onClick={() => {
              setBusy(true);
              setError(null);
              void api
                .patchInvitation(invitation.id, {
                  event_data: {
                    ...(invitation.event_data || {}),
                    text_source: "custom",
                    final_text_blocks: {
                      header: normalizeUzbekSpelling(blocks.header, invitation.language),
                      body: normalizeUzbekSpelling(blocks.body, invitation.language),
                      date_time: normalizeUzbekSpelling(blocks.date_time, invitation.language),
                      address: normalizeUzbekSpelling(blocks.address, invitation.language),
                      footer: "",
                    },
                  },
                })
                .then(() => navigate(`/create/${invitation.id}/style`))
                .catch((err: Error) => {
                  setError(err.message);
                  setBusy(false);
                });
            }}
          >
            {t("next")}
          </button>
        </div>
      </div>
    </WizardChrome>
  );
}

export function StylePage() {
  const { id } = useParams();
  const { t } = useTranslation();
  return (
    <WizardChrome step={5} title={t("style")} hint={t("styleHint")}>
      <div className="grid style-grid">
        <Link className="card-link style-card" to={`/create/${id}/style/templates`}>
          <strong>{t("pathTemplate")}</strong>
          <span>{t("pathTemplateDesc")}</span>
        </Link>
        <Link className="card-link style-card" to={`/create/${id}/style/ai`}>
          <strong>{t("pathAi")}</strong>
          <span>{t("pathAiDesc")}</span>
        </Link>
      </div>
      <div className="wizard-actions">
        <Link className="ghost" to={`/create/${id}/text`}>
          {t("back")}
        </Link>
      </div>
    </WizardChrome>
  );
}

export function StyleTemplatesPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [templates, setTemplates] = useState<JpgTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .getInvitation(id)
      .then((inv) => {
        setInvitation(inv);
        return api.templates(inv.event_slug);
      })
      .then(setTemplates)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (!invitation) {
    return (
      <WizardChrome step={5} title={t("pathTemplate")} error={error}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  return (
    <WizardChrome step={5} title={t("pathTemplate")} error={error}>
      {templates.length ? (
        <div className="grid template-picks">
          {templates.map((tpl) => {
            const preferred = invitation.template_id === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                className={
                  preferred ? "card-link template-pick preferred" : "card-link template-pick"
                }
                disabled={!!busyId}
                onClick={() => {
                  setBusyId(tpl.id);
                  setError(null);
                  void api
                    .patchInvitation(invitation.id, {
                      generation_path: "template",
                      template_id: tpl.id,
                    })
                    .then(() =>
                      navigate(`/create/${invitation.id}/generating`, {
                        replace: true,
                        state: { pendingGenerate: true },
                      }),
                    )
                    .catch((err: Error) => {
                      setError(err.message);
                      setBusyId(null);
                    });
                }}
              >
                <img src={tpl.bg_url_preview} alt={tpl.theme_name} />
                <span>{tpl.theme_name}</span>
                {preferred ? (
                  <small className="template-pick-badge">{t("gallerySelected")}</small>
                ) : null}
                {busyId === tpl.id && <small>{t("loading")}</small>}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("templatesEmpty")}
          body={t("templatesEmptyHint")}
          actionTo={`/create/${invitation.id}/style/ai`}
          actionLabel={t("pathAi")}
        />
      )}
      <div className="wizard-actions">
        <Link className="ghost" to={`/create/${invitation.id}/style`}>
          {t("back")}
        </Link>
      </div>
    </WizardChrome>
  );
}

export function StyleAiPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = normalizeUiLang(i18n.language);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [moods, setMoods] = useState<
    Record<string, Array<{ slug: string; name_translations: Record<string, string> }>>
  >({});
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [presetId, setPresetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void api
      .getInvitation(id)
      .then((inv) => {
        setInvitation(inv);
        setSelected(inv.selected_mood_tags || []);
        setNote(inv.custom_style_note || "");
        void api.moodTags().then(setMoods);
        void api.aiPresets(inv.event_slug).then((list) => {
          const kept = list.find((p) => p.id === inv.ai_preset_id);
          if (kept) setPresetId(kept.id);
          else if (list[0]) setPresetId(list[0].id);
        });
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (!invitation) {
    return (
      <WizardChrome step={5} title={t("pathAi")} error={error}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  return (
    <WizardChrome step={5} title={t("pathAi")} hint={t("pathAiDesc")} error={error}>
      <div className="wizard-stack">
        <section className="wizard-panel">
          <div className="mood-board">
            {Object.entries(moods).map(([category, tags]) => (
              <div key={category} className="mood-group">
                <h3>{t(`mood_${category}`, { defaultValue: category })}</h3>
                <div className="choice-row">
                  {tags.map((tag) => {
                    const active = selected.includes(tag.slug);
                    return (
                      <button
                        key={tag.slug}
                        type="button"
                        className={active ? "choice-pill active" : "choice-pill"}
                        aria-pressed={active}
                        onClick={() =>
                          setSelected((prev) =>
                            active
                              ? prev.filter((s) => s !== tag.slug)
                              : [...prev, tag.slug],
                          )
                        }
                      >
                        {t(`mood_${tag.slug}`, {
                          defaultValue:
                            pickTranslation(tag.name_translations, lang) || tag.slug,
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <label className="mood-note">
            <span className="mood-note-label">{t("customNote")}</span>
            <p id="custom-note-hint" className="mood-note-hint">
              {t("customNoteHint")}
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("customNotePlaceholder")}
              aria-describedby="custom-note-hint"
            />
          </label>
        </section>

        <div className="wizard-actions">
          <Link className="ghost" to={`/create/${invitation.id}/style`}>
            {t("back")}
          </Link>
          <button
            type="button"
            className="cta"
            disabled={busy || (!selected.length && !note.trim())}
            onClick={() => {
              if (!selected.length && !note.trim()) {
                setError(t("moodRequired"));
                return;
              }
              setBusy(true);
              setError(null);
              void api
                .patchInvitation(invitation.id, {
                  generation_path: "ai_from_scratch",
                  selected_mood_tags: selected,
                  custom_style_note: note.trim(),
                  ai_preset_id: presetId || null,
                })
                .then(() =>
                  navigate(`/create/${invitation.id}/generating`, {
                    replace: true,
                    state: { pendingGenerate: true },
                  }),
                )
                .catch((err: Error) => {
                  setError(err.message);
                  setBusy(false);
                });
            }}
          >
            {busy ? t("loading") : t("generate")}
          </button>
        </div>
      </div>
    </WizardChrome>
  );
}

export function GeneratingPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState(t("generating"));
  const [failed, setFailed] = useState(false);
  const [polling, setPolling] = useState(false);
  const kickStarted = useRef(false);

  useEffect(() => {
    if (!id || kickStarted.current) return;
    kickStarted.current = true;
    const state = location.state as
      | { pendingGenerate?: boolean; pendingFormat?: "9:16" | "1:1" }
      | null;

    const fail = (msg: string) => {
      setFailed(true);
      setMessage(msg || t("generateFailed"));
    };

    void api
      .getInvitation(id)
      .then((inv) => {
        if (state?.pendingFormat) {
          return api.generateFormat(id, state.pendingFormat).then(() => setPolling(true));
        }
        if (state?.pendingGenerate) {
          return api.generate(id).then(() => setPolling(true));
        }
        if (inv.status === "ready") {
          navigate(`/create/${id}/result`, { replace: true });
          return;
        }
        if (inv.status === "generating") {
          setPolling(true);
          return;
        }
        if (inv.status === "failed") {
          fail(inv.last_error || t("generateFailed"));
          return;
        }
        if (inv.generation_path) {
          return api.generate(id).then(() => setPolling(true));
        }
        navigate(invitationContinuePath(inv), { replace: true });
      })
      .catch((err: Error) => fail(err.message || t("generateFailed")));
  }, [id, location.state, navigate, t]);

  useEffect(() => {
    if (!id || failed || !polling) return;
    const startedAt = Date.now();
    const poll = () => {
      if (Date.now() - startedAt > 150_000) {
        setFailed(true);
        setMessage(t("generateTimeout"));
        return;
      }
      void api
        .status(id)
        .then((st) => {
          if (st.status === "ready") navigate(`/create/${id}/result`);
          else if (st.status === "failed") {
            setFailed(true);
            setMessage(st.error || t("generateFailed"));
          }
        })
        .catch((err: Error) => {
          setFailed(true);
          setMessage(err.message);
        });
    };
    poll();
    const timer = window.setInterval(poll, 700);
    return () => window.clearInterval(timer);
  }, [id, navigate, t, failed, polling]);

  return (
    <WizardChrome step={5} title="">
      <GeneratingScene failed={failed} message={failed ? message : undefined} />
      {failed && id && (
        <div className="wizard-actions">
          <Link className="cta" to={`/create/${id}/style`}>
            {t("tryAgain")}
          </Link>
        </div>
      )}
    </WizardChrome>
  );
}

export function ResultPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharedImage, setSharedImage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState({
    header: "",
    body: "",
    date_time: "",
    address: "",
  });

  useEffect(() => {
    if (!id) return;
    void api
      .getInvitation(id)
      .then((inv) => {
        if (inv.status === "generating") {
          navigate(`/create/${id}/generating`, { replace: true });
          return;
        }
        if (inv.status !== "ready") {
          navigate(invitationContinuePath(inv), { replace: true });
          return;
        }
        setInvitation(inv);
        const existing =
          (inv.event_data?.final_text_blocks as typeof blocks) || {};
        setBlocks({
          header: formatDatesInText(existing.header || "", inv.language),
          body: formatDatesInText(existing.body || "", inv.language),
          date_time:
            inv.event_slug === "hayit"
              ? ""
              : formatDatesInText(existing.date_time || "", inv.language),
          address: existing.address || "",
        });
      })
      .catch((err: Error) => setError(err.message));
  }, [id, navigate]);

  if (!invitation) {
    return (
      <WizardChrome step={6} title={t("result")} error={error}>
        <PageLoader label={t("loading")} />
      </WizardChrome>
    );
  }

  const regenerate = () => {
    setBusy(true);
    setError(null);
    void api
      .patchInvitation(invitation.id, {
        event_data: {
          ...(invitation.event_data || {}),
                    final_text_blocks: {
                      header: normalizeUzbekSpelling(blocks.header, invitation.language),
                      body: normalizeUzbekSpelling(blocks.body, invitation.language),
                      date_time:
                        invitation.event_slug === "hayit"
                          ? ""
                          : normalizeUzbekSpelling(blocks.date_time, invitation.language),
                      address: normalizeUzbekSpelling(blocks.address, invitation.language),
                    },
        },
      })
      .then(() =>
        navigate(`/create/${invitation.id}/generating`, {
          replace: true,
          state: { pendingGenerate: true },
        }),
      )
      .catch((err: Error) => {
        setError(err.message);
        setBusy(false);
      });
  };

  const shareImage = async () => {
    setError(null);
    try {
      const d = await api.download(invitation.id);
      void api.share(invitation.id, "share_image").catch(() => undefined);
      const resp = await fetch(d.url);
      const blob = await resp.blob();
      const file = new File([blob], `lutfan-${invitation.id}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          files: [file],
          title: t("brand"),
          text: t("shareImageHint"),
        });
        setSharedImage(true);
        window.setTimeout(() => setSharedImage(false), 2000);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setSharedImage(true);
      window.setTimeout(() => setSharedImage(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shareFailed"));
    }
  };

  return (
    <WizardChrome step={6} title={t("result")} error={error}>
      {invitation.final_image_url ? (
        <div className="result-stage">
          <img
            className="result-img"
            src={invitation.final_image_url}
            alt={t("resultAlt")}
          />
        </div>
      ) : (
        <EmptyState
          title={t(`status_${invitation.status}`, { defaultValue: invitation.status })}
          body={t("resultNotReady")}
          actionTo={`/create/${invitation.id}/style`}
          actionLabel={t("tryAgain")}
        />
      )}
      {invitation.final_image_url && (
        <div className="result-actions">
          <div className="result-primary">
            <button
              type="button"
              className="cta btn-with-icon"
              onClick={() => {
                void api
                  .download(invitation.id)
                  .then((d) =>
                    downloadImageFile(d.url, `lutfan-${invitation.id}-hd.jpg`),
                  )
                  .catch((err: Error) => setError(err.message));
              }}
            >
              <IconDownload />
              {t("downloadHd")}
            </button>
          </div>
          <div className="result-edit-actions">
            <button
              type="button"
              className="ghost btn-with-icon"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? <IconClose /> : <IconEdit />}
              {editing ? t("cancelEdit") : t("editText")}
            </button>
            <Link className="ghost btn-with-icon" to={`/create/${invitation.id}/style`}>
              <IconPalette />
              {t("changeStyle")}
            </Link>
            <button
              type="button"
              className="ghost btn-with-icon"
              onClick={() => void shareImage()}
            >
              <IconShare />
              {sharedImage ? t("sharedImage") : t("shareImage")}
            </button>
          </div>
          {editing && (
            <section className="wizard-panel result-edit-panel">
              <div className="text-blocks">
                {(
                  invitation.event_slug === "hayit"
                    ? (["header", "body", "address"] as const)
                    : (["header", "body", "date_time", "address"] as const)
                ).map((key) => (
                  <label key={key} className={`text-block text-block-${key}`}>
                    <span>{t(`block_${key}`)}</span>
                    <textarea
                      rows={key === "body" ? 4 : 2}
                      value={blocks[key]}
                      onChange={(e) =>
                        setBlocks((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="cta btn-with-icon"
                disabled={busy}
                onClick={regenerate}
              >
                <IconRefresh />
                {busy ? t("loading") : t("regenerate")}
              </button>
            </section>
          )}
          <div className="result-secondary">
            <AdditionalFormatButtons
              invitation={invitation}
              onError={setError}
              t={t}
            />
          </div>
          <div className="result-tertiary">
            <button
              type="button"
              className="ghost btn-with-icon"
              onClick={() => {
                void api
                  .share(invitation.id, "copy_link")
                  .then(async () => {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/i/${invitation.id}`,
                    );
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  })
                  .catch((err: Error) => setError(err.message));
              }}
            >
              <IconLink />
              {copied ? t("copied") : t("shareLink")}
            </button>
            <Link className="ghost btn-with-icon" to="/create">
              <IconPlus />
              {t("createNew")}
            </Link>
            <Link className="ghost btn-with-icon" to="/account">
              <IconUser />
              {t("account")}
            </Link>
          </div>
        </div>
      )}
    </WizardChrome>
  );
}

function AdditionalFormatButtons({
  invitation,
  t,
  onError,
}: {
  invitation: Invitation;
  t: (key: string, options?: any) => string;
  onError: (msg: string | null) => void;
}) {
  const navigate = useNavigate();
  const additional = invitation.additional_formats || {};
  const url9 = additional["9:16"];
  const url11 = additional["1:1"];

  const gen = (fmt: "9:16" | "1:1") => {
    navigate(`/create/${invitation.id}/generating`, {
      replace: true,
      state: { pendingFormat: fmt },
    });
  };

  return (
    <>
      <button
        type="button"
        className="ghost btn-with-icon"
        onClick={() => {
          if (url9) {
            void api
              .download(invitation.id, "9:16")
              .then((d) =>
                downloadImageFile(d.url, `lutfan-${invitation.id}-9x16.jpg`),
              )
              .catch((err: Error) => onError(err.message));
          } else {
            gen("9:16");
          }
        }}
      >
        {url9 ? <IconDownload /> : <IconRatio916 />}
        {url9 ? `${t("download")} 9:16` : `${t("generate")} 9:16`}
      </button>
      <button
        type="button"
        className="ghost btn-with-icon"
        onClick={() => {
          if (url11) {
            void api
              .download(invitation.id, "1:1")
              .then((d) =>
                downloadImageFile(d.url, `lutfan-${invitation.id}-1x1.jpg`),
              )
              .catch((err: Error) => onError(err.message));
          } else {
            gen("1:1");
          }
        }}
      >
        {url11 ? <IconDownload /> : <IconRatio11 />}
        {url11 ? `${t("download")} 1:1` : `${t("generate")} 1:1`}
      </button>
    </>
  );
}
