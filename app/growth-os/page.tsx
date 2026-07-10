"use client";

/**
 * This Week — the operating dashboard. Stat cards, meetings-by-source with
 * editable spend (cost per meeting recomputes live) and a kill ritual with
 * budget reallocation, the three ship lists, and the reporting agent's
 * digest — regenerable, and it narrates this session's decisions.
 */
import { useState } from "react";
import { Badge, Button, Card, Input, SectionHeading } from "@siena/design-system";
import { AUDIT_FEED, CHANNELS, PIPELINE, THIS_WEEK, type Channel, type ChannelId } from "./_lib/data";
import {
  costPerMeeting,
  efficiency,
  fmt,
  livingChannels,
  money,
  moneyK,
  totals,
  trendPct,
  writeDigest,
} from "./_lib/compute";
import { useGrowthState } from "./_lib/state";
import { EffChip, OwnerChip, StatCard } from "./_components/ui";

type KillStep =
  | { step: "reason"; channel: Channel }
  | { step: "reallocate"; channel: Channel; reason: string }
  | null;

export default function ThisWeekPage() {
  const [state, update, hydrated] = useGrowthState();
  const [kill, setKill] = useState<KillStep>(null);
  const [reason, setReason] = useState("");
  const [alloc, setAlloc] = useState<Partial<Record<ChannelId, number>>>({});
  const [digestBusy, setDigestBusy] = useState(false);

  const killed = state.killedChannels;
  const alive = livingChannels(killed);
  const t = totals(state.spend, killed);
  const pipeTotal = PIPELINE.newValue + PIPELINE.expansionValue;

  const startKill = (channel: Channel) => {
    setReason("");
    setKill({ step: "reason", channel });
  };

  const confirmReason = () => {
    if (!kill || kill.step !== "reason" || !reason.trim()) return;
    const spend = state.spend[kill.channel.id] ?? kill.channel.defaultSpend;
    if (spend > 0) {
      setAlloc({});
      setKill({ step: "reallocate", channel: kill.channel, reason: reason.trim() });
    } else {
      applyKill(kill.channel, reason.trim(), {});
      setKill(null);
    }
  };

  const applyKill = (
    channel: Channel,
    killReason: string,
    allocation: Partial<Record<ChannelId, number>>,
  ) => {
    const spendAtDeath = state.spend[channel.id] ?? channel.defaultSpend;
    const cpmAtDeath = costPerMeeting(spendAtDeath, channel.meetings);
    const now = new Date().toISOString();
    const moved = Object.entries(allocation).filter(([, v]) => (v ?? 0) > 0) as [
      ChannelId,
      number,
    ][];
    const movedText =
      moved.length > 0
        ? ` ${money(moved.reduce((n, [, v]) => n + v, 0))} moved: ${moved
            .map(([id, v]) => {
              const target = CHANNELS.find((ch) => ch.id === id);
              return `${target?.label} +${money(v)}`;
            })
            .join(", ")}.`
        : spendAtDeath > 0
          ? ` ${money(spendAtDeath)} freed, unallocated.`
          : "";
    update((prev) => ({
      killedChannels: {
        ...prev.killedChannels,
        [channel.id]: {
          reason: killReason,
          date: now,
          spendAtDeath,
          meetingsAtDeath: channel.meetings,
          costPerMeetingAtDeath:
            cpmAtDeath === Infinity || cpmAtDeath === null ? null : Math.round(cpmAtDeath),
          reallocated: Object.fromEntries(moved),
        },
      },
      spend: {
        ...prev.spend,
        [channel.id]: 0,
        ...Object.fromEntries(moved.map(([id, v]) => [id, (prev.spend[id] ?? 0) + v])),
      },
      actions: [
        ...prev.actions,
        {
          text: `Killed ${channel.label} — "${killReason}" — it was ${money(spendAtDeath)}/mo at ${
            cpmAtDeath === null || cpmAtDeath === Infinity ? "—" : money(cpmAtDeath)
          }/meeting.${movedText}`,
          at: now,
        },
      ],
    }));
  };

  const runDigest = () => {
    setDigestBusy(true);
    window.setTimeout(() => {
      update({ digestGeneratedAt: new Date().toISOString() });
      setDigestBusy(false);
    }, 700);
  };

  const freed =
    kill?.step === "reallocate"
      ? (state.spend[kill.channel.id] ?? kill.channel.defaultSpend)
      : 0;
  const allocated = Object.values(alloc).reduce((n, v) => n + (v ?? 0), 0);
  const remaining = freed - allocated;
  const survivors =
    kill?.step === "reallocate" ? alive.filter((c) => c.id !== kill.channel.id) : [];
  const projected = survivors.reduce((n, c) => {
    const amount = alloc[c.id] ?? 0;
    const cpm = costPerMeeting(state.spend[c.id] ?? c.defaultSpend, c.meetings);
    if (!amount || cpm === null || cpm === Infinity || cpm === 0) return n;
    return n + amount / cpm;
  }, 0);

  const digestStamp = (() => {
    if (!hydrated || !state.digestGeneratedAt) return "Posted to #growth · Monday 9:00";
    const ms = Date.now() - Date.parse(state.digestGeneratedAt);
    if (ms < 90_000) return "Generated just now · reporting agent";
    const d = new Date(state.digestGeneratedAt);
    return `Generated ${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · reporting agent`;
  })();

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
          sub={`across ${alive.length} sources — per-channel below`}
          trendPct={trendPct(t.meetings, t.meetingsLastMonth)}
        />
        <StatCard
          label="Blended cost / meeting"
          value={money(t.blended)}
          sub="directional only — per-channel is the real number"
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
          subtitle="Spend is editable — cost per meeting recomputes as you type. Kill asks for a reason, then for the money."
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alive.map((c) => {
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
                  <td>
                    <button
                      type="button"
                      className="gos-killbtn"
                      onClick={() => startKill(c)}
                      aria-label={`Kill ${c.label}`}
                    >
                      Kill
                    </button>
                  </td>
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
              <td colSpan={3} className="gos-table__note">
                blended hides the winner — see Metrics.
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
          subtitle="Reporting agent output, rendered from the numbers above. Run it again after a decision — it narrates."
        />
      </div>
      <Card tone="sand" radius="lg" padding="none" className="gos-panel gos-digest">
        <div className="gos-digest__meta">
          <Badge variant="filled" className="gos-digest__slack">
            {digestBusy ? "generating…" : digestStamp}
          </Badge>
          <span>
            audit feed: {AUDIT_FEED.runsThisWeek} runs · {AUDIT_FEED.leadsCreated} leads ·{" "}
            {AUDIT_FEED.fastTracked} fast-tracked · {fmt(AUDIT_FEED.meetingsThisMonth)} meetings
          </span>
          <span className="gos-digest__run">
            <Button variant="secondary" size="sm" onClick={runDigest} disabled={digestBusy}>
              Run digest
            </Button>
          </span>
        </div>
        <p style={digestBusy ? { opacity: 0.35 } : undefined}>
          {writeDigest(state.spend, killed, state.actions)}
        </p>
      </Card>

      {/* ---- kill ritual ---- */}
      {kill && (
        <>
          <button className="gos-scrim" aria-label="Cancel" onClick={() => setKill(null)} />
          <div className="gos-modal" role="dialog" aria-label={`Kill ${kill.channel.label}`}>
            {kill.step === "reason" ? (
              <>
                <h2 className="gos-modal__title">Kill {kill.channel.label}</h2>
                <p className="gos-modal__sub">
                  One line for the graveyard — why does it die? The numbers at death are
                  recorded automatically.
                </p>
                <Input
                  aria-label="Kill reason"
                  placeholder="why it dies, one line"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="gos-modal__actions">
                  <Button variant="secondary" size="sm" onClick={() => setKill(null)}>
                    Keep it
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={confirmReason}
                    disabled={!reason.trim()}
                  >
                    Kill it
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="gos-modal__title">Where does the money go?</h2>
                <p className="gos-modal__sub">
                  {kill.channel.label} frees {money(freed)}/mo. Slide it into the lanes
                  that earn it — projections use each lane&rsquo;s current cost per
                  meeting.
                </p>
                <div className="gos-realloc">
                  {survivors.map((c) => {
                    const cpm = costPerMeeting(
                      state.spend[c.id] ?? c.defaultSpend,
                      c.meetings,
                    );
                    const amount = alloc[c.id] ?? 0;
                    const extra =
                      cpm === null || cpm === Infinity || cpm === 0 ? null : amount / cpm;
                    return (
                      <div key={c.id} className="gos-realloc__row">
                        <span className="gos-realloc__name">{c.label}</span>
                        <input
                          type="range"
                          min={0}
                          max={freed}
                          step={50}
                          value={amount}
                          aria-label={`Reallocate to ${c.label}`}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const others = allocated - amount;
                            setAlloc((prev) => ({
                              ...prev,
                              [c.id]: Math.max(0, Math.min(v, freed - others)),
                            }));
                          }}
                        />
                        <span className="gos-realloc__nums">
                          +{money(amount)}
                          <em>
                            {extra === null
                              ? "unpriced lane"
                              : `≈ +${extra.toFixed(1)} meetings at ${money(cpm ?? 0)}`}
                          </em>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="gos-realloc__total">
                  {money(allocated)} allocated · {money(remaining)} left on the table ·
                  projected ≈ +{projected.toFixed(1)} meetings/mo
                </p>
                <div className="gos-modal__actions">
                  <Button variant="secondary" size="sm" onClick={() => setKill(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      applyKill(kill.channel, kill.reason, alloc);
                      setKill(null);
                    }}
                  >
                    Kill and move the money
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
