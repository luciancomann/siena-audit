/**
 * Volume-by-intent bars. Hand-rolled, token-styled divs — no charting
 * library — so the section prints exactly and stays quiet: no gridlines,
 * no axes, value labels always outside the bar.
 */
import { Badge } from "@siena/design-system";
import {
  INTENT_LABELS,
  type IntentMetrics,
  type LongTailEntry,
} from "@/lib/cx-audit/types";
import { formatNumber, formatShare } from "./format";

export function IntentBars({
  intents,
  longTail,
}: {
  intents: IntentMetrics[];
  /** The "other" bucket, read closer — rendered as a chip row, not a bar. */
  longTail?: LongTailEntry[];
}) {
  // "other" lives in the chip row below, not in the bars
  const sorted = [...intents]
    .filter((i) => i.intent !== "other")
    .sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((i) => i.count), 1);

  return (
    <div className="cxa-bars">
      {sorted.map((row) => {
        // Pre-purchase gets its own lane: not a cost to automate away, a
        // revenue conversation the Shopping Agent turns into orders.
        const isRevenue = row.intent === "pre_purchase";
        const label = INTENT_LABELS[row.intent];
        return (
          <div className="cxa-bar-row" key={row.intent}>
            <div className="cxa-bar-label">
              <span className="cxa-bar-name">
                {row.automatable && (
                  <span className="cxa-bar-check" aria-hidden="true">
                    ✓
                  </span>
                )}
                {isRevenue && (
                  <span className="cxa-bar-check cxa-bar-check--revenue" aria-hidden="true">
                    ↗
                  </span>
                )}
                {label}
              </span>
              {isRevenue ? (
                <Badge variant="outline" className="cxa-badge--revenue">
                  Shopping Agent · Revenue
                </Badge>
              ) : (
                row.automatable &&
                row.sienaAction && <Badge variant="outline">{row.sienaAction}</Badge>
              )}
            </div>
            <div
              className="cxa-bar-track"
              role="img"
              aria-label={`${label}: ${formatNumber(row.count)} tickets, ${formatShare(row.share)} of the sample`}
            >
              <div
                className={
                  isRevenue
                    ? "cxa-bar-fill cxa-bar-fill--revenue"
                    : row.automatable
                      ? "cxa-bar-fill cxa-bar-fill--auto"
                      : "cxa-bar-fill"
                }
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
            <div className="cxa-bar-value">
              {formatNumber(row.count)} · {formatShare(row.share)}
            </div>
          </div>
        );
      })}
      {longTail && longTail.length > 0 && (
        <div className="cxa-longtail">
          <span className="cxa-longtail__label">
            Under 1% each, we read these too
          </span>
          <span className="cxa-longtail__chips">
            {longTail.map((entry) => (
              <Badge variant="outline" key={entry.label}>
                {entry.label} · {entry.count}
              </Badge>
            ))}
          </span>
        </div>
      )}
      <p className="cxa-bars-legend">
        <span
          className="cxa-legend-swatch cxa-legend-swatch--auto"
          aria-hidden="true"
        />{" "}
        Siena resolves end to end
        <span className="cxa-legend-sep" aria-hidden="true">
          ·
        </span>
        <span
          className="cxa-legend-swatch cxa-legend-swatch--revenue"
          aria-hidden="true"
        />{" "}
        turns into revenue
        <span className="cxa-legend-sep" aria-hidden="true">
          ·
        </span>
        <span className="cxa-legend-swatch" aria-hidden="true" /> stays with your team
      </p>
    </div>
  );
}
