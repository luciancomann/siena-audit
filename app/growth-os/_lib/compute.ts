/**
 * Growth OS derived numbers — pure functions over the seed + state, so the
 * dashboard, the digest, the command bar, and the bets board never disagree.
 */
import type { Bet, BetStatus, ChannelId, Deal, DealStage } from "./data";
import type { Efficiency } from "./data-types";
import type { ActionLog, DraftBet, GrowthState, KilledChannel } from "./state";
import {
  AUDIT_FEED,
  BATTLECARDS,
  BETS,
  BRAIN_FILES,
  BRAIN_PROPOSALS,
  CHANNELS,
  DEALS,
  DEAL_STAGES,
  MAX_LIVE,
  MESSAGING_MATRIX,
  PIPELINE,
  SEED_TODAY,
} from "./data";

export type { Efficiency };

export const fmt = (n: number): string => n.toLocaleString("en-US");
export const money = (n: number): string => `$${fmt(Math.round(n))}`;
export const moneyK = (n: number): string =>
  n >= 1000 ? `$${Math.round(n / 1000)}K` : money(n);

// ---------------------------------------------------------------- channels

export function costPerMeeting(spend: number, meetings: number): number | null {
  if (meetings <= 0) return spend > 0 ? Infinity : null;
  return spend / meetings;
}

export function efficiency(cpm: number | null): Efficiency {
  if (cpm === null) return "efficient"; // no spend, no meetings burned
  if (cpm < 300) return "efficient";
  if (cpm <= 700) return "watch";
  return "expensive";
}

export type KilledMap = Partial<Record<ChannelId, KilledChannel>>;

/** Channels still alive, in seed order. */
export function livingChannels(killed: KilledMap) {
  return CHANNELS.filter((c) => !killed[c.id]);
}

export function totals(spend: Record<ChannelId, number>, killed: KilledMap = {}) {
  const alive = livingChannels(killed);
  const meetings = alive.reduce((n, c) => n + c.meetings, 0);
  const meetingsLastMonth = alive.reduce((n, c) => n + c.meetingsLastMonth, 0);
  const totalSpend = alive.reduce((n, c) => n + (spend[c.id] ?? c.defaultSpend), 0);
  const blended = totalSpend / Math.max(1, meetings);
  // last month's blended, from the seed spends (the editable one is "now")
  const lastSpend = 22_800;
  const blendedLastMonth = lastSpend / Math.max(1, meetingsLastMonth);
  return { meetings, meetingsLastMonth, totalSpend, blended, blendedLastMonth };
}

export function trendPct(now: number, before: number): number {
  if (before === 0) return 0;
  return Math.round(((now - before) / before) * 100);
}

// ---------------------------------------------------------------- bets

/** Composite: fit×2 + compounds(3) + cost(low 2 / med 1 / high 0) + speed(8 − weeks, floored at 0). */
export function compositeScore(bet: Pick<Bet, "categoryFit" | "compounds" | "costToRun" | "timeToSignalWeeks">): number {
  const cost = bet.costToRun === "low" ? 2 : bet.costToRun === "med" ? 1 : 0;
  const speed = Math.max(0, 8 - bet.timeToSignalWeeks);
  return bet.categoryFit * 2 + (bet.compounds ? 3 : 0) + cost + speed;
}

/** A board bet: seed bet or a signal-drafted one. */
export type BoardBet = Bet & { draft?: boolean; sourceSignal?: string };

export function allBets(draftBets: DraftBet[]): BoardBet[] {
  const drafts: BoardBet[] = draftBets.map((d) => ({
    ...d,
    defaultStatus: "queued" as BetStatus,
    spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    draft: true,
  }));
  return [...BETS, ...drafts];
}

/** Ranked bets in display order: manual order if set, else composite desc. Unranked bets pinned last. */
export function orderedBets(betOrder: string[] | null, draftBets: DraftBet[] = []): BoardBet[] {
  const pool = allBets(draftBets);
  const ranked = pool.filter((b) => !b.unranked);
  const unranked = pool.filter((b) => b.unranked);
  let inOrder: BoardBet[];
  if (betOrder) {
    const byId = new Map(ranked.map((b) => [b.id, b]));
    inOrder = betOrder.map((id) => byId.get(id)).filter((b): b is BoardBet => Boolean(b));
    for (const b of ranked) if (!inOrder.includes(b)) inOrder.push(b);
  } else {
    inOrder = [...ranked].sort((a, b) => compositeScore(b) - compositeScore(a));
  }
  return [...inOrder, ...unranked];
}

