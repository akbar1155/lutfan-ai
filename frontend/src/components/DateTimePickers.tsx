import { ConfigProvider, DatePicker, theme } from "antd";
import type { Locale } from "antd/es/locale";
import type { PickerLocale } from "antd/es/date-picker/generatePicker";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/ru";
import "dayjs/locale/uz-latn";
import { useTranslation } from "react-i18next";
import ruRU from "antd/locale/ru_RU";
import enGB from "antd/locale/en_GB";
import { normalizeUiLang, type UiLang } from "../i18n/lang";

dayjs.extend(customParseFormat);

const DATE_FMT = "DD.MM.YYYY";
const TIME_FMT = "HH:mm";
const ISO_DATE = "YYYY-MM-DD";
const HOUR_MIN = 5;
const HOUR_MAX = 21;
const HOURS = Array.from(
  { length: HOUR_MAX - HOUR_MIN + 1 },
  (_, i) => HOUR_MIN + i,
);
const MINUTES = [0, 30] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHm(value?: string): { hour: number; minute: number } | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Snap to allowed slots: 05:00–21:00, minutes 00/30 (21:00 only). */
function snapAllowedTime(value?: string): string {
  const parsed = parseHm(value);
  if (!parsed) return "";
  let { hour, minute } = parsed;
  minute = minute >= 30 ? 30 : 0;
  if (hour < HOUR_MIN) {
    hour = HOUR_MIN;
    minute = 0;
  }
  if (hour > HOUR_MAX || (hour === HOUR_MAX && minute !== 0)) {
    hour = HOUR_MAX;
    minute = 0;
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

function dayjsLocale(lang: UiLang): string {
  if (lang === "ru") return "ru";
  return "uz-latn";
}

function buildLocales(
  lang: UiLang,
  labels: { now: string; today: string },
): { configLocale: Locale; pickerLocale: PickerLocale } {
  // Vite ESM may wrap locale modules; unwrap `.default` when present.
  const raw = (lang === "ru" ? ruRU : enGB) as Locale & { default?: Locale };
  const base = (raw?.default ?? raw) as Locale;
  const datePicker = (base.DatePicker || {}) as PickerLocale;
  const langPack = (datePicker.lang || {}) as PickerLocale["lang"];
  const pickerLocale: PickerLocale = {
    ...datePicker,
    lang: {
      ...langPack,
      now: labels.now,
      today: labels.today,
    },
  };
  return {
    configLocale: { ...base, DatePicker: pickerLocale },
    pickerLocale,
  };
}

const appTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#1a4540",
    colorInfo: "#1a4540",
    colorSuccess: "#2f6b45",
    colorError: "#a33b32",
    colorText: "#14201d",
    colorTextSecondary: "#5f6b67",
    colorBorder: "#ddd6cb",
    colorBgContainer: "#fffcf7",
    colorBgElevated: "#fffcf7",
    borderRadius: 9,
    fontFamily: '"Sora", "Avenir Next", "Segoe UI", sans-serif',
    controlHeight: 44,
  },
  components: {
    DatePicker: {
      cellHeight: 32,
      cellWidth: 36,
    },
  },
};

function useLocalizedPicker() {
  const { i18n, t } = useTranslation();
  const lang = normalizeUiLang(i18n.language);
  return useMemo(() => {
    dayjs.locale(dayjsLocale(lang));
    const labels = {
      now: t("pickerNow", {
        defaultValue:
          lang === "ru" ? "Сейчас" : lang === "uz-cyrl" ? "Ҳозир" : "Hozir",
      }),
      today: t("pickerToday", {
        defaultValue:
          lang === "ru" ? "Сегодня" : lang === "uz-cyrl" ? "Бугун" : "Bugun",
      }),
      hour: t("pickerHour", {
        defaultValue: lang === "ru" ? "Час" : lang === "uz-cyrl" ? "Соат" : "Soat",
      }),
      minute: t("pickerMinute", {
        defaultValue:
          lang === "ru" ? "Минута" : lang === "uz-cyrl" ? "Дақиқа" : "Daqiqa",
      }),
      clear: t("pickerClear", {
        defaultValue:
          lang === "ru" ? "Очистить" : lang === "uz-cyrl" ? "Тозалаш" : "Tozalash",
      }),
      done: t("pickerDone", {
        defaultValue:
          lang === "ru" ? "Готово" : lang === "uz-cyrl" ? "Тайёр" : "Tayyor",
      }),
    };
    const { configLocale, pickerLocale } = buildLocales(lang, labels);
    return { lang, labels, configLocale, pickerLocale };
  }, [lang, t, i18n.language]);
}

