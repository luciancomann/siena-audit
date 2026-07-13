"use client";

/**
 * The Loop — the six-stage engine on one screen. Each stage card shows
 * health, inputs/outputs; clicking a stage expands its machinery (agents
 * with status dots). Answers "how does growth actually run day to day."
 */
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, SectionHeading } from "@siena/design-system";
import { LOOP } from "../_lib/data";

export default function LoopPage() {
  const [open, setOpen] = useState<string | null>("signal");
  const stage = LOOP.find((s) => s.id === open) ?? null;

  return (
    <>
      <div className="gos-pagehead">
        <SectionHeading
          as="h1"
          align="left"
          eyebrow="Growth OS · The engine"
          title="The loop"
          subtitle="Signal → Positioning → Content → Distribution → Pipeline → Compounding. Agents where judgment isn't needed, humans where it is. Click a stage for its machinery."
        />
      </div>

      <div className="gos-loop">
        {LOOP.map((s, i) => (
          <Card
            key={s.id}
            tone="white"
            radius="lg"
            padding="none"
            className={`gos-stage${open === s.id ? " gos-stage--open" : ""}`}
            onClick={() => setOpen(open === s.id ? null : s.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(open === s.id ? null : s.id);
              }
            }}
            aria-expanded={open === s.id}
          >
            {i < LOOP.length - 1 && (
              <span className="gos-stage__arrow" aria-hidden="true">
                →
              </span>
            )}
            <span className="gos-stage__name">
              {s.name}
              {s.human && (
                <Badge variant="outline" className="gos-stage__human">
                  human
                </Badge>
              )}
            </span>
            <span className="gos-stage__health">
              {s.health.map((h) => (
                <span key={h.label} className={`gos-health${h.ok ? "" : " gos-health--warn"}`}>
                  <span>{h.label}</span>
                  <span className="gos-health__v">{h.value}</span>
                </span>
              ))}
            </span>
            <span className="gos-stage__io">
              <span>
                <b>in</b> {s.inputs}
              </span>
              <span>
                <b>out</b> {s.outputs}
              </span>
              {s.id === "signal" && (
                <Link
                  href="/growth-os/brain"
                  className="gos-usedin"
                  onClick={(e) => e.stopPropagation()}
                >
                  → writes to GTM Brain
                </Link>
              )}
            </span>
          </Card>
        ))}
      </div>

      {stage && (
        <>
          <div className="gos-sectionhead">
            <SectionHeading
              as="h2"
              align="left"
              eyebrow={`Stage · ${stage.name}`}
              title="The machinery"
              subtitle={
                stage.human
                  ? "Deliberately human — the agent surfaces, we decide."
                  : "Agents, one line each. Amber means someone looks today."
              }
            />
          </div>
          <Card tone="white" radius="lg" padding="none" className="gos-panel gos-loopdetail">
            <ul className="gos-agents">
              {stage.agents.map((a) => (
                <li key={a.name} className="gos-agent">
                  <span className={`gos-agent__dot gos-agent__dot--${a.status}`} aria-hidden="true" />
                  <span className="gos-agent__name">{a.name}</span>
                  <span className="gos-agent__line">{a.line}</span>
                  <span className={`gos-agent__status${a.status === "attention" ? " gos-agent__status--warn" : ""}`}>
                    {a.status === "running" ? "running" : a.note ?? "needs attention"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
