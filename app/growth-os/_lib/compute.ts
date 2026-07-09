/**
 * Growth OS derived numbers — pure functions over the seed + state, so the
 * dashboard, the digest, and the bets board never disagree.
 */
import type { Bet, BetStatus, ChannelId } from "./data";
import type { Efficiency } from "./data-types";
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

export function totals(spend: Record<ChannelId, number>) {
  const meetings = CHANNELS.reduce((n, c) => n + c.meetings, 0);
  const meetingsLastMonth = CHANNELS.reduce((n, c) => n + c.meetingsLastMonth, 0);
  const totalSpend = CHANNELS.reduce((n, c) => n + (spend[c.id] ?? c.defaultSpend), 0);
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
export function compositeScore(bet: Bet): number {
  const cost = bet.costToRun === "low" ? 2 : bet.costToRun === "med" ? 1 : 0;
  const speed = Math.max(0, 8 - bet.timeToSignalWeeks);
  return bet.categoryFit * 2 + (bet.compounds ? 3 : 0) + cost + speed;
}

/** Ranked bets in display order: manual order if set, else composite desc. Unranked bets pinned last. */
export function orderedBets(betOrder: string[] | null): Bet[] {
  const ranked = BETS.filter((b) => !b.unranked);
  const unranked = BETS.filter((b) => b.unranked);
  let inOrder: Bet[];
  if (betOrder) {
    const byId = new Map(ranked.map((b) => [b.id, b]));
    inOrder = betOrder.map((id) => byId.get(id)).filter((b): b is Bet => Boolean(b));
    for (const b of ranked) if (!inOrder.includes(b)) inOrder.push(b);
  } else {
    inOrder = [...ranked].sort((a, b) => compositeScore(b) - compositeScore(a));
  }
  return [...inOrder, ...unranked];
}

export function liveCount(betStatus: Record<string, BetStatus>): number {
  return BETS.filter((b) => (betStatus[b.id] ?? b.defaultStatus) === "live").length;
}

export function canGoLive(betStatus: Record<string, BetStatus>): boolean {
  return liveCount(betStatus) < MAX_LIVE;
}

// ---------------------------------------------------------------- the digest

/** The reporting agent's paragraph, written from the same numbers the page shows. */
export function writeDigest(spend: Record<ChannelId, number>): string {
  const t = totals(spend);
  const withCpm = CHANNELS.map((c) => ({
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
      `MTD: ${t.meetings} meetings (${sign(meetingsTrend)} vs last month), pipeline ${moneyK(pipeTotal)} ` +
      `across ${PIPELINE.newDeals + PIPELINE.expansionDeals} deals (${sign(pipeTrend)}). Spend is zeroed across ` +
      `the board, so cost per meeting is a free lunch until the inputs come back. This week the audit did ` +
      `${AUDIT_FEED.runsThisWeek} runs → ${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked.`
    );
  }

  const cheapest = paid.reduce((a, b) => ((a.cpm ?? 0) <= (b.cpm ?? 0) ? a : b));
  const priciest = paid.reduce((a, b) => ((a.cpm ?? 0) >= (b.cpm ?? 0) ? a : b));
  const audit = withCpm.find((x) => x.c.id === "audit");
  const auditCpm = audit?.cpm ?? null;
  const auditClause =
    auditCpm !== null && auditCpm !== Infinity
      ? cheapest.c.id === "audit"
        ? `at ${money(auditCpm)} a meeting it's our cheapest paid lane`
        : `${money(auditCpm)} a meeting — ${cheapest.c.label.toLowerCase()} currently holds the cheapest-paid crown at ${money(cheapest.cpm ?? 0)}`
      : `spend zeroed, so the lane rides free this month`;

  return (
    `MTD: ${t.meetings} meetings booked (${sign(meetingsTrend)} vs last month), qualified pipeline ` +
    `${moneyK(pipeTotal)} across ${PIPELINE.newDeals + PIPELINE.expansionDeals} deals (${sign(pipeTrend)}), ` +
    `expansion ${moneyK(PIPELINE.expansionValue)} of it. This week: the audit ran ${AUDIT_FEED.runsThisWeek} times → ` +
    `${AUDIT_FEED.leadsCreated} leads → ${AUDIT_FEED.fastTracked} fast-tracked, ${moneyK(AUDIT_FEED.pipelineAttributed)} ` +
    `attributed MTD — ${auditClause}. ${priciest.c.label} is the expensive lane at ${money(priciest.cpm ?? 0)} per ` +
    `meeting; it's on Friday's kill call, and the money moves to what's working. Nothing else changed that the ` +
    `numbers don't already say.`
  );
}
