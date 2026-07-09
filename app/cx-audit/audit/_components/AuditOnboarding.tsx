"use client";

/**
 * The audit page's front door: qualify first, then choose a way in.
 *
 * Phase 1 — QualifyWizard captures team size, monthly volume, and an email.
 * Phase 2 — the heading warms up, the answers sit above the chooser as
 * badges (with an edit link), and AuditFlow takes over. Answers persist in
 * sessionStorage so a refresh doesn't re-ask, and they ride along with an
 * upload into the CRM handoff.
 */
import { useEffect, useState } from "react";
import { Badge, SectionHeading } from "@siena/design-system";
import { AuditFlow } from "./AuditFlow";
import { QualifyWizard, type QualifyAnswers } from "./QualifyWizard";

const STORAGE_KEY = "cxa-qualify-v1";

function readStored(): QualifyAnswers | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QualifyAnswers>;
    if (
      typeof parsed.teamSize === "string" &&
      typeof parsed.ticketsPerMonth === "string" &&
      typeof parsed.email === "string" &&
      parsed.email.includes("@")
    ) {
      return parsed as QualifyAnswers;
    }
  } catch {
    /* unreadable storage — just re-ask */
  }
  return null;
}

export function AuditOnboarding() {
  // null = wizard; answers = chooser. Start null and hydrate from storage
  // after mount so server and first client render agree.
  const [answers, setAnswers] = useState<QualifyAnswers | null>(null);
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnswers(readStored());
    setHydrated(true);
  }, []);

  const complete = (next: QualifyAnswers) => {
    setAnswers(next);
    setEditing(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full/blocked — the run still carries the answers in memory */
    }
  };

  const showWizard = !answers || editing;

  return (
    <section className="cxa-section cxa-audit-head">
      {showWizard ? (
        <>
          <SectionHeading
            as="h1"
            eyebrow="Free CX audit"
            title="First, a little about your queue."
            subtitle="Three quick answers so the audit is sized to your team. Your tickets stay put until you choose how to share them."
          />
          {hydrated && (
            <QualifyWizard initial={answers} onComplete={complete} />
          )}
        </>
      ) : (
        <>
          <SectionHeading
            as="h1"
            eyebrow="Free CX audit"
            title="Start with your last 500 tickets."
            subtitle="Three ways in — a CSV export, a helpdesk connection, or the sample. The same nine agents read them either way."
          />
          <div className="cxq-summary">
            <Badge variant="outline">Team · {answers.teamSize}</Badge>
            <Badge variant="outline">{answers.ticketsPerMonth} tickets / mo</Badge>
            <Badge variant="outline">{answers.email}</Badge>
            <button
              type="button"
              className="cxq-summary__edit"
              onClick={() => setEditing(true)}
            >
              Edit your details
            </button>
          </div>
          <AuditFlow contact={answers} />
        </>
      )}
    </section>
  );
}
