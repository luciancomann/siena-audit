"use client";

/**
 * Ask Growth — the cmd-K command bar. Answers plain-language questions from
 * the LIVE state (current numbers, after any edits), never canned strings:
 * ~12 pattern-matched intents computed in compute.ts. Unmatched questions go
 * to /api/growth-os/ask (Claude, when a key is configured); without a key it
 * lists what it can answer.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@siena/design-system";
import { ASK_INTENTS, answerQuestion, type AskAnswer } from "../_lib/compute";
import { useGrowthState } from "../_lib/state";

export function AskGrowth() {
  const [state] = useGrowthState();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setAnswer(null);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const ask = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const local = answerQuestion(trimmed, stateRef.current);
    if (local) {
      setAnswer(local);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/growth-os/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, state: stateRef.current }),
      });
      const data = (await res.json()) as { ok: boolean; text?: string };
      if (res.ok && data.ok && data.text) {
        setAnswer({ text: data.text });
      } else {
        setAnswer({
          text: `I can answer about: ${ASK_INTENTS.join(" · ")}`,
        });
      }
    } catch {
      setAnswer({ text: `I can answer about: ${ASK_INTENTS.join(" · ")}` });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <button
        type="button"
        className="gos-ask-affordance"
        onClick={() => setOpen(true)}
        aria-label="Ask Growth (cmd-K)"
      >
        Ask Growth
        <span className="gos-ask-kbd" aria-hidden="true">
          ⌘K
        </span>
      </button>

      {open && (
        <>
          <button className="gos-scrim" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="gos-ask" role="dialog" aria-label="Ask Growth">
            <form
              className="gos-ask__form"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(q);
              }}
            >
              <input
                ref={inputRef}
                className="gos-ask__input"
                placeholder="Ask about the numbers — 'what should we kill?'"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Question"
              />
              <Badge variant="outline" className="gos-ask-hint">
                enter
              </Badge>
            </form>
            {busy && <p className="gos-ask__busy">reading the state…</p>}
            {answer && !busy && (
              <div className="gos-ask__answer">
                <p>{answer.text}</p>
                {answer.link && (
                  <Link
                    href={answer.link.href}
                    className="gos-usedin"
                    onClick={() => setOpen(false)}
                  >
                    → {answer.link.label}
                  </Link>
                )}
              </div>
            )}
            {!answer && !busy && (
              <div className="gos-ask__suggestions">
                {ASK_INTENTS.slice(0, 6).map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    className="gos-ask__suggestion"
                    onClick={() => {
                      setQ(intent);
                      void ask(intent);
                    }}
                  >
                    {intent}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
