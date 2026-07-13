"use client";

/**
 * Metrics — the board view, made operational. Every metric is computed from
 * the same state the rest of the OS reads, trended over 12 weeks, held
 * against a target (status is computed, never asserted), traced to the page
 * where you act on it, and expandable into its decomposition. The right
 * column — what we refuse to track — is the same size on purpose.
 */
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, SectionHeading } from "@siena/design-system";
import { CHANNELS, NOT_TRACKED, PAYBACK_BY_CHANNEL, METRIC_LAST_MONTH } from "../_lib/data";
import {
  costPerMeeting,
  efficiency,
  livingChannels,
  lostDeals,
  metricMovers,
  metricsModel,
  money,
  moneyK,
  pipelineFromDeals,
  salesCycle,
  signedDeals,
  winRate,
  type MetricView,
} from "../_lib/compute";
import { useGrowthState, type GrowthState } from "../_lib/state";
import { EffChip, Spark } from "../_components/ui";

const STATUS_LABEL = {
  "on-track": "on track",
  watch: "watch",
  "off-track": "off track",
} as const;

function TargetChip({ m }: { m: MetricView }) {
  return (
    <Badge variant="outline" className={`gos-tgt gos-tgt--${m.target.status}`}>
      {STATUS_LABEL[m.target.status]} · {m.target.label}
    </Badge>
  );
}

