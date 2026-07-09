/**
 * generate-verabloom.ts — deterministic synthetic Gorgias export for Verabloom.
 *
 * Run:  npx tsx scripts/generate-verabloom.ts
 * Out:  data/verabloom-tickets.csv  (columns: id, created_at, channel, subject,
 *       body, customer_email, first_response_at, resolved_at, satisfaction_score)
 *
 * Everything is seeded (mulberry32, fixed seed) — NEVER Math.random. Running it
 * twice produces byte-identical CSV.
 *
 * ── What this file guarantees (and asserts before writing) ──────────────────
 *
 * 1. Exactly 500 tickets, intent distribution matching data/reports/verabloom.json:
 *    wismo 140, pre_purchase 70, subscription_management 55, returns_exchanges 45,
 *    refunds 35, damaged_defective 30, order_editing 25, shipping_issues 25,
 *    discount_promo 20, address_change 18, other 22, account_issues 15.
 *
 * 2. Keyword determinism: every ticket's subject+body contains at least one of
 *    its own intent's anchor phrases (ANCHORS below) and ZERO anchor phrases of
 *    any other intent. Any keyword pre-pass built from these obvious phrase
 *    families classifies the whole sample correctly regardless of table order.
 *    The recommended classify.ts table is printed as a manifest on every run.
 *
 * 3. The three planted stories:
 *    (a) 23 of the 30 damaged_defective tickets describe the Renewal Serum pump
 *        failing, in heavily varied wording, from 23 distinct customers, spread
 *        across the whole of June. (The authored insight says "six weeks" — that
 *        is the story's framing in Verabloom's full history; the 500-ticket
 *        sample window is June 2026, matching metrics.dateRange.)
 *    (b) All 70 pre_purchase tickets are shade matching (24), ingredient
 *        compatibility (24), or bundle advice (22).
 *    (c) Exactly 31 customers have 3+ tickets each — 104 tickets total — and
 *        every one of those threads is about subscription timing.
 *        RECONCILIATION: subscription_management has only 55 tickets, so the
 *        104 cluster tickets span several intents. Thematically each ticket is
 *        the same saga (a skip/pause that didn't take), but the individual
 *        messages classify cleanly by keyword to:
 *          subscription_management 55  (all 55 — no one-off sub tickets exist)
 *          wismo                   15  ("it shipped anyway — where is my order")
 *          refunds                 12  ("charged for a box I'd postponed")
 *          order_editing            8  ("cancel that order before it goes out")
 *          address_change           6  ("before my next box, update my address")
 *          discount_promo           4  ("the promo code you promised never came")
 *          account_issues           4  ("locked out, can't log in to move my date")
 *          ─────────────────────  104
 *        Cluster non-sub bodies deliberately avoid the words skip/pause/
 *        subscription so they never cross-match. Every other customer in the
 *        file has at most 2 tickets, so metrics.repeatContacts = {31, 104}.
 *
 * 4. Engineered timing so the pure-code metrics stage reproduces the authored
 *    medians EXACTLY (both the per-intent table and the overall 252 min /
 *    11.5 h): per intent, the middle order statistics are pinned to the target;
 *    the union is then tuned so exactly 249 values sit strictly below the
 *    overall target and the 250th/251st equal it. All 500 tickets carry both
 *    first_response_at and resolved_at (resolved > first response, always).
 *
 * 5. PII planted with exact occurrence counts (matching the authored
 *    redactionCounts): emails 512, phones 87, order numbers 431, street
 *    addresses 96, names 388 — total 1514. Formats are regular so the redaction
 *    agent can catch them (see manifest for the exact shapes/regexes).
 *
 * 6. Channels: email 312, chat 141, sms 33, social 14 (9 instagram + 5 facebook
 *    in the raw export — ingest should normalize those two to "social").
 *    CSAT present on exactly 310 tickets (62%). created_at spans 2026-06-01
 *    through 2026-06-30 inclusive.
 *
 * ── Coordination notes for the pipeline agent (also printed as manifest) ────
 *  - classify.ts should match on lowercase subject+body using the ANCHORS
 *    table below (or any subset). Do NOT use these as keywords: "renew"
 *    (collides with the Renewal Serum product name), bare "email", bare
 *    "ship"/"shipped", "delivery", "arrive" (only the full phrase
 *    "hasn't arrived"), "verification code", "order".
 *  - redact.ts replacement tokens must not contain intent keywords — use
 *    "[redacted]"-style tokens, never "[address]" / "[email]", because
 *    classification runs after redaction.
 *  - metrics.ts must derive dateRange from created_at (resolved_at can spill
 *    into July) and accept totalInExport as an input (the sample CSV is the
 *    500-ticket sample of a 4,183/month export — the CSV itself cannot carry
 *    that number).
 */

import { unparse } from "papaparse";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INTENTS, type Intent } from "../lib/cx-audit/types";
import { BANNED_WORDS } from "../lib/cx-audit/voice";

// ---------------------------------------------------------------- prng

/** mulberry32 — small fast seeded PRNG. Fixed seed: the sample must be stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260601);
const rint = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- targets

const INTENT_COUNTS: Record<Intent, number> = {
  wismo: 140,
  pre_purchase: 70,
  subscription_management: 55,
  returns_exchanges: 45,
  refunds: 35,
  damaged_defective: 30,
  order_editing: 25,
  shipping_issues: 25,
  discount_promo: 20,
  address_change: 18,
  other: 22,
  account_issues: 15,
};

/** Authored per-intent medians the metrics stage must reproduce exactly. */
const MEDIANS: Record<Intent, { frMins: number; resTenths: number }> = {
  wismo: { frMins: 214, resTenths: 61 },
  pre_purchase: { frMins: 301, resTenths: 148 },
  subscription_management: { frMins: 265, resTenths: 109 },
  returns_exchanges: { frMins: 288, resTenths: 163 },
  refunds: { frMins: 246, resTenths: 124 },
  damaged_defective: { frMins: 234, resTenths: 132 },
  order_editing: { frMins: 198, resTenths: 78 },
  shipping_issues: { frMins: 275, resTenths: 186 },
  discount_promo: { frMins: 187, resTenths: 54 },
  address_change: { frMins: 158, resTenths: 49 },
  other: { frMins: 322, resTenths: 201 },
  account_issues: { frMins: 290, resTenths: 157 },
};
const OVERALL_FR_MINS = 252; // authored metrics.medianFirstResponseMins
const OVERALL_RES_TENTHS = 115; // authored 11.5 h, stored in tenths of an hour

const CHANNEL_QUOTAS = { email: 312, chat: 141, sms: 33, instagram: 9, facebook: 5 };
const CSAT_PRESENT = 310; // 62% of 500 — quoted in the authored copy

/** Exact PII occurrence targets (authored redactionCounts). */
const PII_TARGETS = { emails: 512, phones: 87, orderNumbers: 431, addresses: 96, names: 388 };

// ---------------------------------------------------------------- classifier mirror

/**
 * VERBATIM mirror of the priority-ordered keyword table in
 * lib/cx-audit/pipeline/classify.ts. The validator below simulates that
 * classifier exactly (priority order + single-match 0.97 / multi-match 0.88)
 * and asserts every ticket lands on its intended intent with the intended
 * confidence — so the sample pipeline is fully deterministic without an API
 * key, and the Automation Potential Score computes to exactly 74.
 * scripts/precompute-verabloom.ts re-verifies through the real module.
 */
const CLASSIFY_TABLE: [Intent, string[]][] = [
  ["subscription_management", [
    "subscription", "auto-ship", "autoship", "auto ship", "skip my",
    "skip this month", "pause my", "next delivery", "next shipment",
    "push my delivery", "delay my next", "recurring order", "membership renew",
  ]],
  ["address_change", [
    "wrong address", "change my address", "change the address", "update my address",
    "update the shipping address", "change my shipping address", "new address",
    "address change", "ship it to a different address", "moved recently", "old address",
  ]],
  ["order_editing", [
    "change my order", "edit my order", "modify my order", "add to my order",
    "add an item to my order", "remove from my order", "cancel my order",
    "cancel the order", "change the size", "change the color", "wrong size ordered",
    "ordered the wrong", "swap the", "combine my orders",
  ]],
  ["damaged_defective", [
    "damaged", "broken", "defective", "leaking", "leaked", "doesn't work",
    "does not work", "not working", "stopped working", "stopped dispensing",
    "faulty", "cracked", "shattered", "spoiled", "melted", "expired product",
    "arrived open", "quality issue",
  ]],
  ["shipping_issues", [
    "lost in transit", "stuck in transit", "says delivered", "marked as delivered",
    "delivered but", "never delivered", "missing package", "package missing",
    "carrier", "customs", "returned to sender", "shipping delay", "delayed shipment",
    "wrong item arrived", "missing item", "stolen",
  ]],
  ["returns_exchanges", [
    "return", "exchange", "send it back", "send this back", "sending it back",
    "return label", "rma", "store credit for",
  ]],
  ["refunds", [
    "refund", "money back", "charged twice", "double charged", "charged me twice",
    "overcharged", "chargeback", "dispute the charge", "credit my card",
    "still haven't been refunded",
  ]],
  ["wismo", [
    "where is my order", "where's my order", "wheres my order", "where is my package",
    "order status", "status of my order", "tracking", "track my", "hasn't arrived",
    "hasnt arrived", "has not arrived", "not arrived", "still waiting for my order",
    "when will it arrive", "when will my order", "hasn't shipped", "not shipped yet",
    "no movement", "any update on my order",
  ]],
  ["discount_promo", [
    "discount", "promo code", "promo didn't", "coupon", "code didn't work",
    "code doesn't work", "code isn't working", "price match", "price adjustment",
    "loyalty points", "rewards points", "sale price", "first order code",
  ]],
  ["pre_purchase", [
    "before i buy", "before i order", "before buying", "thinking about buying",
    "thinking of ordering", "does it work with", "is it compatible", "can i use it with",
    "which one should i", "which shade", "what shade", "recommend", "recommendation",
    "difference between", "ingredients", "ingredient list", "size guide", "sizing",
    "in stock", "restock", "back in stock", "when will you have", "do you ship to",
    "gift for", "is this vegan", "cruelty free", "safe for", "safe to use with",
    "how do i use",
  ]],
  ["account_issues", [
    "password", "log in", "login", "can't sign in", "cannot sign in",
    "sign in to my account", "account locked", "reset my", "update my email",
    "change my email", "delete my account", "unsubscribe from emails", "too many emails",
  ]],
];

