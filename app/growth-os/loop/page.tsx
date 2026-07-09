"use client";

/**
 * The Loop — the six-stage engine on one screen. Each stage card shows
 * health, inputs/outputs; clicking a stage expands its machinery (agents
 * with status dots). Answers "how does growth actually run day to day."
 */
import { useState } from "react";
import { LOOP } from "../_lib/data";
import { SectionTitle } from "../_components/ui";

export default function LoopPage() {
  const [open, setOpen] = useState<string | null>("signal");
  const stage = LOOP.find((s) => s.id === open) ?? null;

  return (
    <>
      <div>
        <h1 className="gos-pagetitle">The loop</h1>
        <p className="gos-pagesub">
          Signal → Positioning → Content → Distribution → Pipeline → Compounding. Agents
          where judgment isn&rsquo;t needed, humans where it is. Click a stage for its
          machinery.
        </p>
      </div>

      <div className="gos-loop">
        {LOOP.map((s, i) => (
          <button
            key={s.id}
            className={`gos-stage${open === s.id ? " gos-stage--open" : ""}`}
            onClick={() => setOpen(open === s.id ? null : s.id)}
            aria-expanded={open === s.id}
          >
            {i < LOOP.length - 1 && (
              <span className="gos-stage__arrow" aria-hidden="true">
                →
              </span>
            )}
            <span className="gos-stage__name">
              {s.name}
              {s.human && <span className="gos-stage__human">human</span>}
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
            </span>
          </button>
        ))}
      </div>

      {stage && (
        <>
          <SectionTitle
            title={`${stage.name} — machinery`}
            note={stage.human ? "deliberately human — the agent surfaces, we decide" : "agents, one line each"}
          />
          <div className="gos-panel gos-loopdetail">
            <ul className="gos-agents">
              {stage.agents.map((a) => (
                <li key={a.name} className="gos-agent">
                  <span className={`gos-agent__dot gos-agent__dot--${a.status}`} aria-hidden="true" />
                  <span className="gos-agent__name">{a.name}</span>
                  <span className="gos-agent__line">{a.line}</span>
                  <span className="gos-agent__status">
                    {a.status === "running" ? "running" : "needs attention"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