/** the per-metric decomposition — where the aggregate stops hiding things */
function Breakdown({ id, state }: { id: string; state: GrowthState }) {
  const killed = state.killedChannels;
  const alive = livingChannels(killed);

  if (id === "meetings" || id === "cpm") {
    const rows = alive
      .map((c) => {
        const spend = state.spend[c.id] ?? c.defaultSpend;
        const cpm = costPerMeeting(spend, c.meetings);
        return { c, spend, cpm };
      })
      .sort((a, b) =>
        id === "cpm"
          ? (a.cpm === null || a.cpm === Infinity ? 1e9 : a.cpm) -
            (b.cpm === null || b.cpm === Infinity ? 1e9 : b.cpm)
          : b.c.meetings - a.c.meetings,
      );
    const totalMeetings = alive.reduce((n, c) => n + c.meetings, 0);
    return (
      <div className="gos-mbreak">
        {rows.map(({ c, spend, cpm }) => (
          <div key={c.id} className="gos-mbreak__row">
            <span className="gos-mbreak__name">{c.label}</span>
            <span className="gos-mbreak__num">
              {id === "meetings"
                ? `${c.meetings} meetings · ${Math.round((c.meetings / Math.max(1, totalMeetings)) * 100)}%`
                : cpm === null
                  ? "no spend"
                  : cpm === Infinity
                    ? `${money(spend)} · no meetings`
                    : `${money(cpm)} / meeting on ${money(spend)}`}
            </span>
            <EffChip level={efficiency(cpm)} />
          </div>
        ))}
        <Link href="/growth-os" className="gos-usedin" onClick={(e) => e.stopPropagation()}>
          → act on it: spend inputs and the kill ritual on This Week
        </Link>
      </div>
    );
  }

  if (id === "pipeline") {
    const bySource = CHANNELS.map((c) => {
      const deals = state.deals.filter(
        (x) => x.source === c.id && Date.parse(x.createdAt) >= Date.parse("2026-07-01T00:00:00.000Z"),
      );
      return { c, count: deals.length, sum: deals.reduce((n, x) => n + x.size, 0) };
    }).filter((r) => r.count > 0);
    const pipe = pipelineFromDeals(state.deals);
    return (
      <div className="gos-mbreak">
        <div className="gos-mbreak__row">
          <span className="gos-mbreak__name">new</span>
          <span className="gos-mbreak__num">
            {moneyK(pipe.newValue)} · {pipe.newCount} deals
          </span>
        </div>
        <div className="gos-mbreak__row">
          <span className="gos-mbreak__name">expansion</span>
          <span className="gos-mbreak__num">
            {moneyK(pipe.expValue)} · {pipe.expCount} deals
          </span>
        </div>
        <div className="gos-mbreak__divider" aria-hidden="true" />
        {bySource
          .sort((a, b) => b.sum - a.sum)
          .map((r) => (
            <div key={r.c.id} className="gos-mbreak__row">
              <span className="gos-mbreak__name">{r.c.label}</span>
              <span className="gos-mbreak__num">
                {moneyK(r.sum)} · {r.count} created this month
              </span>
              <Link
                href={`/growth-os/deals?source=${r.c.id}`}
                className="gos-usedin"
                onClick={(e) => e.stopPropagation()}
              >
                → board
              </Link>
            </div>
          ))}
      </div>
    );
  }

  if (id === "winrate") {
    const signed = signedDeals(state.deals);
    const lost = lostDeals(state.deals);
    const byCompetitor = new Map<string, number>();
    for (const x of lost) {
      if (x.lost?.competitor)
        byCompetitor.set(x.lost.competitor, (byCompetitor.get(x.lost.competitor) ?? 0) + 1);
    }
    const wr = winRate(state.deals);
    const cycle = salesCycle(state.deals);
    return (
      <div className="gos-mbreak">
        {signed.map((x) => {
          const at = x.stageHistory.find((h) => h.stage === "signed")?.at;
          const days = at
            ? Math.round((Date.parse(at) - Date.parse(x.createdAt)) / 86_400_000)
            : null;
          return (
            <div key={x.id} className="gos-mbreak__row">
              <span className="gos-mbreak__name">✓ {x.company}</span>
              <span className="gos-mbreak__num">
                {moneyK(x.size)} · {days === null ? "—" : `${days}-day cycle`}
              </span>
            </div>
          );
        })}
        <div className="gos-mbreak__row">
          <span className="gos-mbreak__name">✕ lost</span>
          <span className="gos-mbreak__num">
            {lost.length} deals ·{" "}
            {[...byCompetitor.entries()].map(([k, v]) => `${k} took ${v}`).join(", ") ||
              "none to a named competitor"}
          </span>
          <Link href="/growth-os/brain" className="gos-usedin" onClick={(e) => e.stopPropagation()}>
            → battlecards
          </Link>
        </div>
        <p className="gos-mbreak__note">
          {wr.signed} signed ÷ {wr.closed} closed = {wr.pct}% · cycle averages{" "}
          {cycle.days} days over {cycle.n} signed · last month {METRIC_LAST_MONTH.winRatePct}% ·{" "}
          {METRIC_LAST_MONTH.salesCycleDays} days
        </p>
      </div>
    );
  }

  if (id === "payback") {
    const rows = PAYBACK_BY_CHANNEL.filter((p) => !killed[p.channel]);
    return (
      <div className="gos-mbreak">
        {rows.map((p) => {
          const c = CHANNELS.find((ch) => ch.id === p.channel)!;
          const spend = state.spend[p.channel] ?? 0;
          return (
            <div key={p.channel} className="gos-mbreak__row">
              <span className="gos-mbreak__name">{c.label}</span>
              <span className="gos-mbreak__num">
                {p.months === null ? "—" : `${p.months} mo`}
                {spend > 0 ? ` · weighted by ${money(spend)}/mo` : " · no spend"}
              </span>
              <span className="gos-mbreak__why">{p.note}</span>
            </div>
          );
        })}
        <p className="gos-mbreak__note">
          Modeled fully loaded (incl. team), blended by live spend — kill or defund an
          expensive lane and the headline moves. Media-only flatters to ~2 months.
        </p>
      </div>
    );
  }

  return null;
}

