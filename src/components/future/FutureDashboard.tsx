import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "cyan" | "emerald" | "amber" | "rose" | "violet" | "neutral";

export type FutureHeroStat = {
  label: string;
  value: string;
  tone?: Tone;
};

export type FutureMetric = {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  tone?: Tone;
  progress?: number;
  trend?: string;
  sparkline?: number[];
};

export type FutureChartPoint = {
  label: string;
  present: number;
  late: number;
  absent: number;
};

function toneClass(tone: Tone = "cyan") {
  return `tone-${tone}`;
}

function clampProgress(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function Sparkline({ values = [], tone = "cyan" }: { values?: number[]; tone?: Tone }) {
  const safeValues = values.length > 1 ? values : [0, 1, 0, 1, 0];
  const width = 132;
  const height = 42;
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(max - min, 1);
  const points = safeValues
    .map((value, index) => {
      const x = (index / (safeValues.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`future-sparkline ${toneClass(tone)}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {safeValues.map((value, index) => {
        const x = (index / (safeValues.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 8) - 4;
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.35" fill="currentColor" />;
      })}
    </svg>
  );
}

export function FutureHero({
  eyebrow,
  title,
  description,
  actions,
  stats,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  stats: FutureHeroStat[];
}) {
  return (
    <section className="future-react-hero" data-react-transfer="future-hero">
      <div className="future-hero-glow future-hero-glow-a" />
      <div className="future-hero-glow future-hero-glow-b" />
      <div className="future-hero-copy">
        <span className="future-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {actions ? <div className="future-hero-actions">{actions}</div> : null}
      </div>
      <div className="future-hero-stats" aria-label="ملخص سريع">
        {stats.map((stat) => (
          <article className={`future-hero-stat ${toneClass(stat.tone)}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FutureMetricGrid({ metrics }: { metrics: FutureMetric[] }) {
  return (
    <section className="future-metric-grid" data-react-transfer="future-metrics">
      {metrics.map((metric) => {
        const progress = clampProgress(metric.progress);
        return (
          <article className={`future-metric-card ${toneClass(metric.tone)}`} key={metric.label}>
            <div className="future-metric-bg" />
            <div className="future-metric-head">
              <div className="future-metric-icon" aria-hidden="true">{metric.icon}</div>
              <Sparkline values={metric.sparkline} tone={metric.tone} />
            </div>
            <div className="future-metric-body">
              <span>{metric.label}</span>
              <strong>
                {metric.value}
                {metric.suffix ? <small>{metric.suffix}</small> : null}
              </strong>
              {metric.trend ? <em>{metric.trend}</em> : null}
            </div>
            <div className="future-progress-row">
              <span>مؤشر اليوم</span>
              <b>{progress}%</b>
            </div>
            <div className="future-progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function FutureWeeklyChart({ points }: { points: FutureChartPoint[] }) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.present, point.late, point.absent]));

  return (
    <section className="future-chart-panel" data-react-transfer="future-chart">
      <div className="future-section-heading">
        <div>
          <span className="future-eyebrow small">Realtime React View</span>
          <h2>اتجاهات الأسبوع داخل React</h2>
          <p>المخطط مصنوع كـ TSX Data Component حتى تبقى البيانات من قاعدة المشروع الأصلي ولا تتحول إلى Mock ثابت.</p>
        </div>
        <Link href="/admin/reports" className="btn btn-ghost btn-sm">فتح التقارير ←</Link>
      </div>
      <div className="future-chart-legend">
        <span className="legend-present">الحضور</span>
        <span className="legend-late">التأخير</span>
        <span className="legend-absent">الغياب</span>
      </div>
      <div className="future-chart-bars" role="img" aria-label="مخطط حضور وتأخير وغياب الأسبوع">
        {points.map((point) => (
          <article className="future-chart-day" key={point.label}>
            <div className="future-bar-group">
              <span className="bar-present" style={{ height: `${Math.max(8, (point.present / maxValue) * 100)}%` }} title={`حضور ${point.present}`} />
              <span className="bar-late" style={{ height: `${Math.max(8, (point.late / maxValue) * 100)}%` }} title={`تأخير ${point.late}`} />
              <span className="bar-absent" style={{ height: `${Math.max(8, (point.absent / maxValue) * 100)}%` }} title={`غياب ${point.absent}`} />
            </div>
            <strong>{point.label}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FutureTransferNotice() {
  return (
    <section className="future-transfer-notice" data-react-transfer="future-verification">
      <strong>React Transfer Active</strong>
      <p>
        هذه الطبقة ليست CSS فقط: الواجهة المستقبلية صارت Components داخل <code>src/components/future</code>،
        والصفحات تمرر لها بيانات المشروع الأصلي مباشرة بدون تغيير API أو قاعدة البيانات.
      </p>
    </section>
  );
}
