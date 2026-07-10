"use client";

/**
 * Signals — the insight repository. Objections ranked by frequency,
 * winning language per persona (tabs), competitor mentions. "→ used in"
 * links show the loop actually connecting to bets and content, and every
 * objection can be drafted straight onto the Bets board.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Card, PersonaTabs, SectionHeading } from "@siena/design-system";
import { COMPETITORS, OBJECTIONS, PERSONA_LANGUAGE } from "../_lib/data";
import { activeDealsForCompetitor, competitorLossBumps, draftFromSignal } from "../_lib/compute";
import { useGrowthState } from "../_lib/state";
import { TrendGlyph } from "../_components/ui";

const PERSONAS = Object.keys(PERSONA_LANGUAGE);

export default function SignalsPage() {
  const [state, update] = useGrowthState();
  const router = useRouter();
  const [personaIndex, setPersonaIndex] = useState(0);
  const persona = PERSONAS[personaIndex];
  const lossBumps = competitorLossBumps(state.deals);

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

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The repo"
          title="Signals"
          subtitle="The living insight repo — refreshed by the signal agents, read before anything ships. Counts are this month; arrows are the trend."
        />
      </div>

      <div className="gos-signals">
        <div>
          <div className="gos-sectionhead" style={{ marginBottom: 16 }}>
            <SectionHeading as="h2" align="left" eyebrow="01 · Objections" title="Ranked by frequency" />
          </div>
          <Card tone="white" radius="lg" padding="none" className="gos-panel">
            {OBJECTIONS.map((o) => {
              const draftId = state.signalDrafts[o.text];
              const draft = draftId ? state.draftBets.find((d) => d.id === draftId) : null;
              return (
                <div key={o.text} className="gos-sig">
                  <div className="gos-sig__top">
                    <span className="gos-sig__text">{o.text}</span>
                    <Badge variant="outline" className="gos-count">{o.count}</Badge>
                    <TrendGlyph trend={o.trend} />
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
          </Card>
        </div>

        <div className="gos-signals__stack">
          <div>
            <div className="gos-sectionhead" style={{ marginBottom: 16 }}>
              <SectionHeading as="h2" align="left" eyebrow="02 · Language" title="What wins, per persona" />
            </div>
            <Card tone="white" radius="lg" padding="none" className="gos-panel">
              <PersonaTabs
                className="gos-personatabs"
                label="Persona"
                personas={PERSONAS.map((name) => ({ name }))}
                activeIndex={personaIndex}
                onChange={setPersonaIndex}
              />
              {PERSONA_LANGUAGE[persona].map((ph) => (
                <div key={ph.phrase} className="gos-sig">
                  <div className="gos-sig__top">
                    <span className="gos-sig__text">{ph.phrase}</span>
                  </div>
                  <span className="gos-phrase__note">{ph.note}</span>
                  <div className="gos-sig__meta">
                    <span>
                      {ph.source} · {ph.date}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <div>
            <div className="gos-sectionhead" style={{ marginBottom: 16 }}>
              <SectionHeading as="h2" align="left" eyebrow="03 · Competitors" title="Named this month" />
            </div>
            <Card tone="white" radius="lg" padding="none" className="gos-panel">
              {COMPETITORS.map((c) => {
                const activeDeals = activeDealsForCompetitor(state.deals, c.name);
                return (
                  <div key={c.name} className="gos-sig">
                    <div className="gos-sig__top">
                      <span className="gos-sig__text">{c.name}</span>
                      <Badge variant="outline" className="gos-count">
                        {c.mentions + (lossBumps[c.name] ?? 0)}
                      </Badge>
                      <TrendGlyph trend={c.trend} />
                    </div>
                    <span className="gos-phrase__note">{c.note}</span>
                    <div className="gos-sig__meta">
                      <span>
                        {c.source} · {c.date}
                      </span>
                      {activeDeals.length > 0 && (
                        <Link
                          href={`/growth-os/deals?competitor=${encodeURIComponent(c.name)}`}
                          className="gos-usedin"
                        >
                          → {activeDeals.length} active deal{activeDeals.length === 1 ? "" : "s"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
              {state.lostSignals.length > 0 && (
                <div className="gos-losslog">
                  <span className="sds-mono-label gos-losslog__tag">From the board</span>
                  {state.lostSignals.map((entry) => (
                    <div key={entry.at} className="gos-sig">
                      <div className="gos-sig__top">
                        <span className="gos-sig__text">{entry.text}</span>
                      </div>
                      <div className="gos-sig__meta">
                        <span>
                          Deals Board ·{" "}
                          {new Date(entry.at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
