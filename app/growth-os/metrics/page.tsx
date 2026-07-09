/**
 * Metrics — two columns of equal weight: what we track, and what we
 * refuse to track. The exclusion panel is a product decision and renders
 * like one. Server component; nothing here needs state.
 */
import { Badge, Card } from "@siena/design-system";
import { NOT_TRACKED, TRACKED } from "../_lib/data";

export const metadata = { title: "Metrics · Growth OS" };

export default function MetricsPage() {
  return (
    <>
      <div>
        <h1 className="gos-pagetitle">Metrics</h1>
        <p className="gos-pagesub">
          Board-level numbers on the left. The right column is the same size on purpose —
          what we don&rsquo;t measure is a decision, not an oversight.
        </p>
      </div>

      <div className="gos-metrics">
        <Card tone="white" radius="md" padding="none" className="gos-panel">
          <h2>What we track</h2>
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

        <Card tone="sand" radius="md" padding="none" className="gos-panel gos-excluded">
          <Badge variant="filled" className="gos-excluded__tag">
            Not tracked, on purpose
          </Badge>
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
