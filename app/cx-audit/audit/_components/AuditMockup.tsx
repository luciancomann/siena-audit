/**
 * Hero mockup: a glimpse of the audit itself — three stacked panels
 * (score, sample breakdown, volume by intent) with a slight perspective
 * tilt. Built from the design system's Card surfaces in the light palette
 * so the teaser previews exactly what the report looks like. Numbers
 * mirror the Verabloom sample report so the teaser and the real artifact
 * agree.
 */
import { Card } from "@siena/design-system";
import "./audit-mockup.css";

const DONUT = [
  { label: "Resolvable end to end", value: 74, token: "var(--sds-coral-500)" },
  { label: "Needs your team", value: 20, token: "var(--sds-peach-300)" },
  { label: "Low confidence", value: 6, token: "var(--sds-sky-300)" },
];

const INTENT_BARS = [
  { label: "Where is my order?", pct: 28 },
  { label: "Pre-purchase", pct: 14 },
  { label: "Subscriptions", pct: 11 },
  { label: "Returns", pct: 9 },
  { label: "Refunds", pct: 7 },
];

function Donut() {
  // r=15.9155 → circumference 100, so stroke-dasharray maps 1:1 to percent
  let offset = 25; // start at 12 o'clock
  return (
    <svg viewBox="0 0 42 42" className="cxm-donut" role="img" aria-label="74% of the sample is resolvable end to end">
      {DONUT.map((seg) => {
        const el = (
          <circle
            key={seg.label}
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke={seg.token}
            strokeWidth="5"
            strokeDasharray={`${seg.value} ${100 - seg.value}`}
            strokeDashoffset={offset}
          />
        );
        offset -= seg.value;
        return el;
      })}
      <text x="21" y="20" textAnchor="middle" className="cxm-donut__num">
        500
      </text>
      <text x="21" y="26" textAnchor="middle" className="cxm-donut__unit">
        tickets
      </text>
    </svg>
  );
}

export function AuditMockup() {
  return (
    <div className="cxm" aria-label="Preview of an audit report">
      <Card tone="dark" radius="lg" padding="none" className="cxm__panel cxm__panel--score">
        <span className="cxm__eyebrow">Verabloom · June 2026</span>
        <span className="cxm__score">74%</span>
        <span className="cxm__eyebrow">Automation potential</span>
      </Card>

      <Card tone="dark" radius="lg" padding="none" className="cxm__panel cxm__panel--donut">
        <span className="cxm__panel-title">500 tickets analyzed</span>
        <div className="cxm__donut-row">
          <Donut />
          <ul className="cxm__legend">
            {DONUT.map((seg) => (
              <li key={seg.label}>
                <span className="cxm__dot" style={{ background: seg.token }} />
                <span className="cxm__legend-label">{seg.label}</span>
                <span className="cxm__legend-value">{seg.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card tone="dark" radius="lg" padding="none" className="cxm__panel cxm__panel--bars">
        <span className="cxm__panel-title">Volume by intent</span>
        <ul className="cxm__bars">
          {INTENT_BARS.map((bar) => (
            <li key={bar.label}>
              <span className="cxm__bar-label">{bar.label}</span>
              <span className="cxm__bar-track">
                <span className="cxm__bar-fill" style={{ width: `${bar.pct * 3}%` }} />
              </span>
              <span className="cxm__bar-value">{bar.pct}%</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
