/**
 * Verabloom — authored LLM-stage outputs.
 *
 * These are the hand-written strings for the sample brand, lifted verbatim from
 * the hand-authored data/reports/verabloom.json. They stand in for the three
 * LLM stages (insight agent, report writer, chat-mockup author) so the sample
 * audit runs fully deterministic with no API key:
 *
 *   - scripts/precompute-verabloom.ts merges these with the real computed
 *     pipeline stages and regenerates data/reports/verabloom.json.
 *   - the pipeline uses this module directly when mode === "sample".
 *
 * Every string here follows lib/cx-audit/voice.ts and must pass violatesVoice.
 * The numbers embedded in the prose (4,183 / 74% / 23 / 31 / 104 / 586 / 14% /
 * "five hours" / 62%) are locked to the numbers the deterministic pipeline
 * computes from data/verabloom-tickets.csv — the precompute script asserts
 * that they stay in sync and fails loudly on drift.
 */

import type {
  Assumptions,
  ChatMockup,
  Insight,
  ReportCopy,
} from "./types";

/** Fixed identity + timestamp so the precomputed report is byte-reproducible. */
export const AUTHORED_META = {
  slug: "verabloom",
  brand: "Verabloom",
  mode: "sample",
  createdAt: "2026-07-08T09:00:00.000Z",
  reportUrl: "/cx-audit/report/verabloom",
  preparedFor: "Tom",
} as const;

/** Default assumptions (types.ts documents these defaults). */
export const AUTHORED_ASSUMPTIONS: Assumptions = {
  handleTimeMins: 8,
  loadedCostPerTicket: 6.5,
  automatedCostPerTicket: 0.9,
};

/** Insight agent output — the three planted stories, in full. */
export const AUTHORED_INSIGHTS: Insight[] = [
  {
    title: "The Renewal Serum pump is failing, and nobody tagged it",
    pattern:
      "23 conversations across six weeks describe the same thing in different words: the Renewal Serum pump stops dispensing after a week or two. None of them share a tag, so native reporting shows nothing. Your customers filed the defect report for you — one ticket at a time.",
    evidence_count: 23,
    what_siena_memory_would_do:
      "Siena's intelligence layer clusters these on day one, flags a product-quality pattern to your team, and answers the 24th customer with a replacement already in motion.",
  },
  {
    title: "586 shoppers a month are asking to be sold to",
    pattern:
      "14% of your tickets are pre-purchase questions — shade matching, ingredient compatibility, bundle advice. These are shoppers standing at the counter with their hand up. At a median first response of five hours, most of them have moved on.",
    evidence_count: 70,
    what_siena_memory_would_do:
      "The Shopping Agent answers in seconds, remembers skin type and past orders, and turns the question into a recommendation — with an add-to-cart in the same conversation.",
  },
  {
    title: "31 customers wrote three or more times about the same thing",
    pattern:
      "Your subscription skip and pause flow is generating repeat contacts — 31 customers wrote at least three times each about timing changes, 104 tickets in this sample alone. Each repeat contact is a customer re-explaining themselves to someone new.",
    evidence_count: 31,
    what_siena_memory_would_do:
      "Siena remembers the last conversation, so the second message never starts from zero — and handles skips, pauses, and date changes on the spot, in your voice.",
  },
];

/** Shortened insight variants used inside the CRM handoff payload. */
export const AUTHORED_CRM_INSIGHTS: Insight[] = [
  {
    title: "The Renewal Serum pump is failing, and nobody tagged it",
    pattern: "23 untagged defect reports across six weeks.",
    evidence_count: 23,
    what_siena_memory_would_do:
      "Cluster on day one, flag product quality, auto-resolve replacements.",
  },
  {
    title: "586 shoppers a month are asking to be sold to",
    pattern: "14% of volume is pre-purchase.",
    evidence_count: 70,
    what_siena_memory_would_do:
      "Shopping Agent answers in seconds and converts.",
  },
  {
    title: "31 customers wrote three or more times",
    pattern: "Subscription skip/pause friction drives repeat contacts.",
    evidence_count: 31,
    what_siena_memory_would_do:
      "Memory kills repeat contacts; handles timing changes instantly.",
  },
];

