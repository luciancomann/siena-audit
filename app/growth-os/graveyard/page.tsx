"use client";

/**
 * Graveyard — everything killed on purpose: channels and bets, each with
 * the one-line reason, the date, and the numbers at death. Nothing here is
 * a failure; it's the WIP rule working. Restorable — restoring a channel
 * pulls its reallocated budget back from the survivors.
 */
import { Badge, Button, Card, SectionHeading } from "@siena/design-system";
import { CHANNELS, MAX_LIVE, type ChannelId } from "../_lib/data";
import { allBets, liveCount, money } from "../_lib/compute";
import { useGrowthState } from "../_lib/state";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GraveyardPage() {
  const [state, update, hydrated] = useGrowthState();

  const deadChannels = (Object.entries(state.killedChannels) as [
    ChannelId,
    NonNullable<(typeof state.killedChannels)[ChannelId]>,
  ][]).map(([id, kill]) => ({ channel: CHANNELS.find((c) => c.id === id)!, id, kill }));

  const pool = allBets(state.draftBets);
  const deadBets = Object.entries(state.betKills)
    .map(([id, kill]) => ({ bet: pool.find((b) => b.id === id), id, kill }))
    .filter((e) => e.bet);

  const restoreChannel = (id: ChannelId) => {
    const kill = state.killedChannels[id];
    if (!kill) return;
    const label = CHANNELS.find((c) => c.id === id)?.label ?? id;
    update((prev) => {
      const rest = { ...prev.killedChannels };
      delete rest[id];
      const spend = { ...prev.spend, [id]: kill.spendAtDeath };
      // pull the reallocated budget back from the survivors it went to
      for (const [target, amount] of Object.entries(kill.reallocated ?? {}) as [
        ChannelId,
        number,
      ][]) {
        spend[target] = Math.max(0, (spend[target] ?? 0) - (amount ?? 0));
      }
      return {
        killedChannels: rest,
        spend,
        actions: [
          ...prev.actions,
          {
            text: `Restored ${label} from the graveyard at ${money(kill.spendAtDeath)}/mo — the reallocated budget moved back.`,
            at: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const restoreBet = (id: string) => {
    const bet = pool.find((b) => b.id === id);
    // restores to Queued — going Live again has to pass the WIP rule on the board
    update((prev) => {
      const rest = { ...prev.betKills };
      delete rest[id];
      return {
        betStatus: { ...prev.betStatus, [id]: "queued" },
        betKills: rest,
        actions: [
          ...prev.actions,
          {
            text: `Restored the "${bet?.name ?? id}" bet from the graveyard — back to Queued.`,
            at: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const empty = deadChannels.length === 0 && deadBets.length === 0;

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The record"
          title="Graveyard"
          subtitle="Everything killed on purpose — the reason, the date, the numbers at death. Killing is the WIP rule working, not failure. Restorable."
        />
      </div>

      {!hydrated ? null : empty ? (
        <Card tone="cream" radius="lg" className="gos-grave-empty">
          <p className="gos-grave-empty__line">
            Nothing here yet. That either means everything is working — or
            nothing has been killed that should be. The WIP rule says {MAX_LIVE}{" "}
            live bets max; when the fourth wants in, this page gets its first
            resident.
          </p>
        </Card>
      ) : (
        <div className="gos-grave">
          {deadChannels.map(({ channel, id, kill }) => (
            <Card key={id} tone="white" radius="lg" className="gos-grave__item">
              <div className="gos-grave__head">
                <span className="gos-grave__name">{channel.label}</span>
                <Badge variant="outline" className="gos-grave__type">
                  channel
                </Badge>
                <span className="gos-grave__date">killed {shortDate(kill.date)}</span>
              </div>
              <p className="gos-grave__reason">&ldquo;{kill.reason}&rdquo;</p>
              <p className="gos-grave__numbers">
                At death: {money(kill.spendAtDeath)}/mo · {kill.meetingsAtDeath} meetings ·{" "}
                {kill.costPerMeetingAtDeath === null
                  ? "no cost per meeting"
                  : `${money(kill.costPerMeetingAtDeath)}/meeting`}
                {kill.reallocated && Object.keys(kill.reallocated).length > 0 && (
                  <>
                    {" "}
                    · freed budget went to{" "}
                    {Object.entries(kill.reallocated)
                      .map(
                        ([t, v]) =>
                          `${CHANNELS.find((c) => c.id === t)?.label ?? t} (+${money(v ?? 0)})`,
                      )
                      .join(", ")}
                  </>
                )}
              </p>
              <div className="gos-grave__actions">
                <Button variant="secondary" size="sm" onClick={() => restoreChannel(id)}>
                  Restore
                </Button>
              </div>
            </Card>
          ))}

          {deadBets.map(({ bet, id, kill }) => (
            <Card key={id} tone="white" radius="lg" className="gos-grave__item">
              <div className="gos-grave__head">
                <span className="gos-grave__name">{bet!.name}</span>
                <Badge variant="outline" className="gos-grave__type">
                  bet
                </Badge>
                <span className="gos-grave__date">killed {shortDate(kill.date)}</span>
              </div>
              <p className="gos-grave__reason">&ldquo;{kill.reason}&rdquo;</p>
              <p className="gos-grave__numbers">At death: {kill.numbersAtDeath}</p>
              <div className="gos-grave__actions">
                <Button variant="secondary" size="sm" onClick={() => restoreBet(id)}>
                  Restore to Queued
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!empty && hydrated && liveCount(state.betStatus, state.draftBets) >= MAX_LIVE && (
        <p className="gos-grave__note">
          The board is at {MAX_LIVE} live — restoring a bet parks it in Queued
          until something else dies.
        </p>
      )}
    </>
  );
}
