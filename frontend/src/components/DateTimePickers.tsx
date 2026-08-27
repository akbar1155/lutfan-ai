import { ConfigProvider, DatePicker, TimePicker, theme } from "antd";
import type { Locale } from "antd/es/locale";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/ru";
import "dayjs/locale/uz-latn";
import { useMemo, useRef, type ReactNode } from "react";
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

function antdLocale(lang: UiLang): Locale {
  // Stable default locale. Placeholder/button texts are handled via props/CSS.
  return lang === "ru" ? ruRU : enGB;
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

function PickerShell({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const lang = normalizeUiLang(i18n.language);
  const locale = useMemo(() => {
    dayjs.locale(dayjsLocale(lang));
    return antdLocale(lang);
  }, [lang]);

  return (
    <ConfigProvider locale={locale} theme={appTheme}>
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
};

function scrollFieldIntoView(el: HTMLElement | null) {
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function DateField({
  label,
  required,
  minToday,
  value,
  onChange,
  disabled,
}: FieldProps) {
  const wrapRef = useRef<HTMLLabelElement>(null);
  const parsed =
    value && dayjs(value, ISO_DATE, true).isValid()
      ? dayjs(value, ISO_DATE)
      : null;

  return (
    <label className="ui-field date-time-field" ref={wrapRef}>
      <span className="ui-field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <PickerShell>
        <DatePicker
          className="app-datepicker"
          popupClassName="app-picker-dropdown"
          value={parsed}
          format={DATE_FMT}
          allowClear={!required}
          disabled={disabled}
          inputReadOnly
          placeholder={DATE_FMT.toLowerCase()}
          placement="bottomLeft"
          getPopupContainer={() => document.body}
          disabledDate={
            minToday
              ? (current) =>
                  !!current && current.startOf("day").isBefore(dayjs().startOf("day"))
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
    </label>
  );
}

export function TimeField({ label, required, value, onChange, disabled }: FieldProps) {
  const wrapRef = useRef<HTMLLabelElement>(null);
  const parsed =
    value && dayjs(value, [TIME_FMT, "HH:mm:ss"], true).isValid()
      ? dayjs(value, [TIME_FMT, "HH:mm:ss"])
      : null;

  return (
    <label className="ui-field date-time-field" ref={wrapRef}>
      <span className="ui-field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <PickerShell>
        <TimePicker
          className="app-datepicker"
          popupClassName="app-picker-dropdown"
          value={parsed}
          format={TIME_FMT}
          minuteStep={5}
          needConfirm={false}
          allowClear={!required}
          disabled={disabled}
          inputReadOnly
          placeholder="HH:mm"
          showNow
          placement="bottomLeft"
          getPopupContainer={() => document.body}
          onOpenChange={(open) => {
            if (open) scrollFieldIntoView(wrapRef.current);
          }}
          onChange={(d: Dayjs | null) => {
            onChange(d ? d.format(TIME_FMT) : "");
          }}
        />
      </PickerShell>
    </label>
  );
}