export function liveCount(betStatus: Record<string, BetStatus>, draftBets: DraftBet[] = []): number {
  return allBets(draftBets).filter(
    (b) => (betStatus[b.id] ?? b.defaultStatus) === "live",
  ).length;
}

export function canGoLive(betStatus: Record<string, BetStatus>, draftBets: DraftBet[] = []): boolean {
  return liveCount(betStatus, draftBets) < MAX_LIVE;
}

/**
 * Draft a Queued bet from an objection. Name is derived from the objection
 * ("Answer: <objection, trimmed>"), scores default to fit 3 / compounds no /
 * cost med / signal in 4 weeks — all editable on the board.
 */
export function draftFromSignal(objection: string): DraftBet {
  const clean = objection
    .replace(/[“”"']/g, "")
    .replace(/[.?!]+$/, "")
    .trim();
  const short = clean.length > 44 ? `${clean.slice(0, 44).trim()}…` : clean;
  const slug = clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return {
    id: `draft-${slug}`,
    name: `Answer: ${short}`,
    what: `Content + product answer to the "${short}" objection.`,
    whatFull: `Build the direct answer to the objection "${clean}" — a page, a proof asset, or a product change, whichever kills it fastest. Drafted from Signals; scores are defaults, tune them before ranking matters.`,
    why: `It came up often enough to rank in Signals. Objections that rank get answered or they keep costing meetings.`,
    killCriteria: `If the objection's monthly count doesn't drop within 8 weeks of shipping the answer, kill it.`,
    nextAction: `Scope the smallest artifact that answers it — assign an owner this week.`,
    owner: "Siena",
    metric: "objection count / month",
    compounds: false,
    timeToSignalWeeks: 4,
    costToRun: "med",
    categoryFit: 3,
    sourceSignal: clean,
  };
}

// ---------------------------------------------------------------- deals

export const SEED_NOW = Date.parse(SEED_TODAY);
const DAY = 86_400_000;

/** The demo dataset is anchored to July 2026 — "this month" and "this quarter" mean that window. */
const MONTH_START = Date.parse("2026-07-01T00:00:00.000Z");
const QUARTER_START = MONTH_START; // Q3 opened July 1

export const openDeals = (deals: Deal[]): Deal[] =>
  deals.filter((x) => !x.lost && x.stage !== "signed");
export const signedDeals = (deals: Deal[]): Deal[] =>
  deals.filter((x) => !x.lost && x.stage === "signed");
export const lostDeals = (deals: Deal[]): Deal[] => deals.filter((x) => Boolean(x.lost));

const sumSize = (xs: Deal[]) => xs.reduce((n, x) => n + x.size, 0);

/** When the deal entered its current stage. */
export const stageEnteredAt = (deal: Deal): string =>
  deal.stageHistory[deal.stageHistory.length - 1]?.at ?? deal.createdAt;

export const daysInStage = (deal: Deal, now: number): number =>
  Math.max(0, Math.floor((now - Date.parse(stageEnteredAt(deal))) / DAY));

/** The audit tool's routing rule, verbatim: score > 70 and volume > 3,000. */
export const isFastTracked = (deal: Deal): boolean =>
  deal.source === "audit" && (deal.auditScore ?? 0) > 70 && deal.tickets > 3_000;

/** Qualified pipeline from deals created this month — the This Week cards, to the dollar. */
export function pipelineFromDeals(deals: Deal[]) {
  const mtd = deals.filter((x) => Date.parse(x.createdAt) >= MONTH_START);
  const news = mtd.filter((x) => x.type === "new");
  const exps = mtd.filter((x) => x.type === "expansion");
  return {
    count: mtd.length,
    total: sumSize(mtd),
    newCount: news.length,
    newValue: sumSize(news),
    expCount: exps.length,
    expValue: sumSize(exps),
  };
}

/** Per-column {count, sum} plus the lost tray, over an already-filtered set. */
export function columnTotals(deals: Deal[]) {
  const open = deals.filter((x) => !x.lost);
  const byStage = Object.fromEntries(
    DEAL_STAGES.map((s) => {
      const xs = open.filter((x) => x.stage === s.id);
      return [s.id, { count: xs.length, sum: sumSize(xs) }];
    }),
  ) as Record<DealStage, { count: number; sum: number }>;
  const lost = lostDeals(deals);
  return { byStage, lost: { count: lost.length, sum: sumSize(lost) } };
}

/** Win rate = signed / (signed + lost), quarter to date. */
export function winRate(deals: Deal[]) {
  const signed = signedDeals(deals).filter((x) => {
    const at = x.stageHistory.find((h) => h.stage === "signed")?.at;
    return at && Date.parse(at) >= QUARTER_START;
  }).length;
  const lost = lostDeals(deals).filter((x) => Date.parse(x.lost!.at) >= QUARTER_START).length;
  const closed = signed + lost;
  return { signed, lost, closed, pct: closed === 0 ? 0 : Math.round((signed / closed) * 100) };
}

/** Average days created → signed, over this quarter's signed deals. */
export function salesCycle(deals: Deal[]) {
  const cycles = signedDeals(deals)
    .map((x) => {
      const at = x.stageHistory.find((h) => h.stage === "signed")?.at;
      return at && Date.parse(at) >= QUARTER_START
        ? (Date.parse(at) - Date.parse(x.createdAt)) / DAY
        : null;
    })
    .filter((n): n is number => n !== null);
  const avg = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;
  return { days: Math.round(avg), n: cycles.length };
}

/** Open deals sitting 14+ days in their current stage. */
export const stuckDeals = (deals: Deal[], now: number): Deal[] =>
  openDeals(deals).filter((x) => daysInStage(x, now) >= 14);

/** Active deal count per source channel — the This Week table's deals column. */
export function dealsBySource(deals: Deal[]): Partial<Record<ChannelId, number>> {
  const out: Partial<Record<ChannelId, number>> = {};
  for (const x of openDeals(deals)) out[x.source] = (out[x.source] ?? 0) + 1;
  return out;
}

/** Active deals where a named competitor is in the room. */
export const activeDealsForCompetitor = (deals: Deal[], name: string): Deal[] =>
  openDeals(deals).filter((x) => x.competitor?.name === name);

/** Mentions added by UI lost-to-competitor events (seeded losses are already in the baseline). */
export function competitorLossBumps(deals: Deal[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of lostDeals(deals)) {
    if (x.lost?.competitor && !x.lost.seeded) out[x.lost.competitor] = (out[x.lost.competitor] ?? 0) + 1;
  }
  return out;
}

/** The digest's deal sentence: moves this week, biggest in Proposal, signs, stuck. */
export function dealDigestLine(deals: Deal[], now: number): string {
  const weekAgo = now - 7 * DAY;
  const moves = deals.reduce(
    (n, x) => n + x.stageHistory.filter((h, i) => i > 0 && Date.parse(h.at) >= weekAgo).length,
    0,
  );
  const proposal = openDeals(deals).filter((x) => x.stage === "proposal");
  const biggest = proposal.length
    ? proposal.reduce((a, b) => (a.size >= b.size ? a : b))
    : null;
  const signedThisWeek = signedDeals(deals).filter((x) => {
    const at = x.stageHistory.find((h) => h.stage === "signed")?.at;
    return at && Date.parse(at) >= weekAgo;
  });
  const stuck = stuckDeals(deals, now);
  const parts: string[] = [];
  parts.push(`${moves} stage move${moves === 1 ? "" : "s"} on the board this week`);
  if (signedThisWeek.length)
    parts.push(
      `${signedThisWeek.length} signed (${signedThisWeek.map((x) => x.company).join(", ")} — ${moneyK(sumSize(signedThisWeek))})`,
    );
  if (biggest) parts.push(`biggest in Proposal is ${biggest.company} at ${moneyK(biggest.size)}`);
  parts.push(
    stuck.length
      ? `stuck 14+ days: ${stuck.map((x) => `${x.company} (${daysInStage(x, now)}d in ${x.stage})`).join(", ")}`
      : "nothing has sat 14+ days in a stage",
  );
  return ` Deals: ${parts.join("; ")}.`;
}

// ---------------------------------------------------------------- gtm brain

const STALE_DAYS = 30;

/** Files untouched 30+ days — the amber-chip rule. */
export function staleBrainFiles(
  brainFiles: GrowthState["brainFiles"],
  now: number,
): { id: string; path: string; days: number }[] {
  return BRAIN_FILES.filter((f) => brainFiles[f.id])
    .map((f) => ({
      id: f.id,
      path: f.path,
      days: Math.floor((now - Date.parse(brainFiles[f.id].updatedAt)) / 86_400_000),
    }))
    .filter((f) => f.days >= STALE_DAYS);
}

export const isStaleFile = (updatedAt: string, now: number): boolean =>
  now - Date.parse(updatedAt) >= STALE_DAYS * 86_400_000;

/** Proposals with no decision yet. */
export function pendingProposals(proposals: GrowthState["proposals"]) {
  return BRAIN_PROPOSALS.filter((p) => !proposals[p.id]);
}

// ---------------------------------------------------------------- the digest

function narrateActions(actions: ActionLog[]): string {
  if (actions.length === 0) return "";
  const recent = actions.slice(-3).map((a) => a.text);
  return ` This session: ${recent.join(" ")}`;
}

/** The reporting agent's paragraph, written from the same numbers the page shows. */
export function writeDigest(
  spend: Record<ChannelId, number>,
  killed: KilledMap = {},
  actions: ActionLog[] = [],
  deals: Deal[] = DEALS,
  now: number = SEED_NOW,
): string {
  const t = totals(spend, killed);
  const alive = livingChannels(killed);
  const withCpm = alive.map((c) => ({
    c,
    spend: spend[c.id] ?? c.defaultSpend,
    cpm: costPerMeeting(spend[c.id] ?? c.defaultSpend, c.meetings),
  }));
  const paid = withCpm.filter((x) => x.cpm !== null && x.cpm !== Infinity && x.spend > 0);
  const meetingsTrend = trendPct(t.meetings, t.meetingsLastMonth);
  const pipe = pipelineFromDeals(deals);
  const pipeTotal = pipe.total;
  const pipeTrend = trendPct(pipeTotal, PIPELINE.lastMonthTotal);
  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

  if (paid.length === 0) {
    return (
      `MTD: ${t.meetings} meetings booked (${sign(meetingsTrend)} vs last month), pipeline ${moneyK(pipeTotal)} ` +
      `across ${pipe.count} deals (${sign(pipeTrend)}). Spend is zeroed across ` +
      `the board, so cost per meeting is a free lunch until the inputs come back. This week: the audit ran ` +
      `${AUDIT_FEED.runsThisWeek} times → ${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked ` +
      `→ ${AUDIT_FEED.meetingsThisMonth} meetings.` +
      dealDigestLine(deals, now) +
      narrateActions(actions)
    );
  }

  const cheapest = paid.reduce((a, b) => ((a.cpm ?? 0) <= (b.cpm ?? 0) ? a : b));
  const priciest = paid.reduce((a, b) => ((a.cpm ?? 0) >= (b.cpm ?? 0) ? a : b));
  const audit = withCpm.find((x) => x.c.id === "audit");
  const auditCpm = audit?.cpm ?? null;
  const auditClause =
    audit && auditCpm !== null && auditCpm !== Infinity
      ? cheapest.c.id === "audit"
        ? `at ${money(auditCpm)} a meeting it's our cheapest paid lane`
        : `${money(auditCpm)} a meeting — ${cheapest.c.label.toLowerCase()} currently holds the cheapest-paid crown at ${money(cheapest.cpm ?? 0)}`
      : `the audit lane is off the board right now`;
  const priciestClause =
    Object.keys(killed).length > 0
      ? `${priciest.c.label} is now the expensive lane at ${money(priciest.cpm ?? 0)} per meeting`
      : `${priciest.c.label} is the expensive lane at ${money(priciest.cpm ?? 0)} per meeting; it's on Friday's kill call, and the money moves to what's working`;

  return (
    `MTD: ${t.meetings} meetings booked (${sign(meetingsTrend)} vs last month), qualified pipeline ` +
    `${moneyK(pipeTotal)} across ${pipe.count} deals (${sign(pipeTrend)}), ` +
    `expansion ${moneyK(pipe.expValue)} of it. This week: the audit ran ${AUDIT_FEED.runsThisWeek} times → ` +
    `${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked → ${AUDIT_FEED.meetingsThisMonth} meetings, ` +
    `${moneyK(AUDIT_FEED.pipelineAttributed)} attributed MTD — ${auditClause}. ${priciestClause}.` +
    dealDigestLine(deals, now) +
    ` Nothing else changed that the numbers don't already say.` +
    narrateActions(actions)
  );
}

// ---------------------------------------------------------------- ask growth

export interface AskContext {
  state: GrowthState;
}

export interface AskAnswer {
  text: string;
  link?: { label: string; href: string };
}

/** ~12 pattern-matched intents, every number computed from live state. */
export function answerQuestion(q: string, state: GrowthState): AskAnswer | null {
  const s = q.toLowerCase();
  const killed = state.killedChannels;
  const alive = livingChannels(killed);
  const withCpm = alive.map((c) => ({
    c,
    spend: state.spend[c.id] ?? c.defaultSpend,
    cpm: costPerMeeting(state.spend[c.id] ?? c.defaultSpend, c.meetings),
  }));
  const paid = withCpm.filter((x) => x.cpm !== null && x.cpm !== Infinity && x.spend > 0);
  const t = totals(state.spend, killed);

  // ---- gtm brain intents (checked first: "kill line" must not hit the channel-kill intent) ----
  if (/kill.?line|kill line against/.test(s)) {
    const card = BATTLECARDS.find((b) => s.includes(b.competitor.toLowerCase().split(" ")[0]));
    if (card) {
      const line = state.killLines[card.id] ?? card.killLine;
      const v = state.brainFiles[card.id]?.version;
      return {
        text: `${card.competitor} kill line (battlecards/${card.id}.md v${v}): "${line}" Where we win: ${card.weWin}`,
        link: { label: "open GTM Brain", href: "/growth-os/signals" },
      };
    }
    return {
      text: `Kill lines live in the battlecards: ${BATTLECARDS.map((b) => b.competitor).join(", ")}. Name one.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/what is the (gtm )?brain|gtm brain/.test(s)) {
    const pending = pendingProposals(state.proposals).length;
    return {
      text: `Seven files agents read before they act and write what they learn into — brain.md, the signal library, four battlecards, the messaging matrix — every output archived with the context that produced it. ${pending} proposal${pending === 1 ? "" : "s"} pending review. The files are the memory. The query layer is what makes it a brain — a brain no one can query is just a folder.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/pending (review|proposal|approval)|what needs (review|approval)/.test(s)) {
    const pending = pendingProposals(state.proposals);
    if (pending.length === 0)
      return {
        text: "Nothing pending — every proposal has been approved or rejected. The brain is current.",
        link: { label: "open GTM Brain", href: "/growth-os/signals" },
      };
    return {
      text: `${pending.length} pending: ${pending.map((p) => p.title).join(" · ")}. The brain proposes; a human approves.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/who owns/.test(s)) {
    const file = BRAIN_FILES.find((f) =>
      f.path.toLowerCase().split(/[/.]/).some((part) => part.length > 3 && s.includes(part.replace(/-/g, " "))) ||
      s.includes(f.id.replace(/-/g, " ")) ||
      (f.id !== "brain" && s.includes(f.id.split("-")[0])),
    );
    if (file) {
      const v = state.brainFiles[file.id]?.version;
      return {
        text: `${file.path} is owned by ${file.owner} (v${v}). Every file has a named owner — Ops owns the taxonomy.`,
        link: { label: "open GTM Brain", href: "/growth-os/signals" },
      };
    }
    return {
      text: `Owners: brain.md and signals/library.md — Lucian; battlecards/ — Alex; messaging/matrix.md — Dana. Ops owns the taxonomy.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/stale/.test(s) && /brain|file|battlecard/.test(s)) {
    const stale = staleBrainFiles(state.brainFiles, Date.now());
    if (stale.length === 0)
      return {
        text: "Nothing is stale — every file has been touched inside 30 days.",
        link: { label: "open GTM Brain", href: "/growth-os/signals" },
      };
    return {
      text: `${stale.length} stale (30+ days untouched): ${stale.map((f) => `${f.path} — ${f.days} days`).join("; ")}. Stale battlecards lose deals quietly.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/messaging matrix|matrix for/.test(s)) {
    const persona = /coo/.test(s) ? "COO" : /founder/.test(s) ? "Founder" : /cx/.test(s) ? "CX lead" : null;
    if (persona) {
      const row = MESSAGING_MATRIX.find((r) => r.persona === persona);
      if (row)
        return {
          text: `${persona} × ${row.objection} → approved line: ${row.line} Used in ${row.usedIn.label}. Owner: Dana (messaging/matrix.md v${state.brainFiles.matrix?.version}).`,
          link: { label: "open GTM Brain", href: "/growth-os/signals" },
        };
    }
    return {
      text: `messaging/matrix.md (Dana) maps persona × top objection → the approved line: ${MESSAGING_MATRIX.map((r) => r.persona).join(", ")}. Name a persona for the row.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  // how is [bet] doing — check before generic intents so names win
  const pool = allBets(state.draftBets);
  const namedBet = pool.find(
    (b) =>
      s.includes(b.name.toLowerCase()) ||
      b.name
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 4)
        .some((w) => s.includes(w)),
  );
  if (/(how('s| is| are)? .*(doing|going|performing))|status of/.test(s) && namedBet) {
    const status = state.betStatus[namedBet.id] ?? namedBet.defaultStatus;
    const score = compositeScore(namedBet);
    const now = namedBet.currentValue ? ` Right now: ${namedBet.currentValue}.` : "";
    return {
      text: `${namedBet.name} is ${status}, composite ${score}, owned by ${namedBet.owner}. It moves "${namedBet.metric}".${now} Next action: ${namedBet.nextAction}`,
      link: { label: "open Bets", href: "/growth-os/bets" },
    };
  }

  // ---- deals board intents (live from state.deals) ----
  const deals = state.deals;
  const now = Date.now();

  if (/(what|who|much).*(in proposal)|proposal stage|^proposal/.test(s)) {
    const xs = openDeals(deals).filter((x) => x.stage === "proposal");
    if (xs.length === 0)
      return { text: "Proposal is empty right now.", link: { label: "open Deals Board", href: "/growth-os/deals" } };
    const sum = xs.reduce((n, x) => n + x.size, 0);
    return {
      text: `${xs.length} in Proposal worth ${moneyK(sum)}: ${xs.map((x) => `${x.company} (${moneyK(x.size)})`).join(", ")}. ${xs.reduce((a, b) => (a.size >= b.size ? a : b)).company} is the one to walk the hall for.`,
      link: { label: "open Deals Board — Proposal", href: "/growth-os/deals?stage=proposal" },
    };
  }

  if (/biggest|largest/.test(s) && /deal/.test(s)) {
    const open = openDeals(deals);
    if (open.length === 0)
      return { text: "No open deals on the board.", link: { label: "open Deals Board", href: "/growth-os/deals" } };
    const big = open.reduce((a, b) => (a.size >= b.size ? a : b));
    return {
      text: `${big.company} — ${moneyK(big.size)}, ${big.stage} stage, ${big.buyer.name} (${big.buyer.title}), sourced from ${CHANNELS.find((c) => c.id === big.source)?.label ?? big.source}.${big.competitor ? ` They're ${big.competitor.relation} ${big.competitor.name}.` : ""}`,
      link: { label: "open Deals Board", href: "/growth-os/deals" },
    };
  }

  if (/stuck|stalled|aging|sitting/.test(s) && /deal|board|stage/.test(s)) {
    const xs = stuckDeals(deals, now);
    if (xs.length === 0)
      return {
        text: "Nothing is stuck — no open deal has sat 14+ days in its current stage.",
        link: { label: "open Deals Board", href: "/growth-os/deals" },
      };
    return {
      text: `${xs.length} stuck (14+ days in stage): ${xs.map((x) => `${x.company} — ${daysInStage(x, now)} days in ${x.stage}, ${moneyK(x.size)}`).join("; ")}. Stuck deals don't age into wins; they age into losses.`,
      link: { label: "open Deals Board — stuck", href: "/growth-os/deals?stuck=1" },
    };
  }

  if (/lost.*(competitor|to who)|competitor.*(won|lost|beat)|who beat us/.test(s)) {
    const xs = lostDeals(deals).filter((x) => x.lost?.competitor);
    if (xs.length === 0)
      return { text: "No losses to a named competitor this quarter.", link: { label: "open Deals Board", href: "/growth-os/deals" } };
    const byComp = new Map<string, Deal[]>();
    for (const x of xs) {
      const k = x.lost!.competitor!;
      byComp.set(k, [...(byComp.get(k) ?? []), x]);
    }
    const parts = [...byComp.entries()].map(
      ([k, v]) => `${k} took ${v.length} (${v.map((x) => x.company).join(", ")} — ${moneyK(v.reduce((n, x) => n + x.size, 0))})`,
    );
    return {
      text: `${xs.length} lost to competitors this quarter, ${moneyK(xs.reduce((n, x) => n + x.size, 0))} total: ${parts.join("; ")}. Every one is logged in Signals.`,
      link: { label: "open Deals Board", href: "/growth-os/deals" },
    };
  }

  if (/(how much|what).*trial|in trial|trial worth/.test(s)) {
    const xs = openDeals(deals).filter((x) => x.stage === "trial");
    if (xs.length === 0)
      return { text: "Trial is empty right now.", link: { label: "open Deals Board", href: "/growth-os/deals" } };
    return {
      text: `${moneyK(xs.reduce((n, x) => n + x.size, 0))} across ${xs.length} trials: ${xs.map((x) => `${x.company} (${moneyK(x.size)})`).join(", ")}. Trials are where the audit's fast-tracks land.`,
      link: { label: "open Deals Board — Trial", href: "/growth-os/deals?stage=trial" },
    };
  }

  if (/audit.?sourced|deals? from the audit|audit deals/.test(s)) {
    const xs = openDeals(deals).filter((x) => x.source === "audit");
    const ft = xs.filter(isFastTracked);
    const signedAudit = signedDeals(deals).filter((x) => x.source === "audit").length;
    const signedClause = signedAudit > 0 ? ` ${signedAudit} more already signed this month.` : "";
    return {
      text: `${xs.length} active audit-sourced deals worth ${moneyK(xs.reduce((n, x) => n + x.size, 0))}, ${ft.length} of them fast-tracked (score > 70, volume > 3,000): ${xs.map((x) => x.company).join(", ")}.${signedClause}`,
      link: { label: "open Deals Board — audit-sourced", href: "/growth-os/deals?source=audit" },
    };
  }

  if (/kill|cut|stop|drop/.test(s) && /what|which|should|candidate/.test(s) && !/kill.?line/.test(s)) {
    if (paid.length === 0)
      return { text: "Nothing is spending right now, so there's nothing to kill on cost grounds.", link: { label: "open This Week", href: "/growth-os" } };
    const worst = paid.reduce((a, b) => ((a.cpm ?? 0) >= (b.cpm ?? 0) ? a : b));
    const already = killed.events ? " Events is already in the graveyard." : "";
    return {
      text: `${worst.c.label} — ${money(worst.cpm ?? 0)} per meeting on ${money(worst.spend)} of spend, the worst live lane. Kill it, give the budget to the lanes under $300, and let the digest say so.${already}`,
      link: { label: "open This Week", href: "/growth-os" },
    };
  }

  if (/cost per meeting|cpm/.test(s) && /(why|change|moved|different|went)/.test(s)) {
    const edited = alive.filter((c) => (state.spend[c.id] ?? c.defaultSpend) !== c.defaultSpend);
    if (edited.length === 0)
      return {
        text: `Nothing moved — spend inputs are at their seeded values, so blended sits at ${money(t.blended)} across ${t.meetings} meetings.`,
        link: { label: "open This Week", href: "/growth-os" },
      };
    const parts = edited.map((c) => {
      const now = state.spend[c.id] ?? c.defaultSpend;
      const cpm = costPerMeeting(now, c.meetings);
      return `${c.label} spend is ${money(now)} (seeded ${money(c.defaultSpend)}), so it prices at ${cpm === null ? "—" : cpm === Infinity ? "∞" : money(cpm)}/meeting`;
    });
    return {
      text: `Because the inputs moved: ${parts.join("; ")}. Blended is now ${money(t.blended)}.`,
      link: { label: "open This Week", href: "/growth-os" },
    };
  }

  if (/cheapest|most expensive|expensive lane|best lane|worst lane/.test(s)) {
    if (paid.length === 0)
      return { text: "No lane is spending right now.", link: { label: "open This Week", href: "/growth-os" } };
    const cheapest = paid.reduce((a, b) => ((a.cpm ?? 0) <= (b.cpm ?? 0) ? a : b));
    const priciest = paid.reduce((a, b) => ((a.cpm ?? 0) >= (b.cpm ?? 0) ? a : b));
    return {
      text: `Cheapest paid lane: ${cheapest.c.label} at ${money(cheapest.cpm ?? 0)} per meeting. Most expensive: ${priciest.c.label} at ${money(priciest.cpm ?? 0)}. The gap is the reallocation argument.`,
      link: { label: "open This Week", href: "/growth-os" },
    };
  }

  if (/pipeline/.test(s) && /(month|mtd|new|expansion|much)/.test(s)) {
    const pipe = pipelineFromDeals(deals);
    return {
      text: `${moneyK(pipe.total)} qualified pipeline MTD across ${pipe.count} deals — new ${moneyK(pipe.newValue)} (${pipe.newCount} deals), expansion ${moneyK(pipe.expValue)} (${pipe.expCount} plays). Computed from the Deals Board; expansion is the cheapest pipeline in the company.`,
      link: { label: "open Metrics", href: "/growth-os/metrics" },
    };
  }

  if (/shipped|ship this week|what.*ship/.test(s)) {
    return {
      text: `Three things shipped: the audit tool's revenue scenario + qualify step, story #14 (the pump defect nobody tagged), and expansion cohort 2 — 22 accounts on the Shopping pitch.`,
      link: { label: "open This Week", href: "/growth-os" },
    };
  }

  if (/biggest objection|top objection|objection right now/.test(s)) {
    return {
      text: `"AI will make us sound robotic — our voice is the brand." — 14 mentions this month and rising. The gen-3 outbound templates are aimed straight at it.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/objection.*(grow|rising|up|trend)/.test(s) || /(grow|rising).*objection/.test(s)) {
    return {
      text: `Two are climbing: "sounds robotic" (14, up) and "my team is scared this replaces them" (9, up). The second one is the MentorsCX thesis in the wild — career-ladder framing wins those rooms.`,
      link: { label: "open GTM Brain", href: "/growth-os/signals" },
    };
  }

  if (/audit tool|what does the audit/.test(s)) {
    return {
      text: `This week the audit ran ${AUDIT_FEED.runsThisWeek} times → ${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked → ${AUDIT_FEED.meetingsThisMonth} meetings MTD, ${moneyK(AUDIT_FEED.pipelineAttributed)} pipeline attributed. Every run writes full context to HubSpot before sales opens the call.`,
      link: { label: "open Bets", href: "/growth-os/bets" },
    };
  }

  if (/fast.?track/.test(s)) {
    return {
      text: `Fast-tracked means the routing rule fired: automation score above 70 and volume above 3,000/month. Those accounts skip nurture and land on sales with the full audit context attached — ${AUDIT_FEED.fastTracked} of ${AUDIT_FEED.leadsCreated} leads this week.`,
      link: { label: "open The Loop", href: "/growth-os/loop" },
    };
  }

  if (/not track|don't track|dont track|refuse/.test(s)) {
    return {
      text: `Six things, on purpose: MQLs (gameable), impressions, followers, and traffic (inputs, not outcomes), blended CAC alone (hides the winner), and attribution perfection (directional is enough — two more bets beat a six-figure suite).`,
      link: { label: "open Metrics", href: "/growth-os/metrics" },
    };
  }

  if (/compound/.test(s)) {
    const compounding = pool
      .filter((b) => b.compounds && !b.unranked)
      .map((b) => b.name);
    return {
      text: `${compounding.length} of the ranked bets compound: ${compounding.join(", ")}. "Every ship becomes a launch" is scored compounds: no on purpose — a launch is a moment, not an asset.`,
      link: { label: "open Bets", href: "/growth-os/bets" },
    };
  }

  return null;
}

export const ASK_INTENTS = [
  "what should we kill?",
  "what's our kill line against Decagon?",
  "what is the GTM brain?",
  "what's pending review?",
  "what's stale in the brain?",
  "who owns the Gorgias battlecard?",
  "show the messaging matrix for COO",
  "which deals are stuck?",
  "what's in proposal?",
  "biggest open deal",
  "what have we lost to competitors this quarter?",
  "how much is in trial?",
  "show me audit-sourced deals",
  "why did cost per meeting change?",
  "cheapest and most expensive lane",
  "how is [bet] doing?",
  "pipeline this month, new vs expansion",
  "what shipped this week?",
  "biggest objection right now",
  "which objection is growing?",
  "what does the audit tool produce?",
  "what does fast-tracked mean?",
  "what are we not tracking, and why?",
  "what compounds?",
];
