/**
 * Growth OS shared atoms — thin wrappers over the Siena Design System
 * (StatCard, Badge, Avatar), densified for ops via gos-* modifier classes.
 */
import { Avatar, Badge, StatCard as SdsStatCard } from "@siena/design-system";
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
      <SdsStatCard value={value} label={label} size="md" divider />
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
      <Avatar initials={name} size="sm" className="gos-owner__avatar" />
      {name}
    </span>
  );
}

export function EffChip({ level }: { level: Efficiency }) {
  const label =
    level === "efficient" ? "efficient" : level === "watch" ? "watch" : "expensive";
  return (
    <Badge variant="outline" className={`gos-eff gos-eff--${level}`}>
      {label}
    </Badge>
  );
}

export function TrendGlyph({ trend }: { trend: "up" | "down" | "flat" }) {
  return (
    <span className={`gos-trendglyph gos-trendglyph--${trend}`} aria-label={trend}>
      {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
    </span>
  );
}

export function Spark({
  points,
  height = 26,
  fit = false,
}: {
  points: number[];
  height?: number;
  /** normalize to the series' own min/max (with padding) instead of a zero baseline */
  fit?: boolean;
}) {
  const w = 96;
  const rawMax = Math.max(...points);
  const rawMin = Math.min(...points);
  const pad = fit ? Math.max((rawMax - rawMin) * 0.15, 1e-6) : 0;
  const max = fit ? rawMax + pad : Math.max(rawMax, 1);
  const min = fit ? rawMin - pad : Math.min(rawMin, 0);
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
      <h2 className="sds-mono-label">{title}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}
