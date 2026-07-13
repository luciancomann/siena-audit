/**
 * Growth OS — seeded synthetic dataset. One module, no randomness at
 * runtime: every number here is hand-set and internally consistent
 * (channel spends divide into costs per meeting, pipeline sums match the
 * stat cards, and the audit bet's numbers agree with the CX Audit tool's
 * Verabloom-era figures).
 */

// ---------------------------------------------------------------- channels

export type ChannelId =
  | "outbound"
  | "paid"
  | "audit"
  | "events"
  | "lifecycle"
  | "referral";

export interface Channel {
  id: ChannelId;
  label: string;
  meetings: number; // this month
  meetingsLastMonth: number;
  defaultSpend: number; // this month, $ — editable in the UI
  note: string; // one operator line
}

export const CHANNELS: Channel[] = [
  {
    id: "outbound",
    label: "Outbound",
    meetings: 14,
    meetingsLastMonth: 12,
    defaultSpend: 6200,
    note: "doubles as the messaging lab — replies feed the docs",
  },
  {
    id: "paid",
    label: "Paid (LinkedIn)",
    meetings: 9,
    meetingsLastMonth: 10,
    defaultSpend: 7650,
    note: "only amplifies language that already won in outbound",
  },
  {
    id: "audit",
    label: "Audit tool",
    meetings: 7,
    meetingsLastMonth: 5,
    defaultSpend: 1400,
    note: "bet 1 — every run writes context to HubSpot first",
  },
  {
    id: "events",
    label: "Events",
    meetings: 4,
    meetingsLastMonth: 6,
    defaultSpend: 5200,
    note: "attendee lists scored against ICP before we commit",
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    meetings: 6,
    meetingsLastMonth: 4,
    defaultSpend: 1450,
    note: "expansion plays triggered off product data",
  },
  {
    id: "referral",
    label: "Referral",
    meetings: 2,
    meetingsLastMonth: 2,
    defaultSpend: 0,
    note: "customer voice program should grow this lane",
  },
];

// ---------------------------------------------------------------- pipeline

export const PIPELINE = {
  newDeals: 21,
  newValue: 588_000, // 21 × ~$28K ACV
  expansionDeals: 8,
  expansionValue: 96_000, // 8 × ~$12K plays
  lastMonthTotal: 571_000,
  lastMonthDeals: 25,
  expansionLastMonth: 73_000,
  winRatePct: 24,
  salesCycleDays: 48,
};

// ---------------------------------------------------------------- audit bet feed

/** Numbers that flow in from the CX Audit tool (bet 1). */
export const AUDIT_FEED = {
  runsThisWeek: 27,
  leadsCreated: 19,
  fastTracked: 8, // score > 70 && volume > 3,000 routing rule
  pipelineAttributed: 168_000,
  meetingsThisMonth: 7, // mirrors CHANNELS.audit
};

// ---------------------------------------------------------------- bets

export type BetStatus = "live" | "queued" | "shipped" | "killed";
export type CostToRun = "low" | "med" | "high";

export interface Bet {
  id: string;
  name: string;
  what: string; // one line
  whatFull: string;
  why: string;
  killCriteria: string;
  nextAction: string;
  owner: string;
  metric: string;
  compounds: boolean;
  timeToSignalWeeks: number;
  costToRun: CostToRun;
  categoryFit: 1 | 2 | 3 | 4 | 5;
  defaultStatus: BetStatus;
  /** The metric it moves, as a live number (shown on Live bets). */
  currentValue?: string;
  /** Outside the ranked list — priced, not planned. */
  unranked?: boolean;
  unrankedLabel?: string;
  spark: number[]; // 12 weekly points, synthetic
}

export const MAX_LIVE = 3;

