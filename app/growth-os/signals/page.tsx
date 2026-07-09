"use client";

/**
 * Signals — the insight repository. Objections ranked by frequency,
 * winning language per persona (tabs), competitor mentions. "→ used in"
 * links show the loop actually connecting to bets and content.
 */
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, PersonaTabs, SectionHeading } from "@siena/design-system";
import { COMPETITORS, OBJECTIONS, PERSONA_LANGUAGE } from "../_lib/data";
import { TrendGlyph } from "../_components/ui";

const PERSONAS = Object.keys(PERSONA_LANGUAGE);

export default function SignalsPage() {
  const [personaIndex, setPersonaIndex] = useState(0);
  const persona = PERSONAS[personaIndex];

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
            {OBJECTIONS.map((o) => (
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
                </div>
              </div>
            ))}
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
              {COMPETITORS.map((c) => (
                <div key={c.name} className="gos-sig">
                  <div className="gos-sig__top">
                    <span className="gos-sig__text">{c.name}</span>
                    <Badge variant="outline" className="gos-count">{c.mentions}</Badge>
                    <TrendGlyph trend={c.trend} />
                  </div>
                  <span className="gos-phrase__note">{c.note}</span>
                  <div className="gos-sig__meta">
                    <span>
                      {c.source} · {c.date}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
