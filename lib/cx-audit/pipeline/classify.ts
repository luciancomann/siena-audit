/**
 * Stage 4 — Classification agent.
 * Deterministic keyword table first (targets the obvious ~60%+), then the
 * remainder goes to Claude in batches of 25 with a strict JSON schema.
 * Without an API key the remainder falls back to intent "other" @ 0.5.
 *
 * Automatable is decided IN CODE, always: an intent is automatable when it
 * has a Siena action, except pre_purchase / account_issues / other.
 */
import type { ClassifiedTicket, Intent, NormalizedTicket } from "../types";
import { INTENTS, SIENA_ACTIONS } from "../types";
import { getClient, MODEL, parseStructuredResponse } from "./llm";

const NEVER_AUTOMATABLE = new Set<Intent>(["pre_purchase", "account_issues", "other"]);

export function isAutomatable(intent: Intent): boolean {
  return Boolean(SIENA_ACTIONS[intent]) && !NEVER_AUTOMATABLE.has(intent);
}

// ------------------------------------------------------------- keyword table

/**
 * Priority-ordered keyword lists. When a ticket matches phrases from more
 * than one intent, the first intent in this list wins.
 */
const KEYWORD_TABLE: [Intent, string[]][] = [
  [
    "subscription_management",
    [
      "subscription",
      "auto-ship",
      "autoship",
      "auto ship",
      "skip my",
      "skip this month",
      "pause my",
      "next delivery",
      "next shipment",
      "push my delivery",
      "delay my next",
      "recurring order",
      "membership renew",
    ],
  ],
  [
    "address_change",
    [
      "wrong address",
      "change my address",
      "change the address",
      "update my address",
      "update the shipping address",
      "change my shipping address",
      "new address",
      "address change",
      "ship it to a different address",
      "moved recently",
      "old address",
    ],
  ],
  [
    "order_editing",
    [
      "change my order",
      "edit my order",
      "modify my order",
      "add to my order",
      "add an item to my order",
      "remove from my order",
      "cancel my order",
      "cancel the order",
      "change the size",
      "change the color",
      "wrong size ordered",
      "ordered the wrong",
      "swap the",
      "combine my orders",
    ],
  ],
  [
    "damaged_defective",
    [
      "damaged",
      "broken",
      "defective",
      "leaking",
      "leaked",
      "doesn't work",
      "does not work",
      "not working",
      "stopped working",
      "stopped dispensing",
      "faulty",
      "cracked",
      "shattered",
      "spoiled",
      "melted",
      "expired product",
      "arrived open",
      "quality issue",
    ],
  ],
  [
    "shipping_issues",
    [
      "lost in transit",
      "stuck in transit",
      "says delivered",
      "marked as delivered",
      "delivered but",
      "never delivered",
      "missing package",
      "package missing",
      "carrier",
      "customs",
      "returned to sender",
      "shipping delay",
      "delayed shipment",
      "wrong item arrived",
      "missing item",
      "stolen",
    ],
  ],
  [
    "returns_exchanges",
    [
      "return",
      "exchange",
      "send it back",
      "send this back",
      "sending it back",
      "return label",
      // word-delimited: bare "rma" substring-matches inside "confirmation",
      // "information", "permanent" and misroutes tickets
      " rma ",
      "rma number",
      "rma #",
      "an rma",
      "store credit for",
    ],
  ],
  [
    "refunds",
    [
      "refund",
      "money back",
      "charged twice",
      "double charged",
      "charged me twice",
      "overcharged",
      "chargeback",
      "dispute the charge",
      "credit my card",
      "still haven't been refunded",
    ],
  ],
  [
    "wismo",
    [
      "where is my order",
      "where's my order",
      "wheres my order",
      "where is my package",
      "order status",
      "status of my order",
      "tracking",
      "track my",
      "hasn't arrived",
      "hasnt arrived",
      "has not arrived",
      "not arrived",
      "still waiting for my order",
      "when will it arrive",
      "when will my order",
      "hasn't shipped",
      "not shipped yet",
      "no movement",
      "any update on my order",
    ],
  ],
  [
    "discount_promo",
    [
      "discount",
      "promo code",
      "promo didn't",
      "coupon",
      "code didn't work",
      "code doesn't work",
      "code isn't working",
      "price match",
      "price adjustment",
      "loyalty points",
      "rewards points",
      "sale price",
      "first order code",
    ],
  ],
  [
    "pre_purchase",
    [
      "before i buy",
      "before i order",
      "before buying",
      "thinking about buying",
      "thinking of ordering",
      "does it work with",
      "is it compatible",
      "can i use it with",
      "which one should i",
      "which shade",
      "what shade",
      "recommend",
      "recommendation",
      "difference between",
      "ingredients",
      "ingredient list",
      "size guide",
      "sizing",
      "in stock",
      "restock",
      "back in stock",
      "when will you have",
      "do you ship to",
      "gift for",
      "is this vegan",
      "cruelty free",
      "safe for",
      "safe to use with",
      "how do i use",
    ],
  ],
  [
    "account_issues",
    [
      "password",
      "log in",
      "login",
      "can't sign in",
      "cannot sign in",
      "sign in to my account",
      "account locked",
      "reset my",
      "update my email",
      "change my email",
      "delete my account",
      "unsubscribe from emails",
      "too many emails",
    ],
  ],
];

function keywordClassify(ticket: NormalizedTicket): { intent: Intent; confidence: number } | null {
  const text = `${ticket.subject}\n${ticket.body}`.toLowerCase();
  const matched: Intent[] = [];
  for (const [intent, phrases] of KEYWORD_TABLE) {
    if (phrases.some((phrase) => text.includes(phrase))) matched.push(intent);
  }
  if (matched.length === 0) return null;
  // Single clean match: high confidence. Multi-match: priority order wins,
  // slightly lower confidence.
  if (matched.length === 1) return { intent: matched[0], confidence: 0.97 };
  return { intent: matched[0], confidence: 0.88 };
}

