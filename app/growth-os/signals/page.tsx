"use client";

/**
 * GTM Brain — Signals restructured as file-based memory. Four blocks:
 * the proposals tray (agents propose, humans approve), the core brain.md
 * file (editable, versioned), the context files (signal library,
 * battlecards, messaging matrix — owners, versions, stale chips), and
 * the outputs archive (every shipped asset with the files that produced
 * it). All the old Signals data is preserved inside the files.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Input, SectionHeading } from "@siena/design-system";
import {
  BATTLECARDS,
  BRAIN_FILES,
  BRAIN_PROPOSALS,
  BRAIN_READERS,
  COMPETITORS,
  CONVERSION_SIGNALS,
  MESSAGING_MATRIX,
  NOISE_IGNORED,
  OBJECTIONS,
  type BrainProposal,
} from "../_lib/data";
import { OUTPUTS_LEDGER } from "../_lib/data";
import {
  SEED_NOW,
  activeDealsForCompetitor,
  allBets,
  competitorLossBumps,
  draftFromSignal,
  isStaleFile,
  lostDeals,
  pendingProposals,
} from "../_lib/compute";
import { useGrowthState, type GrowthState } from "../_lib/state";
import { TrendGlyph } from "../_components/ui";

const fileSeed = (id: string) => BRAIN_FILES.find((f) => f.id === id)!;

/** Editable file field — local draft wins while typing, commits on blur. */
function FileField({
  value,
  onCommit,
  rows,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  rows?: number;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  if (rows) {
    return (
      <textarea
        className="gos-file__edit"
        aria-label={ariaLabel}
        rows={rows}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <input
      className="gos-file__edit gos-file__edit--line"
      aria-label={ariaLabel}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

function fmtDate(iso: string): string {
  // the dataset is UTC-anchored; without an explicit zone, SSR (UTC build) and
  // viewers west of UTC-9:30 would disagree and break hydration
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** filename + front matter + stale chip + expandable version history */
function FileHead({
  id,
  state,
  now,
  label,
}: {
  id: string;
  state: GrowthState;
  now: number;
  label?: string;
}) {
  const [histOpen, setHistOpen] = useState(false);
  const seed = fileSeed(id);
  const live = state.brainFiles[id] ?? { version: seed.version, updatedAt: seed.updatedAt, history: [] };
  const stale = isStaleFile(live.updatedAt, now);
  return (
    <div className="gos-file__head">
      <span className="gos-file__name">{seed.path}</span>
      <span className="gos-file__meta">
        owner: {seed.owner} · updated {fmtDate(live.updatedAt)} ·{" "}
        <button type="button" className="gos-file__vbtn" onClick={() => setHistOpen((v) => !v)}>
          v{live.version} {histOpen ? "▾" : "▸"}
        </button>
      </span>
      {stale && (
        <Badge variant="filled" className="gos-stalechip">
          stale — {Math.floor((now - Date.parse(live.updatedAt)) / 86_400_000)}d
        </Badge>
      )}
      {label && <span className="gos-file__label sds-mono-label">{label}</span>}
      {histOpen && (
        <ul className="gos-file__hist">
          {[...live.history].reverse().map((h) => (
            <li key={`${h.version}-${h.at}`}>
              v{h.version} · {fmtDate(h.at)} — {h.note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GtmBrainPage() {
  const [state, update, hydrated] = useGrowthState();
  const router = useRouter();
  const now = hydrated ? Date.now() : SEED_NOW;
  const [rejecting, setRejecting] = useState<BrainProposal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const lossBumps = competitorLossBumps(state.deals);
  const pending = pendingProposals(state.proposals);
  const decided = BRAIN_PROPOSALS.filter((p) => state.proposals[p.id]);
  const allObjections = [...OBJECTIONS, ...state.extraObjections];

  const bumpFile = (prev: GrowthState, id: string, note: string) => {
    const cur = prev.brainFiles[id];
    const at = new Date().toISOString();
    return {
      ...prev.brainFiles,
      [id]: {
        version: cur.version + 1,
        updatedAt: at,
        history: [...cur.history, { version: cur.version + 1, at, note }],
      },
    };
  };

  const approve = (p: BrainProposal) => {
    const at = new Date().toISOString();
    const stamp = `approved by Lucian · ${fmtDate(at)}`;
    update((prev) => ({
      proposals: { ...prev.proposals, [p.id]: { status: "approved", at } },
      brainFiles: bumpFile(prev, p.fileId, `${p.title.split("→")[1]?.trim() ?? "proposal applied"} — ${stamp}`),
      ...(p.fileId === "decagon" ? { killLines: { ...prev.killLines, decagon: p.proposed } } : {}),
      ...(p.objection ? { extraObjections: [...prev.extraObjections, p.objection] } : {}),
      actions: [
        ...prev.actions,
        { text: `Approved the "${p.filePath}" proposal in the GTM Brain — ${stamp}.`, at },
      ],
    }));
  };

  const confirmReject = () => {
    if (!rejecting || !rejectReason.trim()) return;
    const p = rejecting;
    const at = new Date().toISOString();
    update((prev) => ({
      proposals: {
        ...prev.proposals,
        [p.id]: { status: "rejected", at, reason: rejectReason.trim() },
      },
      actions: [
        ...prev.actions,
        { text: `Rejected the "${p.filePath}" proposal — "${rejectReason.trim()}".`, at },
      ],
    }));
    setRejecting(null);
  };

  const editBrain = (patch: Partial<GrowthState["brainDoc"]>, changed: boolean) => {
    if (!changed) return;
    update((prev) => ({
      brainDoc: { ...prev.brainDoc, ...patch },
      brainFiles: bumpFile(prev, "brain", "edited by Lucian"),
    }));
  };

  const draftBet = (objection: string) => {
    const existingId = state.signalDrafts[objection];
    if (existingId) {
      router.push(`/growth-os/bets?open=${existingId}`);
      return;
    }
    const draft = draftFromSignal(objection);
    update((prev) => ({
      draftBets: prev.draftBets.some((d) => d.id === draft.id)
        ? prev.draftBets
        : [...prev.draftBets, draft],
      signalDrafts: { ...prev.signalDrafts, [objection]: draft.id },
      actions: [
        ...prev.actions,
        {
          text: `Drafted a bet from the "${draft.sourceSignal}" signal — "${draft.name}", queued.`,
          at: new Date().toISOString(),
        },
      ],
    }));
    router.push(`/growth-os/bets?open=${draft.id}`);
  };

  const liveBets = allBets(state.draftBets).filter(
    (b) => (state.betStatus[b.id] ?? b.defaultStatus) === "live",
  );

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The memory"
          title="GTM Brain"
          subtitle="Signals was a list. This is memory — agents write what they learn, read before they act, and every output is archived with the context that produced it."
        />
        <span className="gos-hubspot sds-mono-label">
          GitHub is the write layer. This is the read layer. Agents read and write; humans review.
        </span>
        <span className="gos-brain-owners">Every file has a named owner. Ops owns the taxonomy.</span>
      </div>

      {/* ---- block 1: proposals tray ---- */}
      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="01 · Pending review"
          title="Proposals"
          subtitle="The signal agent proposes edits it cannot apply itself. Diffs, evidence, and a human decision."
        />
      </div>
      {pending.length === 0 ? (
        <Card tone="cream" radius="lg" className="gos-prop gos-prop--empty">
          <p className="gos-prop__none">
            Nothing pending — the tray is clear. The signal agent files the next proposal
            when the evidence clears the bar.
          </p>
        </Card>
      ) : (
        <div className="gos-props">
          {pending.map((p) => (
            <Card key={p.id} tone="white" radius="lg" className="gos-prop">
              <div className="gos-prop__head">
                <span className="gos-prop__title">{p.title}</span>
                <span className="gos-prop__file">{p.filePath}</span>
              </div>
              <div className="gos-prop__diff">
                <div className="gos-prop__line gos-prop__line--del">
                  <span aria-hidden="true">−</span> {p.current}
                </div>
                <div className="gos-prop__line gos-prop__line--add">
                  <span aria-hidden="true">+</span> {p.proposed}
                </div>
              </div>
              <ul className="gos-prop__evidence">
                {p.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <div className="gos-prop__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRejectReason("");
                    setRejecting(p);
                  }}
                >
                  Reject
                </Button>
                <Button variant="primary" size="sm" onClick={() => approve(p)}>
                  Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {decided.length > 0 && (
        <div className="gos-prop__archive">
          {decided.map((p) => {
            const d = state.proposals[p.id];
            return (
              <p key={p.id} className={`gos-prop__decided gos-prop__decided--${d.status}`}>
                {d.status === "approved" ? "✓ approved" : "✕ rejected"} · {p.filePath} —{" "}
                {p.title}
                {d.reason ? ` — "${d.reason}"` : ""} · {fmtDate(d.at)}
              </p>
            );
          })}
        </div>
      )}
      <p className="gos-brain-motto">
        The brain proposes. A human approves. Confident and wrong is the failure mode we
        built against.
      </p>

      {/* ---- block 2: the core file ---- */}
      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="02 · The core file"
          title="brain.md"
          subtitle="Two hundred words every agent loads before it does anything. Editing bumps the version."
        />
      </div>
      <Card tone="white" radius="lg" padding="none" className="gos-panel gos-file gos-brainfile">
        <FileHead id="brain" state={state} now={now} label="every agent reads this first" />
        <div className="gos-file__body">
          <h3 className="gos-file__h">## ICP</h3>
          <FileField
            ariaLabel="ICP"
            rows={2}
            value={state.brainDoc.icp}
            onCommit={(next) => editBrain({ icp: next }, true)}
          />
          <h3 className="gos-file__h">## Positioning</h3>
          <FileField
            ariaLabel="Positioning"
            rows={2}
            value={state.brainDoc.positioning}
            onCommit={(next) => editBrain({ positioning: next }, true)}
          />
          <h3 className="gos-file__h">## Current priorities — auto-pulled from the Live bets</h3>
          <ul className="gos-file__list">
            {liveBets.map((b) => (
              <li key={b.id}>
                {b.name} — {b.metric}
              </li>
            ))}
          </ul>
          <h3 className="gos-file__h">## Voice rules</h3>
          {state.brainDoc.voice.map((rule, i) => (
            <FileField
              key={`voice-${i}`}
              ariaLabel={`Voice rule ${i + 1}`}
              value={rule}
              onCommit={(next) => {
                const voice = [...state.brainDoc.voice];
                voice[i] = next;
                editBrain({ voice }, true);
              }}
            />
          ))}
        </div>
        <div className="gos-file__readby">
          read by:{" "}
          {BRAIN_READERS.map((r) => (
            <Badge key={r} variant="outline" className="gos-reader">
              {r}
            </Badge>
          ))}
        </div>
      </Card>

      {/* ---- block 3: context files ---- */}
      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="03 · Context files"
          title="What the agents read"
          subtitle="The signal library, the battlecards, the messaging matrix — versioned, owned, stale-checked."
        />
      </div>

      <Card tone="white" radius="lg" padding="none" className="gos-panel gos-file">
        <FileHead id="library" state={state} now={now} />
        <div className="gos-file__body">
          <h3 className="gos-file__h">## Objections, ranked by frequency</h3>
          {allObjections.map((o) => {
            const draftId = state.signalDrafts[o.text];
            const draft = draftId ? state.draftBets.find((d) => d.id === draftId) : null;
            return (
              <div key={o.text} className="gos-sig">
                <div className="gos-sig__top">
                  <span className="gos-sig__text">{o.text}</span>
                  <Badge variant="outline" className="gos-count">{o.count}</Badge>
                  <TrendGlyph trend={o.trend} />
                  {o.tag && (
                    <Badge variant="filled" className="gos-opentag">
                      {o.tag}
                    </Badge>
                  )}
                </div>
                <div className="gos-sig__meta">
                  <span>
                    {o.source} · {o.date}
                  </span>
                  {o.usedIn && (
                    <Link href={o.usedIn.href} className="gos-usedin">
                      → used in {o.usedIn.label}
                    </Link>
                  )}
                  {draft ? (
                    <Link href={`/growth-os/bets?open=${draft.id}`} className="gos-usedin">
                      → drafted: {draft.name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="gos-usedin gos-draftbtn"
                      onClick={() => draftBet(o.text)}
                    >
                      → draft a bet
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="gos-library__split">
            <div>
              <h3 className="gos-file__h">## Conversion signals — counts this month</h3>
              <ul className="gos-file__list">
                {CONVERSION_SIGNALS.map((c) => (
                  <li key={c.label}>
                    {c.label} <span className="gos-library__count">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="gos-file__h">## Noise we ignore</h3>
              <ul className="gos-file__list gos-file__list--noise">
                {NOISE_IGNORED.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <div className="gos-battlecards">
        {BATTLECARDS.map((b) => {
          const losses = lostDeals(state.deals).filter((x) => x.lost?.competitor === b.competitor);
          const comp = COMPETITORS.find((c) => c.name === b.competitor);
          const activeDeals = activeDealsForCompetitor(state.deals, b.competitor);
          return (
            <Card key={b.id} tone="white" radius="lg" padding="none" className="gos-panel gos-file gos-battlecard">
              <FileHead id={b.id} state={state} now={now} />
              <div className="gos-file__body">
                <p className="gos-bc__row">
                  <b>where they win</b> {b.theyWin}
                </p>
                <p className="gos-bc__row">
                  <b>where we win</b> {b.weWin}
                </p>
                <p className="gos-bc__kill">
                  <b>kill line</b> &ldquo;{state.killLines[b.id] ?? b.killLine}&rdquo;
                </p>
                <div className="gos-sig__meta">
                  <span>
                    {losses.length} deal{losses.length === 1 ? "" : "s"} lost to them ·{" "}
                    {comp ? comp.mentions + (lossBumps[b.competitor] ?? 0) : 0} mentions this month
                  </span>
                  {activeDeals.length > 0 && (
                    <Link
                      href={`/growth-os/deals?competitor=${encodeURIComponent(b.competitor)}`}
                      className="gos-usedin"
                    >
                      → {activeDeals.length} active deal{activeDeals.length === 1 ? "" : "s"}
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {state.lostSignals.length > 0 && (
        <Card tone="cream" radius="lg" padding="none" className="gos-panel gos-losslog">
          <span className="sds-mono-label gos-losslog__tag">From the board</span>
          {state.lostSignals.map((entry) => (
            <div key={entry.at} className="gos-sig">
              <div className="gos-sig__top">
                <span className="gos-sig__text">{entry.text}</span>
              </div>
              <div className="gos-sig__meta">
                <span>Deals Board · {fmtDate(entry.at)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card tone="white" radius="lg" padding="none" className="gos-panel gos-file">
        <FileHead id="matrix" state={state} now={now} />
        <div className="gos-file__body">
          <h3 className="gos-file__h">## Persona × top objection → the approved line</h3>
          <div className="gos-matrix">
            {MESSAGING_MATRIX.map((row) => (
              <div key={row.persona} className="gos-matrix__row">
                <span className="gos-matrix__persona">{row.persona}</span>
                <div className="gos-matrix__cell">
                  <span className="gos-matrix__objection">{row.objection}</span>
                  <span className="gos-matrix__line">{row.line}</span>
                  {row.alsoWins.map((w) => (
                    <span key={w} className="gos-matrix__also">
                      {w}
                    </span>
                  ))}
                  <Link href={row.usedIn.href} className="gos-usedin">
                    → used in {row.usedIn.label}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ---- block 4: outputs archive ---- */}
      <div className="gos-sectionhead">
        <SectionHeading
          as="h2"
          align="left"
          eyebrow="04 · Outputs archive"
          title="Six months of this is the feedback loop."
          subtitle="Every shipped asset, newest first — with the context files that produced it and the number it moved."
        />
      </div>
      <Card tone="white" radius="lg" padding="none" className="gos-panel gos-ledger">
        {(archiveOpen ? OUTPUTS_LEDGER : OUTPUTS_LEDGER.slice(0, 4)).map((o) => (
          <div key={`${o.date}-${o.asset}`} className="gos-ledger__row">
            <span className="gos-ledger__date">{o.date}</span>
            <div className="gos-ledger__main">
              <span className="gos-ledger__asset">{o.asset}</span>
              <span className="gos-ledger__from">
                from {o.producedBy.map((f) => (
                  <code key={f}>{f}</code>
                ))}
              </span>
            </div>
            <span className="gos-ledger__perf">{o.perf ?? "no number yet"}</span>
          </div>
        ))}
        {OUTPUTS_LEDGER.length > 4 && (
          <button
            type="button"
            className="gos-ledger__more"
            onClick={() => setArchiveOpen((v) => !v)}
          >
            {archiveOpen ? "collapse" : `show all ${OUTPUTS_LEDGER.length}`}
          </button>
        )}
      </Card>

      {/* ---- reject modal ---- */}
      {rejecting && (
        <>
          <button className="gos-scrim" aria-label="Cancel" onClick={() => setRejecting(null)} />
          <div className="gos-modal" role="dialog" aria-label="Reject proposal">
            <h2 className="gos-modal__title">Reject the proposal</h2>
            <p className="gos-modal__sub">
              {rejecting.filePath} — one line on why. The reason is archived with the
              proposal so the agent learns the bar.
            </p>
            <Input
              aria-label="Rejection reason"
              placeholder="why it doesn't clear the bar, one line"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="gos-modal__actions">
              <Button variant="secondary" size="sm" onClick={() => setRejecting(null)}>
                Keep it pending
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
              >
                Reject it
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