export default function MetricsPage() {
  const [state, , hydrated] = useGrowthState();
  const [open, setOpen] = useState<string | null>(null);
  const model = metricsModel(state);
  const movers = metricMovers(model);

  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The numbers"
          title="Metrics"
          subtitle="Five numbers, each computed from the same state the rest of the OS runs on — trended, held against a target, and traceable to the page where you act on it. Click one to decompose it."
        />
      </div>

      <div className="gos-movers">
        {movers.biggest && (
          <Card tone="cream" radius="md" className="gos-mover">
            <span className="gos-mover__k">biggest move</span>
            <span className="gos-mover__v">
              {movers.biggest.name.split(",")[0]} {sign(movers.biggest.trendPct)} vs last month
            </span>
          </Card>
        )}
        {movers.rightDirection && (
          <Card tone="cream" radius="md" className="gos-mover">
            <span className="gos-mover__k">right direction</span>
            <span className="gos-mover__v">
              {movers.rightDirection.name.split(",")[0]} {sign(movers.rightDirection.trendPct)} —{" "}
              {movers.rightDirection.value}
            </span>
          </Card>
        )}
        {movers.offTarget ? (
          <Card tone="cream" radius="md" className="gos-mover gos-mover--watch">
            <span className="gos-mover__k">the one to watch</span>
            <span className="gos-mover__v">
              {movers.offTarget.name.split(",")[0]} — {movers.offTarget.value} vs{" "}
              {movers.offTarget.target.label}
            </span>
          </Card>
        ) : (
          <Card tone="cream" radius="md" className="gos-mover">
            <span className="gos-mover__k">targets</span>
            <span className="gos-mover__v">all five on track</span>
          </Card>
        )}
      </div>

      <div className="gos-metrics">
        <div className="gos-metrics__left">
          {model.map((m) => (
            <Card
              key={m.id}
              tone="white"
              radius="lg"
              padding="none"
              className={`gos-panel gos-mrow${open === m.id ? " gos-mrow--open" : ""}`}
              onClick={() => setOpen(open === m.id ? null : m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(open === m.id ? null : m.id);
                }
              }}
            >
              <div className="gos-mrow__top">
                <div className="gos-mrow__id">
                  <span className="gos-metric__name">{m.name}</span>
                  <span className="gos-mrow__why">{m.why}</span>
                </div>
                <div className="gos-mrow__nums">
                  <span className="gos-metric__value">{m.value}</span>
                  <span className="gos-mrow__sub">{m.sub}</span>
                </div>
                <div className="gos-mrow__spark" aria-hidden="true">
                  <Spark points={m.spark} height={30} fit />
                  <span
                    className={`gos-trend ${
                      (m.trendGoodWhenUp ? m.trendPct >= 0 : m.trendPct <= 0)
                        ? "gos-trend--good"
                        : "gos-trend--bad"
                    }`}
                  >
                    {m.trendPct >= 0 ? "▲" : "▼"} {Math.abs(m.trendPct)}% vs last mo
                  </span>
                </div>
              </div>
              <div className="gos-mrow__meta">
                <TargetChip m={m} />
                <span className="gos-mrow__source">
                  computed from{" "}
                  <Link
                    href={m.source.href}
                    className="gos-usedin"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {m.source.label}
                  </Link>
                </span>
                <span className="gos-mrow__moved">
                  moved by{" "}
                  {m.movedBy.map((b, i) => (
                    <span key={b.label}>
                      {i > 0 && " · "}
                      <Link
                        href={b.href}
                        className="gos-usedin"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {b.label}
                      </Link>
                    </span>
                  ))}
                </span>
                <span className="gos-metric__cadence">reviewed {m.cadence}</span>
                <span className="gos-mrow__chevron" aria-hidden="true">
                  {open === m.id ? "▾" : "▸"}
                </span>
              </div>
              {open === m.id && hydrated && <Breakdown id={m.id} state={state} />}
            </Card>
          ))}
        </div>

        <Card tone="dark" radius="lg" padding="none" className="gos-metrics-panel gos-excluded">
          <span className="sds-mono-label gos-excluded__tag">
            Not tracked, on purpose
          </span>
          {NOT_TRACKED.map((m) => (
            <div key={m.name} className="gos-metric">
              <div className="gos-metric__top">
                <span className="gos-metric__name">{m.name}</span>
              </div>
              <span className="gos-metric__why">{m.reason}</span>
            </div>
          ))}
          <p className="gos-excluded__note">
            If a number shows up here twice in board decks, it moves left or it dies.
          </p>
        </Card>
      </div>
    </>
  );
}
