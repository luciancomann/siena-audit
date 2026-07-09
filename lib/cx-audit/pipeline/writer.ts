/**
 * Stage 8 — Report writer.
 * System prompt = VOICE_RULES + a hard rule: every number comes verbatim
 * from the Metrics object provided — the model phrases, never computes.
 * Produces ReportCopy + 2-3 ChatMockups from the brand's top intents (one
 * ends in add-to-cart when pre_purchase is present). Every produced string
 * is validated with violatesVoice(); one retry naming the violations, then
 * fail loudly.
 */
import type {
  Assumptions,
  Benchmark,
  ChatMockup,
  Insight,
  MathSection,
  Metrics,
  ReportCopy,
} from "../types";
import { INTENT_LABELS, SIENA_ACTIONS } from "../types";
import { VOICE_RULES, violatesVoice } from "../voice";
import { getAuthoredSample } from "./authored";
import { NoApiKeyError, VoiceViolationError } from "./errors";
import { getClient, MODEL, parseStructuredResponse } from "./llm";

export interface WriterInput {
  brand: string;
  mode: "sample" | "upload";
  metrics: Metrics;
  benchmark: Benchmark;
  insights: Insight[];
  math: MathSection;
  assumptions: Assumptions;
  /** Share of sampled tickets that carried a CSAT score, 0-100. Computed in code. */
  csatCoveragePercent: number;
}

export interface WriterOutput {
  copy: ReportCopy;
  chatMockups: ChatMockup[];
}

const WRITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["copy", "chatMockups"],
  properties: {
    copy: {
      type: "object",
      additionalProperties: false,
      required: [
        "headlineStat",
        "headlineHuman",
        "volumeIntro",
        "chatIntro",
        "insightsIntro",
        "mathIntro",
        "benchmarkIntro",
        "couldntSee",
        "ctaLine",
      ],
      properties: {
        headlineStat: { type: "string" },
        headlineHuman: { type: "string" },
        volumeIntro: { type: "string" },
        chatIntro: { type: "string" },
        insightsIntro: { type: "string" },
        mathIntro: { type: "string" },
        benchmarkIntro: { type: "string" },
        couldntSee: { type: "array", items: { type: "string" } },
        ctaLine: { type: "string" },
      },
    },
    chatMockups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["intentLabel", "endsInCart", "lines"],
        properties: {
          intentLabel: { type: "string" },
          endsInCart: { type: "boolean" },
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["role", "text"],
              properties: {
                role: { type: "string", enum: ["customer", "siena"] },
                text: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

function buildSystemPrompt(): string {
  return `${VOICE_RULES}

You are the report writer for a CX audit. You phrase findings; you NEVER compute. Every number you mention must appear verbatim in the data provided — copy it exactly, formatted with thousands separators where natural. If a number is not in the data, do not use a number.

You produce:
1. "copy" — the strings of the report:
   - headlineStat: the automation potential score, digits only (e.g. "74").
   - headlineHuman: 1-2 sentences pairing total monthly questions with what the score means for customers ("X% could have been resolved in seconds, warmly, in your voice").
   - volumeIntro: introduces the intent breakdown; mention that checked intents map to actions Siena resolves end to end.
   - chatIntro: introduces the conversation mockups.
   - insightsIntro: introduces the insights — the support queue as honest customer research.
   - mathIntro: introduces the savings math AND the separately-labeled revenue scenario beside it; note the assumptions are in the open and adjustable, and that the two are never summed.
   - benchmarkIntro: one or two sentences placing the brand against peers its size, using the peer numbers provided.
   - couldntSee: 2-3 honest, plain statements about what this export could not show (use the coverage facts provided — macros/saved replies, channels not in the export, CSAT coverage).
   - ctaLine: one warm invitation to walk through the audit on a 30-minute call. No pressure language.
2. "chatMockups" — 2 or 3 short conversations showing how the brand's TOP intents could sound handled by Siena. Each conversation: 2-4 lines, starts with the customer, alternates customer/siena. Siena's lines are warm, specific, and resolve the request completely — reference plausible details for this brand, never invent order numbers or personal data. If pre_purchase is among the top intents, exactly one mockup answers a shopping question and ends with Siena offering to add the item to a cart (endsInCart: true, and the customer accepting is a fine last line). Otherwise all endsInCart are false.

Respond with JSON only.`;
}

function buildUserMessage(input: WriterInput): string {
  const { brand, metrics, benchmark, insights, math, assumptions } = input;

  const topIntents = metrics.intents.slice(0, 5).map((i) => ({
    intent: i.intent,
    label: INTENT_LABELS[i.intent],
    count: i.count,
    sharePercent: Math.round(i.share * 100),
    automatable: i.automatable,
    sienaAction: SIENA_ACTIONS[i.intent] ?? null,
  }));

  const channelsPresent = Object.keys(metrics.channels);
  const allChannels = ["email", "chat", "sms", "social", "phone"];
  const channelsMissing = allChannels.filter((c) => !channelsPresent.includes(c));

  const facts = {
    brand,
    score: metrics.automationPotentialScore,
    totalQuestionsInExport: metrics.totalInExport,
    monthlyVolumeEstimate: metrics.monthlyVolumeEstimate,
    dateRange: metrics.dateRange,
    sampleSize: metrics.sampleSize,
    medianFirstResponseMins: metrics.medianFirstResponseMins,
    medianResolutionHours: metrics.medianResolutionHours,
    automatableSharePercent: Math.round(metrics.automatableShare * 100),
    topIntents,
    repeatContacts: metrics.repeatContacts,
    benchmark,
    math,
    assumptions,
    insightTitles: insights.map((i) => i.title),
    coverageFacts: {
      channelsPresent,
      channelsMissing,
      note: "The export did not include macros or saved replies.",
      csatCoveragePercent: input.csatCoveragePercent,
    },
  };

  return `Write the report copy and chat mockups for this audit. Data (all numbers you may use):\n${JSON.stringify(facts, null, 2)}`;
}

/** Collect every user-facing string from a writer draft. */
function collectStrings(output: WriterOutput): string[] {
  const strings: string[] = [
    output.copy.headlineStat,
    output.copy.headlineHuman,
    output.copy.volumeIntro,
    output.copy.chatIntro,
    output.copy.insightsIntro,
    output.copy.mathIntro,
    output.copy.benchmarkIntro,
    ...output.copy.couldntSee,
    output.copy.ctaLine,
  ];
  for (const mockup of output.chatMockups) {
    strings.push(mockup.intentLabel);
    for (const line of mockup.lines) strings.push(line.text);
  }
  return strings.filter((s) => typeof s === "string");
}

function sanitize(output: WriterOutput, input: WriterInput): WriterOutput {
  // Numbers are code's job: the headline stat is always the computed score.
  const copy: ReportCopy = {
    ...output.copy,
    headlineStat: String(input.metrics.automationPotentialScore),
    couldntSee: (output.copy.couldntSee ?? []).slice(0, 3),
  };

  const hasPrePurchase = input.metrics.intents
    .slice(0, 5)
    .some((i) => i.intent === "pre_purchase");

  const chatMockups = (output.chatMockups ?? [])
    .filter((m) => Array.isArray(m.lines) && m.lines.length >= 2)
    .slice(0, 3)
    .map((m) => ({
      intentLabel: m.intentLabel,
      endsInCart: hasPrePurchase ? Boolean(m.endsInCart) : false,
      lines: m.lines.slice(0, 4),
    }));

  return { copy, chatMockups };
}

export async function writeReport(input: WriterInput): Promise<WriterOutput> {
  const client = getClient();
  if (!client) {
    if (input.mode === "sample") {
      const authored = getAuthoredSample();
      return { copy: authored.copy, chatMockups: authored.chatMockups };
    }
    throw new NoApiKeyError("report-writing");
  }

  const attempt = async (violationNote?: string): Promise<WriterOutput | null> => {
    const messages: { role: "user"; content: string }[] = [
      { role: "user", content: buildUserMessage(input) },
    ];
    if (violationNote) messages.push({ role: "user", content: violationNote });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: {
        format: { type: "json_schema", schema: WRITER_SCHEMA as unknown as Record<string, unknown> },
      },
      system: buildSystemPrompt(),
      messages,
    });

    const parsed = parseStructuredResponse<WriterOutput>(response);
    return parsed ? sanitize(parsed, input) : null;
  };

  const first = await attempt();
  if (!first) throw new VoiceViolationError(["(no parsable output from the writer)"]);

  let violations = [...new Set(collectStrings(first).flatMap((s) => violatesVoice(s)))];
  if (violations.length === 0) return first;

  // Retry once, naming the violations.
  const second = await attempt(
    `Your previous draft used words that are banned in this voice: ${violations.join(", ")}. Rewrite everything without those words. Keep all numbers identical.`,
  );
  if (second) {
    violations = [...new Set(collectStrings(second).flatMap((s) => violatesVoice(s)))];
    if (violations.length === 0) return second;
  }

  throw new VoiceViolationError(violations);
}
