import type { ReactNode } from "react";

type EventIconProps = {
  slug: string;
  size?: number;
  className?: string;
};

function Svg({
  size,
  children,
}: {
  size: number;
  children: ReactNode;
}) {
  return (
    <svg
      className="event-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function NikohIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <circle cx="9.1" cy="13.2" r="5.1" {...stroke} />
      <circle cx="14.9" cy="13.2" r="5.1" {...stroke} />
      <path d="M12 5.2 12.7 6.8 14.4 7l-1.3 1.1.4 1.7L12 8.9l-1.5.9.4-1.7L9.6 7l1.7-.2z" fill="currentColor" />
    </Svg>
  );
}

function AqiqaIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path
        d="M15.2 6.4a7.2 7.2 0 1 0 2.2 10.4 6.1 6.1 0 0 1-2.2-10.4z"
        {...stroke}
      />
      <circle cx="16.8" cy="6.6" r="1.15" fill="currentColor" />
      <path
        d="M17.8 10.2c.7.2 1.1.8 1.1 1.5 0 .8-.6 1.4-1.1 1.6-.5-.2-1.1-.8-1.1-1.6 0-.7.4-1.3 1.1-1.5z"
        fill="currentColor"
      />
    </Svg>
  );
}

function SunnatIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M7.4 12.8c0-2.6 1.9-5.1 4.6-5.1s4.6 2.5 4.6 5.1" {...stroke} />
      <path d="M6.4 12.8h11.2" {...stroke} />
      <path d="M7.8 12.8h8.4c-.35 2.2-2.1 3.8-4.2 3.8s-3.85-1.6-4.2-3.8z" {...stroke} />
      <circle cx="12" cy="6.8" r="1" fill="currentColor" />
      <path d="M9.2 15.1h5.6" {...stroke} />
    </Svg>
  );
}

function BirthdayIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M5.8 14.4h12.4v5.2a1.2 1.2 0 0 1-1.2 1.2H7a1.2 1.2 0 0 1-1.2-1.2z" {...stroke} />
      <path d="M7 14.4h10v-2.2a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1z" {...stroke} />
      <path d="M12 11.2V7.6" {...stroke} />
      <path
        d="M12 7.5c1-.95 1.1-1.95.3-2.75-.75.35-1.35 1.15-1.05 2.2.1.4.45.55.75.55z"
        fill="currentColor"
      />
      <path d="M8.6 17.2h6.8" {...stroke} />
    </Svg>
  );
}

function HudoyiIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M6.2 14.2c.4 3.2 2.7 5.3 5.8 5.3s5.4-2.1 5.8-5.3" {...stroke} />
      <path d="M5.4 14.2h13.2" {...stroke} />
      <path d="M8.4 14.2c.35-1.3 1.7-2.2 3.6-2.2s3.25.9 3.6 2.2" {...stroke} />
      <path d="M10.1 8.2c.15 1.2.7 1.8 1.9 1.8" {...stroke} />
      <path d="M13.6 7.4c.1 1.1.6 1.7 1.6 1.8" {...stroke} />
    </Svg>
  );
}

function HayitIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M12 4.4v1.6" {...stroke} />
      <path d="M9.2 6h5.6l1.5 2.2H7.7z" {...stroke} />
      <path d="M8.2 8.2h7.6v8.4a1.4 1.4 0 0 1-1.4 1.4H9.6a1.4 1.4 0 0 1-1.4-1.4z" {...stroke} />
      <path d="M13.3 11.2a2.15 2.15 0 1 0 .15 3.35 1.8 1.8 0 0 1-.15-3.35z" {...stroke} />
    </Svg>
  );
}

function DefaultIcon({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="2.2" {...stroke} />
      <path d="M12 8.2v7.6M8.2 12h7.6" {...stroke} />
    </Svg>
  );
}

const ICONS: Record<string, (props: { size: number }) => ReactNode> = {
  nikoh: NikohIcon,
  aqiqa: AqiqaIcon,
  sunnat: SunnatIcon,
  birthday: BirthdayIcon,
  hudoyi: HudoyiIcon,
  hayit: HayitIcon,
};

export function EventIcon({ slug, size = 26, className = "" }: EventIconProps) {
  const Icon = ICONS[slug] || DefaultIcon;
  return (
    <span className={`event-icon-wrap ${className}`.trim()} data-event={slug} aria-hidden>
      <Icon size={size} />
    </span>
  );
}
