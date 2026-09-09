import { ConfigProvider, DatePicker, TimePicker, theme } from "antd";
import type { Locale } from "antd/es/locale";
import type { PickerLocale } from "antd/es/date-picker/generatePicker";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useRef } from "react";
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

export function TimeField({
  label,
  required,
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
    value && dayjs(value, [TIME_FMT, "HH:mm:ss"], true).isValid()
      ? dayjs(value, [TIME_FMT, "HH:mm:ss"])
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
        <TimePicker
          className="app-datepicker"
          popupClassName="app-picker-dropdown"
          locale={pickerLocale}
          value={parsed}
          format={TIME_FMT}
          minuteStep={5}
          needConfirm={false}
          allowClear={!required}
          disabled={disabled}
          status={showInvalid ? "error" : undefined}
          inputReadOnly
          placeholder="HH:mm"
          showNow
          placement="bottomLeft"
          getPopupContainer={() => document.body}
          styles={{ popup: { root: popupLabelStyle(labels) } }}
          onOpenChange={(open) => {
            if (open) scrollFieldIntoView(wrapRef.current);
          }}
          onChange={(d: Dayjs | null) => {
            onChange(d ? d.format(TIME_FMT) : "");
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