/** classify.ts keywordClassify, replicated exactly. */
function simulateClassify(subject: string, body: string): { intent: Intent; confidence: number } | null {
  const text = `${subject}\n${body}`.toLowerCase();
  const matched: Intent[] = [];
  for (const [intent, phrases] of CLASSIFY_TABLE) {
    if (phrases.some((p) => text.includes(p))) matched.push(intent);
  }
  if (matched.length === 0) return null;
  return matched.length === 1
    ? { intent: matched[0], confidence: 0.97 }
    : { intent: matched[0], confidence: 0.88 };
}

/**
 * Confidence engineering: with classify.ts's two confidence levels
 * (0.97 single-intent match / 0.88 multi-intent match resolved by priority),
 * the number of DELIBERATE multi-match tickets per intent below makes every
 * automatable intent's avgConfidence round to the authored table AND makes
 * APS = round(100 * Σ confidence(automatable) / 500)
 *     = round((381.21 - 0.09*107) / 5) = round(74.316) = exactly 74.
 * Multi-match tickets carry one natural secondary phrase from a LOWER-priority
 * intent (e.g. a damaged ticket asking for a refund), so priority order still
 * resolves them to the intended intent.
 */
const MULTI_PLAN: Partial<Record<Intent, number>> = {
  subscription_management: 12, // avg .9504 -> .95
  address_change: 2, //            avg .9600 -> .96
  order_editing: 14, //            avg .9196 -> .92
  damaged_defective: 23, //        avg .9010 -> .90  (all 23 pump tickets)
  shipping_issues: 22, //          avg .8908 -> .89
  returns_exchanges: 15, //        avg .9400 -> .94
  refunds: 15, //                  avg .9314 -> .93
  discount_promo: 4, //            avg .9520 -> .95
  // wismo: 0                      avg .9700 -> .97
};

// ---------------------------------------------------------------- banks

const FIRST_NAMES = [
  "Ava", "Mia", "Noah", "Liam", "Emma", "Olivia", "Sophia", "Isabella",
  "Charlotte", "Amelia", "Harper", "Evelyn", "Layla", "Zoe", "Nora", "Hazel",
  "Ellie", "Lucy", "Stella", "Aurora", "Ruby", "Ivy", "Naomi", "Elena",
  "Priya", "Maya", "Nina", "Tara", "Jade", "Leah", "Rosa", "Marcus",
  "Ethan", "Daniel", "Jordan", "Tyler", "Kevin", "Derek", "Omar", "Felix",
  "Andre", "Miguel", "Diego", "Hana", "Yuki", "Amara", "Imani", "Keisha",
  "Dana", "Morgan", "Riley", "Quinn", "Avery", "Jamie", "Blake", "Erin",
  "Brooke", "Sierra", "Autumn", "Willa", "Selena", "Bianca", "Chloe", "Gwen",
];
const LAST_NAMES = [
  "Whitfield", "Alvarez", "Chen", "Patel", "Nguyen", "Kim", "Park", "Rivera",
  "Morales", "Bennett", "Foster", "Hayes", "Brooks", "Reed", "Cole", "Vaughn",
  "Mercer", "Ellison", "Hartley", "Winslow", "Ferris", "Doyle", "Marsh",
  "Bishop", "Rhodes", "Sutton", "Vega", "Cruz", "Romano", "Silva", "Okafor",
  "Ibrahim", "Haddad", "Nowak", "Larsen", "Dupont", "Moreau", "Tanaka",
  "Ramsey", "Holloway",
];
const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "hotmail.com", "proton.me"];
const STREETS = [
  "Maple Street", "Oak Lane", "Birch Road", "Cedar Avenue", "Willow Court",
  "Juniper Drive", "Magnolia Boulevard", "Sycamore Way", "Alder Place",
  "Hawthorn Terrace", "Bluebell Lane", "Chestnut Street", "Dogwood Drive",
  "Elm Avenue", "Foxglove Court",
];
const CITIES = [
  "Portland", "Austin", "Denver", "Nashville", "Madison", "Savannah",
  "Boulder", "Tucson", "Raleigh", "Providence", "Ann Arbor", "Boise",
  "Asheville", "Tacoma", "Plano",
];
const AREA_CODES = [206, 213, 303, 312, 404, 415, 512, 602, 617, 702, 718, 773, 815, 904, 916];

