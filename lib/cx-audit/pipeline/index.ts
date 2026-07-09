/**
 * The 9-stage CX audit pipeline. Emits a start/end ProgressEvent per stage
 * (keys match PIPELINE_STAGES) and resolves to a complete AuditReport.
 */
import { customAlphabet } from "nanoid";
import type { AuditReport, CrmContact, ProgressEvent } from "../types";
import { buildBenchmark } from "./benchmark";
import { classifyTickets } from "./classify";
import { buildCrmPayload, sendCrmPayload } from "./crm";
import { ingestCsv } from "./ingest";
import { computeMath, computeMetrics, DEFAULT_ASSUMPTIONS } from "./metrics";
import { generateInsights } from "./insights";
import { redactTickets } from "./redact";
import { sampleTickets } from "./sampler";
import { writeReport } from "./writer";

export { NoApiKeyError, IngestError, VoiceViolationError } from "./errors";

export interface PipelineOptions {
  brand: string;
  mode: "sample" | "upload";
  /** Captured by the qualify step before the run; rides into the CRM payload. */
  contact?: CrmContact;
  /** First name the report is addressed to (derived from the contact email). */
  preparedFor?: string;
}

/**
 * nanoid(8) over lowercase alphanumerics — every consumer (report page,
 * store, share URLs) accepts these unconditionally, unlike the default
 * alphabet whose leading "-"/"_" trips stricter slug patterns.
 */
const newSlug = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

const fmt = (n: number): string => n.toLocaleString("en-US");
const plural = (n: number, word: string): string => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;

export async function runPipeline(
  csvText: string,
  opts: PipelineOptions,
  onProgress: (e: ProgressEvent) => void,
): Promise<AuditReport> {
  const emit = (
    stage: ProgressEvent["stage"],
    status: "start" | "end",
    note?: string,
  ): void => onProgress({ type: "stage", stage, status, note });

  // 1 — ingest
  emit("ingest", "start");
  const allTickets = ingestCsv(csvText);
  emit("ingest", "end", `${plural(allTickets.length, "conversation")} normalized`);

  // 2 — sample
  emit("sample", "start");
  const sample = sampleTickets(allTickets, csvText);
  emit(
    "sample",
    "end",
    sample.sampleSize < sample.totalInExport
      ? `${fmt(sample.sampleSize)} of ${fmt(sample.totalInExport)} drawn — seeded, so reruns match`
      : `all ${plural(sample.sampleSize, "conversation")} kept — no sampling needed`,
  );

  // 3 — redact
  emit("redact", "start");
  const { tickets: redacted, counts: redactionCounts } = redactTickets(sample.tickets);
  emit("redact", "end", `${plural(redactionCounts.total, "personal detail")} stripped`);

  // 4 — classify
  emit("classify", "start");
  const { tickets: classified, stats } = await classifyTickets(redacted);
  emit(
    "classify",
    "end",
    `${fmt(stats.byKeyword)} labeled by rules, ${fmt(stats.byLlm)} by Claude`,
  );

  // 5 — metrics
  emit("metrics", "start");
  const metrics = computeMetrics(classified, sample, redactionCounts);
  const assumptions = { ...DEFAULT_ASSUMPTIONS };
  const math = computeMath(metrics, assumptions);
  emit("metrics", "end", `automation potential: ${metrics.automationPotentialScore} of 100`);

  // 6 — benchmark
  emit("benchmark", "start");
  const benchmark = buildBenchmark(metrics);
  emit("benchmark", "end", `compared against brands at ${benchmark.volumeBand}`);

  // 7 — insights
  emit("insights", "start");
  const insights = await generateInsights(classified, metrics, { mode: opts.mode });
  emit(
    "insights",
    "end",
    insights.length > 0
      ? `${insights.length} pattern${insights.length === 1 ? "" : "s"} surfaced from the queue`
      : "no clear patterns above the evidence bar",
  );

  // 8 — write
  emit("write", "start");
  const csatCovered = classified.filter((t) => t.csat !== null).length;
  const csatCoveragePercent = Math.round(
    (100 * csatCovered) / Math.max(1, classified.length),
  );
  const { copy, chatMockups } = await writeReport({
    brand: opts.brand,
    mode: opts.mode,
    metrics,
    benchmark,
    insights,
    math,
    assumptions,
    csatCoveragePercent,
  });
  emit("write", "end", "findings phrased, every number from the metrics engine");

  // 9 — crm
  emit("crm", "start");
  const slug = opts.mode === "sample" ? "verabloom" : newSlug();
  const crm = buildCrmPayload({
    brand: opts.brand,
    slug,
    metrics,
    math,
    insights,
    assumptions,
    contact: opts.contact,
    preparedFor: opts.preparedFor,
  });
  await sendCrmPayload(crm);
  emit("crm", "end", "context packaged for the follow-up");

  return {
    slug,
    brand: opts.brand,
    mode: opts.mode,
    createdAt: new Date().toISOString(),
    metrics,
    benchmark,
    insights,
    chatMockups,
    assumptions,
    math,
    copy,
    crm,
  };
}
