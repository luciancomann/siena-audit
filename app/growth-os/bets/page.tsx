"use client";

/**
 * Bets — the ranked pipeline as an interactive board. Composite score
 * orders by default, rows drag-reorder, the WIP rule (max 3 live) is
 * enforced with a visible "Kill something first." Clicking a bet opens
 * the detail panel with the full what/why, kill criteria, next action,
 * and a synthetic sparkline. The audit bet's numbers come from the tool.
 */
import { useEffect, useRef, useState } from "react";
import { AUDIT_FEED, BETS, MAX_LIVE, type Bet, type BetStatus } from "../_lib/data";
import { compositeScore, liveCount, moneyK, orderedBets } from "../_lib/compute";
import { useGrowthState } from "../_lib/state";
import { OwnerChip, SectionTitle, Spark } from "../_components/ui";

const STATUS_CYCLE: BetStatus[] = ["queued", "live", "shipped", "killed"];
const STATUS_LABEL: Record<BetStatus, string> = {
  live: "Live",
  queued: "Queued",
  shipped: "Shipped",
  killed: "Killed",
};

export default function BetsPage() {
  const [state, update] = useGrowthState();
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const bets = orderedBets(state.betOrder);
  const statusOf = (b: Bet): BetStatus => state.betStatus[b.id] ?? b.defaultStatus;
  const live = liveCount(state.betStatus);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const cycleStatus = (bet: Bet) => {
    const current = statusOf(bet);
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    if (next === "live" && live >= MAX_LIVE) {
      // WIP rule: no fourth Live — the transition is refused.
      showToast("Kill something first.");
      return;
    }
    update((prev) => ({ betStatus: { ...prev.betStatus, [bet.id]: next } }));
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

  const openBet = openId ? BETS.find((b) => b.id === openId) : null;

  return (
    <>
      <div>
        <h1 className="gos-pagetitle">Bets</h1>
        <p className="gos-pagesub">
          Ranked by composite: fit×2 + compounds(3) + cost(0–2) + speed(8−weeks). Drag to
          overrule the math — it persists. Click a row for the full case.
        </p>
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
        {toast && <span className="gos-wiptoast" role="alert">{toast}</span>}
        {state.betOrder && (
          <button className="gos-resetorder" onClick={() => update({ betOrder: null })}>
            Reset to score order
          </button>
        )}
      </div>

      <div className="gos-bets">
        {bets.map((bet) => {
          const status = statusOf(bet);
          const score = compositeScore(bet);
          return (
            <div
              key={bet.id}
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
                    <span className="gos-chip gos-unranked-tag">{bet.unrankedLabel}</span>
                  ) : (
                    <span className="gos-bet__score">score {score}</span>
                  )}
                </span>
                <span className="gos-bet__what">{bet.what}</span>
              </div>
              <div className="gos-bet__mid">
                {bet.unranked ? (
                  <span className="gos-status gos-status--gate" title="Priced option — gated, not queued for a WIP slot">
                    Gate
                  </span>
                ) : (
                  <button
                    className={`gos-status gos-status--${status}`}
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
            </div>
          );
        })}
      </div>

      {openBet && (
        <>
          <button className="gos-scrim" aria-label="Close detail" onClick={() => setOpenId(null)} />
          <aside className="gos-detail" aria-label={`${openBet.name} detail`}>
            <div className="gos-detail__head">
              <h2>{openBet.name}</h2>
              <button className="gos-detail__close" onClick={() => setOpenId(null)}>
                Esc
              </button>
            </div>
            <div className="gos-detail__row">
              {openBet.unranked ? (
                <span className="gos-status gos-status--gate">Gate</span>
              ) : (
                <span className={`gos-status gos-status--${statusOf(openBet)}`}>
                  {STATUS_LABEL[statusOf(openBet)]}
                </span>
              )}
              <OwnerChip name={openBet.owner} />
              {openBet.unranked ? (
                <span className="gos-chip gos-unranked-tag">{openBet.unrankedLabel}</span>
              ) : (
                <span className="gos-bet__score">composite {compositeScore(openBet)}</span>
              )}
            </div>

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
    </>
  );
}