// ------------------------------------------------------------------ LLM pass

const BATCH_SIZE = 25;
const LLM_CONCURRENCY = 3;

const CLASSIFY_SYSTEM = `You label ecommerce customer-support tickets. Assign each ticket exactly one intent from this list — the definitions are precise, follow them:

- wismo: the customer already ordered and is asking where it is — order status, tracking, delivery ETA, "hasn't arrived".
- returns_exchanges: wants to send a received item back, or swap it for another item/size/shade.
- order_editing: wants to change an order BEFORE it ships — add/remove items, change size/quantity, cancel the order.
- address_change: wants to fix or update the shipping address on an order or account.
- refunds: wants money back, disputes a charge, was charged twice, or is chasing a refund already promised.
- subscription_management: anything about a recurring subscription — skip, pause, reschedule, cancel, change products or frequency.
- pre_purchase: has NOT bought yet — product questions, recommendations, compatibility, ingredients, sizing, stock, shipping options, gifting.
- discount_promo: discount codes, promotions, price matching, loyalty or rewards points.
- shipping_issues: the CARRIER failed — lost or stuck in transit, marked delivered but missing, customs, returned to sender. (The product itself is fine.)
- damaged_defective: the PRODUCT arrived damaged or is defective/not working. (Delivery happened; the item is the problem.)
- account_issues: login, password, account data, email preferences, account deletion.
- other: none of the above fits.

Also mark "automatable": true when the request could be resolved end to end by an automated action (order lookup, address edit, return initiation, subscription change, refund processing, promo fix, carrier lookup, replacement) — false for open-ended judgment calls.

Give "confidence" between 0 and 1 for your intent label. Respond with JSON only.`;

const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["classifications"],
  properties: {
    classifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "intent", "automatable", "confidence"],
        properties: {
          id: { type: "string" },
          intent: { type: "string", enum: [...INTENTS] },
          automatable: { type: "boolean" },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;

interface LlmClassification {
  id: string;
  intent: Intent;
  automatable: boolean;
  confidence: number;
}

function fallbackClassification(ticket: NormalizedTicket): ClassifiedTicket {
  return {
    ...ticket,
    intent: "other",
    automatable: false,
    confidence: 0.5,
    classified_by: "keyword",
  };
}

async function classifyBatchWithClaude(
  batch: NormalizedTicket[],
): Promise<ClassifiedTicket[]> {
  const client = getClient();
  if (!client) return batch.map(fallbackClassification);

  const payload = batch.map((t) => ({
    id: t.id,
    subject: t.subject.slice(0, 140),
    body: t.body.slice(0, 480),
  }));

  let parsed: { classifications: LlmClassification[] } | null = null;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: CLASSIFY_SCHEMA as unknown as Record<string, unknown> },
      },
      system: CLASSIFY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Classify these ${payload.length} tickets:\n${JSON.stringify(payload)}`,
        },
      ],
    });
    parsed = parseStructuredResponse<{ classifications: LlmClassification[] }>(response);
  } catch {
    parsed = null; // network/API failure — degrade gracefully below
  }

  const byId = new Map<string, LlmClassification>();
  if (parsed?.classifications) {
    for (const c of parsed.classifications) {
      if (typeof c?.id === "string" && (INTENTS as readonly string[]).includes(c.intent)) {
        byId.set(c.id, c);
      }
    }
  }

  return batch.map((ticket) => {
    const c = byId.get(ticket.id);
    if (!c) return fallbackClassification(ticket);
    const confidence = Math.max(0, Math.min(1, Number(c.confidence) || 0.5));
    return {
      ...ticket,
      intent: c.intent,
      // Code owns the automatable rule regardless of the model's opinion.
      automatable: isAutomatable(c.intent),
      confidence,
      classified_by: "llm" as const,
    };
  });
}

// ---------------------------------------------------------------- entrypoint

export interface ClassifyStats {
  byKeyword: number;
  byLlm: number;
}

export async function classifyTickets(
  tickets: NormalizedTicket[],
): Promise<{ tickets: ClassifiedTicket[]; stats: ClassifyStats }> {
  const classified = new Map<string, ClassifiedTicket>();
  const remainder: NormalizedTicket[] = [];

  for (const ticket of tickets) {
    const hit = keywordClassify(ticket);
    if (hit) {
      classified.set(ticket.id, {
        ...ticket,
        intent: hit.intent,
        automatable: isAutomatable(hit.intent),
        confidence: hit.confidence,
        classified_by: "keyword",
      });
    } else {
      remainder.push(ticket);
    }
  }

  const byKeyword = classified.size;

  // Batch the remainder through Claude, a few batches at a time.
  const batches: NormalizedTicket[][] = [];
  for (let i = 0; i < remainder.length; i += BATCH_SIZE) {
    batches.push(remainder.slice(i, i + BATCH_SIZE));
  }
  for (let i = 0; i < batches.length; i += LLM_CONCURRENCY) {
    const wave = batches.slice(i, i + LLM_CONCURRENCY);
    const results = await Promise.all(wave.map(classifyBatchWithClaude));
    for (const batchResult of results) {
      for (const t of batchResult) classified.set(t.id, t);
    }
  }

  // Preserve input order.
  const out = tickets.map((t) => classified.get(t.id)!).filter(Boolean);
  const byLlm = out.filter((t) => t.classified_by === "llm").length;

  return { tickets: out, stats: { byKeyword, byLlm } };
}
