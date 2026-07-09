/**
 * precompute-verabloom.ts — regenerates data/reports/verabloom.json by running
 * the REAL deterministic pipeline stages over data/verabloom-tickets.csv:
 *
 *   ingest -> sample -> redact -> classify (keyword only) -> metrics
 *          -> benchmark -> crm
 *
 * and merging the authored LLM-stage outputs (insights / chat mockups / copy)
 * from lib/cx-audit/authored-verabloom.ts. The LLM stages are the ONLY thing
 * not computed here — every number comes from the pure-code pipeline.
 *
 * Run:  npx tsx scripts/generate-verabloom.ts   (writes the CSV)
 *       npx tsx scripts/precompute-verabloom.ts (writes the report JSON)
 *
 * The authored prose embeds specific numbers (4,183 / 74% / 23 / 31 / 104 /
 * 586 / 62%). This script asserts the computed pipeline output matches every
 * one of them — and the full authored metric table — and FAILS LOUDLY if
 * anything drifts. If it fails, either the generator, the pipeline stage
 * semantics, or the authored copy changed: fix the drift, don't loosen the
 * assertion.
 *
 * Note on volume: the CSV is itself the 500-ticket sample of Verabloom's
 * ~4,183/month export (a real upload of that volume would be sampled down to
 * 500 by the sampler). The full export doesn't exist as a file, so
 * totalInExport is injected as the documented brand fact before metrics.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AuditReport, Intent } from "../lib/cx-audit/types";
import { violatesVoice } from "../lib/cx-audit/voice";
import {
  allAuthoredStrings,
  AUTHORED_CHAT_MOCKUPS,
  AUTHORED_COPY,
  AUTHORED_CRM_INSIGHTS,
  AUTHORED_INSIGHTS,
  AUTHORED_META,
} from "../lib/cx-audit/authored-verabloom";
import { buildBenchmark } from "../lib/cx-audit/pipeline/benchmark";
import { classifyTickets } from "../lib/cx-audit/pipeline/classify";
import { buildCrmPayload } from "../lib/cx-audit/pipeline/crm";
import { ingestCsv } from "../lib/cx-audit/pipeline/ingest";
import {
  computeMath,
  computeMetrics,
  DEFAULT_ASSUMPTIONS,
} from "../lib/cx-audit/pipeline/metrics";
import { redactTickets } from "../lib/cx-audit/pipeline/redact";
import { sampleTickets } from "../lib/cx-audit/pipeline/sampler";

/** Brand fact: Verabloom's export volume that the 500-ticket CSV samples. */
const MONTHLY_EXPORT_TOTAL = 4_183;

const here = fileURLToPath(import.meta.url);
const csvPath = resolve(here, "../../data/verabloom-tickets.csv");
const outPath = resolve(here, "../../data/reports/verabloom.json");

function fail(msg: string): never {
  console.error(`\n✗ PRECOMPUTE DRIFT: ${msg}\n`);
  console.error(
    "The computed pipeline output no longer matches the authored Verabloom copy. " +
      "Fix the drift (generator, pipeline stage, or authored strings) — do not loosen this check.",
  );
  process.exit(1);
}
function expectEq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(`${label}: computed ${a} != authored ${e}`);
}

/** The authored per-intent table every run must reproduce (verabloom.json). */
const EXPECTED_INTENTS: Record<
  Intent,
  {
    count: number;
    share: number;
    automatable: boolean;
    avgConfidence: number | null; // null = not asserted (LLM-stage confidences)
    frMins: number;
    resHours: number;
    sienaAction: string | null;
  }
> = {
  wismo: { count: 140, share: 0.28, automatable: true, avgConfidence: 0.97, frMins: 214, resHours: 6.1, sienaAction: "Order Tracking" },
  pre_purchase: { count: 70, share: 0.14, automatable: false, avgConfidence: null, frMins: 301, resHours: 14.8, sienaAction: "Shopping Agent" },
  subscription_management: { count: 55, share: 0.11, automatable: true, avgConfidence: 0.95, frMins: 265, resHours: 10.9, sienaAction: "Subscription Management" },
  returns_exchanges: { count: 45, share: 0.09, automatable: true, avgConfidence: 0.94, frMins: 288, resHours: 16.3, sienaAction: "Returns & Exchanges flow" },
  refunds: { count: 35, share: 0.07, automatable: true, avgConfidence: 0.93, frMins: 246, resHours: 12.4, sienaAction: "Refunds flow" },
  damaged_defective: { count: 30, share: 0.06, automatable: true, avgConfidence: 0.9, frMins: 234, resHours: 13.2, sienaAction: "Replacement flow + QA tagging" },
  order_editing: { count: 25, share: 0.05, automatable: true, avgConfidence: 0.92, frMins: 198, resHours: 7.8, sienaAction: "Order Editing" },
  shipping_issues: { count: 25, share: 0.05, automatable: true, avgConfidence: 0.89, frMins: 275, resHours: 18.6, sienaAction: "Carrier Lookup + Proactive Updates" },
  discount_promo: { count: 20, share: 0.04, automatable: true, avgConfidence: 0.95, frMins: 187, resHours: 5.4, sienaAction: "Promo Resolution" },
  address_change: { count: 18, share: 0.036, automatable: true, avgConfidence: 0.96, frMins: 158, resHours: 4.9, sienaAction: "Address Change" },
  other: { count: 22, share: 0.044, automatable: false, avgConfidence: null, frMins: 322, resHours: 20.1, sienaAction: null },
  account_issues: { count: 15, share: 0.03, automatable: false, avgConfidence: null, frMins: 290, resHours: 15.7, sienaAction: null },
};

