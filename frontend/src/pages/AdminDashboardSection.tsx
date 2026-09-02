import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type Tab =
  | "dashboard"
  | "users"
  | "invitations"
  | "events"
  | "texts"
  | "templates"
  | "moods"
  | "presets"
  | "generations"
  | "logs";

type DailyRow = {
  date: string;
  new_users: number;
  dau: number;
  invitations_created: number;
  invitations_completed: number;
  ai_cost_usd: number;
};

type DashboardData = {
  dau: number;
  new_users_today: number;
  invitations_today: number;
  invitations_ready_week: number;
  ai_generations_today: number;
  ai_cost_today: number;
  counts: Record<string, number>;
  charts?: {
    daily_metrics?: DailyRow[];
    funnel?: { created_week: number; ready_week: number };
  };
};

const CHART_PRIMARY = "#1a4540";
const CHART_SECONDARY = "#3d8b80";
const CHART_TERTIARY = "#14b8a6";
const CHART_W = 640;
const CHART_H = 220;
const PAD = { t: 18, r: 16, b: 28, l: 36 };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCount(n: number): string {
  return n.toLocaleString("uz-UZ");
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function shortDayLabel(dateStr: string): string {
  const parts = dateStr.split(".");
  const d =
    parts.length >= 3
      ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
      : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 5);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function shortDateLabel(dateStr: string): string {
  const parts = dateStr.split(".");
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return dateStr;
}

function formatFullDate(dateStr: string): string {
  const parts = dateStr.split(".");
  if (parts.length >= 3) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return dateStr;
}

function trendPct(series: number[]): { pct: number; up: boolean } {
  if (series.length < 2) return { pct: 0, up: true };
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev === 0) return { pct: last > 0 ? 100 : 0, up: last >= prev };
  const raw = Math.round(((last - prev) / prev) * 100);
  return { pct: Math.abs(raw), up: raw >= 0 };
}

function scaleSeries(values: number[], height: number, min = 0) {
  const max = Math.max(min, ...values, 1);
  const innerH = height - PAD.t - PAD.b;
  return values.map((v) => PAD.t + innerH - (v / max) * innerH);
}

function linePath(values: number[], height: number, xs: number[]): string {
  const ys = scaleSeries(values, height);
  return values
    .map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`)
    .join(" ");
}

function areaPath(values: number[], width: number, height: number, xs: number[]): string {
  const ys = scaleSeries(values, height);
  const base = height - PAD.b;
  const line = values.map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`).join(" ");
  const lastX = xs[xs.length - 1] ?? width - PAD.r;
  const firstX = xs[0] ?? PAD.l;
  return `${line} L ${lastX} ${base} L ${firstX} ${base} Z`;
}

function TrendBadge({ series }: { series: number[] }) {
  const { pct, up } = trendPct(series);
  if (!series.length) return null;
  return (
    <span className={`admin-dash-trend ${up ? "up" : "down"}`}>
      {up ? "+" : "−"}
      {pct}%
    </span>
  );
}