function PickerShell({ children }: { children: ReactNode }) {
  const { lang, configLocale } = useLocalizedPicker();
  return (
    <ConfigProvider key={lang} locale={configLocale} theme={appTheme}>
      {children}
    </ConfigProvider>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  minToday?: boolean;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
};

function scrollFieldIntoView(el: HTMLElement | null) {
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function popupLabelStyle(labels: { now: string; today: string }): CSSProperties {
  return {
    ["--picker-now-label" as string]: JSON.stringify(labels.now),
    ["--picker-today-label" as string]: JSON.stringify(labels.today),
  };
}

export function DateField({
  label,
  required,
  minToday,
  value,
  onChange,
  disabled,
  invalid,
  error,
}: FieldProps) {
  const wrapRef = useRef<HTMLLabelElement>(null);
  const { pickerLocale, labels } = useLocalizedPicker();
  const showInvalid = invalid || Boolean(error);
  const parsed =
    value && dayjs(value, ISO_DATE, true).isValid()
      ? dayjs(value, ISO_DATE)
      : null;

  return (
    <label
      className={`ui-field date-time-field${showInvalid ? " field-invalid" : ""}`}
      ref={wrapRef}
    >
      <span className="ui-field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <PickerShell>
        <DatePicker
          className="app-datepicker"
          popupClassName="app-picker-dropdown"
          locale={pickerLocale}
          value={parsed}
          format={DATE_FMT}
          allowClear={!required}
          disabled={disabled}
          status={showInvalid ? "error" : undefined}
          inputReadOnly
          placeholder={DATE_FMT.toLowerCase()}
          placement="bottomLeft"
          getPopupContainer={() => document.body}
          showNow
          styles={{ popup: { root: popupLabelStyle(labels) } }}
          disabledDate={
            minToday
              ? (current) =>
                  !!current &&
                  current.startOf("day").isBefore(dayjs().startOf("day"))
              : undefined
          }
          onOpenChange={(open) => {
            if (open) scrollFieldIntoView(wrapRef.current);
          }}
          onChange={(d: Dayjs | null) => {
            onChange(d ? d.format(ISO_DATE) : "");
          }}
        />
      </PickerShell>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const WHEEL_ITEM = 32;
const WHEEL_VISIBLE = 5;
const WHEEL_PAD = Math.floor(WHEEL_VISIBLE / 2); // items above/below center

type WheelColumnProps = {
  options: number[];
  value: number;
  ariaLabel: string;
  onChange: (next: number) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function WheelColumn({ options, value, ariaLabel, onChange }: WheelColumnProps) {
  const initialOffset =
    Math.max(0, options.indexOf(value) >= 0 ? options.indexOf(value) : 0) *
    WHEEL_ITEM;
  const viewportRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(initialOffset);
  const [offset, setOffset] = useState(initialOffset);
  const dragging = useRef(false);
  const wheelTimer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const indexOf = (v: number) => {
    const i = optionsRef.current.indexOf(v);
    return i >= 0 ? i : 0;
  };

  const applyOffset = (next: number, commit: boolean) => {
    const max = Math.max(0, optionsRef.current.length - 1) * WHEEL_ITEM;
    const clamped = clamp(next, 0, max);
    offsetRef.current = clamped;
    setOffset(clamped);
    if (!commit) return;
    const idx = Math.round(clamped / WHEEL_ITEM);
    const picked = optionsRef.current[clamp(idx, 0, optionsRef.current.length - 1)];
    if (picked !== undefined) onChangeRef.current(picked);
  };

  const snap = (nextOffset: number) => {
    const idx = Math.round(nextOffset / WHEEL_ITEM);
    applyOffset(idx * WHEEL_ITEM, true);
  };

  // Sync from selected value when not dragging.
  useEffect(() => {
    if (dragging.current) return;
    const target = indexOf(value) * WHEEL_ITEM;
    if (Math.abs(offsetRef.current - target) < 0.5) return;
    offsetRef.current = target;
    setOffset(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.join(",")]);

  // Wheel / trackpad — listen non-passively.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      applyOffset(offsetRef.current + e.deltaY, false);
      if (wheelTimer.current != null) window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => snap(offsetRef.current), 90);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimer.current != null) window.clearTimeout(wheelTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = WHEEL_PAD * WHEEL_ITEM - offset;
  const activeIdx = clamp(
    Math.round(offset / WHEEL_ITEM),
    0,
    Math.max(0, options.length - 1),
  );

  return (
    <div className="time-wheel-col">
      <div
        ref={viewportRef}
        className="time-wheel-viewport"
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          dragging.current = true;
          const startY = e.clientY;
          const startOffset = offsetRef.current;
          let didMove = false;
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);

          const onMove = (ev: PointerEvent) => {
            const dy = startY - ev.clientY;
            if (Math.abs(dy) > 2) didMove = true;
            applyOffset(startOffset + dy, false);
          };
          const onUp = (ev: PointerEvent) => {
            dragging.current = false;
            target.releasePointerCapture(ev.pointerId);
            target.removeEventListener("pointermove", onMove);
            target.removeEventListener("pointerup", onUp);
            target.removeEventListener("pointercancel", onUp);

            if (!didMove) {
              // Tap: pick item under the pointer relative to center.
              const rect = target.getBoundingClientRect();
              const deltaItems = Math.round(
                (ev.clientY - (rect.top + rect.height / 2)) / WHEEL_ITEM,
              );
              const currentIdx = Math.round(offsetRef.current / WHEEL_ITEM);
              applyOffset((currentIdx + deltaItems) * WHEEL_ITEM, true);
              return;
            }
            snap(offsetRef.current);
          };
          target.addEventListener("pointermove", onMove);
          target.addEventListener("pointerup", onUp);
          target.addEventListener("pointercancel", onUp);
        }}
        onKeyDown={(e) => {
          const i = indexOf(value);
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            applyOffset((i + 1) * WHEEL_ITEM, true);
          } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            applyOffset((i - 1) * WHEEL_ITEM, true);
          }
        }}
      >
        <div
          className="time-wheel-track"
          style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
        >
          {options.map((opt, i) => {
            const active = i === activeIdx;
            return (
              <div
                key={opt}
                role="option"
                aria-selected={active}
                className={`time-wheel-item${active ? " is-active" : ""}`}
              >
                {pad2(opt)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TimeField({
  label,
  required,
  value,
  onChange,
  disabled,
  invalid,
  error,
}: FieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { labels } = useLocalizedPicker();
  const listId = useId();
  const showInvalid = invalid || Boolean(error);
  const [open, setOpen] = useState(false);

  const display = snapAllowedTime(value) || "";
  const selected = parseHm(display) || { hour: 10, minute: 0 };
  const minuteOptions = useMemo(
    () => (selected.hour === HOUR_MAX ? [0] : [...MINUTES]),
    [selected.hour],
  );
  const minuteValue = minuteOptions.includes(selected.minute)
    ? selected.minute
    : minuteOptions[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!value) return;
    const snapped = snapAllowedTime(value);
    if (snapped && snapped !== value) onChangeRef.current(snapped);
  }, [value]);

  const pick = (hour: number, minute: number) => {
    let h = hour;
    let m = minute;
    if (h === HOUR_MAX) m = 0;
    if (h < HOUR_MIN) h = HOUR_MIN;
    if (h > HOUR_MAX) h = HOUR_MAX;
    onChange(`${pad2(h)}:${pad2(m)}`);
  };

  return (
    <div
      className={`ui-field date-time-field time-wheel-field${showInvalid ? " field-invalid" : ""}${open ? " is-open" : ""}`}
      ref={wrapRef}
    >
      <span className="ui-field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <button
        type="button"
        className="time-wheel-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <span className={display ? "time-wheel-value" : "time-wheel-placeholder"}>
          {display || TIME_FMT}
        </span>
        <span className="time-wheel-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M12 8v4.2l2.6 1.6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          className="time-wheel-panel"
          id={listId}
          ref={panelRef}
          role="dialog"
          aria-label={label}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="time-wheel-headings">
            <span>{labels.hour}</span>
            <span>{labels.minute}</span>
          </div>
          <div className="time-wheel-body">
            <div className="time-wheel-highlight" aria-hidden />
            <WheelColumn
              options={HOURS}
              value={selected.hour}
              ariaLabel={labels.hour}
              onChange={(hour) => {
                const nextMinute =
                  hour === HOUR_MAX ? 0 : selected.minute === 30 ? 30 : 0;
                pick(hour, nextMinute);
              }}
            />
            <div className="time-wheel-divider" aria-hidden>
              :
            </div>
            <WheelColumn
              key={`mins-${minuteOptions.join("-")}`}
              options={minuteOptions}
              value={minuteValue}
              ariaLabel={labels.minute}
              onChange={(minute) => pick(selected.hour || 10, minute)}
            />
          </div>
          <div className="time-wheel-actions">
            {!required ? (
              <button
                type="button"
                className="time-wheel-clear"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {labels.clear}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="time-wheel-done"
              onClick={() => {
                if (!display) pick(selected.hour, selected.minute);
                setOpen(false);
              }}
            >
              {labels.done}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
