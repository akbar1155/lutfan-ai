import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const TIP_KEYS = [
  "generatingHint",
  "generatingTip1",
  "generatingTip2",
  "generatingTip3",
] as const;

export default function GeneratingScene({
  failed,
  message,
}: {
  failed?: boolean;
  message?: string;
}) {
  const { t } = useTranslation();
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(7);

  useEffect(() => {
    if (failed) return;
    const timer = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % TIP_KEYS.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [failed]);

  useEffect(() => {
    if (failed) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      // Smooth pseudo-progress: fast start, slow near completion.
      const target = Math.min(96, Math.round(100 * (1 - Math.exp(-elapsedSec / 20))));
      setProgress((prev) => (target > prev ? target : prev));
    }, 650);
    return () => window.clearInterval(timer);
  }, [failed]);

  return (
    <div className={`gen-scene ${failed ? "is-failed" : ""}`} aria-live="polite">
      <div className="gen-card" aria-hidden>
        <div className="gen-card-shine" />
        <div className="gen-card-lines">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      {!failed && <div className="gen-loader" aria-hidden />}
      {!failed && (
        <div className="gen-progress" aria-label={`${progress}%`}>
          <div className="gen-progress-track">
            <div className="gen-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="gen-progress-value">{progress}%</span>
        </div>
      )}
      <p className="gen-title">{failed ? t("generateFailed") : t("generating")}</p>
      {!failed && (
        <p key={tipIndex} className="gen-hint">
          {t(TIP_KEYS[tipIndex])}
        </p>
      )}
      {failed && message && <p className="gen-hint">{message}</p>}
    </div>
  );
}
