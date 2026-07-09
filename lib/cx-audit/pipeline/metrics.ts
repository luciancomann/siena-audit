/**
 * Stage 5 — Metrics engine. PURE CODE, no LLM. Every number in the report
 * is computed here; the report writer only phrases them.
 */
import type {
  Assumptions,
  ClassifiedTicket,
  Intent,
  IntentMetrics,
  MathSection,
  Metrics,
  NormalizedTicket,
  RedactionCounts,
} from "../types";
import { INTENT_LABELS, SIENA_ACTIONS } from "../types";
import { isAutomatable } from "./classify";
import type { SampleResult } from "./sampler";

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  handleTimeMins: 8,
  loadedCostPerTicket: 6.5,
  automatedCostPerTicket: 0.9,
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function minutesBetween(fromIso: string, toIso: string | null): number | null {
  if (!toIso) return null;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const mins = (to - from) / 60_000;
  return mins >= 0 ? mins : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function firstResponseMins(tickets: NormalizedTicket[]): number | null {
  const raw = median(
    tickets
      .map((t) => minutesBetween(t.created_at, t.first_response_at))
      .filter((v): v is number => v !== null),
  );
  return raw === null ? null : Math.round(raw);
}

function resolutionHours(tickets: NormalizedTicket[]): number | null {
  const raw = median(
    tickets
      .map((t) => minutesBetween(t.created_at, t.resolved_at))
      .filter((v): v is number => v !== null),
  );
  return raw === null ? null : round(raw / 60, 1);
}

export function computeMetrics(
  tickets: ClassifiedTicket[],
  sample: Pick<SampleResult, "sampleSize" | "totalInExport" | "dateRange">,
  redactionCounts: RedactionCounts,
): Metrics {
  const { sampleSize, totalInExport, dateRange } = sample;

  // Monthly volume estimate from the export's span.
  const spanMs = Date.parse(dateRange.to) - Date.parse(dateRange.from);
  const spanDays = Math.max(1, spanMs / 86_400_000 + 1); // inclusive span
  const monthlyVolumeEstimate = Math.round((totalInExport / spanDays) * 30);

  // Automation potential: confidence-weighted share of automatable volume.
  const automatable = tickets.filter((t) => t.automatable);
  const automationPotentialScore = Math.round(
    (100 * automatable.reduce((sum, t) => sum + t.confidence, 0)) / Math.max(1, sampleSize),
  );
  const automatableShare = round(automatable.length / Math.max(1, sampleSize), 3);

  // Per-intent metrics, sorted by count desc.
  const byIntent = new Map<Intent, ClassifiedTicket[]>();
  for (const t of tickets) {
    const bucket = byIntent.get(t.intent);
    if (bucket) bucket.push(t);
    else byIntent.set(t.intent, [t]);
  }
  const intents: IntentMetrics[] = [...byIntent.entries()]
    .map(([intent, group]) => ({
      intent,
      count: group.length,
      share: round(group.length / Math.max(1, sampleSize), 3),
      automatable: isAutomatable(intent),
      avgConfidence: round(
        group.reduce((sum, t) => sum + t.confidence, 0) / group.length,
        2,
      ),
      medianFirstResponseMins: firstResponseMins(group),
      medianResolutionHours: resolutionHours(group),
      sienaAction: SIENA_ACTIONS[intent] ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  // Repeat contacts: customers with >= 3 tickets in the sample.
  const byCustomer = new Map<string, ClassifiedTicket[]>();
  for (const t of tickets) {
    const bucket = byCustomer.get(t.customer_hash);
    if (bucket) bucket.push(t);
    else byCustomer.set(t.customer_hash, [t]);
  }
  const repeatGroups = [...byCustomer.values()].filter((g) => g.length >= 3);
  const repeatTickets = repeatGroups.flat();
  const intentCounts = new Map<Intent, number>();
  for (const t of repeatTickets) {
    intentCounts.set(t.intent, (intentCounts.get(t.intent) ?? 0) + 1);
  }
  let topCluster = "";
  let topCount = 0;
  for (const [intent, count] of intentCounts) {
    if (count > topCount) {
      topCount = count;
      topCluster = INTENT_LABELS[intent];
    }
  }

  // Channel distribution (only channels that appear).
  const channels: Partial<Record<NormalizedTicket["channel"], number>> = {};
  for (const t of tickets) {
    channels[t.channel] = (channels[t.channel] ?? 0) + 1;
  }

  return {
    sampleSize,
    totalInExport,
    dateRange,
    monthlyVolumeEstimate,
    automationPotentialScore,
    automatableShare,
    intents,
    medianFirstResponseMins: firstResponseMins(tickets) ?? 0,
    medianResolutionHours: resolutionHours(tickets) ?? 0,
    repeatContacts: {
      customers: repeatGroups.length,
      tickets: repeatTickets.length,
      topCluster,
    },
    channels,
    redactionCounts,
  };
}

/**
 * The math section — also pure code. Numbers follow the sample report's
 * method exactly: costs are computed over the automatable monthly volume.
 */
export function computeMath(metrics: Metrics, assumptions: Assumptions): MathSection {
  const automatableMonthly = Math.round(
    metrics.monthlyVolumeEstimate * metrics.automatableShare,
  );
  const hoursRecoverablePerMonth = Math.round(
    (automatableMonthly * assumptions.handleTimeMins) / 60,
  );
  const costTodayPerMonth = Math.round(automatableMonthly * assumptions.loadedCostPerTicket);
  const costAutomatedPerMonth = Math.round(
    automatableMonthly * assumptions.automatedCostPerTicket,
  );

  const prePurchase = metrics.intents.find((i) => i.intent === "pre_purchase");
  const prePurchaseTicketsPerMonth = prePurchase
    ? Math.round(metrics.monthlyVolumeEstimate * prePurchase.share)
    : 0;

  const frtPhrase = formatMinutes(metrics.medianFirstResponseMins);
  const prePurchaseRevenueNote =
    prePurchaseTicketsPerMonth > 0
      ? `${prePurchaseTicketsPerMonth.toLocaleString("en-US")} pre-purchase conversations a month is a sales channel hiding in your support queue. Answered in seconds instead of ${frtPhrase}, a portion of those become orders — we'll model that with your AOV on a call.`
      : `This export shows almost no pre-purchase questions. Either shoppers aren't finding your support channel before they buy, or those conversations live in a channel this export can't see — worth checking, because they convert.`;

  return {
    hoursRecoverablePerMonth,
    costTodayPerMonth,
    costAutomatedPerMonth,
    savingsPerMonth: costTodayPerMonth - costAutomatedPerMonth,
    prePurchaseTicketsPerMonth,
    prePurchaseRevenueNote,
  };
}

/** "252" minutes -> "four hours"; small values -> "18 minutes". */
function formatMinutes(mins: number): string {
  if (mins <= 0) return "hours";
  if (mins < 90) return `${Math.round(mins)} minutes`;
  const hours = Math.round(mins / 60);
  const words = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
  ];
  return hours <= 12 ? `${words[hours]} hours` : `${hours} hours`;
}
