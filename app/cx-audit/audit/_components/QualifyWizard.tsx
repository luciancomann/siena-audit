"use client";

/**
 * The three-step qualify card that fronts the audit — team size, monthly
 * volume, then an email — styled after the clone's pricing form: a
 * gradient-framed cream card with numbered step chips, sand option rows,
 * and Previous / Next Step footing. The last step ends on "Run audit".
 */
import { useState } from "react";
import { Button, Card, Input } from "@siena/design-system";
import "./qualify.css";

export interface QualifyAnswers {
  teamSize: string;
  ticketsPerMonth: string;
  email: string;
}

const STEPS = [
  { key: "teamSize", label: "Team size" },
  { key: "ticketsPerMonth", label: "Tickets per month" },
  { key: "email", label: "Personal details" },
] as const;

const TEAM_SIZES = ["1-10", "11-50", "51-100", "101-500", "501+"];
const TICKET_BANDS = ["<3,000", "3,000-10,000", "10,000-20,000", "20,000-30,000", "Over 30,000"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StepChip({
  index,
  state,
  label,
}: {
  index: number;
  state: "done" | "active" | "todo";
  label: string;
}) {
  return (
    <span className={`cxq-step cxq-step--${state}`}>
      <span className="cxq-step__box" aria-hidden="true">
        {state === "done" ? (
          <svg viewBox="0 0 12 12" width="11" height="11">
            <path
              d="M2 6.2 4.8 9 10 3.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          index + 1
        )}
      </span>
      <span className="cxq-step__label">{label}</span>
    </span>
  );
}

function OptionList({
  options,
  value,
  onPick,
}: {
  options: string[];
  value: string;
  onPick: (option: string) => void;
}) {
  return (
    <div className="cxq-options" role="radiogroup">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`cxq-opt${value === option ? " cxq-opt--picked" : ""}`}
          onClick={() => onPick(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function QualifyWizard({
  initial,
  onComplete,
}: {
  initial?: QualifyAnswers | null;
  onComplete: (answers: QualifyAnswers) => void;
}) {
  const [step, setStep] = useState(0);
  const [teamSize, setTeamSize] = useState(initial?.teamSize ?? "");
  const [ticketsPerMonth, setTicketsPerMonth] = useState(initial?.ticketsPerMonth ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);

  const canAdvance =
    step === 0 ? teamSize !== "" : step === 1 ? ticketsPerMonth !== "" : EMAIL_RE.test(email);

  const stepState = (i: number): "done" | "active" | "todo" =>
    i < step ? "done" : i === step ? "active" : "todo";

  const finish = () => {
    if (!EMAIL_RE.test(email)) {
      setEmailError("That address doesn't look complete — check the domain.");
      return;
    }
    setEmailError(null);
    onComplete({ teamSize, ticketsPerMonth, email: email.trim() });
  };

  return (
    <div className="cxq-frame">
      <Card tone="cream" radius="lg" padding="none" className="cxq-card">
        <div className="cxq-steps">
          {STEPS.map((s, i) => (
            <StepChip key={s.key} index={i} state={stepState(i)} label={s.label} />
          ))}
        </div>

        {step === 0 && (
          <div className="cxq-body" key="s0">
            <h2 className="cxq-question">How big is your customer service team?</h2>
            <OptionList options={TEAM_SIZES} value={teamSize} onPick={setTeamSize} />
          </div>
        )}

        {step === 1 && (
          <div className="cxq-body" key="s1">
            <h2 className="cxq-question">How many tickets do you get per month?</h2>
            <OptionList
              options={TICKET_BANDS}
              value={ticketsPerMonth}
              onPick={setTicketsPerMonth}
            />
          </div>
        )}

        {step === 2 && (
          <div className="cxq-body cxq-body--email" key="s2">
            <h2 className="cxq-question">What&rsquo;s the best way to reach you?</h2>
            <Input
              label="Email*"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="hello@example.com"
              value={email}
              error={emailError ?? undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
            />
          </div>
        )}

        <div className="cxq-footer">
          {step > 0 && (
            <Button variant="secondary" size="md" onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          {step < 2 ? (
            <Button
              variant="primary"
              size="md"
              disabled={!canAdvance}
              onClick={() => setStep(step + 1)}
            >
              Next Step
            </Button>
          ) : (
            <Button variant="primary" size="md" disabled={!canAdvance} onClick={finish}>
              Run audit
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