/** Chat-mockup author output — how the top conversations could sound. */
export const AUTHORED_CHAT_MOCKUPS: ChatMockup[] = [
  {
    intentLabel: "Where is my order?",
    endsInCart: false,
    lines: [
      {
        role: "customer",
        text: "Hi! I ordered the Daily Glow set last week and haven't seen any movement on tracking 😕",
      },
      {
        role: "siena",
        text: "I checked — your set left our Reno warehouse yesterday and the carrier scan just hadn't caught up. It lands Thursday. I'll send you the new tracking link right now, and I'm sorry the silence made you wonder.",
      },
      { role: "customer", text: "Oh perfect, thank you!" },
    ],
  },
  {
    intentLabel: "Pre-purchase question",
    endsInCart: true,
    lines: [
      {
        role: "customer",
        text: "Is the Renewal Serum okay to layer with retinol? I use it every other night.",
      },
      {
        role: "siena",
        text: "Yes — on your retinol nights, apply the serum first and give it a minute to settle. On off nights it pairs beautifully with the Barrier Cream you bought in March. Want me to add the serum to a cart with your usual 10% subscriber pricing?",
      },
      { role: "customer", text: "Yes please — add it!" },
    ],
  },
  {
    intentLabel: "Subscription timing",
    endsInCart: false,
    lines: [
      {
        role: "customer",
        text: "I still have half a bottle left, can I push my next delivery?",
      },
      {
        role: "siena",
        text: "Done — I moved your next Renewal Serum shipment to August 12 and kept your subscriber price. If you're ever running low early, just tell me and I'll pull it forward. No forms, no waiting.",
      },
    ],
  },
];

/** Report-writer output — every section intro and the honest-limits list. */
export const AUTHORED_COPY: ReportCopy = {
  headlineStat: "74",
  headlineHuman:
    "Your customers asked 4,183 questions last month. 74% could have been resolved in seconds, warmly, in your voice.",
  volumeIntro:
    "Here's what your customers actually wrote in about. The checked intents map to actions Siena resolves end to end — not routed, not queued, resolved.",
  chatIntro:
    "This is how those conversations could sound. Same questions, your voice, answered in seconds.",
  insightsIntro:
    "A support queue is the most honest customer research you own. Here's what yours has been trying to tell you.",
  mathIntro:
    "The math, with our assumptions in the open — change them and the numbers update.",
  benchmarkIntro:
    "Brands your size typically sit here — same volume band, same channel mix.",
  couldntSee: [
    "Your export didn't include macros or saved replies, so we can't see what your team already automates by hand.",
    "Social DMs weren't in this export — for most consumer brands they add 10–20% more volume with the same intent mix.",
    "CSAT was present on 62% of tickets; the medians above use what's there. A full audit reads every channel and every field.",
  ],
  ctaLine:
    "Walk through your audit with us — 30 minutes, your numbers, no slides.",
};

/** The one authored string that lives inside the math section. */
export const AUTHORED_PRE_PURCHASE_REVENUE_NOTE =
  "586 pre-purchase conversations a month is a sales channel hiding in your support queue. Answered in seconds instead of five hours, a portion of those become orders — we'll model that with your AOV on a call.";

/** Every authored user-facing string, flattened, for voice linting. */
export function allAuthoredStrings(): string[] {
  const out: string[] = [];
  for (const i of [...AUTHORED_INSIGHTS, ...AUTHORED_CRM_INSIGHTS]) {
    out.push(i.title, i.pattern, i.what_siena_memory_would_do);
  }
  for (const m of AUTHORED_CHAT_MOCKUPS) {
    out.push(m.intentLabel, ...m.lines.map((l) => l.text));
  }
  const c = AUTHORED_COPY;
  out.push(
    c.headlineStat,
    c.headlineHuman,
    c.volumeIntro,
    c.chatIntro,
    c.insightsIntro,
    c.mathIntro,
    c.benchmarkIntro,
    ...c.couldntSee,
    c.ctaLine,
    AUTHORED_PRE_PURCHASE_REVENUE_NOTE,
  );
  return out;
}
