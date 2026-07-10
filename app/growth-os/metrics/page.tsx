"use client";

/**
 * Metrics — two columns of equal weight: what we track, and what we
 * refuse to track. The exclusion panel is a product decision and renders
 * like one. Pipeline, win rate, and sales cycle are computed live from
 * the Deals Board — mark a deal lost and the win rate moves.
 */
import { Card, SectionHeading } from "@siena/design-system";
import { NOT_TRACKED, TRACKED } from "../_lib/data";
import { moneyK, pipelineFromDeals, salesCycle, winRate } from "../_lib/compute";
import { useGrowthState } from "../_lib/state";

export default function MetricsPage() {
  const [state] = useGrowthState();
  const pipe = pipelineFromDeals(state.deals);
  const wr = winRate(state.deals);
  const cycle = salesCycle(state.deals);

  const computed: Record<string, { value: string; note: string }> = {
    "Qualified pipeline created — ACV and count": {
      value: `${moneyK(pipe.total)} · ${pipe.count} deals`,
      note: "computed from Deals Board · created this month",
    },
    "Win rate and sales cycle length": {
      value: `${wr.pct}% · ${cycle.days} days`,
      note: `computed from Deals Board · quarter to date, ${wr.closed} closed · cycle over the quarter's ${cycle.n} signed`,
    },
  };

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The numbers"
          title="Metrics"
          subtitle="Board-level numbers on the left. The right column is the same size on purpose — what we don't measure is a decision, not an oversight."
        />
      </div>

      <div className="gos-metrics">
        <Card tone="cream" radius="lg" padding="none" className="gos-metrics-panel">
          <h2 className="sds-mono-label">What we track</h2>
          {TRACKED.map((m) => {
            const live = computed[m.name];
            return (
              <div key={m.name} className="gos-metric">
                <div className="gos-metric__top">
                  <span className="gos-metric__name">{m.name}</span>
                  <span className="gos-metric__value">{live ? live.value : m.value}</span>
                </div>
                <span className="gos-metric__why">{m.why}</span>
                <span className="gos-metric__cadence">
                  {live ? live.note : `reviewed ${m.cadence}`}
                </span>
              </div>
            );
          })}
        </Card>

        <Card tone="dark" radius="lg" padding="none" className="gos-metrics-panel gos-excluded">
          <span className="sds-mono-label gos-excluded__tag">
            Not tracked, on purpose
          </span>
          {NOT_TRACKED.map((m) => (
            <div key={m.name} className="gos-metric">
              <div className="gos-metric__top">
                <span className="gos-metric__name">{m.name}</span>
              </div>
              <span className="gos-metric__why">{m.reason}</span>
            </div>
          ))}
          <p className="gos-excluded__note">
            If a number shows up here twice in board decks, it moves left or it dies.
          </p>
        </Card>
      </div>
    </>
  );
}
