"use client";

/**
 * Bets — the ranked pipeline as an interactive board. Composite score
 * orders by default, rows drag-reorder, the WIP rule (max 3 live) is
 * enforced with a visible "Kill something first." Killing a bet asks for
 * a one-line reason and archives it to the Graveyard. Signal-drafted bets
 * merge into the ranking with editable score dials.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, Input, SectionHeading } from "@siena/design-system";
import { AUDIT_FEED, MAX_LIVE, type BetStatus, type CostToRun } from "../_lib/data";
import {
  allBets,
  compositeScore,
  liveCount,
  moneyK,
  orderedBets,
  type BoardBet,
} from "../_lib/compute";
import { useGrowthState } from "../_lib/state";
import { OwnerChip, Spark } from "../_components/ui";

const STATUS_CYCLE: BetStatus[] = ["queued", "live", "shipped", "killed"];
const STATUS_LABEL: Record<BetStatus, string> = {
  live: "Live",
  queued: "Queued",
  shipped: "Shipped",
  killed: "Killed",
};

function BetsBoard() {
  const [state, update] = useGrowthState();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<BoardBet | null>(null);
  const [killReason, setKillReason] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // deep link from Signals: /growth-os/bets?open=<id>
  useEffect(() => {
    const target = searchParams.get("open");
    if (target) setOpenId(target);
  }, [searchParams]);

  const bets = orderedBets(state.betOrder, state.draftBets);
  const statusOf = (b: BoardBet): BetStatus => state.betStatus[b.id] ?? b.defaultStatus;
  const live = liveCount(state.betStatus, state.draftBets);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const cycleStatus = (bet: BoardBet) => {
    const current = statusOf(bet);
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    if (next === "live" && live >= MAX_LIVE) {
      // WIP rule: no fourth Live — the transition is refused.
      showToast("Kill something first.");
      return;
    }
    if (next === "killed") {
      // the kill ritual: one line for the graveyard first
      setKillReason("");
      setKillTarget(bet);
      return;
    }
    update((prev) => ({ betStatus: { ...prev.betStatus, [bet.id]: next } }));
  };

  const confirmBetKill = () => {
    if (!killTarget || !killReason.trim()) return;
    const bet = killTarget;
    const score = compositeScore(bet);
    const status = statusOf(bet);
    update((prev) => ({
      betStatus: { ...prev.betStatus, [bet.id]: "killed" },
      betKills: {
        ...prev.betKills,
        [bet.id]: {
          reason: killReason.trim(),
          date: new Date().toISOString(),
          numbersAtDeath: `composite ${score} · was ${STATUS_LABEL[status]} · ${bet.timeToSignalWeeks}w to signal · ${bet.metric}`,
        },
      },
      actions: [
        ...prev.actions,
        {
          text: `Killed the "${bet.name}" bet — "${killReason.trim()}".`,
          at: new Date().toISOString(),
        },
      ],
    }));
    setKillTarget(null);
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDropId(null);
      return;
    }
    const ranked = bets.filter((b) => !b.unranked).map((b) => b.id);
    const from = ranked.indexOf(dragId);
    const to = ranked.indexOf(targetId);
    if (from === -1 || to === -1) {
      setDragId(null);
      setDropId(null);
      return;
    }
    ranked.splice(to, 0, ...ranked.splice(from, 1));
    update({ betOrder: ranked });
    setDragId(null);
    setDropId(null);
  };

  const updateDraft = (id: string, patch: Partial<(typeof state.draftBets)[number]>) => {
    update((prev) => ({
      draftBets: prev.draftBets.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  };

  const openBet = openId ? allBets(state.draftBets).find((b) => b.id === openId) : null;

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The portfolio"
          title="Bets"
          subtitle="Ranked by composite: fit×2 + compounds(3) + cost(0–2) + speed(8−weeks). Drag to overrule the math — it persists. Click a row for the full case."
        />
      </div>

      <div className="gos-betbar">
        <span className="gos-wipmeter">
          WIP
          <span className="gos-wipmeter__slots">
            {Array.from({ length: MAX_LIVE }, (_, i) => (
              <span
                key={i}
                className={`gos-wipmeter__slot${i < live ? " gos-wipmeter__slot--full" : ""}`}
              />
            ))}
          </span>
          {live} of {MAX_LIVE} live
        </span>
        {toast && (
          <Badge variant="filled" className="gos-wiptoast">
            <span role="alert">{toast}</span>
          </Badge>
        )}
        {state.betOrder && (
          <Button variant="secondary" size="sm" onClick={() => update({ betOrder: null })}>
            Reset to score order
          </Button>
        )}
      </div>

      <div className="gos-bets">
        {bets.map((bet) => {
          const status = statusOf(bet);
          const score = compositeScore(bet);
          return (
            <Card
              key={bet.id}
              tone="white"
              radius="lg"
              padding="none"
              className={`gos-bet${bet.unranked ? " gos-bet--unranked" : ""}${
                dragId === bet.id ? " gos-bet--dragging" : ""
              }${dropId === bet.id && dragId !== bet.id ? " gos-bet--dropover" : ""}`}
              draggable={!bet.unranked}
              onDragStart={(e) => {
                setDragId(bet.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropId(null);
              }}
              onDragOver={(e) => {
                if (bet.unranked || !dragId) return;
                e.preventDefault();
                setDropId(bet.id);
              }}
              onDrop={() => onDrop(bet.id)}
              onClick={() => setOpenId(bet.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpenId(bet.id);
              }}
            >
              <span className="gos-bet__grab" aria-hidden="true">
                {bet.unranked ? "·" : "⠿"}
              </span>
              <div className="gos-bet__head">
                <span className="gos-bet__name">
                  {bet.name}
                  {bet.unranked ? (
                    <Badge variant="filled" className="gos-unranked-tag">
                      {bet.unrankedLabel}
                    </Badge>
                  ) : (
                    <span className="gos-bet__score">score {score}</span>
                  )}
                  {bet.draft && (
                    <Badge variant="outline" className="gos-draft-tag">
                      drafted from signal
                    </Badge>
                  )}
                </span>
                <span className="gos-bet__what">{bet.what}</span>
              </div>
              <div className="gos-bet__mid">
                {bet.unranked ? (
                  <Badge variant="outline" className="gos-status gos-status--gate">
                    Gate
                  </Badge>
                ) : (
                  <button
                    className={`sds-badge sds-badge--outline gos-status gos-status--${status}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleStatus(bet);
                    }}
                    title="Click to change status"
                  >
                    {STATUS_LABEL[status]}
                  </button>
                )}
                <OwnerChip name={bet.owner} />
              </div>
              <div className="gos-bet__dials">
                <span className="gos-dial">
                  <span className="gos-dial__k">Compounds</span>
                  <span className={`gos-dial__v${bet.compounds ? " gos-dial__v--good" : ""}`}>
                    {bet.compounds ? "yes" : "no"}
                  </span>
                </span>
                <span className="gos-dial">
                  <span className="gos-dial__k">Signal in</span>
                  <span className="gos-dial__v">{bet.timeToSignalWeeks}w</span>
                </span>
                <span className="gos-dial">
                  <span className="gos-dial__k">Cost to run</span>
                  <span className="gos-dial__v">{bet.costToRun}</span>
                </span>
                <span className="gos-dial">
                  <span className="gos-dial__k">Category fit</span>
                  <span className="gos-dial__v">{bet.categoryFit} / 5</span>
                </span>
                <Spark points={bet.spark} />
              </div>
              <span className="gos-bet__metric">
                moves: {bet.metric}
                {bet.currentValue && status === "live" && (
                  <span className="gos-bet__now"> · now {bet.currentValue}</span>
                )}
              </span>
            </Card>
          );
        })}
      </div>

      {openBet && (
        <>
          <button className="gos-scrim" aria-label="Close detail" onClick={() => setOpenId(null)} />
          <aside className="gos-detail" aria-label={`${openBet.name} detail`}>
            <div className="gos-detail__head">
              <h2>{openBet.name}</h2>
              <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
            <div className="gos-detail__row">
              {openBet.unranked ? (
                <Badge variant="outline" className="gos-status gos-status--gate">
                  Gate
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`gos-status gos-status--${statusOf(openBet)}`}
                >
                  {STATUS_LABEL[statusOf(openBet)]}
                </Badge>
              )}
              <OwnerChip name={openBet.owner} />
              {openBet.unranked ? (
                <Badge variant="filled" className="gos-unranked-tag">
                  {openBet.unrankedLabel}
                </Badge>
              ) : (
                <span className="gos-bet__score">composite {compositeScore(openBet)}</span>
              )}
            </div>

            {state.betKills[openBet.id] && (
              <p className="gos-detail__kill">
                Killed {new Date(state.betKills[openBet.id].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} —
                &ldquo;{state.betKills[openBet.id].reason}&rdquo;. Restore it from the
                Graveyard.
              </p>
            )}

            {openBet.draft && openBet.sourceSignal && (
              <>
                <h3>Source signal</h3>
                <p className="gos-detail__next">{openBet.sourceSignal}</p>
                <h3>Score dials — draft, tune them</h3>
                <div className="gos-draftdials">
                  <label>
                    compounds
                    <select
                      value={openBet.compounds ? "yes" : "no"}
                      onChange={(e) => updateDraft(openBet.id, { compounds: e.target.value === "yes" })}
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </select>
                  </label>
                  <label>
                    signal in (weeks)
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={openBet.timeToSignalWeeks}
                      onChange={(e) =>
                        updateDraft(openBet.id, {
                          timeToSignalWeeks: Math.max(1, Math.min(16, Number(e.target.value) || 4)),
                        })
                      }
                    />
                  </label>
                  <label>
                    cost to run
                    <select
                      value={openBet.costToRun}
                      onChange={(e) => updateDraft(openBet.id, { costToRun: e.target.value as CostToRun })}
                    >
                      <option value="low">low</option>
                      <option value="med">med</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                  <label>
                    category fit
                    <select
                      value={openBet.categoryFit}
                      onChange={(e) =>
                        updateDraft(openBet.id, { categoryFit: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            {openBet.id === "audit" && (
              <>
                <h3>Live from the audit tool</h3>
                <div className="gos-auditfeed">
                  <span className="gos-auditfeed__cell">
                    <span className="gos-auditfeed__v">{AUDIT_FEED.runsThisWeek}</span>
                    <span className="gos-auditfeed__k">runs this week</span>
                  </span>
                  <span className="gos-auditfeed__cell">
                    <span className="gos-auditfeed__v">{AUDIT_FEED.leadsCreated}</span>
                    <span className="gos-auditfeed__k">leads created</span>
                  </span>
                  <span className="gos-auditfeed__cell">
                    <span className="gos-auditfeed__v">{AUDIT_FEED.fastTracked}</span>
                    <span className="gos-auditfeed__k">fast-tracked</span>
                  </span>
                  <span className="gos-auditfeed__cell">
                    <span className="gos-auditfeed__v">{moneyK(AUDIT_FEED.pipelineAttributed)}</span>
                    <span className="gos-auditfeed__k">pipeline attributed MTD</span>
                  </span>
                </div>
              </>
            )}

            <h3>What</h3>
            <p>{openBet.whatFull}</p>
            <h3>Why</h3>
            <p>{openBet.why}</p>
            <h3>Kill criteria</h3>
            <p className="gos-detail__kill">{openBet.killCriteria}</p>
            <h3>Next action</h3>
            <p className="gos-detail__next">{openBet.nextAction}</p>
            <h3>{openBet.metric} — last 12 weeks</h3>
            <Spark points={openBet.spark} height={40} />
          </aside>
        </>
      )}

      {killTarget && (
        <>
          <button className="gos-scrim" aria-label="Cancel" onClick={() => setKillTarget(null)} />
          <div className="gos-modal" role="dialog" aria-label={`Kill ${killTarget.name}`}>
            <h2 className="gos-modal__title">Kill &ldquo;{killTarget.name}&rdquo;</h2>
            <p className="gos-modal__sub">
              One line for the graveyard — the numbers at death are recorded
              automatically. Restorable later.
            </p>
            <Input
              aria-label="Kill reason"
              placeholder="why it dies, one line"
              value={killReason}
              onChange={(e) => setKillReason(e.target.value)}
            />
            <div className="gos-modal__actions">
              <Button variant="secondary" size="sm" onClick={() => setKillTarget(null)}>
                Keep it
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmBetKill}
                disabled={!killReason.trim()}
              >
                Kill it
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function BetsPage() {
  return (
    <Suspense>
      <BetsBoard />
    </Suspense>
  );
}