export const BETS: Bet[] = [
  {
    id: "audit",
    name: "Free CX Audit Agent",
    what: "Helpdesk in, intelligence briefing out — every run is a lead with context.",
    whatFull:
      "A brand connects their helpdesk or uploads a ticket export and gets an audit of 500 tickets back as an intelligence briefing, not a savings calculator: automation potential with the confidence math shown, a complexity ladder (where macros stop, where add-on AI stops, where end-to-end begins), a benchmark against brands their size, and the patterns sitting unread in the queue — the failing product nobody tagged, the pre-purchase questions that are revenue in a support ticket's clothes, the repeat contacts flagging churn. It says out loud what it couldn't see. Every completed run writes full context to HubSpot, so sales opens the first call already knowing the account.",
    why:
      "Fastest path to qualified pipeline that also compounds. Every vendor ships the same cost calculator; ours is the intelligence layer expressed as a product decision — the prospect experiences the positioning before anyone pitches. Compounds three ways: every run is a lead with context, every run grows the benchmark dataset, the dataset becomes the industry report.",
    killCriteria:
      "Kill if runs fall under 10/week by week 6, or run→meeting conversion sits under 15% by week 8.",
    nextAction: "Ship the Gorgias one-click connect path; watch run→meeting rate weekly.",
    owner: "Lucian",
    metric: "Meetings from audit runs",
    currentValue: "7 MTD · $200/meeting",
    compounds: true,
    timeToSignalWeeks: 2,
    costToRun: "low",
    categoryFit: 5,
    defaultStatus: "live",
    spark: [2, 3, 5, 4, 7, 9, 8, 11, 12, 14, 13, 16],
  },
  {
    id: "expansion",
    name: "Expansion engine",
    what: "Lifecycle plays for the 130 brands, triggered by product data.",
    whatFull:
      "Lifecycle campaigns for the 130 existing brands, triggered by product data. High automation on Support gets the Shopping Agent pitch. Below-benchmark accounts get an optimization play. QA scores and surfaces-live drive the sequencing.",
    why:
      "Cheapest pipeline in the company. Every Support customer is a Shopping, Reviews, and QA prospect. Marketing owns an expansion number, not just new logos.",
    killCriteria:
      "Kill if expansion pipeline runs under $40K per quarter after two sequenced cohorts.",
    nextAction: "Sequence the next cohort: 22 accounts above 70% Support automation, Shopping pitch.",
    owner: "Dana",
    metric: "Expansion pipeline $",
    currentValue: "$96K MTD ▲32%",
    compounds: true,
    timeToSignalWeeks: 3,
    costToRun: "low",
    categoryFit: 5,
    defaultStatus: "live",
    spark: [40, 44, 41, 52, 58, 55, 63, 71, 68, 80, 88, 96],
  },
  {
    id: "story",
    name: "Story machine",
    what: "One true customer micro-story per week, shipped everywhere.",
    whatFull:
      "One true customer micro-story per week, mined from wins, reviews, and Memory insights — the pump defect nobody tagged, the sampler that became a product line — shipped across LinkedIn, the blog, outbound first lines, and sales decks.",
    why:
      "This category is bought on trust, and trust is built with specifics. The library compounds: every story becomes permanent sales collateral and ad creative, and it feeds every other bet.",
    killCriteria:
      "Kill if story posts stop beating the baseline reply and engagement rate for four straight weeks.",
    nextAction: "Polish this week's draft (the Verabloom pump-defect pattern) and ship with outbound attached.",
    owner: "Alex",
    metric: "Reply rate on story-led lines",
    currentValue: "3.4% vs 1.7% generic",
    compounds: true,
    timeToSignalWeeks: 2,
    costToRun: "low",
    categoryFit: 4,
    defaultStatus: "live",
    spark: [1.1, 1.4, 1.2, 1.8, 2.1, 1.9, 2.4, 2.2, 2.8, 2.6, 3.1, 3.4],
  },
  {
    id: "voice",
    name: "Customer voice program",
    what: "Ten CX leaders post their own wins; thought-leader ads amplify.",
    whatFull:
      "Take our 10 closest customers — CX leaders we already have real relationships with — and turn them into the category's loudest voices. The story machine drafts LinkedIn posts from their own wins and data, in their voice; they review, tweak, approve, post. Thought Leader Ads run behind the posts against the matched ICP audience, so buyers see proof from a peer's face, not our logo. Guardrail: their voice, their edits, their approval on every post — the moment it reads scripted, the asset dies.",
    why:
      "Nobody trusts a vendor saying it works; everybody trusts a Head of CX at a brand they recognize. Ten voices posting monthly compounds into a library of peer proof, warmer references, and customers publicly invested in our success.",
    killCriteria:
      "Kill if fewer than 6 of 10 customers approve a post in the first month.",
    nextAction: "Shortlist the 10; draft the first post for the two warmest relationships.",
    owner: "Lucian",
    metric: "Meetings from TL ads",
    compounds: true,
    timeToSignalWeeks: 4,
    costToRun: "med",
    categoryFit: 5,
    defaultStatus: "queued",
    spark: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2],
  },
  {
    id: "loops",
    name: "Weaponize existing loops",
    what: "The loops we already have — reviews, referrals, integrations — get owners and targets.",
    whatFull:
      "The product already generates loops nobody operates: customers who'd refer if asked at the right moment, review responses that read like ads, integration partners whose marketplaces list us. Give each loop an owner, a trigger, and a number. No new machinery — just running what exists.",
    why:
      "Zero new spend, mostly wiring. Loops that already exist are the cheapest compounding there is; they just need someone accountable.",
    killCriteria: "Kill if instrumented loops add fewer than 5 meetings/month by week 8.",
    nextAction: "Instrument the referral ask into the QBR flow; measure for one cycle.",
    owner: "Dana",
    metric: "Meetings from product loops",
    compounds: true,
    timeToSignalWeeks: 4,
    costToRun: "low",
    categoryFit: 4,
    defaultStatus: "queued",
    spark: [0, 0, 1, 0, 1, 1, 2, 1, 2, 3, 2, 3],
  },
  {
    id: "outbound-lab",
    name: "Outbound messaging lab",
    what: "Clay-built ICP, agent-personalized sends — every sequence a controlled experiment.",
    whatFull:
      "An agent pipeline: Clay builds the ICP through tech-stack detection (Shopify, Gorgias, Zendesk, Recharge) plus ticket-volume proxies; signal agents watch for triggers — CX hiring, funding, review spikes, helpdesk installs. A personalization agent scrapes each account's site, reviews, and LinkedIn, then drafts first lines from something real. Dedicated sending infrastructure, warmed, rotated, monitored.",
    why:
      "Every sequence is a controlled experiment against one persona and one objection from the insight repo. Reply data feeds the messaging docs weekly; copy that clears the reply threshold gets promoted to LinkedIn ads on the same matched audience. Meetings are the output — the messaging data is the asset.",
    killCriteria: "Kill if reply rate sits under 1.5% after three template generations.",
    nextAction: "Generation 3 templates against the 'sounds robotic' objection, CX-lead persona.",
    owner: "Alex",
    metric: "Qualified replies / week",
    compounds: true,
    timeToSignalWeeks: 4,
    costToRun: "med",
    categoryFit: 3,
    defaultStatus: "queued",
    spark: [8, 11, 9, 14, 12, 16, 15, 19, 17, 21, 20, 24],
  },
  {
    id: "launches",
    name: "Every ship becomes a launch",
    what: "Product ships on a cadence — each one leaves with a story and distribution attached.",
    whatFull:
      "The product team ships constantly; almost none of it reaches the market as a moment. Every meaningful ship gets the launch treatment by default: a story angle from the signal repo, a founder post, a lifecycle touch to affected customers, and an outbound line for prospects it unblocks. Nothing ships naked.",
    why:
      "The cadence already exists — we're paying for the ships and pocketing none of the attention. Launch muscle also feeds the AEO surface: every launch page is a citable artifact. Scored compounds: no, on purpose — a launch is a moment, not an asset that accrues on its own. The honest score is the framework having teeth.",
    killCriteria:
      "Kill if three consecutive launches produce no measurable signup or meeting bump.",
    nextAction: "Backfill the launch kit for the last two unlaunched ships; measure the delta.",
    owner: "Lucian",
    metric: "Meetings within 14d of a launch",
    compounds: false,
    timeToSignalWeeks: 2,
    costToRun: "low",
    categoryFit: 3,
    defaultStatus: "queued",
    spark: [0, 2, 0, 1, 3, 0, 2, 4, 1, 3, 5, 2],
  },
  {
    id: "aeo",
    name: "Own the AI answer (AEO)",
    what: "Be the name in the answer when buyers ask an AI for a shortlist.",
    whatFull:
      "8 in 10 B2B buyers now ask an AI before building a shortlist. Three layers: an answer-page matrix (persona × question — 'best AI CX tool for Shopify brands', 'Siena vs Gorgias AI') with schema and llms.txt; citation seeding where models triangulate (G2 velocity, Reddit, listicles, YouTube); and a monitoring agent that runs 50 buying questions across ChatGPT, Perplexity, and Claude weekly, logs who gets named, and turns every gap into next week's content task. Guardrail: no page farms — every page passes the same voice bar as the site.",
    why:
      "A cited page keeps getting served in thousands of answers at zero marginal spend, and early movers get locked into the retrieval consensus later entrants have to fight. Share of AI voice becomes a tracked number, not a vibe.",
    killCriteria: "Kill if share of AI voice doesn't move by week 12.",
    nextAction: "Stand up the 50-question monitoring run; baseline who gets named today.",
    owner: "Dana",
    metric: "Share of AI voice (50-question panel)",
    compounds: true,
    timeToSignalWeeks: 10,
    costToRun: "med",
    categoryFit: 4,
    defaultStatus: "queued",
    spark: [4, 4, 5, 4, 6, 6, 7, 6, 8, 8, 9, 10],
  },
  {
    id: "mentorscx",
    name: "The Unreasonable Bet — acquire MentorsCX",
    what: "Own where CX professionals level up; flip Siena from career threat to career ladder.",
    whatFull:
      "Acquire mentorscx.com — the CX mentorship platform with 50+ mentors from Shopify, HubSpot, Apple, and DTC brands like TUSHY and Terra Kaffe. Run it independent, TheHustle-style: light 'powered by Siena' branding, no pitching. Merge its academy with Siena Certification into the industry credential for AI-era CX. De-risked path: a 90-day exclusive partnership first — Siena powers the AI-era curriculum; if pipeline signal shows up, acquire.",
    why:
      "The audience is literally the buyer: every mentee is a CX professional at a consumer brand, every mentor a potential champion inside an ICP account. It attacks the category's deepest objection — CX leaders quietly fear AI takes their jobs. Paid stops when spend stops; an owned community of the exact buying persona compounds monthly. Risks: trust is the asset and hard selling kills it; some mentors at competing vendors will leave; M&A at this stage is a real cash and attention call — which is why this sits outside the ranked list.",
    killCriteria:
      "Partnership gate: if 90 days of powering the curriculum shows no pipeline signal, don't acquire.",
    nextAction: "Price the 90-day exclusive partnership; no earlier commitment.",
    owner: "Lucian",
    metric: "Pipeline signal from community (gate)",
    compounds: true,
    timeToSignalWeeks: 13,
    costToRun: "high",
    categoryFit: 5,
    defaultStatus: "queued",
    unranked: true,
    unrankedLabel: "Priced, not planned",
    spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

// ---------------------------------------------------------------- this week

export interface WeekItem {
  text: string;
  owner: string;
}

export const THIS_WEEK: {
  shipped: WeekItem[];
  moving: WeekItem[];
  kill: WeekItem[];
} = {
  shipped: [
    { text: "Audit tool: revenue scenario + qualify step live on the report", owner: "Lucian" },
    { text: "Story #14 shipped — the pump defect nobody tagged (post + outbound line)", owner: "Alex" },
    { text: "Expansion cohort 2 sequenced — 22 accounts, Shopping pitch", owner: "Dana" },
  ],
  moving: [
    { text: "Gorgias one-click connect for the audit — in review", owner: "Lucian" },
    { text: "Outbound gen-3 templates vs 'sounds robotic', CX-lead persona", owner: "Alex" },
    { text: "TL-ads shortlist: 10 customer voices, 2 warm intros drafted", owner: "Lucian" },
    { text: "Referral ask wired into QBR flow — measuring one cycle", owner: "Dana" },
  ],
  kill: [
    { text: "Events lane: $1,300/meeting and falling attendance — decide Friday", owner: "Lucian" },
    { text: "Generic 'AI for CX' ad set — never beat the story-led variant", owner: "Alex" },
  ],
};

// ---------------------------------------------------------------- loop stages

export interface LoopAgent {
  name: string;
  line: string;
  status: "running" | "attention";
  /** The one-line reason, when status is attention. */
  note?: string;
}

export interface LoopStage {
  id: string;
  name: string;
  human?: boolean; // deliberately human stage
  inputs: string;
  outputs: string;
  health: { label: string; value: string; ok: boolean }[];
  agents: LoopAgent[];
}

export const LOOP: LoopStage[] = [
  {
    id: "signal",
    name: "Signal",
    inputs: "Call transcripts, Memory + Ask Siena data (130 brands), reviews, win/loss, community",
    outputs: "Living insight repo: objections ranked, winning language per persona, competitor gaps",
    health: [
      { label: "insights added this week", value: "9", ok: true },
      { label: "sources refreshed", value: "4 of 4", ok: true },
    ],
    agents: [
      { name: "Sales intelligence agent", line: "reads every call, extracts objections + language that moves deals", status: "running" },
      { name: "Memory miner", line: "voice-of-customer across 130 brands, with permission", status: "running" },
      { name: "Review & community watcher", line: "reviews, threads, win/loss notes into the repo", status: "attention", note: "G2 re-auth needed" },
      { name: "Audit intake", line: "every audit run adds queue patterns + benchmark rows to the repo", status: "running" },
    ],
  },
  {
    id: "positioning",
    name: "Positioning",
    human: true,
    inputs: "The signal repo — what buyers actually say",
    outputs: "One messaging doc per persona (CX lead, COO, founder), kept current",
    health: [
      { label: "messaging docs current", value: "3 of 3", ok: true },
      { label: "last review", value: "6d ago", ok: true },
    ],
    agents: [
      { name: "Deliberately human", line: "Lucian + founders, monthly — the agent surfaces, we decide", status: "running" },
    ],
  },
  {
    id: "content",
    name: "Content",
    inputs: "Positioning docs + story bank + signal repo",
    outputs: "Every piece tagged persona × objection — never a calendar filled for its own sake",
    health: [
      { label: "pieces shipped this week", value: "5", ok: true },
      { label: "tagged persona × objection", value: "5 of 5", ok: true },
    ],
    agents: [
      { name: "Story agent", line: "mines wins, reviews, Memory into micro-story drafts", status: "running" },
      { name: "Drafting agent", line: "positioning + stories → posts, blog arguments, first lines, ad variants", status: "running" },
      { name: "QA agent", line: "every piece checked against brand voice rules before it ships", status: "running" },
    ],
  },
  {
    id: "distribution",
    name: "Distribution",
    inputs: "Content units — nothing ships naked",
    outputs: "Sends with distribution attached; winners promoted to paid",
    health: [
      { label: "sends this week", value: "1,840", ok: true },
      { label: "replies", value: "43 (2.3%)", ok: true },
      { label: "story-led / generic reply", value: "3.4% (640 sends) / 1.7% (1,200)", ok: true },
      { label: "promoted to paid", value: "2", ok: true },
    ],
    agents: [
      { name: "Clay ICP agent", line: "lists segmented + enriched: Shopify, helpdesk, volume signals", status: "running" },
      { name: "Personalization agent", line: "first lines at scale into the sending infrastructure", status: "running" },
      { name: "Sender infra monitor", line: "warmed, rotated, watched — deliverability is a metric", status: "attention", note: "deliverability dipped 0.4% — pool rotating" },
    ],
  },
  {
    id: "pipeline",
    name: "Pipeline",
    inputs: "Booked meetings, per-channel calendar links",
    outputs: "Source-true CRM records; hot accounts routed with full context",
    health: [
      { label: "meetings this week", value: "12", ok: true },
      { label: "routing hits", value: "7", ok: true },
    ],
    agents: [
      { name: "ChiliPiper router", line: "every channel books through its own link — source truth is native", status: "running" },
      { name: "Reporting agent", line: "writes the weekly digest to #growth, Monday 9:00", status: "running" },
    ],
  },
  {
    id: "compounding",
    name: "Compounding",
    inputs: "New customers on the platform",
    outputs: "Memory data, QA scores, case-study material — all feeding Signal",
    health: [
      { label: "customer stories captured", value: "2", ok: true },
      { label: "audit reruns", value: "4", ok: false },
    ],
    agents: [
      { name: "Memory intake", line: "every new brand starts generating voice-of-customer on day one", status: "running" },
      { name: "Benchmark accretion", line: "every audit run grows the dataset the report is built from", status: "attention", note: "reruns below target — 4 vs 6" },
    ],
  },
];

// ---------------------------------------------------------------- metrics page

export interface TrackedMetric {
  name: string;
  value: string;
  why: string;
  cadence: string;
}

export const TRACKED: TrackedMetric[] = [
  {
    name: "Qualified meetings booked, by source",
    value: "42 this month",
    why: "The leading indicator — everything upstream exists to move this.",
    cadence: "Weekly",
  },
  {
    name: "Cost per qualified meeting, by channel",
    value: "$521 blended · per-channel on This Week",
    why: "Spend follows return; the blend hides which channel earns it.",
    cadence: "Weekly",
  },
  {
    name: "Qualified pipeline created — ACV and count",
    value: "$684K · 29 deals",
    why: "Meetings are the input; this is what the board funds.",
    cadence: "Monthly",
  },
  {
    name: "Win rate and sales cycle length",
    value: "24% · 48 days",
    why: "If these degrade while meetings climb, the funnel is lying — wrong message shipping.",
    cadence: "Monthly",
  },
  {
    name: "CAC payback, by channel",
    value: "9.8 mo blended — fully loaded, incl. team",
    why: "Media-only flatters to ~2 months; the loaded number is the ceiling on how fast each lane may grow.",
    cadence: "Monthly",
  },
];

export interface ExcludedMetric {
  name: string;
  reason: string;
}

export const NOT_TRACKED: ExcludedMetric[] = [
  { name: "MQLs as a target", reason: "Gameable, and they reward volume over intent." },
  { name: "Impressions", reason: "Inputs, not outcomes. Looked at to debug, never to celebrate." },
  { name: "Followers", reason: "Same — an input. The feed is not the funnel." },
  { name: "Traffic", reason: "Debugging data. Celebrating it ships the wrong incentives." },
  {
    name: "Blended CAC on its own",
    reason: "It hides which channel is actually working. Per-channel or nothing.",
  },
  {
    name: "Attribution perfection",
    reason:
      "Directional attribution (calendar-per-channel + CRM touchpoints) is enough. Two more bets beat a six-figure attribution suite.",
  },
];

// ---------------------------------------------------------------- signals

export type SignalSource = "Sales call" | "Review" | "Community" | "Memory";

export interface Objection {
  text: string;
  count: number;
  trend: "up" | "down" | "flat";
  source: SignalSource;
  date: string;
  usedIn?: { label: string; href: string };
  /** e.g. "open — no asset yet" for objections nothing answers yet */
  tag?: string;
}

export const OBJECTIONS: Objection[] = [
  {
    text: "“AI will make us sound robotic — our voice is the brand.”",
    count: 14,
    trend: "up",
    source: "Sales call",
    date: "Jul 7",
    usedIn: { label: "Outbound gen-3 templates", href: "/growth-os/bets" },
  },
  {
    text: "“We tried a bot in 2023 and it made things worse.”",
    count: 11,
    trend: "flat",
    source: "Sales call",
    date: "Jul 4",
    usedIn: { label: "Story #14 — pump defect", href: "/growth-os/bets" },
  },
  {
    text: "“My team is scared this replaces them.”",
    count: 9,
    trend: "up",
    source: "Community",
    date: "Jul 2",
    usedIn: { label: "MentorsCX thesis", href: "/growth-os/bets" },
  },
  {
    text: "“What happens on the tickets it can't handle?”",
    count: 8,
    trend: "flat",
    source: "Sales call",
    date: "Jun 30",
    usedIn: { label: "Complexity ladder (audit report)", href: "/cx-audit/report/verabloom" },
  },
  {
    text: "“Integration with our stack looks like a project.”",
    count: 6,
    trend: "down",
    source: "Sales call",
    date: "Jun 27",
    tag: "open — no asset yet",
  },
  {
    text: "“How do I sell this spend to my COO?”",
    count: 5,
    trend: "up",
    source: "Community",
    date: "Jun 26",
    usedIn: { label: "ROI math in the audit", href: "/cx-audit/report/verabloom" },
  },
];

export interface PersonaPhrase {
  phrase: string;
  note: string;
  source: SignalSource;
  date: string;
}

export const PERSONA_LANGUAGE: Record<string, PersonaPhrase[]> = {
  "CX lead": [
    {
      phrase: "“It answers like someone who's read the whole thread.”",
      note: "Memory framing beats 'automation' framing 3:1 in replies.",
      source: "Sales call",
      date: "Jul 6",
    },
    {
      phrase: "“I want my team off the copy-paste tickets, not out of a job.”",
      note: "Career-ladder language opens; cost language closes doors.",
      source: "Community",
      date: "Jul 1",
    },
    {
      phrase: "“Show me what it does when it doesn't know.”",
      note: "Honesty about limits is a buying trigger, not a risk.",
      source: "Sales call",
      date: "Jun 28",
    },
  ],
  COO: [
    {
      phrase: "“What's the payback window, and who owns the number?”",
      note: "Leads with per-channel math; allergic to blended claims.",
      source: "Sales call",
      date: "Jul 3",
    },
    {
      phrase: "“Headcount flexibility, not headcount cuts.”",
      note: "Reframe that survives the exec meeting.",
      source: "Sales call",
      date: "Jun 25",
    },
  ],
  Founder: [
    {
      phrase: "“The support queue is the only honest focus group we have.”",
      note: "Queue-as-research is the founder wedge — audit demo lands here.",
      source: "Review",
      date: "Jul 5",
    },
    {
      phrase: "“Every pre-purchase question we miss is a lost order.”",
      note: "Revenue framing; mirrors the audit's 586 line.",
      source: "Memory",
      date: "Jun 29",
    },
  ],
};

export interface CompetitorMention {
  name: string;
  mentions: number;
  trend: "up" | "down" | "flat";
  note: string;
  source: SignalSource;
  date: string;
}

export const COMPETITORS: CompetitorMention[] = [
  {
    name: "Gorgias AI",
    mentions: 11,
    trend: "up",
    note: "Shows up in every Shopify-stack deal; wins on bundling, loses on depth.",
    source: "Sales call",
    date: "Jul 7",
  },
  {
    name: "Zendesk AI",
    mentions: 7,
    trend: "flat",
    note: "Enterprise gravity; buyers cite seat pricing as the wedge against it.",
    source: "Sales call",
    date: "Jul 2",
  },
  {
    name: "Decagon",
    mentions: 5,
    trend: "up",
    note: "New in evaluations; strong demo, thin on commerce actions.",
    source: "Community",
    date: "Jun 30",
  },
  {
    name: "Intercom Fin",
    mentions: 4,
    trend: "down",
    note: "Named less since spring; pricing anxiety in reviews.",
    source: "Review",
    date: "Jun 26",
  },
];

// ---------------------------------------------------------------- owners

export const OWNERS = ["Lucian", "Dana", "Alex"] as const;

// ---------------------------------------------------------------- deals board

/**
 * The Deals Board dataset. "Synced from HubSpot" in production; seeded here.
 * All fictional DTC brands. The numbers are engineered so every derived
 * metric lands exactly on the dashboard:
 *   · created MTD (July 2026): 29 deals, $684K — new 21/$588K, expansion 8/$96K
 *   · win rate QTD: 4 signed / 17 closed = 23.5% → displays 24%
 *   · sales cycle: signed cycles 7+9+8+168 days → average 48.0
 *   · active board: 14 deals, one stuck 22 days in Proposal
 * Change ANY size, date, or status here and bump SEED_VERSION in state.ts.
 */

/** The demo's "today". Aging math uses this before hydration so SSR stays deterministic. */
export const SEED_TODAY = "2026-07-10T12:00:00.000Z";

export type DealStage = "discovery" | "demo" | "proposal" | "trial" | "signed";

export const DEAL_STAGES: { id: DealStage; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "demo", label: "Demo" },
  { id: "proposal", label: "Proposal" },
  { id: "trial", label: "Trial" },
  { id: "signed", label: "Signed" },
];

