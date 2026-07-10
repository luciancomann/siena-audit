/**
 * Growth OS derived numbers — pure functions over the seed + state, so the
 * dashboard, the digest, the command bar, and the bets board never disagree.
 */
import type { Bet, BetStatus, ChannelId } from "./data";
import type { Efficiency } from "./data-types";
import type { ActionLog, DraftBet, GrowthState, KilledChannel } from "./state";
import { AUDIT_FEED, BETS, CHANNELS, MAX_LIVE, PIPELINE } from "./data";

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
  const pipeTotal = PIPELINE.newValue + PIPELINE.expansionValue;
  const pipeTrend = trendPct(pipeTotal, PIPELINE.lastMonthTotal);
  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

  if (paid.length === 0) {
    return (
      `MTD: ${t.meetings} meetings booked (${sign(meetingsTrend)} vs last month), pipeline ${moneyK(pipeTotal)} ` +
      `across ${PIPELINE.newDeals + PIPELINE.expansionDeals} deals (${sign(pipeTrend)}). Spend is zeroed across ` +
      `the board, so cost per meeting is a free lunch until the inputs come back. This week: the audit ran ` +
      `${AUDIT_FEED.runsThisWeek} times → ${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked ` +
      `→ ${AUDIT_FEED.meetingsThisMonth} meetings.` +
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
    `${moneyK(pipeTotal)} across ${PIPELINE.newDeals + PIPELINE.expansionDeals} deals (${sign(pipeTrend)}), ` +
    `expansion ${moneyK(PIPELINE.expansionValue)} of it. This week: the audit ran ${AUDIT_FEED.runsThisWeek} times → ` +
    `${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked → ${AUDIT_FEED.meetingsThisMonth} meetings, ` +
    `${moneyK(AUDIT_FEED.pipelineAttributed)} attributed MTD — ${auditClause}. ${priciestClause}. ` +
    `Nothing else changed that the numbers don't already say.` +
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

  if (/kill|cut|stop|drop/.test(s) && /what|which|should|candidate/.test(s)) {
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
    return {
      text: `${moneyK(PIPELINE.newValue + PIPELINE.expansionValue)} qualified pipeline MTD across ${PIPELINE.newDeals + PIPELINE.expansionDeals} deals — new ${moneyK(PIPELINE.newValue)} (${PIPELINE.newDeals} deals), expansion ${moneyK(PIPELINE.expansionValue)} (${PIPELINE.expansionDeals} plays). Expansion is the cheapest pipeline in the company.`,
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
      link: { label: "open Signals", href: "/growth-os/signals" },
    };
  }

  if (/objection.*(grow|rising|up|trend)/.test(s) || /(grow|rising).*objection/.test(s)) {
    return {
      text: `Two are climbing: "sounds robotic" (14, up) and "my team is scared this replaces them" (9, up). The second one is the MentorsCX thesis in the wild — career-ladder framing wins those rooms.`,
      link: { label: "open Signals", href: "/growth-os/signals" },
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
