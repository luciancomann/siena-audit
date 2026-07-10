"use client";

/**
 * Deals Board — five-stage kanban over the deal dataset ("synced from
 * HubSpot in production, seeded locally in this demo"). Drag between
 * stages persists; column headers reconcile to the visible cards; killing
 * a deal goes through the Lost tray, and a loss to a named competitor
 * writes itself into Signals. Filterable by source, type, competitor,
 * stage, and stuck — the filtered views the bets and signals link into.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Badge, Button, Card, Input, SectionHeading } from "@siena/design-system";
import {
  CHANNELS,
  COMPETITORS,
  DEAL_STAGES,
  type ChannelId,
  type CompetitorRelation,
  type Deal,
  type DealStage,
  type DealType,
} from "../_lib/data";
import {
  SEED_NOW,
  columnTotals,
  daysInStage,
  fmt,
  isFastTracked,
  money,
  moneyK,
  openDeals,
  stuckDeals,
} from "../_lib/compute";
import { useGrowthState } from "../_lib/state";

const STAGE_LABEL = Object.fromEntries(DEAL_STAGES.map((s) => [s.id, s.label])) as Record<
  DealStage,
  string
>;
const channelLabel = (id: ChannelId) => CHANNELS.find((c) => c.id === id)?.label ?? id;

function DealsBoard() {
  const [state, update, hydrated] = useGrowthState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<DealStage | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [losing, setLosing] = useState<Deal | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossCompetitor, setLossCompetitor] = useState("");

  const now = hydrated ? Date.now() : SEED_NOW;

  // filters live in the URL so bets/signals/ask can deep-link them
  const fSource = searchParams.get("source") as ChannelId | null;
  const fType = searchParams.get("type") as DealType | null;
  const fCompetitor = searchParams.get("competitor");
  const fStage = searchParams.get("stage") as DealStage | null;
  const fStuck = searchParams.get("stuck") === "1";
  const hasFilter = Boolean(fSource || fType || fCompetitor || fStage || fStuck);

  useEffect(() => {
    const target = searchParams.get("open");
    if (target) setOpenId(target);
  }, [searchParams]);

  const stuckIds = new Set(stuckDeals(state.deals, now).map((x) => x.id));
  const visible = state.deals.filter(
    (x) =>
      (!fSource || x.source === fSource) &&
      (!fType || x.type === fType) &&
      (!fCompetitor || x.competitor?.name === fCompetitor) &&
      (!fStage || x.stage === fStage) &&
      (!fStuck || stuckIds.has(x.id)),
  );
  const totals = columnTotals(visible);
  const lost = visible.filter((x) => x.lost);

  const clearFilter = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(key);
    const qs = next.toString();
    router.replace(`/growth-os/deals${qs ? `?${qs}` : ""}`);
  };

  const patchDeal = (id: string, patch: Partial<Deal>) => {
    update((prev) => ({
      deals: prev.deals.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  };

  const moveDeal = (id: string, stage: DealStage) => {
    const deal = state.deals.find((x) => x.id === id);
    if (!deal || deal.lost || deal.stage === stage) return;
    const at = new Date().toISOString();
    update((prev) => ({
      deals: prev.deals.map((x) =>
        x.id === id ? { ...x, stage, stageHistory: [...x.stageHistory, { stage, at }] } : x,
      ),
      actions: [
        ...prev.actions,
        {
          text: `Moved ${deal.company} (${moneyK(deal.size)}) to ${STAGE_LABEL[stage]} on the Deals Board.`,
          at,
        },
      ],
    }));
  };

  const confirmLoss = () => {
    if (!losing || !lossReason.trim()) return;
    const deal = losing;
    const reason = lossReason.trim();
    const competitor = lossCompetitor || null;
    const at = new Date().toISOString();
    update((prev) => ({
      deals: prev.deals.map((x) =>
        x.id === deal.id ? { ...x, lost: { reason, competitor, at } } : x,
      ),
      lostSignals: competitor
        ? [...prev.lostSignals, { text: `Lost ${deal.company} to ${competitor}: ${reason}`, at }]
        : prev.lostSignals,
      actions: [
        ...prev.actions,
        {
          text: `Marked ${deal.company} (${moneyK(deal.size)}) lost — "${reason}"${competitor ? ` — ${competitor} won it` : ""}.`,
          at,
        },
      ],
    }));
    setLosing(null);
    setOpenId(null);
  };

  const reopenDeal = (id: string) => {
    const deal = state.deals.find((x) => x.id === id);
    if (!deal?.lost) return;
    update((prev) => ({
      deals: prev.deals.map((x) => (x.id === id ? { ...x, lost: undefined } : x)),
      actions: [
        ...prev.actions,
        { text: `Reopened ${deal.company} in ${STAGE_LABEL[deal.stage]}.`, at: new Date().toISOString() },
      ],
    }));
  };

  const open = openId ? state.deals.find((x) => x.id === openId) : null;

  const filterChips: { key: string; label: string }[] = [
    ...(fSource ? [{ key: "source", label: `source: ${channelLabel(fSource)}` }] : []),
    ...(fType ? [{ key: "type", label: `type: ${fType}` }] : []),
    ...(fCompetitor ? [{ key: "competitor", label: `competitor: ${fCompetitor}` }] : []),
    ...(fStage ? [{ key: "stage", label: `stage: ${STAGE_LABEL[fStage] ?? fStage}` }] : []),
    ...(fStuck ? [{ key: "stuck", label: "stuck 14+ days" }] : []),
  ];

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The pipeline"
          title="Deals Board"
          subtitle="Every open dollar, staged. Drag a card to move it — the digest narrates the move. Losing asks for a reason; a named competitor lands in Signals."
        />
        <span className="gos-hubspot sds-mono-label">
          Synced from HubSpot in production, seeded locally in this demo
        </span>
      </div>

      {hasFilter && (
        <div className="gos-filterbar">
          <span className="gos-filterbar__label">Filtered</span>
          {filterChips.map((f) => (
            <button
              key={f.key}
              type="button"
              className="gos-filterchip"
              onClick={() => clearFilter(f.key)}
              title="Remove filter"
            >
              {f.label} ✕
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={() => router.replace("/growth-os/deals")}>
            Clear all
          </Button>
        </div>
      )}

      <div className="gos-board">
        {DEAL_STAGES.map((stage) => {
          const cards = visible.filter((x) => !x.lost && x.stage === stage.id);
          const col = totals.byStage[stage.id];
          return (
            <section
              key={stage.id}
              className={`gos-col${dropStage === stage.id ? " gos-col--dropover" : ""}`}
              aria-label={`${stage.label} column`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setDropStage(stage.id);
              }}
              onDragLeave={() => setDropStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) moveDeal(dragId, stage.id);
                setDragId(null);
                setDropStage(null);
              }}
            >
              <header className="gos-col__head">
                <span className="gos-col__name">{stage.label}</span>
                <span className="gos-col__nums">
                  {col.count} · {moneyK(col.sum)}
                </span>
              </header>
              {cards.map((deal) => (
                <Card
                  key={deal.id}
                  tone="white"
                  radius="md"
                  padding="none"
                  className={`gos-dealcard${dragId === deal.id ? " gos-dealcard--dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(deal.id);
                    // Firefox cancels drags whose data store is empty
                    e.dataTransfer.setData("text/plain", deal.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropStage(null);
                  }}
                  onClick={() => setOpenId(deal.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setOpenId(deal.id);
                  }}
                >
                  <div className="gos-dealcard__top">
                    <span className="gos-dealcard__company">{deal.company}</span>
                    <span className="gos-dealcard__size">{moneyK(deal.size)}</span>
                  </div>
                  <span className="gos-dealcard__site">{deal.website}</span>
                  <span className="gos-dealcard__buyer">
                    {deal.buyer.name} · {deal.buyer.title}
                  </span>
                  <span className="gos-dealcard__ops">
                    {fmt(deal.tickets)} tickets/mo · {deal.agents} agents
                  </span>
                  <div className="gos-dealcard__chips">
                    <Badge variant="outline" className={`gos-srcchip gos-srcchip--${deal.source}`}>
                      {channelLabel(deal.source)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`gos-typechip gos-typechip--${deal.type}`}
                    >
                      {deal.type}
                    </Badge>
                    {isFastTracked(deal) && (
                      <Badge variant="filled" className="gos-ftchip">
                        ⚡ fast-track
                      </Badge>
                    )}
                    {hydrated && stuckIds.has(deal.id) && (
                      <Badge variant="outline" className="gos-stuckchip">
                        {daysInStage(deal, now)}d in stage
                      </Badge>
                    )}
                  </div>
                  {deal.competitor && (
                    <span className="gos-dealcard__comp">
                      {deal.competitor.relation} {deal.competitor.name}
                    </span>
                  )}
                  {deal.auditReport && (
                    <Link
                      href={deal.auditReport}
                      className="gos-usedin"
                      onClick={(e) => e.stopPropagation()}
                    >
                      → View audit
                    </Link>
                  )}
                </Card>
              ))}
              {cards.length === 0 && <p className="gos-col__empty">empty</p>}
            </section>
          );
        })}
      </div>

      <Card tone="cream" radius="lg" padding="none" className="gos-losttray">
        <button
          type="button"
          className="gos-losttray__head"
          onClick={() => setLostOpen((v) => !v)}
          aria-expanded={lostOpen}
        >
          <span className="gos-losttray__title">Lost</span>
          <span className="gos-col__nums">
            {totals.lost.count} · {moneyK(totals.lost.sum)}
          </span>
          <span className="gos-losttray__toggle">{lostOpen ? "collapse" : "expand"}</span>
        </button>
        {lostOpen && (
          <ul className="gos-losttray__list">
            {lost.map((deal) => (
              <li key={deal.id} className="gos-losttray__item">
                <span className="gos-losttray__co">
                  {deal.company} · {moneyK(deal.size)}
                </span>
                <span className="gos-losttray__why">
                  &ldquo;{deal.lost!.reason}&rdquo;
                  {deal.lost!.competitor ? ` — lost to ${deal.lost!.competitor}` : ""}
                  {" · "}
                  {new Date(deal.lost!.at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <Button variant="secondary" size="sm" onClick={() => reopenDeal(deal.id)}>
                  Reopen
                </Button>
              </li>
            ))}
            {lost.length === 0 && <li className="gos-losttray__item">Nothing lost in this view.</li>}
          </ul>
        )}
      </Card>

      {open && (
        <>
          <button className="gos-scrim" aria-label="Close detail" onClick={() => setOpenId(null)} />
          <aside className="gos-detail gos-dealdetail" aria-label={`${open.company} detail`}>
            <div className="gos-detail__head">
              <h2>{open.company}</h2>
              <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
            <div className="gos-detail__row">
              <Badge variant="outline" className={`gos-typechip gos-typechip--${open.type}`}>
                {open.type}
              </Badge>
              <Badge variant="outline" className={`gos-srcchip gos-srcchip--${open.source}`}>
                {channelLabel(open.source)}
              </Badge>
              {isFastTracked(open) && (
                <Badge variant="filled" className="gos-ftchip">
                  ⚡ fast-track
                </Badge>
              )}
              {open.lost ? (
                <Badge variant="filled" className="gos-lostchip">
                  lost
                </Badge>
              ) : (
                <Badge variant="outline">
                  {STAGE_LABEL[open.stage]}
                  {hydrated ? ` · ${daysInStage(open, now)}d` : ""}
                </Badge>
              )}
            </div>

            {open.lost && (
              <p className="gos-detail__kill">
                Lost — &ldquo;{open.lost.reason}&rdquo;
                {open.lost.competitor ? ` — ${open.lost.competitor} won it.` : "."}
              </p>
            )}
            {open.auditReport && (
              <Link href={open.auditReport} className="gos-usedin">
                → View audit report{open.auditScore ? ` (score ${open.auditScore})` : ""}
              </Link>
            )}

            <h3>The account</h3>
            <div className="gos-dealform">
              <label>
                company
                <Input
                  aria-label="Company"
                  value={open.company}
                  onChange={(e) => patchDeal(open.id, { company: e.target.value })}
                />
              </label>
              <label>
                website
                <Input
                  aria-label="Website"
                  value={open.website}
                  onChange={(e) => patchDeal(open.id, { website: e.target.value })}
                />
              </label>
              <label>
                deal size ($)
                <Input
                  aria-label="Deal size"
                  type="number"
                  value={String(open.size)}
                  onChange={(e) =>
                    patchDeal(open.id, {
                      size: Math.max(0, Math.min(1_000_000, Number(e.target.value) || 0)),
                    })
                  }
                />
              </label>
              <label>
                tickets / mo
                <Input
                  aria-label="Monthly tickets"
                  type="number"
                  value={String(open.tickets)}
                  onChange={(e) =>
                    patchDeal(open.id, {
                      tickets: Math.max(0, Math.min(100_000, Number(e.target.value) || 0)),
                    })
                  }
                />
              </label>
              <label>
                agents
                <Input
                  aria-label="Agents"
                  type="number"
                  value={String(open.agents)}
                  onChange={(e) =>
                    patchDeal(open.id, {
                      agents: Math.max(0, Math.min(500, Number(e.target.value) || 0)),
                    })
                  }
                />
              </label>
              <label>
                source
                <select
                  aria-label="Source channel"
                  value={open.source}
                  onChange={(e) => patchDeal(open.id, { source: e.target.value as ChannelId })}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                type
                <select
                  aria-label="Deal type"
                  value={open.type}
                  onChange={(e) => patchDeal(open.id, { type: e.target.value as DealType })}
                >
                  <option value="new">new</option>
                  <option value="expansion">expansion</option>
                </select>
              </label>
            </div>

            <h3>The buyer</h3>
            <div className="gos-dealform">
              <label>
                full name
                <Input
                  aria-label="Buyer name"
                  value={open.buyer.name}
                  onChange={(e) =>
                    patchDeal(open.id, { buyer: { ...open.buyer, name: e.target.value } })
                  }
                />
              </label>
              <label>
                job title
                <Input
                  aria-label="Buyer title"
                  value={open.buyer.title}
                  onChange={(e) =>
                    patchDeal(open.id, { buyer: { ...open.buyer, title: e.target.value } })
                  }
                />
              </label>
              <label>
                work email
                <Input
                  aria-label="Buyer email"
                  value={open.buyer.email}
                  onChange={(e) =>
                    patchDeal(open.id, { buyer: { ...open.buyer, email: e.target.value } })
                  }
                />
              </label>
            </div>

            <h3>Competitor</h3>
            <div className="gos-dealform">
              <label>
                who&apos;s in the room
                <select
                  aria-label="Competitor"
                  value={open.competitor?.name ?? ""}
                  onChange={(e) =>
                    patchDeal(open.id, {
                      competitor: e.target.value
                        ? { name: e.target.value, relation: open.competitor?.relation ?? "in talks with" }
                        : null,
                    })
                  }
                >
                  <option value="">none</option>
                  {COMPETITORS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {open.competitor && (
                <label>
                  relation
                  <select
                    aria-label="Competitor relation"
                    value={open.competitor.relation}
                    onChange={(e) =>
                      patchDeal(open.id, {
                        competitor: {
                          ...open.competitor!,
                          relation: e.target.value as CompetitorRelation,
                        },
                      })
                    }
                  >
                    <option value="uses">uses</option>
                    <option value="in talks with">in talks with</option>
                  </select>
                </label>
              )}
            </div>

            <h3>Stage history</h3>
            <ul className="gos-stagehist">
              {open.stageHistory.map((h, i) => {
                const next = open.stageHistory[i + 1];
                const end = next ? Date.parse(next.at) : open.lost ? Date.parse(open.lost.at) : now;
                const spent = Math.max(0, Math.round((end - Date.parse(h.at)) / 86_400_000));
                return (
                  <li key={`${h.stage}-${h.at}`} className="gos-stagehist__row">
                    <span className="gos-stagehist__stage">{STAGE_LABEL[h.stage]}</span>
                    <span className="gos-stagehist__date">
                      {new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="gos-stagehist__days">
                      {hydrated ? `${spent}d${!next && !open.lost ? " and counting" : ""}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>

            <h3>Notes</h3>
            <textarea
              className="gos-dealnotes"
              aria-label="Deal notes"
              value={open.notes}
              placeholder="context the next person needs"
              onChange={(e) => patchDeal(open.id, { notes: e.target.value })}
            />

            {!open.lost && (
              <div className="gos-detail__row" style={{ justifyContent: "flex-end" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setLossReason("");
                    setLossCompetitor("");
                    setLosing(open);
                  }}
                >
                  Mark lost
                </Button>
              </div>
            )}
            {open.lost && (
              <div className="gos-detail__row" style={{ justifyContent: "flex-end" }}>
                <Button variant="secondary" size="sm" onClick={() => reopenDeal(open.id)}>
                  Reopen
                </Button>
              </div>
            )}
          </aside>
        </>
      )}

      {losing && (
        <>
          <button className="gos-scrim" aria-label="Cancel" onClick={() => setLosing(null)} />
          <div className="gos-modal" role="dialog" aria-label={`Mark ${losing.company} lost`}>
            <h2 className="gos-modal__title">Mark {losing.company} lost</h2>
            <p className="gos-modal__sub">
              One line on why — and if a competitor won it, name them. Named losses
              write themselves into Signals.
            </p>
            <Input
              aria-label="Loss reason"
              placeholder="why we lost it, one line"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
            />
            <label className="gos-losswho">
              who won it (optional)
              <select
                aria-label="Winning competitor"
                value={lossCompetitor}
                onChange={(e) => setLossCompetitor(e.target.value)}
              >
                <option value="">no one — deal just died</option>
                {COMPETITORS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="gos-modal__actions">
              <Button variant="secondary" size="sm" onClick={() => setLosing(null)}>
                Keep it open
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmLoss}
                disabled={!lossReason.trim()}
              >
                Mark lost
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function DealsPage() {
  return (
    <Suspense>
      <DealsBoard />
    </Suspense>
  );
}