async function main(): Promise<void> {
  // The sample path is keyword-only by design — never let a configured key
  // route the 22 "other" tickets through a live model call.
  delete process.env.ANTHROPIC_API_KEY;

  // ---- the real pipeline stages -------------------------------------------
  const csvText = readFileSync(csvPath, "utf8");

  const tickets = ingestCsv(csvText); //                       1 — ingest
  expectEq(tickets.length, 500, "ingested ticket count");

  const sample = sampleTickets(tickets, csvText); //           2 — sample
  expectEq(sample.sampleSize, 500, "sampleSize");
  // Inject the brand fact (see header): the CSV is the sample, not the export.
  const sampleWithVolume = { ...sample, totalInExport: MONTHLY_EXPORT_TOTAL };

  const { tickets: redacted, counts: redactionCounts } = redactTickets(sample.tickets); // 3 — redact

  const { tickets: classified, stats } = await classifyTickets(redacted); // 4 — classify (keyword only)
  expectEq(stats.byLlm, 0, "tickets classified by LLM (sample must be keyword-only)");
  expectEq(stats.byKeyword, 478, "tickets classified by keyword table");

  const metrics = computeMetrics(classified, sampleWithVolume, redactionCounts); // 5 — metrics
  const assumptions = { ...DEFAULT_ASSUMPTIONS };
  const computedMath = computeMath(metrics, assumptions);
  const benchmark = buildBenchmark(metrics); //                6 — benchmark

  // ---- drift gate: computed numbers vs the authored copy ------------------
  expectEq(metrics.sampleSize, 500, "metrics.sampleSize");
  expectEq(metrics.totalInExport, 4183, "metrics.totalInExport");
  expectEq(metrics.monthlyVolumeEstimate, 4183, "metrics.monthlyVolumeEstimate");
  expectEq(metrics.automationPotentialScore, 74, "Automation Potential Score");
  expectEq(metrics.automatableShare, 0.786, "automatableShare");
  expectEq(metrics.dateRange, { from: "2026-06-01", to: "2026-06-30" }, "dateRange");
  expectEq(metrics.medianFirstResponseMins, 252, "median first response (mins)");
  expectEq(metrics.medianResolutionHours, 11.5, "median resolution (hours)");
  expectEq(metrics.repeatContacts.customers, 31, "repeat-contact customers");
  expectEq(metrics.repeatContacts.tickets, 104, "repeat-contact tickets");
  const expectedChannels = { email: 312, chat: 141, sms: 33, social: 14 };
  expectEq(Object.keys(metrics.channels).sort(), Object.keys(expectedChannels).sort(), "channels present");
  for (const [ch, n] of Object.entries(expectedChannels)) {
    expectEq(metrics.channels[ch as keyof typeof metrics.channels], n, `channels.${ch}`);
  }
  expectEq(
    redactionCounts,
    { emails: 512, phones: 87, orderNumbers: 431, addresses: 96, names: 388, total: 1514 },
    "redactionCounts",
  );

  expectEq(metrics.intents.length, 12, "intent row count");
  for (const row of metrics.intents) {
    const want = EXPECTED_INTENTS[row.intent];
    expectEq(row.count, want.count, `count(${row.intent})`);
    expectEq(row.share, want.share, `share(${row.intent})`);
    expectEq(row.automatable, want.automatable, `automatable(${row.intent})`);
    if (want.avgConfidence !== null) {
      expectEq(row.avgConfidence, want.avgConfidence, `avgConfidence(${row.intent})`);
    }
    expectEq(row.medianFirstResponseMins, want.frMins, `medianFirstResponseMins(${row.intent})`);
    expectEq(row.medianResolutionHours, want.resHours, `medianResolutionHours(${row.intent})`);
    expectEq(row.sienaAction, want.sienaAction, `sienaAction(${row.intent})`);
  }

  expectEq(computedMath.hoursRecoverablePerMonth, 438, "math.hoursRecoverablePerMonth");
  expectEq(computedMath.costTodayPerMonth, 21372, "math.costTodayPerMonth");
  expectEq(computedMath.costAutomatedPerMonth, 2959, "math.costAutomatedPerMonth");
  expectEq(computedMath.savingsPerMonth, 18413, "math.savingsPerMonth");
  expectEq(computedMath.prePurchaseTicketsPerMonth, 586, "math.prePurchaseTicketsPerMonth");
  expectEq(computedMath.revenueScenario.monthlyRevenue, 4571, "revenue scenario $/mo (586 x 12% x $65)");
  expectEq(computedMath.revenueScenario.annualRevenue, 54850, "revenue scenario $/yr (unrounded monthly x 12)");
  expectEq(computedMath.revenueScenario.prePurchasePerMonth, 586, "revenue scenario pre-purchase basis");

  expectEq(benchmark.volumeBand, "2,500–7,500 tickets/month", "benchmark.volumeBand");
  expectEq(benchmark.peerScore, 58, "benchmark.peerScore");
  expectEq(benchmark.peerFirstResponseMins, 138, "benchmark.peerFirstResponseMins");
  expectEq(benchmark.automationCeiling, 85, "benchmark.automationCeiling");

  expectEq(
    metrics.longTail,
    [
      { label: "Influencer collabs", count: 7 },
      { label: "Wholesale inquiries", count: 5 },
      { label: "Donation requests", count: 3 },
      { label: "One-offs", count: 7 },
    ],
    "metrics.longTail (chip row)",
  );

  const csatCovered = classified.filter((t) => t.csat !== null).length;
  expectEq(Math.round((100 * csatCovered) / classified.length), 62, "CSAT coverage %");

  // The authored strings must quote the computed numbers verbatim.
  if (!AUTHORED_COPY.headlineHuman.includes("4,183")) fail("headlineHuman lost the 4,183 volume");
  if (AUTHORED_COPY.headlineStat !== String(metrics.automationPotentialScore)) {
    fail(`headlineStat "${AUTHORED_COPY.headlineStat}" != computed APS ${metrics.automationPotentialScore}`);
  }
  if (!AUTHORED_COPY.headlineHuman.includes(`${metrics.automationPotentialScore}%`)) {
    fail("headlineHuman lost the APS percentage");
  }
  if (AUTHORED_INSIGHTS[0].evidence_count !== 23) fail("pump insight evidence_count != 23");
  if (AUTHORED_INSIGHTS[1].evidence_count !== EXPECTED_INTENTS.pre_purchase.count) {
    fail("pre-purchase insight evidence_count != pre_purchase ticket count");
  }
  if (AUTHORED_INSIGHTS[2].evidence_count !== metrics.repeatContacts.customers) {
    fail("repeat-contact insight evidence_count != computed repeat customers");
  }
  if (!AUTHORED_INSIGHTS[2].pattern.includes(`${metrics.repeatContacts.tickets} tickets`)) {
    fail("repeat-contact insight lost the 104-ticket figure");
  }
  if (!AUTHORED_INSIGHTS[1].what_siena_memory_would_do.includes("$4,571")) {
    fail("shopper insight lost the modeled $4,571/month figure");
  }

  // Every authored string obeys the voice rules.
  for (const s of allAuthoredStrings()) {
    const violations = violatesVoice(s);
    if (violations.length > 0) fail(`voice violation [${violations.join(", ")}] in: "${s}"`);
  }

  // ---- assemble + write ----------------------------------------------------
  const report: AuditReport = {
    slug: AUTHORED_META.slug,
    brand: AUTHORED_META.brand,
    prepared_for: AUTHORED_META.preparedFor,
    mode: AUTHORED_META.mode,
    createdAt: AUTHORED_META.createdAt, // fixed — the file is byte-reproducible
    metrics,
    benchmark,
    insights: AUTHORED_INSIGHTS,
    chatMockups: AUTHORED_CHAT_MOCKUPS,
    assumptions,
    math: computedMath,
    copy: AUTHORED_COPY,
    crm: {
      ...buildCrmPayload({ //                                  7 — crm handoff
        brand: AUTHORED_META.brand,
        slug: AUTHORED_META.slug,
        metrics,
        math: computedMath,
        insights: AUTHORED_CRM_INSIGHTS,
        assumptions,
        preparedFor: AUTHORED_META.preparedFor,
      }),
      generated_at: AUTHORED_META.createdAt, // fixed for reproducibility
    },
  };

  expectEq(report.crm.fast_track, true, "crm.fast_track (74 > 70 && 4,183 > 3,000)");
  expectEq(
    report.crm.top_intents,
    [
      { intent: "wismo", share: 0.28 },
      { intent: "pre_purchase", share: 0.14 },
      { intent: "subscription_management", share: 0.11 },
    ],
    "crm.top_intents",
  );
  expectEq(report.crm.report_url, "/cx-audit/report/verabloom", "crm.report_url");
  expectEq(report.crm.prepared_for, "Tom", "crm.prepared_for");
  expectEq(report.crm.revenue_scenario_mo, 4571, "crm.revenue_scenario_mo");
  expectEq(
    report.crm.revenue_scenario_assumptions,
    { pre_purchase_per_month: 586, incremental_conversion_pct: 12, average_order_value: 65 },
    "crm.revenue_scenario_assumptions",
  );

  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        wrote: outPath,
        automationPotentialScore: metrics.automationPotentialScore,
        monthlyVolumeEstimate: metrics.monthlyVolumeEstimate,
        sampleSize: metrics.sampleSize,
        classifiedByKeyword: stats.byKeyword,
        redactionTotal: redactionCounts.total,
        drift: "none — every authored number reproduced by the real pipeline",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
