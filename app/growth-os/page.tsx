"use client";

/**
 * This Week — the operating dashboard. Stat cards, meetings-by-source with
 * editable spend (cost per meeting recomputes live), the three ship lists,
 * and the reporting agent's digest written from the same numbers.
 */
import { AUDIT_FEED, CHANNELS, PIPELINE, THIS_WEEK } from "./_lib/data";
import {
  costPerMeeting,
  efficiency,
  fmt,
  money,
  moneyK,
  totals,
  trendPct,
  writeDigest,
} from "./_lib/compute";
import { Badge, Card, Input, SectionHeading } from "@siena/design-system";
import { useGrowthState } from "./_lib/state";
import { EffChip, OwnerChip, StatCard } from "./_components/ui";

export default function ThisWeekPage() {
  const [state, update] = useGrowthState();
  const t = totals(state.spend);
  const pipeTotal = PIPELINE.newValue + PIPELINE.expansionValue;

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · Week 28"
          title="This week"
          subtitle="Numbers are month-to-date, trends vs last month. The digest at the bottom is what #growth reads."
        />
      </div>

      <div className="gos-statrow">
        <StatCard
          label="Qualified pipeline created"
          value={moneyK(pipeTotal)}
          sub={`${PIPELINE.newDeals + PIPELINE.expansionDeals} deals — new ${moneyK(PIPELINE.newValue)} (${PIPELINE.newDeals}) · expansion ${moneyK(PIPELINE.expansionValue)} (${PIPELINE.expansionDeals})`}
          trendPct={trendPct(pipeTotal, PIPELINE.lastMonthTotal)}
        />
        <StatCard
          label="Meetings booked"
          value={String(t.meetings)}
          sub="6 sources, per-channel below"
          trendPct={trendPct(t.meetings, t.meetingsLastMonth)}
        />
        <StatCard
          label="Blended cost / meeting"
          value={money(t.blended)}
          sub="debug number — per-channel is the real one"
          trendPct={trendPct(Math.round(t.blended), Math.round(t.blendedLastMonth))}
          trendGoodWhenUp={false}
        />
        <StatCard
          label="Expansion pipeline"
          value={moneyK(PIPELINE.expansionValue)}
          sub={`${PIPELINE.expansionDeals} plays, lifecycle-triggered`}
          trendPct={trendPct(PIPELINE.expansionValue, PIPELINE.expansionLastMonth)}
        />
      </div>

      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="01 · The channels"
          title="Meetings by source"
          subtitle="Spend is editable — cost per meeting recomputes as you type."
        />
      </div>
      <Card tone="white" radius="lg" padding="none" className="gos-panel">
        <table className="gos-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Meetings</th>
              <th>Spend / mo</th>
              <th>Cost / meeting</th>
              <th>Read</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map((c) => {
              const spend = state.spend[c.id] ?? c.defaultSpend;
              const cpm = costPerMeeting(spend, c.meetings);
              return (
                <tr key={c.id}>
                  <td>
                    <strong>{c.label}</strong>
                  </td>
                  <td className="gos-num">
                    {c.meetings}
                    <span style={{ color: "var(--sds-text-muted)" }}>
                      {" "}
                      / {c.meetingsLastMonth} last mo
                    </span>
                  </td>
                  <td>
                    <Input
                      className="gos-spendfield"
                      type="number"
                      aria-label={`${c.label} spend this month`}
                      value={String(spend)}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(1_000_000, Number(e.target.value) || 0));
                        update((prev) => ({ spend: { ...prev.spend, [c.id]: v } }));
                      }}
                    />
                  </td>
                  <td className="gos-num">
                    {cpm === null ? "—" : cpm === Infinity ? "no meetings" : money(cpm)}
                  </td>
                  <td>
                    <EffChip level={efficiency(cpm)} />
                  </td>
                  <td className="gos-table__note">{c.note}</td>
                </tr>
              );
            })}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="gos-num">{t.meetings}</td>
              <td className="gos-num">{money(t.totalSpend)}</td>
              <td className="gos-num">{money(t.blended)} blended</td>
              <td colSpan={2} className="gos-table__note">
                blended shown for debugging only — see Metrics for why
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="02 · The board"
          title="Shipped, moving, dying"
          subtitle="One line each, owners attached."
        />
      </div>
      <div className="gos-week">
        <Card tone="cream" radius="lg" padding="none" className="gos-week__col">
          <h3 className="sds-mono-label">Shipped</h3>
          <ul className="gos-week__list">
            {THIS_WEEK.shipped.map((item) => (
              <li key={item.text} className="gos-week__item">
                <span>{item.text}</span>
                <OwnerChip name={item.owner} />
              </li>
            ))}
          </ul>
        </Card>
        <Card tone="cream" radius="lg" padding="none" className="gos-week__col">
          <h3 className="sds-mono-label">Moving</h3>
          <ul className="gos-week__list">
            {THIS_WEEK.moving.map((item) => (
              <li key={item.text} className="gos-week__item">
                <span>{item.text}</span>
                <OwnerChip name={item.owner} />
              </li>
            ))}
          </ul>
        </Card>
        <Card tone="cream" radius="lg" padding="none" className="gos-week__col gos-week__col--kill">
          <h3 className="sds-mono-label">Kill candidates</h3>
          <ul className="gos-week__list">
            {THIS_WEEK.kill.map((item) => (
              <li key={item.text} className="gos-week__item gos-week__item--kill">
                <span>{item.text}</span>
                <OwnerChip name={item.owner} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="03 · The digest"
          title="What #growth reads"
          subtitle="Reporting agent output, rendered from the numbers above."
        />
      </div>
      <Card tone="sand" radius="lg" padding="none" className="gos-panel gos-digest">
        <div className="gos-digest__meta">
          <Badge variant="filled" className="gos-digest__slack">
            Posted to #growth · Monday 9:00
          </Badge>
          <span>
            audit feed: {AUDIT_FEED.runsThisWeek} runs · {AUDIT_FEED.leadsCreated} leads ·{" "}
            {moneyK(AUDIT_FEED.pipelineAttributed)} attributed · {fmt(AUDIT_FEED.meetingsThisMonth)}{" "}
            meetings
          </span>
        </div>
        <p>{writeDigest(state.spend)}</p>
      </Card>
    </>
  );
}
