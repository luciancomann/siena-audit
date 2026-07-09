/**
 * Metrics — two columns of equal weight: what we track, and what we
 * refuse to track. The exclusion panel is a product decision and renders
 * like one. Server component; nothing here needs state.
 */
import { Card, SectionHeading } from "@siena/design-system";
import { NOT_TRACKED, TRACKED } from "../_lib/data";

export const metadata = { title: "Metrics · Growth OS" };

export default function MetricsPage() {
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
          {TRACKED.map((m) => (
            <div key={m.name} className="gos-metric">
              <div className="gos-metric__top">
                <span className="gos-metric__name">{m.name}</span>
                <span className="gos-metric__value">{m.value}</span>
              </div>
              <span className="gos-metric__why">{m.why}</span>
              <span className="gos-metric__cadence">reviewed {m.cadence}</span>
            </div>
          ))}
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