function DailyMetricChart({
  title,
  subtitle,
  labels,
  rawDates,
  values,
  color,
  variant,
  valueLabel,
  gradientId,
}: {
  title: string;
  subtitle: string;
  labels: string[];
  rawDates: string[];
  values: number[];
  color: string;
  variant: "bar" | "line";
  valueLabel: string;
  gradientId: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = CHART_W;
  const height = CHART_H;
  const innerW = width - PAD.l - PAD.r;
  const max = Math.max(1, ...values);
  const xs = labels.map((_, i) =>
    PAD.l + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW),
  );
  const ys = scaleSeries(values, height);
  const tipLeft =
    hover != null && labels.length > 1
      ? `${((xs[hover] - PAD.l) / innerW) * 100}%`
      : hover != null
        ? "50%"
        : undefined;

  return (
    <div className="admin-dash-chart-card">
      <div className="admin-dash-chart-head stacked">
        <div>
          <h3>{title}</h3>
          <p className="admin-dash-chart-sub">{subtitle}</p>
        </div>
      </div>
      <div className="admin-dash-chart-wrap">
        {hover != null && tipLeft && (
          <div className="admin-dash-hover-tip" style={{ left: tipLeft }}>
            <span className="admin-dash-hover-tip-date">{formatFullDate(rawDates[hover])}</span>
            <span className="admin-dash-hover-tip-value">
              {valueLabel}: <strong>{formatCount(values[hover])}</strong>
            </span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="admin-dash-chart"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.t + (height - PAD.t - PAD.b) * t;
            return (
              <line
                key={t}
                x1={PAD.l}
                x2={width - PAD.r}
                y1={y}
                y2={y}
                className="admin-dash-grid-line"
              />
            );
          })}
          {[0, 0.5, 1].map((t) => {
            const y = PAD.t + (height - PAD.t - PAD.b) * t;
            const val = Math.round(max * (1 - t));
            return (
              <text key={t} x={PAD.l - 8} y={y + 4} textAnchor="end" className="admin-dash-axis-label">
                {val}
              </text>
            );
          })}
          {variant === "bar" ? (
            values.map((v, i) => {
              const gap = 6;
              const barW = innerW / values.length - gap;
              const barH = ((height - PAD.t - PAD.b) * v) / max;
              const x = PAD.l + i * (barW + gap) + gap / 2;
              const y = height - PAD.b - barH;
              const active = hover === null || hover === i;
              return (
                <g key={labels[i]}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx="6"
                    fill={color}
                    opacity={active ? 0.92 : 0.35}
                  />
                  {hover === i && v > 0 && (
                    <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="admin-dash-bar-value">
                      {formatCount(v)}
                    </text>
                  )}
                  <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="admin-dash-axis-label">
                    {labels[i]}
                  </text>
                  <rect
                    x={x}
                    y={PAD.t}
                    width={barW}
                    height={height - PAD.t - PAD.b}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })
          ) : (
            <>
              <path d={areaPath(values, width, height, xs)} fill={`url(#${gradientId})`} />
              <path
                d={linePath(values, height, xs)}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {hover != null && (
                <line
                  x1={xs[hover]}
                  x2={xs[hover]}
                  y1={PAD.t}
                  y2={height - PAD.b}
                  className="admin-dash-hover-guide"
                />
              )}
              {xs.map((x, i) => (
                <g key={labels[i]}>
                  <circle
                    cx={x}
                    cy={ys[i]}
                    r={hover === i ? 5 : 3}
                    fill={color}
                    stroke="#fff"
                    strokeWidth="2"
                    opacity={hover === null || hover === i ? 1 : 0.35}
                  />
                  <text x={x} y={height - 8} textAnchor="middle" className="admin-dash-axis-label">
                    {labels[i]}
                  </text>
                </g>
              ))}
              {xs.map((x, i) => (
                <rect
                  key={`hit-${i}`}
                  x={x - innerW / labels.length / 2}
                  y={PAD.t}
                  width={innerW / labels.length}
                  height={height - PAD.t - PAD.b}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

function BarChart({
  values,
  labels,
  title,
}: {
  values: number[];
  labels: string[];
  title: string;
}) {
  const width = CHART_W;
  const height = 200;
  const max = Math.max(1, ...values);
  const barW = (width - PAD.l - PAD.r) / values.length - 8;

  return (
    <div className="admin-dash-chart-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="admin-dash-chart" role="img" aria-label={title}>
        <defs>
          <linearGradient id="dash-bar-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={CHART_PRIMARY} />
            <stop offset="100%" stopColor={CHART_TERTIARY} />
          </linearGradient>
        </defs>
        {values.map((v, i) => {
          const h = ((height - PAD.b - 20) * v) / max;
          const x = PAD.l + i * (barW + 8) + 4;
          const y = height - PAD.b - h;
          return (
            <g key={labels[i]}>
              <rect x={x} y={y} width={barW} height={h} rx="6" fill="url(#dash-bar-grad)" opacity="0.9" />
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="admin-dash-axis-label">
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({
  segments,
  title,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  title: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -90;
  const r = 54;
  const cx = 90;
  const cy = 90;

  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const start = angle;
    angle += sweep;
    const end = angle;
    const large = sweep > 180 ? 1 : 0;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(start));
    const y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(end));
    const y2 = cy + r * Math.sin(rad(end));
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    const pct = Math.round((seg.value / total) * 100);
    return { ...seg, d, pct };
  });

  return (
    <div className="admin-dash-chart-card">
      <h3>{title}</h3>
      <div className="admin-dash-donut-wrap">
        <svg viewBox="0 0 180 180" className="admin-dash-donut" role="img" aria-label={title}>
          {arcs.map((a) => (
            <path key={a.label} d={a.d} fill={a.color} opacity="0.92" />
          ))}
          <circle cx={cx} cy={cy} r="34" className="admin-dash-donut-hole" />
        </svg>
        <ul className="admin-dash-donut-legend">
          {arcs.map((a) => (
            <li key={a.label}>
              <i style={{ background: a.color }} />
              <span>{a.label}</span>
              <strong>{a.pct}%</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RadialGauge({
  value,
  total,
  title,
  label,
}: {
  value: number;
  total: number;
  title: string;
  label: string;
}) {
  const pct = total > 0 ? value / total : 0;
  const circumference = 2 * Math.PI * 58;
  const dash = circumference * pct;

  return (
    <div className="admin-dash-chart-card">
      <h3>{title}</h3>
      <div className="admin-dash-radial-wrap">
        <svg viewBox="0 0 160 160" className="admin-dash-radial" role="img" aria-label={title}>
          <defs>
            <linearGradient id="dash-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={CHART_PRIMARY} />
              <stop offset="100%" stopColor={CHART_SECONDARY} />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="58" className="admin-dash-ring-bg" />
          <circle
            cx="80"
            cy="80"
            r="58"
            className="admin-dash-ring-fill"
            stroke="url(#dash-ring-grad)"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="admin-dash-radial-center">
          <strong>{formatCount(value)}</strong>
          <span>{label}</span>
        </div>
        <ul className="admin-dash-radial-legend">
          <li>
            <i className="cyan" /> {Math.round(pct * 100)}% {label}
          </li>
          <li>
            <i className="muted" /> {Math.round((1 - pct) * 100)}% {title}
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function AdminDashboardSection({
  dashboard,
  onNavigate,
  onExport,
}: {
  dashboard: DashboardData;
  onNavigate: (tab: Tab) => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  const daily = dashboard.charts?.daily_metrics ?? [];
  const funnel = dashboard.charts?.funnel ?? { created_week: 0, ready_week: 0 };
  const counts = dashboard.counts ?? {};

  const labels = useMemo(() => daily.map((d) => shortDateLabel(d.date)), [daily]);
  const newUsersSeries = useMemo(() => daily.map((d) => num(d.new_users)), [daily]);
  const dauSeries = useMemo(() => daily.map((d) => num(d.dau)), [daily]);
  const invitesCreated = useMemo(() => daily.map((d) => num(d.invitations_created)), [daily]);
  const invitesDone = useMemo(() => daily.map((d) => num(d.invitations_completed)), [daily]);

  const last7 = daily.slice(-7);
  const barLabels = last7.map((d) => shortDayLabel(d.date));
  const barValues = last7.map((d) => num(d.dau));
  const rawDates = useMemo(() => daily.map((d) => d.date), [daily]);

  const catalogEntries = [
    ["users", "adminNavUsers"],
    ["events", "adminNavEvents"],
    ["text_templates", "adminNavTexts"],
    ["templates", "adminNavTemplates"],
    ["mood_tags", "adminNavMoods"],
    ["invitations", "adminNavInvitations"],
    ["ai_presets", "adminNavPresets"],
  ] as const;

  const tabMap: Record<string, Tab> = {
    users: "users",
    events: "events",
    text_templates: "texts",
    templates: "templates",
    mood_tags: "moods",
    invitations: "invitations",
    ai_presets: "presets",
  };

  return (
    <section className="admin-dash">
      <div className="admin-dash-hero-row">
        <div className="admin-dash-hero primary">
          <span>{t("adminDashTotalUsers")}</span>
          <strong>{formatCount(num(counts.users))}</strong>
          <small>{t("adminDashTotalUsersHint")}</small>
        </div>
        <div className="admin-dash-hero accent">
          <span>{t("adminMetricDau")}</span>
          <strong>{formatCount(num(dashboard.dau))}</strong>
          <small>{t("adminDashDauHint")}</small>
        </div>
        <div className="admin-dash-mini-metrics">
          <div className="admin-dash-mini">
            <span>{t("adminMetricNewUsers")}</span>
            <div>
              <strong>{formatCount(num(dashboard.new_users_today))}</strong>
              <TrendBadge series={newUsersSeries} />
            </div>
          </div>
          <div className="admin-dash-mini">
            <span>{t("adminMetricInvites")}</span>
            <div>
              <strong>{formatCount(num(dashboard.invitations_today))}</strong>
              <TrendBadge series={invitesCreated} />
            </div>
          </div>
          <div className="admin-dash-mini">
            <span>{t("adminMetricAi")}</span>
            <div>
              <strong>{formatCount(num(dashboard.ai_generations_today))}</strong>
            </div>
          </div>
          <div className="admin-dash-mini">
            <span>{t("adminMetricCost")}</span>
            <div>
              <strong>{formatMoney(num(dashboard.ai_cost_today))}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-dash-grid user-metrics">
        <DailyMetricChart
          title={t("adminDashNewUsersDaily")}
          subtitle={t("adminDashNewUsersDailyHint")}
          labels={labels}
          rawDates={rawDates}
          values={newUsersSeries}
          color={CHART_PRIMARY}
          variant="bar"
          valueLabel={t("adminMetricNewUsers")}
          gradientId="dash-new-users-grad"
        />
        <DailyMetricChart
          title={t("adminDashActiveUsersDaily")}
          subtitle={t("adminDashActiveUsersDailyHint")}
          labels={labels}
          rawDates={rawDates}
          values={dauSeries}
          color={CHART_SECONDARY}
          variant="line"
          valueLabel={t("adminMetricActiveUsers")}
          gradientId="dash-active-users-grad"
        />
      </div>

      <div className="admin-dash-grid user-metrics">
        <DailyMetricChart
          title={t("adminDashInvitesCreatedDaily")}
          subtitle={t("adminDashInvitesCreatedDailyHint")}
          labels={labels}
          rawDates={rawDates}
          values={invitesCreated}
          color={CHART_SECONDARY}
          variant="bar"
          valueLabel={t("adminDashInvitesCreatedLabel")}
          gradientId="dash-invites-created-grad"
        />
        <DailyMetricChart
          title={t("adminDashInvitesCompletedDaily")}
          subtitle={t("adminDashInvitesCompletedDailyHint")}
          labels={labels}
          rawDates={rawDates}
          values={invitesDone}
          color={CHART_TERTIARY}
          variant="line"
          valueLabel={t("adminDashInvitesCompletedLabel")}
          gradientId="dash-invites-done-grad"
        />
      </div>

      <div className="admin-dash-grid three">
        <DonutChart
          title={t("adminDashCatalogMix")}
          segments={[
            { label: t("adminNavUsers"), value: num(counts.users), color: CHART_PRIMARY },
            { label: t("adminNavInvitations"), value: num(counts.invitations), color: CHART_SECONDARY },
            { label: t("adminNavTemplates"), value: num(counts.templates), color: CHART_TERTIARY },
            {
              label: t("adminNavTexts"),
              value: num(counts.text_templates),
              color: "#64748b",
            },
          ].filter((s) => s.value > 0)}
        />
        <RadialGauge
          title={t("adminDashFunnelCreated")}
          label={t("adminDashFunnelReady")}
          value={num(funnel.ready_week)}
          total={Math.max(num(funnel.created_week), num(funnel.ready_week), 1)}
        />
        <BarChart title={t("adminDashActiveByWeek")} values={barValues} labels={barLabels} />
      </div>

      <div className="admin-dash-catalog">
        <div className="admin-dash-catalog-head">
          <h2>{t("adminCatalog")}</h2>
          <button type="button" className="admin-dash-export" onClick={onExport}>
            {t("adminExportCsv")}
          </button>
        </div>
        <div className="admin-dash-catalog-grid">
          {catalogEntries.map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              className="admin-dash-catalog-tile"
              onClick={() => {
                const next = tabMap[key];
                if (next) onNavigate(next);
              }}
            >
              <span>{t(labelKey)}</span>
              <strong>{formatCount(num(counts[key]))}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
