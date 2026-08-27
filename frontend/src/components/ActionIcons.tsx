import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "default" | "danger" | "ok";
  children: ReactNode;
};

export function IconBtn({
  label,
  tone = "default",
  children,
  className = "",
  ...rest
}: IconBtnProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${tone} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPower() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 7.2a7.5 7.5 0 1 0 11 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconBan() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6.2 6.2l11.6 11.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconExternal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 5h5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 14L19 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function IconDownload() {
  return (
    <Svg>
      <path
        d="M12 3v12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.5 11.5 12 16l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconShare() {
  return (
    <Svg>
      <circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.2 10.8 15.7 6.4M8.2 13.2l7.5 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconPalette() {
  return (
    <Svg>
      <path
        d="M12 3.5a8.5 8.5 0 1 0 0 17h1.6a2.4 2.4 0 0 0 0-4.8H12a2 2 0 0 1 0-4h4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.2" cy="10" r="1.15" fill="currentColor" />
      <circle cx="10.5" cy="7.2" r="1.15" fill="currentColor" />
      <circle cx="14.2" cy="7.2" r="1.15" fill="currentColor" />
    </Svg>
  );
}

export function IconLink() {
  return (
    <Svg>
      <path
        d="M9.5 14.5 14.5 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11 16.5 9.2 18.3a3.2 3.2 0 0 1-4.5-4.5L6.5 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 7.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5L17.5 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPlus() {
  return (
    <Svg>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconClose() {
  return (
    <Svg>
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconRatio916() {
  return (
    <Svg>
      <rect
        x="7.5"
        y="3.5"
        width="9"
        height="17"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function IconRatio11() {
  return (
    <Svg>
      <rect
        x="5.5"
        y="5.5"
        width="13"
        height="13"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function IconRefresh() {
  return (
    <Svg>
      <path
        d="M20 12a8 8 0 1 1-2.2-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 5v5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