const SERUM = "Renewal Serum";
const PRODUCTS = [
  SERUM, "Daily Glow set", "Barrier Cream", "Hydra Cleanser",
  "Overnight Repair Mask", "Niacinamide Toner", "Vitamin C Drops",
  "Tinted Mineral SPF", "Marine Collagen Capsules", "Biotin+ Gummies",
  "Ashwagandha Softgels", "Rosewater Mist",
];
const SUB_PRODUCTS = [SERUM, "Marine Collagen Capsules", "Biotin+ Gummies", "Ashwagandha Softgels"];
const SPF_SHADES = ["Fair", "Light Beige", "Golden Medium", "Honey Tan", "Deep Amber"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const newStreet = () => `${rint(12, 980)} ${pick(STREETS)}, ${pick(CITIES)}`;
const newPhone = () => `(${pick(AREA_CODES)}) 555-01${String(rint(0, 99)).padStart(2, "0")}`;
const newOrder = () => `#VB-${rint(10000, 89999)}`;

// ---------------------------------------------------------------- customers

interface Customer {
  first: string;
  last: string;
  email: string;
}
const usedEmails = new Set<string>();
function newCustomer(): Customer {
  for (;;) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${rint(2, 989)}@${pick(DOMAINS)}`;
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);
    return { first, last, email };
  }
}

// ---------------------------------------------------------------- specs

/** A ticket before text/timing assembly. */
interface Spec {
  intent: Intent;
  /** template theme within the intent */
  theme: string;
  /** position within a cluster thread (0-based), -1 for non-cluster */
  threadPos: number;
  threadLen: number;
  customer: Customer;
  // PII plan
  emails: 0 | 1 | 2;
  phone: boolean;
  addresses: 0 | 1 | 2;
  name: boolean;
  orderRefs: 0 | 1 | 2;
  /** deliberately matches a second, lower-priority intent (confidence 0.88) */
  multi: boolean;
  // filled later
  subject?: string;
  body?: string;
  day?: number; // 1..30 June 2026
  createdAt?: Date;
  frMins?: number;
  frSlot?: "below" | "mid" | "above";
  resTenths?: number;
  resSlot?: "below" | "mid" | "above";
  channel?: string;
  csat?: number | null;
  pinEndpoint?: "first" | "last";
}

const specs: Spec[] = [];

// --- cluster threads: 31 customers, 104 tickets, all subscription-timing.
// Thread shapes (see reconciliation in the header):
//   3-ticket: 4×[sub,sub,sub], 8×[sub,sub,X], 8×[sub,X,Y]
//   4-ticket: 8×[sub,sub,X,Y], 3×[sub,X,Y,Z]
// Non-sub slots consume exactly: wismo 15, refunds 12, order_editing 8,
// address_change 6, discount_promo 4, account_issues 4  (= 49).
const clusterCustomers: Customer[] = [];
{
  const nonSubPool: Intent[] = shuffle([
    ...Array<Intent>(15).fill("wismo"),
    ...Array<Intent>(12).fill("refunds"),
    ...Array<Intent>(8).fill("order_editing"),
    ...Array<Intent>(6).fill("address_change"),
    ...Array<Intent>(4).fill("discount_promo"),
    ...Array<Intent>(4).fill("account_issues"),
  ]);
  const shapes: Intent[][] = [];
  const S: Intent = "subscription_management";
  for (let i = 0; i < 4; i++) shapes.push([S, S, S]);
  for (let i = 0; i < 8; i++) shapes.push([S, S, nonSubPool.pop()!]);
  for (let i = 0; i < 8; i++) shapes.push([S, nonSubPool.pop()!, nonSubPool.pop()!]);
  for (let i = 0; i < 8; i++) shapes.push([S, S, nonSubPool.pop()!, nonSubPool.pop()!]);
  for (let i = 0; i < 3; i++) shapes.push([S, nonSubPool.pop()!, nonSubPool.pop()!, nonSubPool.pop()!]);
  if (nonSubPool.length !== 0) throw new Error("cluster non-sub pool not fully consumed");
  for (const shape of shapes) {
    const customer = newCustomer();
    clusterCustomers.push(customer);
    // within a thread, non-sub tickets follow at least one sub ticket — the
    // saga starts with the skip/pause ask. Shuffle only positions 1+.
    const ordered = [shape[0], ...shuffle(shape.slice(1))];
    ordered.forEach((intent, i) => {
      specs.push({
        intent,
        theme: "cluster",
        threadPos: i,
        threadLen: ordered.length,
        customer,
        emails: 0,
        phone: false,
        addresses: 0,
        name: false,
        orderRefs: 0,
        multi: false,
      });
    });
  }
}

// --- non-cluster specs
function pushN(intent: Intent, theme: string, n: number) {
  for (let i = 0; i < n; i++) {
    specs.push({
      intent,
      theme,
      threadPos: -1,
      threadLen: 1,
      customer: null as unknown as Customer, // assigned below
      emails: 0,
      phone: false,
      addresses: 0,
      name: false,
      orderRefs: 0,
      multi: false,
    });
  }
}
pushN("wismo", "regular", 125);
pushN("pre_purchase", "shade", 24);
pushN("pre_purchase", "ingredient", 24);
pushN("pre_purchase", "bundle", 22);
pushN("returns_exchanges", "regular", 45);
pushN("refunds", "regular", 23);
pushN("damaged_defective", "pump", 23);
pushN("damaged_defective", "general", 7);
pushN("order_editing", "regular", 17);
pushN("shipping_issues", "stuck", 8);
pushN("shipping_issues", "delivered", 7);
pushN("shipping_issues", "lost", 5);
pushN("shipping_issues", "misdelivery", 5);
pushN("discount_promo", "regular", 16);
pushN("address_change", "regular", 12);
pushN("other", "misc", 22);
pushN("account_issues", "regular", 11);

// sanity: distribution
{
  const got: Record<string, number> = {};
  for (const s of specs) got[s.intent] = (got[s.intent] ?? 0) + 1;
  for (const intent of INTENTS) {
    if (got[intent] !== INTENT_COUNTS[intent]) {
      throw new Error(`intent count drift: ${intent} ${got[intent]} != ${INTENT_COUNTS[intent]}`);
    }
  }
  if (specs.length !== 500) throw new Error(`expected 500 specs, got ${specs.length}`);
}

// --- assign customers to non-cluster specs.
// Pump reporters must be 23 distinct single-ticket customers. Of the rest,
// 56 customers file 2 tickets each (112 tickets) and 261 file 1 (261 tickets).
{
  const nonCluster = specs.filter((s) => s.threadPos === -1);
  const pump = nonCluster.filter((s) => s.theme === "pump");
  const rest = shuffle(nonCluster.filter((s) => s.theme !== "pump"));
  for (const s of pump) s.customer = newCustomer();
  for (let i = 0; i < 56; i++) {
    const c = newCustomer();
    rest[2 * i].customer = c;
    rest[2 * i + 1].customer = c;
  }
  for (let i = 112; i < rest.length; i++) rest[i].customer = newCustomer();
}

// ---------------------------------------------------------------- pii plan

/** Deterministically flag the first n shuffled specs of an intent that match. */
function flagN(intent: Intent, n: number, set: (s: Spec) => void, where: (s: Spec) => boolean = () => true) {
  const eligible = shuffle(specs.filter((s) => s.intent === intent && where(s)));
  if (eligible.length < n) throw new Error(`flagN: not enough ${intent} specs (${eligible.length} < ${n})`);
  for (let i = 0; i < n; i++) set(eligible[i]);
}

// order references — base 1 for order-bearing intents, +1 extras, sums to 431:
// 140+45+35+30+25+25+18 base + 20 sub + 10 discount + (49+12+10+12) seconds = 431
for (const s of specs) {
  if (["wismo", "returns_exchanges", "refunds", "damaged_defective", "order_editing", "shipping_issues", "address_change"].includes(s.intent)) {
    s.orderRefs = 1;
  }
}
flagN("subscription_management", 20, (s) => (s.orderRefs = 1));
flagN("discount_promo", 10, (s) => (s.orderRefs = 1));
flagN("wismo", 49, (s) => (s.orderRefs = 2));
flagN("order_editing", 12, (s) => (s.orderRefs = 2));
flagN("refunds", 10, (s) => (s.orderRefs = 2));
flagN("shipping_issues", 12, (s) => (s.orderRefs = 2));

// emails — every ticket carries 1, except: all 15 account_issues carry 2
// (old+new inbox), 3 subscription tickets carry 2 (moved inboxes), and 6
// "other" tickets carry 0. 476×1 + 18×2 = 512.
for (const s of specs) s.emails = 1;
for (const s of specs) if (s.intent === "account_issues") s.emails = 2;
flagN("subscription_management", 3, (s) => (s.emails = 2));
flagN("other", 6, (s) => (s.emails = 0));

// phones — 87 total
const PHONE_PLAN: Partial<Record<Intent, number>> = {
  wismo: 20, shipping_issues: 10, returns_exchanges: 8, refunds: 8,
  order_editing: 10, address_change: 8, subscription_management: 8,
  damaged_defective: 6, account_issues: 4, discount_promo: 3, pre_purchase: 2,
};
for (const [intent, n] of Object.entries(PHONE_PLAN)) flagN(intent as Intent, n!, (s) => (s.phone = true));

// street addresses — 96 total: address_change 18×2, wismo 40, returns 12, order_editing 8
for (const s of specs) if (s.intent === "address_change") s.addresses = 2;
flagN("wismo", 40, (s) => (s.addresses = 1));
flagN("returns_exchanges", 12, (s) => (s.addresses = 1));
flagN("order_editing", 8, (s) => (s.addresses = 1));

// names — 388 tickets sign or introduce themselves (112 do not)
const NO_NAME_PLAN: Partial<Record<Intent, number>> = {
  other: 10, pre_purchase: 30, wismo: 30, subscription_management: 10,
  discount_promo: 8, returns_exchanges: 8, refunds: 6, damaged_defective: 4,
  shipping_issues: 4, account_issues: 2,
};
for (const s of specs) s.name = true;
for (const [intent, n] of Object.entries(NO_NAME_PLAN)) flagN(intent as Intent, n!, (s) => (s.name = false));

// deliberate multi-intent matches (see MULTI_PLAN). The 23 damaged multis are
// exactly the pump-story tickets — a defect report asking for a replacement
// or refund is the natural phrasing anyway.
for (const [intent, n] of Object.entries(MULTI_PLAN)) {
  if (intent === "damaged_defective") flagN(intent as Intent, n!, (s) => (s.multi = true), (s) => s.theme === "pump");
  else flagN(intent as Intent, n!, (s) => (s.multi = true));
}

// ---------------------------------------------------------------- text

const altEmail = (c: Customer) =>
  `${c.first.toLowerCase()}${c.last.toLowerCase().slice(0, 1)}${rint(2, 97)}@${pick(DOMAINS)}`;

interface Ctx {
  s: Spec;
  order: string | null;
  product: string;
  subProduct: string;
  addr1: string;
  addr2: string;
  oldEmail: string;
  price: string;
  d: number;
  d2: number;
  n: number;
  weekday: string;
  city: string;
  shade1: string;
  shade2: string;
}

type Core = (c: Ctx) => { subject: string; body: string };

const wismoRegular: Core[] = [
  (c) => ({ subject: "Where is my order?", body: `I ordered the ${c.product} ${c.n} days ago and ${c.order} still shows just a label. Where is my order?` }),
  (c) => ({ subject: "Order status check", body: `Could I get an order status update on ${c.order}? The site said 3–5 business days and it's been ${c.n}.` }),
  (c) => ({ subject: "Package not moving", body: `My order ${c.order} hasn't moved since last ${c.weekday} — the tracking is frozen. I keep refreshing and nothing changes.` }),
  (c) => ({ subject: "Tracking not updating", body: `The tracking link for ${c.order} has said the same thing since ${c.weekday}. Is it actually on the way?` }),
  (c) => ({ subject: "Still waiting", body: `Still waiting for my order — ${c.order}, placed June ${c.d}. Any idea when it goes out?` }),
  (c) => ({ subject: "Cutting it close", body: `When will it arrive? I bought the ${c.product} for a trip on the ${c.d2}th and I'm getting nervous. ${c.order}.` }),
  (c) => ({ subject: "Any update?", body: `Any update on my order ${c.order}? No word since the order went through on June ${c.d}.` }),
  (c) => ({ subject: "Order overdue", body: `Hasn't arrived yet — I ordered the ${c.product} June ${c.d} and the estimate said by June ${c.d2}. ${c.order}.` }),
  (c) => ({ subject: "Is my package coming?", body: `Just checking in — where's my order? ${c.order}. The porch has been empty all week 😕` }),
  (c) => ({ subject: "First order, no news", body: `First time ordering from you — is there any tracking yet for ${c.order}? The receipt came through but nothing since.` }),
];
const wismoCluster: Core[] = [
  (c) => ({ subject: "It went out anyway?", body: `You'd moved my ${c.subProduct} box to June ${c.d2}, but I just got a dispatch notice. Where is my order now — and can you send tracking?` }),
  (c) => ({ subject: "Where is the box I postponed?", body: `The box I asked you to push out went out anyway. Where's my order ${c.order}? If it's coming regardless, I'd at least like the tracking link.` }),
  (c) => ({ subject: "Fine, but where is it", body: `Since my ${c.subProduct} refill went out early anyway, can you send the tracking? ${c.order}. Third message this month about this box.` }),
];

const returnsRegular: Core[] = [
  (c) => ({ subject: "Return request", body: `I'd like to return the ${c.product} — it's just not agreeing with my skin. ${c.order}.` }),
  (c) => ({ subject: "Exchange?", body: `Can I exchange the ${c.product} for the ${c.subProduct}? Unopened, still in the wrapper. ${c.order}.` }),
  (c) => ({ subject: "Ordered a duplicate", body: `Ordered two of the ${c.product} by mistake — can I send it back? What's the return process? ${c.order}.` }),
  (c) => ({ subject: "Gift didn't land", body: `Got the ${c.product} as a gift and it's not my thing. How do I set up a return? ${c.order}.` }),
  (c) => ({ subject: "Too heavy for me", body: `The ${c.product} smells lovely but sits heavy on me. I'd like to return it for store credit if that's an option. ${c.order}.` }),
  (c) => ({ subject: "Swap for the lighter one", body: `Would love to exchange my Tinted Mineral SPF for the lighter one — used it once. ${c.order}.` }),
  (c) => ({ subject: "Didn't work out", body: `Sadly the ${c.product} broke me out. Can I return the rest of the set? ${c.order}.` }),
];

const orderEditRegular: Core[] = [
  (c) => ({ subject: "Duplicate order", body: `Please cancel my order ${c.order} — I accidentally placed it twice within a minute.` }),
  (c) => ({ subject: "One more thing", body: `Can you add to my order? One more Barrier Cream on ${c.order} before it goes out.` }),
  (c) => ({ subject: "Wrong item", body: `I picked the wrong item — can you change my order to the ${c.product}? ${c.order}.` }),
  (c) => ({ subject: "Size fix", body: `Can I edit my order? I meant to get the bigger size of the ${c.product}. ${c.order}.` }),
  (c) => ({ subject: "Cancel please", body: `Please cancel the order if it hasn't left yet — ${c.order}. I'll reorder next month when I'm back home.` }),
];
const orderEditCluster: Core[] = [
  (c) => ({ subject: "Cancel this month's box", body: `My next box is queued for tomorrow — please cancel the order (${c.order}); I still have plenty left.` }),
  (c) => ({ subject: "Cancel before it leaves", body: `The June box went to processing even though I'd moved my date. Can you cancel the order ${c.order} before it leaves the warehouse?` }),
];

const addressRegular: Core[] = [
  (c) => ({ subject: "Update my address", body: `I just moved — please update my address to ${c.addr1}. The old one on file is ${c.addr2}.` }),
  (c) => ({ subject: "Wrong address on file", body: `The address on file is wrong — it should be ${c.addr1}, not ${c.addr2}. Can you update my address before anything else goes out?` }),
  (c) => ({ subject: "Moving soon", body: `Moving on the ${c.d}th — can you change my address to ${c.addr1}? Old one: ${c.addr2}.` }),
];
const addressCluster: Core[] = [
  (c) => ({ subject: "New address before my next box", body: `Before my next box goes out, please update my address to ${c.addr1} — the ${c.addr2} one is my old place.` }),
];

const refundsRegular: Core[] = [
  (c) => ({ subject: "Charged twice", body: `I was charged twice for ${c.order} — ${c.price} and then ${c.price} again a minute later. Please refund the duplicate.` }),
  (c) => ({ subject: "Refund request", body: `Please refund ${c.order}. I changed my mind the same morning and it hasn't gone out yet.` }),
  (c) => ({ subject: "Price dropped a day later", body: `The ${c.product} dropped in price the day after I paid full. Any chance of a partial refund on ${c.order}?` }),
  (c) => ({ subject: "Where's my refund?", body: `You approved my refund for ${c.order} on June ${c.d} and it still hasn't landed on my card. Can you check?` }),
  (c) => ({ subject: "Refused the package", body: `I refused the box at the door — please refund ${c.order} once it makes its way back to you.` }),
  (c) => ({ subject: "Double billed", body: `My statement shows two charges for one order ${c.order}. I'd like the extra one refunded — happy to send a screenshot.` }),
];
const refundsCluster: Core[] = [
  (c) => ({ subject: "Charged for a box I'd postponed", body: `I'd moved my June ${c.subProduct} refill to next month and was still charged ${c.price}. Please refund ${c.order}.` }),
  (c) => ({ subject: "Please refund this month", body: `This is the one I asked you to hold — it billed anyway. Refund ${c.order} please; I'll keep the ${c.subProduct}, but the charge needs to come off.` }),
  (c) => ({ subject: "Early charge", body: `My next box wasn't supposed to bill until July and the charge hit today. Can you refund ${c.order}? I've got plenty left.` }),
];

const subFirst: Core[] = [
  (c) => ({ subject: "Skip my July box", body: `Can I skip my July ${c.subProduct} box? I still have most of this one left.` }),
  (c) => ({ subject: "Pause for two months", body: `I'm traveling for work — please pause my subscription until August.` }),
  (c) => ({ subject: "Move my date", body: `Could you push my delivery of the ${c.subProduct} to the ${c.d}th? The skip button on my end never saves.` }),
  (c) => ({ subject: "Stacking up", body: `Loving the ${c.subProduct}, but it's stacking up on my shelf. Can we pause the subscription for a cycle?` }),
  (c) => ({ subject: "Skip one month?", body: `How do I skip my next box for just one month? I don't want out — just a breather until July.` }),
];
const subFollowUp: Core[] = [
  (c) => ({ subject: "Following up on my skip", body: `Following up — I asked to skip my June box on the ${c.d}th and the dashboard still shows June ${c.d2}. Did it go through?` }),
  (c) => ({ subject: "Still not paused", body: `Second time writing about this: the subscription still isn't paused. Can someone confirm it this time?` }),
  (c) => ({ subject: "Skip didn't save (again)", body: `This is my third message about the same thing — please just pause my ${c.subProduct} subscription until August and confirm by reply.` }),
  (c) => ({ subject: "Did it go through?", body: `Sorry to nag — no reply on my last note. Is my subscription officially on hold for June? I don't want another box yet.` }),
  (c) => ({ subject: "Turn it back on", body: `Actually — I'm running low sooner than I thought. Can you resume my subscription and set the next box for June ${c.d2}?` }),
  (c) => ({ subject: "Same request, take three", body: `Writing again because the last change didn't stick. Please push my ${c.subProduct} subscription to next month and tell me it's done.` }),
];
const subTwoEmails: Core = (c) => ({
  subject: "Skip + new inbox",
  body: `My subscription is under ${c.oldEmail} but I've switched over to ${c.s.customer.email} — can you make sure the skip I asked for landed on the right one?`,
});

const discountRegular: Core[] = [
  (c) => ({ subject: "Code didn't apply", body: `My promo code VERA20 didn't apply at checkout — the total stayed the same. Can you help?` }),
  (c) => ({ subject: "Promo expired early?", body: `The discount from your June newsletter says expired, but the fine print says the ${c.d}th. Can you honor it?` }),
  (c) => ({ subject: "Coupon question", body: `Can the welcome coupon stack with the 10% off from the skin quiz? Cart's ready to go either way.` }),
  (c) => ({ subject: "Discount vanished", body: `The discount showed in my cart yesterday and now it's gone. Haven't placed the order yet — can you reapply it?` }),
  (c) => ({ subject: "First order code?", body: `Is there a first order code? Saw one mentioned in your newsletter but can't find it anywhere.` }),
];
const discountCluster: Core[] = [
  (c) => ({ subject: "The code you promised", body: `After last month's mix-up you promised a promo code for my next box — it never came through. Could you send it over?` }),
];

const shippingCores: Record<string, Core[]> = {
  stuck: [
    (c) => ({ subject: "Package stuck in transit", body: `My box ${c.order} has been stuck in transit in ${c.city} since June ${c.d}. Nine scans, zero movement.` }),
    (c) => ({ subject: "Stuck at the hub", body: `${c.order} has been sitting at the ${c.city} hub for ${c.n} days now. Is it stuck in transit for good, or should I wait it out?` }),
  ],
  delivered: [
    (c) => ({ subject: "Marked as delivered, nothing here", body: `${c.order} shows marked as delivered on ${c.weekday}, but there's nothing at my door, the mailroom, or with neighbors.` }),
    (c) => ({ subject: "Says delivered — it isn't", body: `It's marked as delivered since ${c.weekday} morning and I've checked everywhere twice. ${c.order}. What now?` }),
  ],
  lost: [
    (c) => ({ subject: "I think it's lost", body: `No scans on ${c.order} in ${c.n} days — the carrier says ask the sender. I think it's lost in transit.` }),
    (c) => ({ subject: "Lost in the mail?", body: `${c.order} vanished after the ${c.city} scan ${c.n} days ago. Looks lost in transit. Can you start a trace with the carrier?` }),
  ],
  misdelivery: [
    (c) => ({ subject: "Went to the wrong house", body: `The carrier photo shows a porch that isn't mine. ${c.order}. Can you help me figure out where it went?` }),
    (c) => ({ subject: "Neighbor got my box?", body: `The carrier left ${c.order} somewhere on my street — the photo has a red door and mine is blue. Never showed up here.` }),
  ],
};

const pumpCores: Core[] = [
  (c) => ({ subject: "Renewal Serum pump stopped working", body: `About ${c.n} days in, the pump on my Renewal Serum stopped working — it clicks but nothing comes out. ${c.order}.` }),
  (c) => ({ subject: "Pump problem", body: `My Renewal Serum pump only gives a half press and then jams — basically not working two weeks in. ${c.order}.` }),
  (c) => ({ subject: "Serum won't come out", body: `The Renewal Serum pump has stopped dispensing entirely — it springs back with nothing. I've tried rinsing the top. ${c.order}.` }),
  (c) => ({ subject: "Pump died", body: `${c.n} days in and the pump on my Renewal Serum just stopped working. There's clearly product left — I can hear it slosh. ${c.order}.` }),
  (c) => ({ subject: "Is my pump defective?", body: `Is the Renewal Serum pump supposed to lock up like this? Mine seems defective — stopped mid-press and never came back. ${c.order}.` }),
  (c) => ({ subject: "Second bottle, same pump issue", body: `This is my second Renewal Serum where the pump goes faulty after a week or so. Love the serum, hate the bottle. ${c.order}.` }),
  (c) => ({ subject: "Pump stuck down", body: `The pump head on my Renewal Serum is stuck all the way down and won't spring back — completely stopped working. ${c.order}.` }),
  (c) => ({ subject: "Can't get product out", body: `Half a bottle of Renewal Serum left and the pump seems defective — it won't pull anything up. I've resorted to unscrewing the top. ${c.order}.` }),
  (c) => ({ subject: "Dispenser issue", body: `The dispenser pump on my Renewal Serum quit after ${c.n} days — presses feel loose, like something is broken inside. ${c.order}.` }),
  (c) => ({ subject: "Pump pushes air only", body: `My Renewal Serum pump only pushes out air now — it's stopped dispensing any serum. The bottle is basically full. ${c.order}.` }),
  (c) => ({ subject: "Pump quit again", body: `The one you sent last month has quit too — same slow death, fewer drops per press until it's simply not working. Renewal Serum pump, again. ${c.order}.` }),
  (c) => ({ subject: "Serum pump faulty", body: `The pump feels like it's grinding and pulls up nothing — faulty, I think. Renewal Serum, bought June ${c.d}. ${c.order}.` }),
];
const damagedGeneral: Core[] = [
  (c) => ({ subject: "Jar showed up leaking", body: `The Barrier Cream showed up leaking through the box — maybe a third of the jar left. ${c.order}.` }),
  (c) => ({ subject: "Cracked cap", body: `The cap on my Tinted Mineral SPF was cracked in the mailer and it's oozing everywhere. ${c.order}.` }),
  (c) => ({ subject: "Dented tin", body: `The Marine Collagen tin came badly dented — it's damaged enough that the seal popped. Not comfortable using it. ${c.order}.` }),
  (c) => ({ subject: "Dropper shattered", body: `The Vitamin C Drops dropper shattered inside the box — glass everywhere, product everywhere. ${c.order}.` }),
  (c) => ({ subject: "Seal broken", body: `The safety seal on my Ashwagandha Softgels was broken when it got here. Can you send a sealed one? ${c.order}.` }),
  (c) => ({ subject: "Gummies melted", body: `My Biotin+ Gummies fused into one solid blob — I think they melted in the truck. ${c.order}.` }),
  (c) => ({ subject: "Mask tube split", body: `The Overnight Repair Mask tube split at the crimp and it's damaged beyond use. ${c.order}.` }),
];

const accountRegular: Core[] = [
  (c) => ({ subject: "Locked out", body: `I'm locked out of my account — the password reset goes to ${c.oldEmail} but I only use ${c.s.customer.email} now. Can you point it at the right one?` }),
  (c) => ({ subject: "Can't log in", body: `Can't log in since the site update. I've tried ${c.s.customer.email} and my older ${c.oldEmail} — neither takes the reset.` }),
  (c) => ({ subject: "Password reset loop", body: `Every password reset link loops me back to the sign in page. Tried from ${c.s.customer.email}, then ${c.oldEmail}. Help?` }),
  (c) => ({ subject: "New inbox", body: `Please update my email from ${c.oldEmail} to ${c.s.customer.email} — I no longer have access to the old inbox.` }),
  (c) => ({ subject: "Delete my account", body: `Please delete my account — it's registered under ${c.oldEmail}; you can confirm with me at ${c.s.customer.email}.` }),
];
const accountCluster: Core[] = [
  (c) => ({ subject: "Locked out before my box date", body: `I've been locked out and can't log in to move my next box date. The reset goes to ${c.oldEmail} instead of ${c.s.customer.email}.` }),
  (c) => ({ subject: "Can't get in, date approaching", body: `I can't sign in — trying to push my June date back and the page just spins. ${c.oldEmail} is the old login; reach me at ${c.s.customer.email}.` }),
];

const prePurchaseCores: Record<string, Core[]> = {
  shade: [
    (c) => ({ subject: "Which shade?", body: `I'm fair with cool undertones — which shade of the Tinted Mineral SPF should I go for?` }),
    (c) => ({ subject: "Shade advice", body: `Torn between ${c.shade1} and ${c.shade2}. I tan easily in summer — which shade works better year-round?` }),
    (c) => ({ subject: "Shade match help", body: `I wear a light-medium with golden undertones in my usual tinted moisturizer — what shade is closest for me?` }),
    (c) => ({ subject: "Too deep for me?", body: `Haven't bought anything yet — is ${c.shade1} too deep if I'm olive-skinned? Happy to be shade-matched before I buy.` }),
    (c) => ({ subject: "Between two shades", body: `Which shade should I pick if I'm between ${c.shade1} and ${c.shade2}? First time buying from you.` }),
  ],
  ingredient: [
    (c) => ({ subject: "Retinol question", body: `Is the Niacinamide Toner safe to use with retinol? I alternate nights.` }),
    (c) => ({ subject: "Fragrance?", body: `Does the Overnight Repair Mask ingredient list include fragrance? My skin flares at almost anything scented.` }),
    (c) => ({ subject: "Pregnancy safe?", body: `I'm pregnant — is the Renewal Serum safe for pregnancy? Want to check before I order.` }),
    (c) => ({ subject: "Layering question", body: `Can I use it with vitamin C in the morning? Wondering how the Barrier Cream ingredients play with it.` }),
    (c) => ({ subject: "Supplement ingredients", body: `Is the Marine Collagen safe to take alongside a prenatal? Checking ingredients before I buy.` }),
    (c) => ({ subject: "Sensitive skin check", body: `Is it safe for reactive, rosacea-prone skin? Asking about the ${c.product} ingredient list before I commit.` }),
  ],
  bundle: [
    (c) => ({ subject: "Dry skin starter?", body: `Can you recommend a bundle for very dry skin? Starting my routine from scratch.` }),
    (c) => ({ subject: "Set or build my own?", body: `Would you recommend the Daily Glow set, or building my own bundle around the Hydra Cleanser?` }),
    (c) => ({ subject: "Gift bundle advice", body: `Gift for my mom — sixties, sensitive skin. What bundle would you recommend?` }),
    (c) => ({ subject: "Skin + supplements together", body: `Do the supplements come in a bundle with the skincare? Trying to simplify before I buy.` }),
    (c) => ({ subject: "Best value bundle", body: `Which bundle would you recommend for combination skin on a budget — the Daily Glow set or something smaller?` }),
  ],
};

const otherCores: Core[] = [
  (c) => ({ subject: "Wholesale inquiry", body: `I run a small boutique in ${c.city} and would love to stock Verabloom. Who handles wholesale?` }),
  (c) => ({ subject: "Stocking your line", body: `Buyer for a three-store apothecary chain here — is Verabloom open to wholesale partners this year?` }),
  (c) => ({ subject: "Boutique partnership", body: `We're opening a self-care studio in ${c.city} this fall and want Verabloom on the shelves. What are your wholesale terms?` }),
  (c) => ({ subject: "Wholesale minimums?", body: `What are your wholesale minimums and lead times? Asking for our ${c.city} storefront.` }),
  (c) => ({ subject: "Creator collab", body: `I'm a skincare creator (120k on TikTok) and genuinely use the ${c.product}. Do you work with creators?` }),
  (c) => ({ subject: "Content partnership", body: `I make beauty content and my audience keeps asking about your serum. Is there someone on brand partnerships I can talk to?` }),
  (c) => ({ subject: "PR list?", body: `How do I get on your PR list? I review indie skincare weekly on YouTube.` }),
  (c) => ({ subject: "Press request", body: `I'm writing a piece on independent skincare brands for a regional magazine — could someone chat for 20 minutes this week?` }),
  (c) => ({ subject: "Podcast invite", body: `We host a small-business podcast and would love your founder on for an episode. Who books interviews?` }),
  (c) => ({ subject: "Donation request", body: `Our school auction is putting together gift baskets — would Verabloom consider donating a set?` }),
  (c) => ({ subject: "Charity drive", body: `I organize a women's shelter drive in ${c.city} each summer. Would you contribute skincare minis?` }),
  (c) => ({ subject: "Do you sell in stores?", body: `Do you sell in any stores in ${c.city}, or is it online only? I'd rather see everything in person first.` }),
  (c) => ({ subject: "Find you locally?", body: `Is there anywhere in ${c.city} that carries the line? My sister wants to smell everything first.` }),
  (c) => ({ subject: "Retail locations", body: `Any retail presence planned? Asking because gift-shopping is easier in person.` }),
  (c) => ({ subject: "Careers", body: `Do you have openings on your support team? I've admired how you talk to customers and I'd love to send a portfolio.` }),
  (c) => ({ subject: "Internship?", body: `I'm a cosmetic chemistry student — do you take summer interns in the lab?` }),
  (c) => ({ subject: "Recyclable bottles?", body: `Are the serum bottles recyclable curbside, or do I mail them back through a program?` }),
  (c) => ({ subject: "Refill program?", body: `Any plans for refill pouches? I'd happily reuse the glass jars forever.` }),
  (c) => ({ subject: "Packaging feedback", body: `Genuine compliment: the June box used way less plastic. Is that here to stay?` }),
  (c) => ({ subject: "Affiliate program", body: `How do I join your affiliate program? I run a wellness newsletter with 8k readers.` }),
  (c) => ({ subject: "Affiliate terms", body: `What are the affiliate terms — flat fee or rev share? Want to pitch you to my book club, of all things.` }),
  (c) => ({ subject: "Pop-up this summer?", body: `Heard a rumor about a Verabloom pop-up in ${c.city} this summer — is that happening?` }),
];

// ---------------------------------------------------------------- assembly

const EMAIL_LINES = [
  (e: string) => `The order's under ${e}.`,
  (e: string) => `You can reach me at ${e}.`,
  (e: string) => `I'm at ${e} if you need me.`,
  (e: string) => `Everything's under ${e}.`,
  (e: string) => `It was placed with ${e}.`,
];
const PHONE_LINES = [
  (p: string) => `Call or text me at ${p} if that's easier.`,
  (p: string) => `My cell is ${p}.`,
  (p: string) => `I'm reachable at ${p} most afternoons.`,
];
/**
 * Named tickets sign off in a form the redaction agent's NAME_RE
 * (greeting/sign-off word + comma + Capitalized name) counts exactly once.
 * Greetings are deliberately forms that do NOT trip NAME_RE ("Hi there," puts
 * a lowercase word after the greeting word), so unnamed tickets count zero.
 */
const NAME_SIGNOFFS = [
  (c: Customer) => `\n\nThanks,\n${c.first}`,
  (c: Customer) => `\n\nBest,\n${c.first} ${c.last}`,
  (c: Customer) => `\n\nCheers,\n${c.first}`,
  (c: Customer) => `\n\nRegards,\n${c.first} ${c.last}`,
  (c: Customer) => `\n\nSincerely,\n${c.first}`,
];
const GREETINGS = ["Hi there,", "Good morning,", "Good afternoon,"];

/**
 * Secondary phrase for deliberate multi-intent tickets — always a natural ask
 * borrowed from a LOWER-priority intent, so classify.ts priority order still
 * resolves to the intended intent (at multi-match confidence 0.88).
 */
const MULTI_LINES: Partial<Record<Intent, string[]>> = {
  subscription_management: [
    "If it bills anyway, I'll be asking for a refund.",
    "Last time this happened you had to refund me — let's skip that part.",
    "Fair warning: if a box ships, I'll want a refund on it.",
  ],
  address_change: [
    "If it's already boxed up, cancel the order and I'll re-place it.",
    "Worst case, cancel the order and I'll reorder from the right place.",
  ],
  order_editing: [
    "If it's too late, just refund that one instead.",
    "Otherwise a refund works too.",
  ],
  damaged_defective: [
    "Happy with a replacement or a refund — whichever is faster.",
    "Can I exchange it for a fresh bottle?",
    "A refund works if replacements are out of the question.",
    "Would love a replacement, or a refund failing that.",
  ],
  shipping_issues: [
    "If it's gone for good, I'd rather just get a refund.",
    "At this point a refund might be simpler than a reship.",
  ],
  returns_exchanges: [
    "I'd prefer a refund over credit, if possible.",
    "A refund to the original card would be ideal.",
  ],
  refunds: [
    "This was with the welcome discount, if that matters.",
    "It was bought on a discount, so the math might be odd on your end.",
  ],
  discount_promo: [
    "Still comparing before I buy, but I'd like the numbers right.",
    "Deciding before I buy — the price is the deciding vote.",
  ],
};
const ADDR_LINES: Partial<Record<Intent, ((a: string) => string)[]>> = {
  wismo: [
    (a) => `It's headed to ${a}.`,
    (a) => `It should be coming to ${a}.`,
    (a) => `The box is going to ${a}.`,
  ],
  returns_exchanges: [
    (a) => `I'm at ${a} if the label needs it.`,
    (a) => `Pickup would be from ${a}.`,
  ],
  order_editing: [
    (a) => `It's still set to go to my old place at ${a}.`,
    (a) => `If it helps, it should go to ${a}.`,
  ],
};
const ORDER_LINES = [
  (o: string) => `For reference: ${o}.`,
  (o: string) => `The order ref is ${o}.`,
  (o: string) => `That's order ${o}.`,
];

const ORDER_RE = /#VB-\d{5}/g;
const count = (re: RegExp, text: string) => (text.match(re) ?? []).length;

let otherIdx = 0;
let pumpIdx = 0;
function coreFor(s: Spec, ctx: Ctx): { subject: string; body: string } {
  switch (s.intent) {
    case "wismo":
      return pick(s.theme === "cluster" ? wismoCluster : wismoRegular)(ctx);
    case "returns_exchanges":
      return pick(returnsRegular)(ctx);
    case "order_editing":
      return pick(s.theme === "cluster" ? orderEditCluster : orderEditRegular)(ctx);
    case "address_change":
      return pick(s.theme === "cluster" ? addressCluster : addressRegular)(ctx);
    case "refunds":
      return pick(s.theme === "cluster" ? refundsCluster : refundsRegular)(ctx);
    case "subscription_management":
      if (s.emails === 2) return subTwoEmails(ctx);
      return pick(s.threadPos === 0 ? subFirst : subFollowUp)(ctx);
    case "discount_promo":
      return pick(s.theme === "cluster" ? discountCluster : discountRegular)(ctx);
    case "shipping_issues":
      return pick(shippingCores[s.theme])(ctx);
    case "damaged_defective":
      return s.theme === "pump" ? pumpCores[pumpIdx++ % pumpCores.length](ctx) : pick(damagedGeneral)(ctx);
    case "pre_purchase":
      return pick(prePurchaseCores[s.theme])(ctx);
    case "account_issues":
      return pick(s.theme === "cluster" ? accountCluster : accountRegular)(ctx);
    case "other":
      return otherCores[otherIdx++ % otherCores.length](ctx);
  }
}

for (const s of specs) {
  const shadePair = shuffle([...SPF_SHADES]).slice(0, 2);
  const d = rint(2, 14);
  const ctx: Ctx = {
    s,
    order: s.orderRefs >= 1 ? newOrder() : "ORDER_UNSET",
    product: pick(PRODUCTS),
    subProduct: pick(SUB_PRODUCTS),
    addr1: newStreet(),
    addr2: newStreet(),
    oldEmail: altEmail(s.customer),
    price: `$${pick([38, 42, 48, 54, 58, 64, 72, 86])}`,
    d,
    d2: d + rint(3, 12),
    n: rint(5, 16),
    weekday: pick(WEEKDAYS),
    city: pick(CITIES),
    shade1: shadePair[0],
    shade2: shadePair[1],
  };
  const core = coreFor(s, ctx);
  let subject = core.subject;
  const parts: string[] = [];
  let intro = "";
  let signoff = "";
  if (s.name) signoff = pick(NAME_SIGNOFFS)(s.customer);
  if (rng() < 0.45) intro = pick(GREETINGS) + " ";
  parts.push(core.body);
  if (s.multi) parts.push(pick(MULTI_LINES[s.intent]!));
  if (s.addresses === 1) parts.push(pick(ADDR_LINES[s.intent]!)(ctx.addr1));
  if (s.emails === 1) {
    // prospective buyers and misc writers have no order to be "under"
    const lines =
      s.intent === "pre_purchase" || s.intent === "other"
        ? EMAIL_LINES.slice(1, 3)
        : EMAIL_LINES;
    parts.push(pick(lines)(s.customer.email));
  }
  if (s.phone) parts.push(pick(PHONE_LINES)(newPhone()));
  let body = intro + parts.join(" ") + signoff;
  // top up order references to the planned count: refs===2 puts one in the
  // subject; the body always carries the other(s).
  if (s.orderRefs === 2) subject = `${subject} — ${ctx.order}`;
  while (count(ORDER_RE, subject + " " + body) < s.orderRefs) {
    body = body.replace(/(\n\n|$)/, ` ${pick(ORDER_LINES)(ctx.order!)}$1`);
  }
  s.subject = subject;
  s.body = body;
}

// ---------------------------------------------------------------- timing

type Slot = "below" | "mid" | "above";
function buildSlots(n: number, target: number, minV: number): { v: number; slot: Slot }[] {
  const nMid = n % 2 === 0 ? 2 : 1;
  const nSide = (n - nMid) / 2;
  const out: { v: number; slot: Slot }[] = [];
  for (let j = 0; j < nSide; j++) {
    const f = 0.35 + 0.6 * ((j + 0.2 + rng() * 0.6) / nSide);
    out.push({ v: Math.max(minV, Math.min(Math.round(target * f), target - 2)), slot: "below" });
  }
  for (let k = 0; k < nMid; k++) out.push({ v: target, slot: "mid" });
  for (let j = 0; j < nSide; j++) {
    const f = 1.06 + 1.2 * ((j + 0.2 + rng() * 0.6) / nSide);
    out.push({ v: Math.max(Math.round(target * f), target + 2), slot: "above" });
  }
  out.sort((a, b) => a.v - b.v);
  return out;
}

for (const intent of INTENTS) {
  const group = specs.filter((s) => s.intent === intent);
  const fr = buildSlots(group.length, MEDIANS[intent].frMins, 15);
  const res = buildSlots(group.length, MEDIANS[intent].resTenths, 5);
  group.forEach((s, i) => {
    s.frMins = fr[i].v;
    s.frSlot = fr[i].slot;
    s.resTenths = res[i].v;
    s.resSlot = res[i].slot;
    // resolution must comfortably follow first response (comonotonic pairing
    // makes violations rare; repair upward when the slot allows it)
    if (s.resTenths * 6 < s.frMins + 15) {
      const needed = Math.ceil((s.frMins + 15) / 6);
      if (s.resSlot === "above" || needed <= MEDIANS[intent].resTenths - 2) s.resTenths = Math.max(s.resTenths, needed);
      else s.frMins = Math.max(15, s.resTenths * 6 - 15);
    }
  });
}

/**
 * Tune the union distribution so the OVERALL median is exact: after this,
 * exactly 249 values sit strictly below the union target and at least two
 * equal it — the 250th/251st order statistics are the target under any median
 * definition. Only side-slot values move, and only within their own side of
 * their intent's median, so per-intent medians are untouched.
 */
function tuneUnion(kind: "fr" | "res") {
  const unionTarget = kind === "fr" ? OVERALL_FR_MINS : OVERALL_RES_TENTHS;
  const minV = kind === "fr" ? 15 : 5;
  const get = (s: Spec) => (kind === "fr" ? s.frMins! : s.resTenths!);
  const set = (s: Spec, v: number) => (kind === "fr" ? (s.frMins = v) : (s.resTenths = v));
  const slotOf = (s: Spec) => (kind === "fr" ? s.frSlot! : s.resSlot!);
  const targetOf = (s: Spec) => (kind === "fr" ? MEDIANS[s.intent].frMins : MEDIANS[s.intent].resTenths);
  const canHold = (s: Spec, v: number) => {
    if (slotOf(s) === "mid") return false;
    const t = targetOf(s);
    return slotOf(s) === "below" ? v >= minV && v <= t - 2 : v >= t + 2;
  };
  const guardOk = (s: Spec, v: number) => {
    const frM = kind === "fr" ? v : s.frMins!;
    const resM = (kind === "res" ? v : s.resTenths!) * 6;
    return resM >= frM + 15;
  };
  const pinned = new Set<Spec>();
  // 1) pin two values exactly at the union target
  const pinCandidates = specs
    .filter((s) => canHold(s, unionTarget) && guardOk(s, unionTarget))
    .sort((a, b) => Math.abs(get(a) - unionTarget) - Math.abs(get(b) - unionTarget));
  if (pinCandidates.length < 2) throw new Error(`tuneUnion(${kind}): not enough pin candidates`);
  for (const s of pinCandidates.slice(0, 2)) {
    set(s, unionTarget);
    pinned.add(s);
  }
  // 2) move flexible values across the boundary until exactly 249 sit below
  const below = () => specs.filter((s) => get(s) < unionTarget).length;
  let steps = 0;
  while (below() !== 249) {
    if (++steps > 400) throw new Error(`tuneUnion(${kind}): did not converge`);
    const needFewerBelow = below() > 249;
    const delta = 3 + rint(0, 40);
    const to = needFewerBelow ? unionTarget + delta : Math.max(minV, unionTarget - delta);
    const mover = specs.find(
      (s) =>
        !pinned.has(s) &&
        (needFewerBelow ? get(s) < unionTarget : get(s) > unionTarget) &&
        canHold(s, to) &&
        guardOk(s, to),
    );
    if (!mover) continue; // different delta next loop
    set(mover, to);
  }
}
tuneUnion("fr");
tuneUnion("res");

// ---------------------------------------------------------------- dates

const JUNE_WEEKENDS = new Set([6, 7, 13, 14, 20, 21, 27, 28]);
const PIN_FIRST = Date.UTC(2026, 5, 1, 7, 41, 22);
const PIN_LAST = Date.UTC(2026, 5, 30, 21, 17, 45);

// cluster threads: start day 1–18, then 2–4 day gaps between messages
{
  const byCustomer = new Map<string, Spec[]>();
  for (const s of specs) {
    if (s.threadPos < 0) continue;
    const list = byCustomer.get(s.customer.email) ?? [];
    list.push(s);
    byCustomer.set(s.customer.email, list);
  }
  for (const thread of byCustomer.values()) {
    thread.sort((a, b) => a.threadPos - b.threadPos);
    let day = rint(1, 18);
    for (const s of thread) {
      s.day = day;
      day += rint(2, 4);
    }
  }
}
// pump reports: spread evenly across the whole month
{
  const pumps = specs.filter((sp) => sp.theme === "pump");
  pumps.forEach((s, i) => {
    s.day = Math.min(30, Math.max(1, 1 + Math.floor((i * 29) / (pumps.length - 1)) + rint(-1, 1)));
  });
}
// everything else: uniform-ish June days, lighter on weekends
for (const s of specs) {
  if (s.day !== undefined) continue;
  let day = rint(1, 30);
  if (JUNE_WEEKENDS.has(day) && rng() < 0.5) day = rint(1, 30);
  s.day = day;
}
for (const s of specs) {
  s.createdAt = new Date(Date.UTC(2026, 5, s.day!, rint(7, 22), rint(0, 59), rint(0, 59)));
}
// pin the export's date range endpoints on two standalone "other" tickets
{
  const others = specs.filter((s) => s.intent === "other");
  others[0].createdAt = new Date(PIN_FIRST);
  others[0].pinEndpoint = "first";
  others[others.length - 1].createdAt = new Date(PIN_LAST);
  others[others.length - 1].pinEndpoint = "last";
  for (const s of specs) {
    if (s.pinEndpoint) continue;
    if (s.createdAt!.getTime() < PIN_FIRST) {
      s.createdAt = new Date(PIN_FIRST + rint(10, 300) * 60000);
    } else if (s.createdAt!.getTime() > PIN_LAST) {
      s.createdAt = new Date(PIN_LAST - rint(10, 300) * 60000);
    }
  }
}

// ---------------------------------------------------------------- channels + csat

{
  const channels = shuffle([
    ...Array<string>(CHANNEL_QUOTAS.email).fill("email"),
    ...Array<string>(CHANNEL_QUOTAS.chat).fill("chat"),
    ...Array<string>(CHANNEL_QUOTAS.sms).fill("sms"),
    ...Array<string>(CHANNEL_QUOTAS.instagram).fill("instagram"),
    ...Array<string>(CHANNEL_QUOTAS.facebook).fill("facebook"),
  ]);
  specs.forEach((s, i) => (s.channel = channels[i]));

  const withCsat = new Set(shuffle(specs.map((_, i) => i)).slice(0, CSAT_PRESENT));
  specs.forEach((s, i) => {
    if (!withCsat.has(i)) {
      s.csat = null;
      return;
    }
    const r = rng();
    if (s.intent === "shipping_issues" || s.intent === "damaged_defective") {
      s.csat = r < 0.3 ? 1 : r < 0.5 ? 2 : r < 0.65 ? 3 : r < 0.85 ? 4 : 5;
    } else if (s.intent === "pre_purchase" || s.intent === "other") {
      s.csat = r < 0.05 ? 2 : r < 0.15 ? 3 : r < 0.45 ? 4 : 5;
    } else {
      s.csat = r < 0.1 ? 1 : r < 0.2 ? 2 : r < 0.32 ? 3 : r < 0.62 ? 4 : 5;
    }
  });
}

// ---------------------------------------------------------------- rows

specs.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
let nextId = 241000;
const rows = specs.map((s) => {
  nextId += rint(1, 9);
  return {
    id: String(nextId),
    created_at: iso(s.createdAt!),
    channel: s.channel!,
    subject: s.subject!,
    body: s.body!,
    customer_email: s.customer.email,
    first_response_at: iso(new Date(s.createdAt!.getTime() + s.frMins! * 60000)),
    resolved_at: iso(new Date(s.createdAt!.getTime() + s.resTenths! * 360000)),
    satisfaction_score: s.csat == null ? "" : String(s.csat),
  };
});

// ---------------------------------------------------------------- validation

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`VALIDATION FAILED: ${msg}`);
}

