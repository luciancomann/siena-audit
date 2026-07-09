/**
 * Stage 7 — Insight agent.
 * Claude reads the redacted bodies grouped by intent cluster and proposes
 * 3–5 insights. The model cites ticket ids; CODE recounts the evidence by
 * validating those ids against the sample. No key + sample mode -> authored
 * content; no key + upload -> typed NoApiKeyError.
 */
import type { ClassifiedTicket, Insight, Intent, Metrics } from "../types";
import { INTENTS, INTENT_LABELS } from "../types";
import { VOICE_RULES, violatesVoice } from "../voice";
import { getAuthoredSample } from "./authored";
import { NoApiKeyError } from "./errors";
import { getClient, MODEL, parseStructuredResponse } from "./llm";

const INSIGHTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "pattern",
          "cluster_intent",
          "cited_ticket_ids",
          "what_siena_memory_would_do",
        ],
        properties: {
          title: { type: "string" },
          pattern: { type: "string" },
          cluster_intent: { type: "string", enum: [...INTENTS] },
          cited_ticket_ids: { type: "array", items: { type: "string" } },
          what_siena_memory_would_do: { type: "string" },
        },
      },
    },
  },
} as const;

interface ProposedInsight {
  title: string;
  pattern: string;
  cluster_intent: Intent;
  cited_ticket_ids: string[];
  what_siena_memory_would_do: string;
}

const SYSTEM_PROMPT = `${VOICE_RULES}

You are the insight agent in a CX audit. You read a brand's redacted support tickets, grouped by intent, and surface 3 to 5 insights the brand can act on. Look specifically for:
- product defect patterns: many tickets describing the same product failing the same way, in different words, with no shared tag
- pre-purchase volume: shoppers asking questions before buying, and what the response delay costs
- subscription friction: skip/pause/reschedule flows generating tickets that should be self-serve
- repeat-contact clusters: the same customers writing again and again about the same thing

Rules:
- Every insight must cite the exact ticket ids (from the data provided) that evidence it, in cited_ticket_ids. Cite every matching ticket you can find — the evidence count shown in the report is recomputed in code from your citations.
- Use only numbers that appear in the provided data. Do not invent counts, percentages, or dollar figures.
- "what_siena_memory_would_do" describes concretely what Siena's intelligence layer would do with this pattern — cluster it, remember it, resolve it — in one or two sentences.
- Titles are specific and human ("The pump on X is failing, and nobody tagged it"), never generic ("Product quality issues detected").
Respond with JSON only.`;

function buildDigest(tickets: ClassifiedTicket[], metrics: Metrics): string {
  // Group by intent; take the biggest clusters first.
  const byIntent = new Map<Intent, ClassifiedTicket[]>();
  for (const t of tickets) {
    const bucket = byIntent.get(t.intent);
    if (bucket) bucket.push(t);
    else byIntent.set(t.intent, [t]);
  }
  const clusters = [...byIntent.entries()].sort((a, b) => b[1].length - a[1].length);

  const parts: string[] = [];
  parts.push(
    `Sample: ${metrics.sampleSize} tickets of ${metrics.totalInExport} in the export (${metrics.dateRange.from} to ${metrics.dateRange.to}). Estimated monthly volume: ${metrics.monthlyVolumeEstimate}. Median first response: ${metrics.medianFirstResponseMins} minutes. Median resolution: ${metrics.medianResolutionHours} hours.`,
  );
  parts.push(
    `Repeat contacts: ${metrics.repeatContacts.customers} customers wrote 3+ times each (${metrics.repeatContacts.tickets} tickets). Dominant cluster: ${metrics.repeatContacts.topCluster || "none"}.`,
  );

  // Repeat-contact ticket ids so the model can cite them.
  const byCustomer = new Map<string, ClassifiedTicket[]>();
  for (const t of tickets) {
    const bucket = byCustomer.get(t.customer_hash);
    if (bucket) bucket.push(t);
    else byCustomer.set(t.customer_hash, [t]);
  }
  const repeatIds = [...byCustomer.values()]
    .filter((g) => g.length >= 3)
    .flat()
    .map((t) => t.id)
    .slice(0, 120);
  if (repeatIds.length > 0) {
    parts.push(`Repeat-contact ticket ids: ${JSON.stringify(repeatIds)}`);
  }

  for (const [intent, group] of clusters.slice(0, 7)) {
    const label = INTENT_LABELS[intent];
    const samples = group.slice(0, 14).map((t) => ({
      id: t.id,
      subject: t.subject.slice(0, 120),
      body: t.body.slice(0, 300),
    }));
    parts.push(
      `Intent "${intent}" (${label}) — ${group.length} tickets (${Math.round((group.length / Math.max(1, metrics.sampleSize)) * 100)}% of sample). Samples:\n${JSON.stringify(samples)}`,
    );
  }

  return parts.join("\n\n");
}

