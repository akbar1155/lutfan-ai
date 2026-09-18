import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function IconPhone() {
  return (
    <Svg>
      <rect x="7.5" y="3" width="9" height="18" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 18.6h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconComputer() {
  return (
    <Svg>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 19.5h8M12 16v3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconInfo() {
  return (
    <Svg>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      <circle cx="8.2" cy="10" r="1.1" fill="currentColor" />
      <circle cx="10.5" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="14.2" cy="7.2" r="1.1" fill="currentColor" />
    </Svg>
  );
}

export function IconPattern() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </Svg>
  );
}

export function IconFlower() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path
        d="M12 5c2 2 2 4 0 6-2-2-2-4 0-6zm7 7c-2 2-4 2-6 0 2-2 4-2 6 0zM12 19c-2-2-2-4 0-6 2 2 2 4 0 6zM5 12c2-2 4-2 6 0-2 2-4 2-6 0z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPaper() {
  return (
    <Svg>
      <path
        d="M7 4.5h7.2L19 9.2V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5H7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 4.8V9h4.4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconFrame() {
  return (
    <Svg>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="0.8" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function IconType() {
  return (
    <Svg>
      <path d="M5 6.5h14M12 6.5V18.5M8.5 18.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMotion() {
  return (
    <Svg>
      <path d="M5 16c4-8 10-8 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12c2.5-4 5.5-4 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1.4" fill="currentColor" />
    </Svg>
  );
}

export function IconDensity() {
  return (
    <Svg>
      <path d="M5 8h4M5 12h8M5 16h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSparkle() {
  return (
    <Svg>
      <path
        d="M12 3.2 13.4 8.6 19 10l-5.6 1.4L12 16.8l-1.4-5.4L5 10l5.6-1.4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconMusic() {
  return (
    <Svg>
      <path d="M9 18.5a2.5 2.5 0 1 1-2-2.45V8.2L19 5.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="17" cy="16.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

export function IconPrev() {
  return (
    <Svg>
      <path d="M18 6.5v11l-8.5-5.5L18 6.5zM6.8 6.2v11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconNext() {
  return (
    <Svg>
      <path d="M6 6.5v11l8.5-5.5L6 6.5zM17.2 6.2v11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconPlay() {
  return (
    <Svg>
      <path d="M9 7.2v9.6l8-4.8-8-4.8z" fill="currentColor" />
    </Svg>
  );
}

export function IconPause() {
  return (
    <Svg>
      <path d="M8 7h2.6v10H8zM13.4 7H16v10h-2.6z" fill="currentColor" />
    </Svg>
  );
}

export function IconSend() {
  return (
    <Svg>
      <path d="M4.5 12 19 5.5 14.2 19 12 12.4 4.5 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconCopy() {
  return (
    <Svg>
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 16V6.8A1.8 1.8 0 0 1 7.8 5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconTelegram() {
  return (
    <Svg>
      <path
        d="M20.5 5.2 3.8 11.6c-.8.3-.8 1.4 0 1.7l4.1 1.3 1.6 5c.3.8 1.3 1 1.8.4l2.4-2.9 4.5 3.3c.7.5 1.7.1 1.9-.7L21.6 6c.2-.9-.7-1.6-1.1-.8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconDice() {
  return (
    <Svg>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="9" r="1.15" fill="currentColor" />
      <circle cx="15" cy="15" r="1.15" fill="currentColor" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
    </Svg>
  );
}

export function IconCheck() {
  return (
    <Svg>
      <path d="M5.5 12.5 9.5 16.5 18.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconTrash() {
  return (
    <Svg>
      <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.5L16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconUpload() {
  return (
    <Svg>
      <path d="M12 16V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 9.5 12 5.5 16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSearch() {
  return (
    <Svg>
      <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.2 15.2 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
