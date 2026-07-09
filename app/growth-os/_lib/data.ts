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
      { label: "story-led / generic reply", value: "3.4% / 1.7%", ok: true },
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
