/**
 * "Where the ladder ends" — the automation-complexity spectrum, computed
 * from the report's own intent metrics. Four rungs, one horizontal track,
 * same visual language as the intent bars: ink for what Siena resolves,
 * sand tones for everything that isn't hers to take.
 */
import type { Intent, IntentMetrics } from "@/lib/cx-audit/types";
import { formatNumber, formatShare } from "./format";

interface Rung {
  key: string;
  title: string;
  body: string;
  intents: Intent[];
}

const RUNGS: Rung[] = [
  {
    key: "macro",
    title: "Saved-reply territory",
    body: "Password resets and log-in help — a saved reply already answers these. No AI needed, and no credit taken.",
    intents: ["account_issues"],
  },
  {
    key: "addon",
    title: "Add-on AI territory",
    body: "Single-step lookups, like reading an order status back. This is where help-desk AI add-ons top out.",
    intents: ["wismo"],
  },
  {
    key: "siena",
    title: "Siena resolves end to end",
    body: "Multi-step work — the returns flow, refunds, address changes, subscription skips, replacement flows. Resolved in your voice, not routed, not queued.",
    intents: [
      "returns_exchanges",
      "refunds",
      "address_change",
      "subscription_management",
      "damaged_defective",
      "order_editing",
      "shipping_issues",
      "discount_promo",
    ],
  },
  {
    key: "team",
    title: "Stays with your team, and should",
    body: "The judgment calls — missing parts, unusual exchanges, escalations. People decide these; Siena makes sure they arrive with context.",
    intents: ["other"],
  },
];

export function Ladder({
  intents,
  sampleSize,
}: {
  intents: IntentMetrics[];
  sampleSize: number;
}) {
  const byIntent = new Map(intents.map((i) => [i.intent, i]));
  const rungs = RUNGS.map((rung) => {
    const count = rung.intents.reduce((n, key) => n + (byIntent.get(key)?.count ?? 0), 0);
    return { ...rung, count, share: count / Math.max(1, sampleSize) };
  });
  const prePurchase = byIntent.get("pre_purchase");
  const onLadder = rungs.reduce((n, r) => n + r.count, 0);

  return (
    <div className="cxa-ladder">
      <div className="cxa-ladder-track" role="img" aria-label="How the sample splits across the four rungs of the automation ladder">
        {rungs.map((rung) => (
          <span
            key={rung.key}
            className={`cxa-ladder-seg cxa-ladder-seg--${rung.key}`}
            style={{ width: `${(rung.count / Math.max(1, onLadder)) * 100}%` }}
          />
        ))}
      </div>
      <ol className="cxa-ladder-rungs">
        {rungs.map((rung) => (
          <li key={rung.key} className="cxa-ladder-rung">
            <span className={`cxa-ladder-swatch cxa-ladder-seg--${rung.key}`} aria-hidden="true" />
            <h3 className="cxa-ladder-rung__title">{rung.title}</h3>
            <p className="cxa-ladder-rung__body">{rung.body}</p>
            <p className="cxa-ladder-rung__value">
              {formatNumber(rung.count)} tickets · {formatShare(rung.share)}
            </p>
          </li>
        ))}
      </ol>
      {prePurchase && (
        <p className="cxa-ladder-footnote">
          Your {formatNumber(prePurchase.count)} pre-purchase conversations (
          {formatShare(prePurchase.share)}) sit off this ladder on purpose — they&rsquo;re
          revenue, not cost.
        </p>
      )}
    </div>
  );
}