// 1. distribution
{
  const got: Record<string, number> = {};
  for (const s of specs) got[s.intent] = (got[s.intent] ?? 0) + 1;
  for (const intent of INTENTS) assert(got[intent] === INTENT_COUNTS[intent], `count(${intent})=${got[intent]}`);
  assert(specs.length === 500 && rows.length === 500, "500 rows");
  assert(new Set(rows.map((r) => r.id)).size === 500, "unique ids");
}

// 2+3. simulate the REAL pipeline, ticket by ticket: redaction first
// (lib/cx-audit/pipeline/redact.ts regexes, same order, same tokens), then
// keyword classification over the REDACTED text (classify.ts replica above).
// This proves the keyword pre-pass classifies the whole sample correctly with
// no API key, at exactly the planned confidences, and that the redaction
// counts land on the authored totals (512/87/431/96/388 = 1514).
const R_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const R_PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]?\d{4}\b/g;
const R_ORDER = /#\d{4,}\b|#?\b[A-Z]{1,4}-?\d{4,}\b/g;
const R_ADDRESS =
  /\b\d{1,6}\s+(?:[A-Za-z'.]+\s+){0,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Highway|Hwy)\b\.?(?:,?\s*(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[\w-]+)?/gi;
const R_NAME =
  /\b(Dear|Hi|Hello|Hey|Thanks|Thank you|Best|Regards|Kind regards|Warm regards|Sincerely|Cheers)([,!]?\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

const redactionFound = { emails: 0, phones: 0, orderNumbers: 0, addresses: 0, names: 0 };
function simulateRedact(text: string): string {
  return text
    .replace(R_EMAIL, () => ((redactionFound.emails += 1), "[redacted-email]"))
    .replace(R_PHONE, () => ((redactionFound.phones += 1), "[redacted-phone]"))
    .replace(R_ORDER, () => ((redactionFound.orderNumbers += 1), "[redacted-order]"))
    .replace(R_ADDRESS, () => ((redactionFound.addresses += 1), "[redacted-address]"))
    .replace(R_NAME, (_m, g: string, sep: string) => ((redactionFound.names += 1), `${g}${sep}[redacted-name]`));
}

const confidenceSums = new Map<Intent, number>();
for (const s of specs) {
  const raw = `${s.subject} ${s.body}`.toLowerCase();
  for (const w of BANNED_WORDS) assert(!raw.includes(w), `banned word "${w}" in: "${s.body}"`);
  assert(!raw.includes("order_unset"), `unset order leaked: "${s.body}"`);

  const hit = simulateClassify(simulateRedact(s.subject!), simulateRedact(s.body!));
  if (s.intent === "other") {
    assert(hit === null, `"other" ticket matched ${hit?.intent}: "${s.subject}" / "${s.body}"`);
    continue;
  }
  assert(hit !== null, `${s.intent} ticket matched nothing: "${s.subject}" / "${s.body}"`);
  assert(hit.intent === s.intent, `${s.intent} ticket classified as ${hit.intent}: "${s.subject}" / "${s.body}"`);
  const expected = s.multi ? 0.88 : 0.97;
  assert(
    hit.confidence === expected,
    `${s.intent} confidence ${hit.confidence} != ${expected} (multi=${s.multi}): "${s.subject}" / "${s.body}"`,
  );
  confidenceSums.set(s.intent, (confidenceSums.get(s.intent) ?? 0) + hit.confidence);
}

for (const k of Object.keys(PII_TARGETS) as (keyof typeof PII_TARGETS)[]) {
  const found = redactionFound[k];
  assert(found === PII_TARGETS[k], `pii ${k}: redaction agent would strip ${found} != target ${PII_TARGETS[k]}`);
}
assert(specs.filter((s) => s.name).length === PII_TARGETS.names, "planted name flags = 388");

// confidence engineering: per-intent avgConfidence (2dp, metrics.ts rounding)
// must land on the authored table, and APS on exactly 74.
const AUTOMATABLE: Intent[] = [
  "wismo", "subscription_management", "returns_exchanges", "refunds",
  "damaged_defective", "order_editing", "shipping_issues", "discount_promo",
  "address_change",
];
const EXPECTED_AVG_CONFIDENCE: Partial<Record<Intent, number>> = {
  wismo: 0.97, subscription_management: 0.95, returns_exchanges: 0.94,
  refunds: 0.93, damaged_defective: 0.9, order_editing: 0.92,
  shipping_issues: 0.89, discount_promo: 0.95, address_change: 0.96,
};
let apsSum = 0;
for (const intent of AUTOMATABLE) {
  const sum = confidenceSums.get(intent) ?? 0;
  apsSum += sum;
  const avg = Math.round((sum / INTENT_COUNTS[intent]) * 100) / 100;
  assert(
    avg === EXPECTED_AVG_CONFIDENCE[intent],
    `avgConfidence(${intent}) ${avg} != ${EXPECTED_AVG_CONFIDENCE[intent]}`,
  );
}
const aps = Math.round((100 * apsSum) / 500);
assert(aps === 74, `Automation Potential Score ${aps} != 74`);

// 4. the three stories
{
  const pumps = specs.filter((s) => s.theme === "pump");
  assert(pumps.length === 23, "23 pump tickets");
  for (const s of pumps) {
    const t = `${s.subject} ${s.body}`.toLowerCase();
    assert(t.includes("pump") && t.includes("renewal serum"), "pump ticket mentions pump + Renewal Serum");
  }
  assert(new Set(pumps.map((s) => s.customer.email)).size === 23, "23 distinct pump reporters");

  const pp = specs.filter((s) => s.intent === "pre_purchase");
  assert(pp.filter((s) => s.theme === "shade").length === 24, "24 shade tickets");
  assert(pp.filter((s) => s.theme === "ingredient").length === 24, "24 ingredient tickets");
  assert(pp.filter((s) => s.theme === "bundle").length === 22, "22 bundle tickets");

  const perCustomer = new Map<string, Spec[]>();
  for (const s of specs) {
    const l = perCustomer.get(s.customer.email) ?? [];
    l.push(s);
    perCustomer.set(s.customer.email, l);
  }
  const repeat = [...perCustomer.values()].filter((l) => l.length >= 3);
  assert(repeat.length === 31, `31 repeat customers (got ${repeat.length})`);
  const repeatTickets = repeat.reduce((n, l) => n + l.length, 0);
  assert(repeatTickets === 104, `104 repeat tickets (got ${repeatTickets})`);
  const clusterIntents: Record<string, number> = {};
  for (const l of repeat) for (const s of l) clusterIntents[s.intent] = (clusterIntents[s.intent] ?? 0) + 1;
  const expected: Record<string, number> = {
    subscription_management: 55, wismo: 15, refunds: 12, order_editing: 8,
    address_change: 6, discount_promo: 4, account_issues: 4,
  };
  for (const [k, v] of Object.entries(expected)) assert(clusterIntents[k] === v, `cluster ${k}=${clusterIntents[k]} != ${v}`);
  // every repeat thread is monotone in time
  for (const l of repeat) {
    const sorted = [...l].sort((a, b) => a.threadPos - b.threadPos);
    for (let i = 1; i < sorted.length; i++) {
      assert(sorted[i].createdAt!.getTime() > sorted[i - 1].createdAt!.getTime(), "thread times ascend");
    }
  }
}

// 5. timing: exact medians, sane ordering, June-only dates
function medianOf(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  return n % 2 === 0 ? (v[n / 2 - 1] + v[n / 2]) / 2 : v[(n - 1) / 2];
}
for (const intent of INTENTS) {
  const group = specs.filter((s) => s.intent === intent);
  assert(medianOf(group.map((s) => s.frMins!)) === MEDIANS[intent].frMins, `median fr(${intent})`);
  assert(medianOf(group.map((s) => s.resTenths!)) === MEDIANS[intent].resTenths, `median res(${intent})`);
}
assert(medianOf(specs.map((s) => s.frMins!)) === OVERALL_FR_MINS, "overall first-response median = 252");
assert(medianOf(specs.map((s) => s.resTenths!)) === OVERALL_RES_TENTHS, "overall resolution median = 11.5h");
for (const s of specs) {
  assert(s.resTenths! * 6 >= s.frMins! + 15, "resolved after first response");
  const t = s.createdAt!.getTime();
  assert(t >= PIN_FIRST && t <= PIN_LAST, "created_at within June 2026");
}
assert(specs[0].createdAt!.getTime() === PIN_FIRST, "first ticket 2026-06-01");
assert(specs[specs.length - 1].createdAt!.getTime() === PIN_LAST, "last ticket 2026-06-30");

// 6. channels + csat
{
  const ch: Record<string, number> = {};
  for (const s of specs) ch[s.channel!] = (ch[s.channel!] ?? 0) + 1;
  for (const [k, v] of Object.entries(CHANNEL_QUOTAS)) assert(ch[k] === v, `channel ${k}=${ch[k]} != ${v}`);
  const withCsat = specs.filter((s) => s.csat != null);
  assert(withCsat.length === CSAT_PRESENT, `csat on ${withCsat.length} != ${CSAT_PRESENT}`);
  for (const s of withCsat) assert(s.csat! >= 1 && s.csat! <= 5, "csat 1..5");
}

// ---------------------------------------------------------------- write

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../data/verabloom-tickets.csv");
mkdirSync(dirname(outPath), { recursive: true });
const FIELDS = [
  "id", "created_at", "channel", "subject", "body", "customer_email",
  "first_response_at", "resolved_at", "satisfaction_score",
];
const csv = unparse(rows, { columns: FIELDS, newline: "\n" });
writeFileSync(outPath, csv + "\n", "utf8");

// ---------------------------------------------------------------- manifest

const automatableCount = AUTOMATABLE.reduce((n, i) => n + INTENT_COUNTS[i], 0);
console.log(
  JSON.stringify(
    {
      wrote: outPath,
      tickets: rows.length,
      intentCounts: INTENT_COUNTS,
      automatableShare: automatableCount / 500, // 0.786
      automationPotentialScore: aps, // 74, via the classify.ts confidence rules
      multiMatchPlan: MULTI_PLAN,
      medians: { overallFirstResponseMins: 252, overallResolutionHours: 11.5, perIntent: MEDIANS },
      redactionCounts: { ...redactionFound, total: Object.values(redactionFound).reduce((a, b) => a + b, 0) },
      channels: CHANNEL_QUOTAS,
      csatPresent: CSAT_PRESENT,
      stories: {
        pumpTickets: 23,
        prePurchaseThemes: { shade: 24, ingredient: 24, bundle: 22 },
        repeatContacts: { customers: 31, tickets: 104 },
      },
      verifiedAgainst: [
        "lib/cx-audit/pipeline/classify.ts — keyword table + priority order + 0.97/0.88 confidences replicated; every ticket classifies to its intended intent keyword-only (no API key), 'other' matches nothing and falls back to other@0.5.",
        "lib/cx-audit/pipeline/redact.ts — all five regexes replicated and run in order BEFORE classification; counts land exactly on the authored 512/87/431/96/388.",
        "lib/cx-audit/pipeline/metrics.ts — median + rounding semantics; per-intent and overall medians are pinned by construction.",
        "NOTE: keep those modules and this generator in sync — scripts/precompute-verabloom.ts re-runs the REAL modules end to end and fails loudly on any drift.",
      ],
    },
    null,
    2,
  ),
);