async function proposeInsights(
  digest: string,
  extraInstruction?: string,
): Promise<ProposedInsight[] | null> {
  const client = getClient();
  if (!client) return null;

  const messages: { role: "user"; content: string }[] = [
    {
      role: "user",
      content:
        `Here is the audited ticket data. Surface 3-5 insights.\n\n${digest}` +
        (extraInstruction ? `\n\n${extraInstruction}` : ""),
    },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: {
      format: { type: "json_schema", schema: INSIGHTS_SCHEMA as unknown as Record<string, unknown> },
    },
    system: SYSTEM_PROMPT,
    messages,
  });

  const parsed = parseStructuredResponse<{ insights: ProposedInsight[] }>(response);
  return parsed?.insights ?? null;
}

/** Validate citations against real ticket ids and recount evidence in code. */
function toInsights(
  proposed: ProposedInsight[],
  validIds: Set<string>,
): { insights: Insight[]; violations: string[] } {
  const violations: string[] = [];
  const insights: Insight[] = [];

  for (const p of proposed) {
    if (!p || typeof p.title !== "string") continue;
    const cited = Array.isArray(p.cited_ticket_ids) ? p.cited_ticket_ids : [];
    const evidence = new Set(cited.filter((id) => validIds.has(id)));
    if (evidence.size === 0) continue; // no real evidence -> not an insight

    const texts = [p.title, p.pattern, p.what_siena_memory_would_do];
    const bad = texts.flatMap((t) => violatesVoice(t ?? ""));
    if (bad.length > 0) {
      violations.push(...bad);
      continue;
    }

    insights.push({
      title: p.title,
      pattern: p.pattern,
      evidence_count: evidence.size,
      what_siena_memory_would_do: p.what_siena_memory_would_do,
    });
  }

  return { insights: insights.slice(0, 5), violations: [...new Set(violations)] };
}

export async function generateInsights(
  tickets: ClassifiedTicket[],
  metrics: Metrics,
  opts: { mode: "sample" | "upload" },
): Promise<Insight[]> {
  if (!getClient()) {
    if (opts.mode === "sample") return getAuthoredSample().insights;
    throw new NoApiKeyError("insight");
  }

  const digest = buildDigest(tickets, metrics);
  const validIds = new Set(tickets.map((t) => t.id));

  const first = await proposeInsights(digest);
  if (!first) return []; // refusal / truncation — ship the report without insights

  const firstPass = toInsights(first, validIds);
  let insights = firstPass.insights;
  const violations = firstPass.violations;

  // One retry when the voice rules were broken, naming the violations.
  if (insights.length < 3 && violations.length > 0) {
    const retry = await proposeInsights(
      digest,
      `Your previous attempt used words that are banned in this voice: ${violations.join(", ")}. Rewrite the insights without those words.`,
    );
    if (retry) {
      const second = toInsights(retry, validIds);
      if (second.insights.length > insights.length) insights = second.insights;
    }
  }

  return insights;
}
