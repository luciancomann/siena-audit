/**
 * Volume-by-intent bars. Hand-rolled, token-styled divs — no charting
 * library — so the section prints exactly and stays quiet: no gridlines,
 * no axes, value labels always outside the bar.
 */
import { Badge } from "@siena/design-system";
import { INTENT_LABELS, type IntentMetrics } from "@/lib/cx-audit/types";
import { formatNumber, formatShare } from "./format";

export function IntentBars({ intents }: { intents: IntentMetrics[] }) {
  const sorted = [...intents].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((i) => i.count), 1);

  return (
    <div className="cxa-bars">
      {sorted.map((row) => (
        <div className="cxa-bar-row" key={row.intent}>
          <div className="cxa-bar-label">
            <span className="cxa-bar-name">
              {row.automatable && (
                <span className="cxa-bar-check" aria-hidden="true">
                  ✓
                </span>
              )}
              {INTENT_LABELS[row.intent]}
            </span>
            {row.automatable && row.sienaAction && (
              <Badge variant="outline">{row.sienaAction}</Badge>
            )}
          </div>
          <div
            className="cxa-bar-track"
            role="img"
            aria-label={`${INTENT_LABELS[row.intent]}: ${formatNumber(row.count)} tickets, ${formatShare(row.share)} of the sample`}
          >
            <div
              className={
                row.automatable ? "cxa-bar-fill cxa-bar-fill--auto" : "cxa-bar-fill"
              }
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <div className="cxa-bar-value">
            {formatNumber(row.count)} · {formatShare(row.share)}
          </div>
        </div>
      ))}
      <p className="cxa-bars-legend">
        <span
          className="cxa-legend-swatch cxa-legend-swatch--auto"
          aria-hidden="true"
        />{" "}
        Siena resolves end to end
        <span className="cxa-legend-sep" aria-hidden="true">
          ·
        </span>
        <span className="cxa-legend-swatch" aria-hidden="true" /> stays with your team
      </p>
    </div>
  );
}
