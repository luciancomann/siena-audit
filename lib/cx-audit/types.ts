/**
 * CX Audit Agent — shared contracts.
 * Every stage of the pipeline and every page renders from these shapes.
 * The LLM never computes numbers: metrics are produced by pure code and the
 * report writer only phrases them.
 */

// ---------------------------------------------------------------- tickets

/** Normalized ticket shape produced by the ingest agent. */
export interface NormalizedTicket {
  id: string;
  created_at: string; // ISO 8601
  first_response_at: string | null;
  resolved_at: string | null;
  channel: "email" | "chat" | "sms" | "social" | "phone" | "other";
  subject: string;
  body: string;
  customer_hash: string;
  csat: number | null; // 1..5
}

export const INTENTS = [
  "wismo",
  "returns_exchanges",
  "order_editing",
  "address_change",
  "refunds",
  "subscription_management",
  "pre_purchase",
  "discount_promo",
  "shipping_issues",
  "damaged_defective",
  "account_issues",
  "other",
] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  wismo: "Where is my order?",
  returns_exchanges: "Returns & exchanges",
  order_editing: "Order editing",
  address_change: "Address changes",
  refunds: "Refunds",
  subscription_management: "Subscription management",
  pre_purchase: "Pre-purchase questions",
  discount_promo: "Discounts & promos",
  shipping_issues: "Shipping issues",
  damaged_defective: "Damaged or defective",
  account_issues: "Account issues",
  other: "Everything else",
};

/** The Siena action-library mapping shown next to automatable intents. */
export const SIENA_ACTIONS: Partial<Record<Intent, string>> = {
  wismo: "Order Tracking",
  returns_exchanges: "Returns & Exchanges flow",
  order_editing: "Order Editing",
  address_change: "Address Change",
  refunds: "Refunds flow",
  subscription_management: "Subscription Management",
  pre_purchase: "Shopping Agent",
  discount_promo: "Promo Resolution",
  shipping_issues: "Carrier Lookup + Proactive Updates",
  damaged_defective: "Replacement flow + QA tagging",
};

export interface ClassifiedTicket extends NormalizedTicket {
  intent: Intent;
  automatable: boolean;
  confidence: number; // 0..1
  classified_by: "keyword" | "llm";
}

// ---------------------------------------------------------------- metrics

export interface IntentMetrics {
  intent: Intent;
  count: number;
  share: number; // 0..1 of sample
  automatable: boolean;
  avgConfidence: number;
  medianFirstResponseMins: number | null;
  medianResolutionHours: number | null;
  sienaAction: string | null;
}

export interface Metrics {
  sampleSize: number;
  totalInExport: number;
  dateRange: { from: string; to: string };
  monthlyVolumeEstimate: number;
  /** 0..100 — automatable volume share weighted by confidence. Pure code. */
  automationPotentialScore: number;
  automatableShare: number; // 0..1
  intents: IntentMetrics[]; // sorted by count desc
  medianFirstResponseMins: number;
  medianResolutionHours: number;
  repeatContacts: { customers: number; tickets: number; topCluster: string };
  channels: Partial<Record<NormalizedTicket["channel"], number>>;
  redactionCounts: RedactionCounts;
}

export interface RedactionCounts {
  emails: number;
  phones: number;
  orderNumbers: number;
  addresses: number;
  names: number;
  total: number;
}

// ---------------------------------------------------------------- stages

export interface Benchmark {
  volumeBand: string; // e.g. "2,500–7,500 tickets/month"
  peerScore: number;
  peerFirstResponseMins: number;
  automationCeiling: number;
  caveatLine: string;
}

export interface Insight {
  title: string;
  pattern: string;
  evidence_count: number;
  what_siena_memory_would_do: string;
}

export interface ChatBubbleLine {
  role: "customer" | "siena";
  text: string;
}

export interface ChatMockup {
  intentLabel: string;
  lines: ChatBubbleLine[];
  /** true when the conversation ends in an add-to-cart moment */
  endsInCart: boolean;
}

export interface Assumptions {
  handleTimeMins: number; // default 8
  loadedCostPerTicket: number; // default 6.50
  automatedCostPerTicket: number; // default 0.90
}

export interface MathSection {
  hoursRecoverablePerMonth: number;
  costTodayPerMonth: number;
  costAutomatedPerMonth: number;
  savingsPerMonth: number;
  prePurchaseTicketsPerMonth: number;
  prePurchaseRevenueNote: string;
}

/** All strings the report writer produces. Numbers come verbatim from Metrics. */
export interface ReportCopy {
  headlineStat: string; // e.g. "74"
  headlineHuman: string;
  volumeIntro: string;
  chatIntro: string;
  insightsIntro: string;
  mathIntro: string;
  benchmarkIntro: string;
  couldntSee: string[];
  ctaLine: string;
}

export interface CrmPayload {
  company: string;
  audit_slug: string;
  automation_potential_score: number;
  monthly_volume_estimate: number;
  fast_track: boolean; // score > 70 && volume > 3000
  top_intents: { intent: Intent; share: number }[];
  insights: Insight[];
  median_first_response_mins: number;
  repeat_contact_customers: number;
  assumptions: Assumptions;
  report_url: string;
  generated_at: string;
  source: "cx-audit-agent";
}

// ---------------------------------------------------------------- report

export interface AuditReport {
  slug: string;
  brand: string;
  mode: "sample" | "upload";
  createdAt: string;
  metrics: Metrics;
  benchmark: Benchmark;
  insights: Insight[];
  chatMockups: ChatMockup[];
  assumptions: Assumptions;
  math: MathSection;
  copy: ReportCopy;
  crm: CrmPayload;
}

// ---------------------------------------------------------------- pipeline progress

export const PIPELINE_STAGES = [
  { key: "ingest", label: "Ingest agent", detail: "parsing and normalizing your export" },
  { key: "sample", label: "Sampler", detail: "drawing a seeded random sample" },
  { key: "redact", label: "Redaction agent", detail: "stripping PII before any analysis" },
  { key: "classify", label: "Classification agent", detail: "labeling every conversation by intent" },
  { key: "metrics", label: "Metrics engine", detail: "computing the numbers, no model math" },
  { key: "benchmark", label: "Benchmark agent", detail: "comparing against brands your size" },
  { key: "insights", label: "Insight agent", detail: "reading what your tickets already know" },
  { key: "write", label: "Report writer", detail: "phrasing the findings in plain language" },
  { key: "crm", label: "Handoff agent", detail: "packaging context for the follow-up" },
] as const;
export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

export interface ProgressEvent {
  type: "stage" | "done" | "error";
  stage?: PipelineStageKey;
  status?: "start" | "end";
  note?: string;
  slug?: string;
  error?: string;
}