export type DealType = "new" | "expansion";
export type CompetitorRelation = "uses" | "in talks with";

export interface Deal {
  id: string;
  company: string;
  website: string;
  size: number; // estimated deal size, $
  tickets: number; // monthly support tickets
  agents: number; // human agents on the team
  buyer: { name: string; title: string; email: string };
  source: ChannelId;
  type: DealType;
  competitor: { name: string; relation: CompetitorRelation } | null;
  stage: DealStage;
  createdAt: string; // ISO
  /** every stage entered, in order — [0] is creation */
  stageHistory: { stage: DealStage; at: string }[];
  auditScore?: number; // audit-sourced deals only
  auditReport?: string; // href to the actual report, where one exists
  notes: string;
  lost?: { reason: string; competitor: string | null; at: string; seeded?: boolean };
}

const d = (day: number, month = 7) =>
  `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00:00.000Z`;

export const DEALS: Deal[] = [
  // ---- active, created this month (13) --------------------------------
  {
    id: "verabloom",
    company: "Verabloom",
    website: "verabloom.com",
    size: 36_000,
    tickets: 4_183,
    agents: 8,
    buyer: { name: "Tom Hale", title: "Head of CX", email: "tom@verabloom.com" },
    source: "audit",
    type: "new",
    competitor: { name: "Gorgias AI", relation: "uses" },
    stage: "trial",
    createdAt: d(1),
    stageHistory: [
      { stage: "discovery", at: d(1) },
      { stage: "demo", at: d(3) },
      { stage: "trial", at: d(8) },
    ],
    auditScore: 74,
    auditReport: "/cx-audit/report/verabloom",
    notes: "Fast-tracked from the audit run — the pump-defect insight opened the call.",
  },
  {
    id: "copperleaf",
    company: "Copperleaf Coffee",
    website: "copperleafcoffee.com",
    size: 45_000,
    tickets: 6_200,
    agents: 12,
    buyer: { name: "Maya Torres", title: "Head of CX", email: "maya@copperleafcoffee.com" },
    source: "outbound",
    type: "new",
    competitor: { name: "Decagon", relation: "in talks with" },
    stage: "proposal",
    createdAt: d(2),
    stageHistory: [
      { stage: "discovery", at: d(2) },
      { stage: "demo", at: d(5) },
      { stage: "proposal", at: d(7) },
    ],
    notes: "Subscription-heavy; wants commerce actions in the first 30 days.",
  },
  {
    id: "solstice",
    company: "Solstice Sleep",
    website: "solsticesleep.com",
    size: 38_000,
    tickets: 5_400,
    agents: 9,
    buyer: { name: "Dana Whitfield", title: "Director of CX", email: "dana@solsticesleep.com" },
    source: "paid",
    type: "new",
    competitor: null,
    stage: "proposal",
    createdAt: d(3),
    stageHistory: [
      { stage: "discovery", at: d(3) },
      { stage: "demo", at: d(6) },
      { stage: "proposal", at: d(8) },
    ],
    notes: "Came in off the LinkedIn founder-story ad. WISMO is 31% of volume.",
  },
  {
    id: "fernwild",
    company: "Fernwild Outdoor",
    website: "fernwild.com",
    size: 32_000,
    tickets: 3_900,
    agents: 7,
    buyer: { name: "Jordan Blake", title: "VP Ecommerce", email: "jordan@fernwild.com" },
    source: "audit",
    type: "new",
    competitor: null,
    stage: "demo",
    createdAt: d(3),
    stageHistory: [
      { stage: "discovery", at: d(3) },
      { stage: "demo", at: d(7) },
    ],
    auditScore: 76,
    notes: "Audit flagged 62% automatable. Wants the demo on their own ticket sample.",
  },
  {
    id: "emberline",
    company: "Emberline Candles",
    website: "emberline.com",
    size: 27_000,
    tickets: 2_400,
    agents: 4,
    buyer: { name: "Priya Shah", title: "Founder", email: "priya@emberline.com" },
    source: "events",
    type: "new",
    competitor: null,
    stage: "demo",
    createdAt: d(4),
    stageHistory: [
      { stage: "discovery", at: d(4) },
      { stage: "demo", at: d(8) },
    ],
    notes: "Met at the DTC dinner. Founder answers tickets herself on weekends.",
  },
  {
    id: "northfork",
    company: "Northfork Provisions",
    website: "northforkprovisions.com",
    size: 30_000,
    tickets: 4_800,
    agents: 10,
    buyer: { name: "Sam Delgado", title: "COO", email: "sam@northforkprovisions.com" },
    source: "outbound",
    type: "new",
    competitor: { name: "Decagon", relation: "in talks with" },
    stage: "discovery",
    createdAt: d(6),
    stageHistory: [{ stage: "discovery", at: d(6) }],
    notes: "COO-led. Asked for the payback math before the first call.",
  },
  {
    id: "willowwren",
    company: "Willow & Wren",
    website: "willowandwren.com",
    size: 22_000,
    tickets: 2_800,
    agents: 5,
    buyer: { name: "Erin Castillo", title: "Head of CX", email: "erin@willowandwren.com" },
    source: "paid",
    type: "new",
    competitor: null,
    stage: "discovery",
    createdAt: d(7),
    stageHistory: [{ stage: "discovery", at: d(7) }],
    notes: "Kidswear; sizing questions dominate pre-purchase volume.",
  },
  {
    id: "tidepool",
    company: "Tidepool Swim",
    website: "tidepoolswim.com",
    size: 24_000,
    tickets: 3_100,
    agents: 6,
    buyer: { name: "Lena Ortiz", title: "Director of CX", email: "lena@tidepoolswim.com" },
    source: "referral",
    type: "new",
    competitor: { name: "Gorgias AI", relation: "uses" },
    stage: "discovery",
    createdAt: d(8),
    stageHistory: [{ stage: "discovery", at: d(8) }],
    notes: "Referred by Onda Swim mid-trial. Unhappy with macro-only automation.",
  },
  {
    id: "marrowmoss",
    company: "Marrow & Moss",
    website: "marrowandmoss.com",
    size: 28_000,
    tickets: 2_900,
    agents: 5,
    buyer: { name: "Felix Grant", title: "Head of CX", email: "felix@marrowandmoss.com" },
    source: "audit",
    type: "new",
    competitor: null,
    stage: "demo",
    createdAt: d(5),
    stageHistory: [
      { stage: "discovery", at: d(5) },
      { stage: "demo", at: d(9) },
    ],
    auditScore: 66,
    notes: "Below the fast-track bar (66 / 2,900) — normal nurture pace.",
  },
  {
    id: "harborknits",
    company: "Harbor Knits",
    website: "harborknits.com",
    size: 20_000,
    tickets: 2_200,
    agents: 3,
    buyer: { name: "Ada Lindqvist", title: "Founder", email: "ada@harborknits.com" },
    source: "outbound",
    type: "new",
    competitor: null,
    stage: "discovery",
    createdAt: d(9),
    stageHistory: [{ stage: "discovery", at: d(9) }],
    notes: "Replied to the gen-3 template. Three-person team, all doing support.",
  },
  {
    id: "juniperlane",
    company: "Juniper Lane",
    website: "juniperlane.com",
    size: 34_000,
    tickets: 5_100,
    agents: 11,
    buyer: { name: "Marcus Webb", title: "VP Ecommerce", email: "marcus@juniperlane.com" },
    source: "audit",
    type: "new",
    competitor: { name: "Zendesk AI", relation: "uses" },
    stage: "trial",
    createdAt: d(2),
    stageHistory: [
      { stage: "discovery", at: d(2) },
      { stage: "demo", at: d(4) },
      { stage: "proposal", at: d(6) },
      { stage: "trial", at: d(9) },
    ],
    auditScore: 81,
    notes: "Fast-tracked. Zendesk renewal in October is the forcing function.",
  },
  {
    id: "bloomfield",
    company: "Bloomfield Pantry",
    website: "bloomfieldpantry.com",
    size: 15_000,
    tickets: 3_600,
    agents: 7,
    buyer: { name: "Rosa Nguyen", title: "Head of CX", email: "rosa@bloomfieldpantry.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: null,
    stage: "trial",
    createdAt: d(2),
    stageHistory: [
      { stage: "discovery", at: d(2) },
      { stage: "demo", at: d(4) },
      { stage: "trial", at: d(7) },
    ],
    notes: "Cohort-2 expansion — adding the Shopping Agent to an existing seat.",
  },
  {
    id: "hearthstone",
    company: "Hearthstone Home",
    website: "hearthstonehome.com",
    size: 18_000,
    tickets: 4_200,
    agents: 8,
    buyer: { name: "Omar Haddad", title: "Director of CX", email: "omar@hearthstonehome.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: null,
    stage: "proposal",
    createdAt: d(2),
    stageHistory: [
      { stage: "discovery", at: d(2) },
      { stage: "demo", at: d(6) },
      { stage: "proposal", at: d(9) },
    ],
    notes: "Expansion play from the lifecycle trigger — subscription volume doubled.",
  },

  // ---- carried from June, stuck (1) -----------------------------------
  {
    id: "meridian",
    company: "Meridian Wellness",
    website: "meridianwellness.com",
    size: 31_000,
    tickets: 6_800,
    agents: 13,
    buyer: { name: "Grace Okafor", title: "COO", email: "grace@meridianwellness.com" },
    source: "outbound",
    type: "new",
    competitor: { name: "Decagon", relation: "in talks with" },
    stage: "proposal",
    createdAt: d(12, 6),
    stageHistory: [
      { stage: "discovery", at: d(12, 6) },
      { stage: "demo", at: d(15, 6) },
      { stage: "proposal", at: d(18, 6) },
    ],
    notes: "Proposal with procurement since mid-June. Decagon in the building.",
  },

  // ---- signed this month (4) ------------------------------------------
  {
    id: "wildgrove",
    company: "Wildgrove Snacks",
    website: "wildgrovesnacks.com",
    size: 30_000,
    tickets: 5_900,
    agents: 9,
    buyer: { name: "Nate Rivers", title: "Head of CX", email: "nate@wildgrovesnacks.com" },
    source: "audit",
    type: "new",
    competitor: null,
    stage: "signed",
    createdAt: d(1),
    stageHistory: [
      { stage: "discovery", at: d(1) },
      { stage: "demo", at: d(2) },
      { stage: "proposal", at: d(4) },
      { stage: "signed", at: d(8) },
    ],
    auditScore: 84,
    notes: "Audit fast-track, signed in 7 days. The benchmark page closed it.",
  },
  {
    id: "onda",
    company: "Onda Swim",
    website: "ondaswim.com",
    size: 24_000,
    tickets: 3_400,
    agents: 6,
    buyer: { name: "Ivy Chen", title: "Director of CX", email: "ivy@ondaswim.com" },
    source: "audit",
    type: "new",
    competitor: null,
    stage: "signed",
    createdAt: d(1),
    stageHistory: [
      { stage: "discovery", at: d(1) },
      { stage: "demo", at: d(3) },
      { stage: "trial", at: d(6) },
      { stage: "signed", at: d(10) },
    ],
    auditScore: 77,
    notes: "Signed in 9 days — already referring (Tidepool Swim).",
  },
  {
    id: "clementine",
    company: "Clementine Beauty",
    website: "clementinebeauty.com",
    size: 12_000,
    tickets: 4_600,
    agents: 9,
    buyer: { name: "Theo Marsh", title: "VP Ecommerce", email: "theo@clementinebeauty.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: null,
    stage: "signed",
    createdAt: d(2),
    stageHistory: [
      { stage: "discovery", at: d(2) },
      { stage: "demo", at: d(5) },
      { stage: "signed", at: d(10) },
    ],
    notes: "Expansion signed in 8 days — lifecycle trigger straight to paper.",
  },
  {
    id: "basecamp",
    company: "Basecamp Bars",
    website: "basecampbars.com",
    size: 52_000,
    tickets: 7_400,
    agents: 15,
    buyer: { name: "Miriam Vance", title: "COO", email: "miriam@basecampbars.com" },
    source: "events",
    type: "new",
    competitor: { name: "Zendesk AI", relation: "uses" },
    stage: "signed",
    createdAt: d(19, 1),
    stageHistory: [
      { stage: "discovery", at: d(19, 1) },
      { stage: "demo", at: d(10, 2) },
      { stage: "proposal", at: d(24, 3) },
      { stage: "trial", at: d(30, 5) },
      { stage: "signed", at: d(6) },
    ],
    notes: "The long one — 168 days, security review and a Zendesk unwind.",
  },

  // ---- lost this month (13) -------------------------------------------
  {
    id: "foxglove",
    company: "Foxglove Apothecary",
    website: "foxgloveapothecary.com",
    size: 42_000,
    tickets: 5_700,
    agents: 10,
    buyer: { name: "Nora Ellison", title: "Director of CX", email: "nora@foxgloveapothecary.com" },
    source: "outbound",
    type: "new",
    competitor: { name: "Decagon", relation: "in talks with" },
    stage: "proposal",
    createdAt: d(1),
    stageHistory: [
      { stage: "discovery", at: d(1) },
      { stage: "demo", at: d(3) },
      { stage: "proposal", at: d(6) },
    ],
    notes: "",
    lost: { reason: "Decagon undercut on price while the security review stalled us", competitor: "Decagon", at: d(8), seeded: true },
  },
  {
    id: "goldenhour",
    company: "Golden Hour Apparel",
    website: "goldenhourapparel.com",
    size: 40_000,
    tickets: 6_100,
    agents: 11,
    buyer: { name: "Chloe Bright", title: "VP Ecommerce", email: "chloe@goldenhourapparel.com" },
    source: "paid",
    type: "new",
    competitor: { name: "Gorgias AI", relation: "uses" },
    stage: "demo",
    createdAt: d(2),
    stageHistory: [
      { stage: "discovery", at: d(2) },
      { stage: "demo", at: d(5) },
    ],
    notes: "",
    lost: { reason: "Gorgias bundled AI into their helpdesk renewal", competitor: "Gorgias AI", at: d(9), seeded: true },
  },
  {
    id: "driftwood",
    company: "Driftwood Supply",
    website: "driftwoodsupply.com",
    size: 28_000,
    tickets: 2_600,
    agents: 4,
    buyer: { name: "Beau Hartley", title: "Founder", email: "beau@driftwoodsupply.com" },
    source: "audit",
    type: "new",
    competitor: null,
    stage: "discovery",
    createdAt: d(2),
    stageHistory: [{ stage: "discovery", at: d(2) }],
    auditScore: 58,
    notes: "",
    lost: { reason: "audit showed too little automatable volume to clear ROI", competitor: null, at: d(6), seeded: true },
  },
  {
    id: "lumenoak",
    company: "Lumen & Oak",
    website: "lumenandoak.com",
    size: 26_000,
    tickets: 3_800,
    agents: 7,
    buyer: { name: "Isabel Fontaine", title: "Head of CX", email: "isabel@lumenandoak.com" },
    source: "outbound",
    type: "new",
    competitor: null,
    stage: "demo",
    createdAt: d(1),
    stageHistory: [
      { stage: "discovery", at: d(1) },
      { stage: "demo", at: d(4) },
    ],
    notes: "",
    lost: { reason: "no budget until Q4 planning", competitor: null, at: d(7), seeded: true },
  },
  {
    id: "petalstem",
    company: "Petal & Stem",
    website: "petalandstem.com",
    size: 21_000,
    tickets: 2_700,
    agents: 5,
    buyer: { name: "Hugo Reyes", title: "Head of CX", email: "hugo@petalandstem.com" },
    source: "referral",
    type: "new",
    competitor: { name: "Gorgias AI", relation: "uses" },
    stage: "discovery",
    createdAt: d(1),
    stageHistory: [{ stage: "discovery", at: d(1) }],
    notes: "",
    lost: { reason: "already mid-migration to Gorgias when we got the intro", competitor: "Gorgias AI", at: d(5), seeded: true },
  },
  {
    id: "sunroom",
    company: "Sunroom Studio",
    website: "sunroomstudio.com",
    size: 16_000,
    tickets: 2_100,
    agents: 3,
    buyer: { name: "Tessa Brook", title: "Founder", email: "tessa@sunroomstudio.com" },
    source: "paid",
    type: "new",
    competitor: null,
    stage: "discovery",
    createdAt: d(1),
    stageHistory: [{ stage: "discovery", at: d(1) }],
    notes: "",
    lost: { reason: "won't change anything before the holiday rush", competitor: null, at: d(4), seeded: true },
  },
  {
    id: "mosswood",
    company: "Mosswood",
    website: "mosswood.co",
    size: 14_000,
    tickets: 2_000,
    agents: 3,
    buyer: { name: "Callum Reid", title: "Founder", email: "callum@mosswood.co" },
    source: "events",
    type: "new",
    competitor: null,
    stage: "discovery",
    createdAt: d(1),
    stageHistory: [{ stage: "discovery", at: d(1) }],
    notes: "",
    lost: { reason: "too small today — revisit at 2× ticket volume", competitor: null, at: d(3), seeded: true },
  },
  {
    id: "aurelia",
    company: "Aurelia Skin",
    website: "aureliaskin.com",
    size: 11_000,
    tickets: 2_300,
    agents: 4,
    buyer: { name: "Zara Malik", title: "Head of CX", email: "zara@aureliaskin.com" },
    source: "paid",
    type: "new",
    competitor: null,
    stage: "discovery",
    createdAt: d(1),
    stageHistory: [{ stage: "discovery", at: d(1) }],
    notes: "",
    lost: { reason: "went quiet after pricing", competitor: null, at: d(3), seeded: true },
  },
  {
    id: "kindred",
    company: "Kindred Kitchen",
    website: "kindredkitchen.com",
    size: 14_000,
    tickets: 4_100,
    agents: 8,
    buyer: { name: "Owen Park", title: "COO", email: "owen@kindredkitchen.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: null,
    stage: "demo",
    createdAt: d(3),
    stageHistory: [
      { stage: "discovery", at: d(3) },
      { stage: "demo", at: d(6) },
    ],
    notes: "",
    lost: { reason: "expansion blocked by an ops hiring freeze", competitor: null, at: d(9), seeded: true },
  },
  {
    id: "velvethive",
    company: "Velvet Hive",
    website: "velvethive.com",
    size: 11_000,
    tickets: 3_300,
    agents: 6,
    buyer: { name: "June Alvarez", title: "Director of CX", email: "june@velvethive.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: { name: "Decagon", relation: "in talks with" },
    stage: "discovery",
    createdAt: d(2),
    stageHistory: [{ stage: "discovery", at: d(2) }],
    notes: "",
    lost: { reason: "parent company consolidating every brand onto one vendor", competitor: "Decagon", at: d(8), seeded: true },
  },
  {
    id: "saltcrest",
    company: "Saltcrest",
    website: "saltcrest.com",
    size: 10_000,
    tickets: 2_900,
    agents: 5,
    buyer: { name: "Milo Turner", title: "Head of CX", email: "milo@saltcrest.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: null,
    stage: "discovery",
    createdAt: d(2),
    stageHistory: [{ stage: "discovery", at: d(2) }],
    notes: "",
    lost: { reason: "paused — replatforming to Shopify Plus first", competitor: null, at: d(6), seeded: true },
  },
  {
    id: "cascade",
    company: "Cascade Botanicals",
    website: "cascadebotanicals.com",
    size: 9_000,
    tickets: 2_500,
    agents: 4,
    buyer: { name: "Freya Holt", title: "Founder", email: "freya@cascadebotanicals.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: null,
    stage: "discovery",
    createdAt: d(1),
    stageHistory: [{ stage: "discovery", at: d(1) }],
    notes: "",
    lost: { reason: "seasonal brand — revisit in September", competitor: null, at: d(4), seeded: true },
  },
  {
    id: "bluffbay",
    company: "Bluff & Bay",
    website: "bluffandbay.com",
    size: 7_000,
    tickets: 3_000,
    agents: 5,
    buyer: { name: "Ray Whitman", title: "COO", email: "ray@bluffandbay.com" },
    source: "lifecycle",
    type: "expansion",
    competitor: { name: "Intercom Fin", relation: "in talks with" },
    stage: "discovery",
    createdAt: d(1),
    stageHistory: [{ stage: "discovery", at: d(1) }],
    notes: "",
    lost: { reason: "committed to Fin a week before our expansion pitch", competitor: "Intercom Fin", at: d(2), seeded: true },
  },
];

// ---------------------------------------------------------------- gtm brain

/**
 * The GTM Brain — Signals restructured as a file-based memory. GitHub is
 * the write layer; this is the read layer. Versions and edit history live
 * in state (seeded from BRAIN_FILES); the static contents live here.
 */

export interface BrainFileSeed {
  id: string;
  path: string; // rendered filename
  owner: string;
  version: number;
  updatedAt: string; // ISO
}

export const BRAIN_FILES: BrainFileSeed[] = [
  { id: "brain", path: "brain.md", owner: "Lucian", version: 4, updatedAt: "2026-07-08T09:00:00.000Z" },
  { id: "library", path: "signals/library.md", owner: "Lucian", version: 7, updatedAt: "2026-07-07T09:00:00.000Z" },
  { id: "gorgias-ai", path: "battlecards/gorgias-ai.md", owner: "Alex", version: 3, updatedAt: "2026-07-05T09:00:00.000Z" },
  { id: "zendesk-ai", path: "battlecards/zendesk-ai.md", owner: "Alex", version: 2, updatedAt: "2026-06-28T09:00:00.000Z" },
  { id: "decagon", path: "battlecards/decagon.md", owner: "Alex", version: 1, updatedAt: "2026-06-30T09:00:00.000Z" },
  { id: "intercom-fin", path: "battlecards/intercom-fin.md", owner: "Alex", version: 2, updatedAt: "2026-06-06T09:00:00.000Z" }, // 34 days stale on purpose
  { id: "matrix", path: "messaging/matrix.md", owner: "Dana", version: 5, updatedAt: "2026-07-03T09:00:00.000Z" },
];

/** brain.md defaults — the editable core file. Priorities are computed from Live bets. */
export const BRAIN_DOC = {
  icp: "Shopify-centric consumer brands, 2,000–8,000 tickets/mo, running Gorgias or Zendesk, brand-conscious.\nBuyer: Head/Director of CX or COO; founder-led under $20M.",
  positioning:
    "Siena resolves support end to end in your brand's voice — an AI teammate that does the work, not a bot that deflects it.",
  voice: [
    "Numbers first, adjectives never — banned: revolutionary, seamless, game-changing.",
    "Career-ladder language, not headcount language — teams get better jobs, not fewer.",
    "Show the failure mode — always say what happens when it doesn't know.",
  ],
};

export const BRAIN_READERS = ["signal agent", "story agent", "drafting agent", "Ask Growth"];

export interface Battlecard {
  id: string; // matches BRAIN_FILES id
  competitor: string; // matches COMPETITORS name
  theyWin: string;
  weWin: string;
  killLine: string; // v1 — current line lives in state so approvals can move it
}

export const BATTLECARDS: Battlecard[] = [
  {
    id: "gorgias-ai",
    competitor: "Gorgias AI",
    theyWin: "Bundling with the helpdesk, renewal pricing, Shopify-stack familiarity.",
    weWin: "Depth — multi-step flows resolved end to end, in the brand's voice, with memory.",
    killLine:
      "Ask them to show a subscription skip handled in your brand voice — bundled AI reads scripts, it doesn't do work.",
  },
  {
    id: "zendesk-ai",
    competitor: "Zendesk AI",
    theyWin: "Enterprise gravity, procurement comfort, the contract that's already signed.",
    weWin: "Seat pricing is the wedge — we price on resolution, not seats, and go live in days.",
    killLine:
      "Price their AI at your seat count, then price ours at your ticket count — bring both numbers to the CFO.",
  },
  {
    id: "decagon",
    competitor: "Decagon",
    theyWin: "Strong demo, fast-moving brand, wins the first impression.",
    weWin: "Commerce actions — returns, refunds, subscription changes processed end to end.",
    killLine: "Strong demo — ask what happens after the demo script ends.",
  },
  {
    id: "intercom-fin",
    competitor: "Intercom Fin",
    theyWin: "Install base and brand recognition — Fin is the default consideration.",
    weWin: "Pricing anxiety is real: per-resolution pricing spikes at volume; ours is predictable.",
    killLine: "Ask for the Fin bill at your ticket volume in Q4 — then ask for ours.",
  },
];

export interface BrainProposal {
  id: string;
  fileId: string;
  filePath: string;
  title: string;
  current: string;
  proposed: string;
  evidence: string[];
  /** for library additions — the objection the approval appends */
  objection?: Objection;
}

export const BRAIN_PROPOSALS: BrainProposal[] = [
  {
    id: "prop-decagon-kill-v2",
    fileId: "decagon",
    filePath: "battlecards/decagon.md",
    title: "Decagon named 3 weeks running, trend up → battlecard update: kill line v2",
    current: "Strong demo — ask what happens after the demo script ends.",
    proposed:
      "Strong demo, thin on commerce actions — ask to see a return processed end to end.",
    evidence: [
      "Named on calls Jun 24, Jul 1, Jul 8 — 5 mentions this month, trend up",
      "2 deals lost to Decagon this quarter ($53K at death)",
      "Jul 8 win-back call: rep had no counter once the demo landed",
    ],
  },
  {
    id: "prop-library-policies",
    fileId: "library",
    filePath: "signals/library.md",
    title: "New objection cluster from Jul 8 calls → addition to signal library",
    current: "— not in the library",
    proposed: "“Who trains it on our policies?” — new objection entry, 4 mentions, trend up",
    evidence: [
      "4 separate calls on Jul 8 asked policy-training questions",
      "2 came from COO personas — security-review adjacent",
      "No existing objection covers onboarding or training",
    ],
    objection: {
      text: "“Who trains it on our policies?”",
      count: 4,
      trend: "up",
      source: "Sales call",
      date: "Jul 8",
    },
  },
];

export const CONVERSION_SIGNALS: { label: string; count: number }[] = [
  { label: "Audit completed", count: 96 },
  { label: "Pricing page, 3+ visits in a week", count: 41 },
  { label: "Competitor named on a call", count: 27 },
  { label: "Fast-track threshold hit (score > 70, volume > 3,000)", count: 12 },
];

export const NOISE_IGNORED: string[] = [
  "Post likes",
  "Newsletter opens",
  "Single blog visits",
];

export interface MatrixRow {
  persona: string;
  objection: string;
  line: string;
  usedIn: { label: string; href: string };
  alsoWins: string[]; // the persona's remaining winning phrases, preserved
}

export const MESSAGING_MATRIX: MatrixRow[] = [
  {
    persona: "CX lead",
    objection: "“AI will make us sound robotic — our voice is the brand.”",
    line: "“It answers like someone who's read the whole thread.”",
    usedIn: { label: "outbound gen-3", href: "/growth-os/bets" },
    alsoWins: [
      "“I want my team off the copy-paste tickets, not out of a job.”",
      "“Show me what it does when it doesn't know.”",
    ],
  },
  {
    persona: "COO",
    objection: "“How do I sell this spend to my COO?”",
    line: "“What's the payback window, and who owns the number?”",
    usedIn: { label: "audit ROI section", href: "/cx-audit/report/verabloom" },
    alsoWins: ["“Headcount flexibility, not headcount cuts.”"],
  },
  {
    persona: "Founder",
    objection: "“We tried a bot in 2023 and it made things worse.”",
    line: "“The support queue is the only honest focus group we have.”",
    usedIn: { label: "story #14", href: "/growth-os/bets" },
    alsoWins: ["“Every pre-purchase question we miss is a lost order.”"],
  },
];

export interface OutputEntry {
  date: string; // display, e.g. "Jul 9"
  asset: string;
  kind: "outbound" | "story" | "audit" | "ad" | "expansion";
  producedBy: string[]; // file paths
  perf: string | null;
}

export const OUTPUTS_LEDGER: OutputEntry[] = [
  {
    date: "Jul 9",
    asset: "Outbound gen-3 templates",
    kind: "outbound",
    producedBy: ["signals/library.md", "messaging/matrix.md", "brain.md"],
    perf: "story-led reply 3.4% vs 1.7% generic",
  },
  {
    date: "Jul 8",
    asset: "Audit report — complexity ladder section",
    kind: "audit",
    producedBy: ["signals/library.md"],
    perf: "27 runs this week · 8 fast-tracked",
  },
  {
    date: "Jul 7",
    asset: "Story #14 — the pump defect nobody tagged",
    kind: "story",
    producedBy: ["signals/library.md", "brain.md"],
    perf: "640 story-led sends · 3.4% reply",
  },
  {
    date: "Jul 5",
    asset: "Audit ROI section — the COO answer",
    kind: "audit",
    producedBy: ["messaging/matrix.md"],
    perf: "$168K pipeline attributed MTD",
  },
  {
    date: "Jul 2",
    asset: "Ad variants — “voice is the brand” set",
    kind: "ad",
    producedBy: ["signals/library.md", "battlecards/gorgias-ai.md"],
    perf: "2 promoted to paid",
  },
  {
    date: "Jun 27",
    asset: "Expansion cohort 2 — Shopping pitch",
    kind: "expansion",
    producedBy: ["brain.md", "messaging/matrix.md"],
    perf: "22 accounts · $96K expansion MTD",
  },
];
