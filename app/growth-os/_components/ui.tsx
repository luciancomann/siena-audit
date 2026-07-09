/**
 * Growth OS shared atoms — dense, mono-labeled, token-colored. Server-safe.
 */
import type { Efficiency } from "../_lib/data-types";

export function StatCard({
  label,
  value,
  sub,
  trendPct,
  trendGoodWhenUp = true,
}: {
  label: string;
  value: string;
  sub?: string;
  trendPct: number;
  trendGoodWhenUp?: boolean;
}) {
  const good = trendGoodWhenUp ? trendPct >= 0 : trendPct <= 0;
  return (
    <div className="gos-stat">
      <span className="gos-stat__label">{label}</span>
      <span className="gos-stat__value">{value}</span>
      <span className="gos-stat__foot">
        {sub && <span className="gos-stat__sub">{sub}</span>}
        <span className={`gos-trend ${good ? "gos-trend--good" : "gos-trend--bad"}`}>
          {trendPct >= 0 ? "▲" : "▼"} {Math.abs(trendPct)}% vs last mo
        </span>
      </span>
    </div>
  );
}

export function OwnerChip({ name }: { name: string }) {
  return (
    <span className="gos-owner">
      <span className="gos-owner__dot" aria-hidden="true">
        {name.charAt(0)}
      </span>
      {name}
    </span>
  );
}

export function EffChip({ level }: { level: Efficiency }) {
  const label =
    level === "efficient" ? "efficient" : level === "watch" ? "watch" : "expensive";
  return <span className={`gos-eff gos-eff--${level}`}>{label}</span>;
}

export function TrendGlyph({ trend }: { trend: "up" | "down" | "flat" }) {
  return (
    <span className={`gos-trendglyph gos-trendglyph--${trend}`} aria-label={trend}>
      {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
    </span>
  );
}

export function Spark({ points, height = 26 }: { points: number[]; height?: number }) {
  const w = 96;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(1e-6, max - min);
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 3 - ((p - min) / range) * (height - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="gos-spark" viewBox={`0 0 ${w} ${height}`} width={w} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke="var(--sds-green-500)" strokeWidth="1.5" />
    </svg>
  );
}

export function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="gos-sectiontitle">
      <h2>{title}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}
