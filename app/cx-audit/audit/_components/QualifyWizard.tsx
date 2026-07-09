"use client";

/**
 * The three-step qualify card that fronts the audit — team size, monthly
 * volume, then an email — styled after the clone's pricing form: a
 * gradient-framed cream card with numbered step chips, sand option rows,
 * and Previous / Next Step footing. The last step ends on "Run audit".
 *
 * Keyboard contract: options are a real ARIA radio group (roving tabindex,
 * arrow keys move and select), Enter submits the current step, and focus
 * lands on the new step's question after each advance.
 */
import { useEffect, useId, useRef, useState } from "react";
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

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** ARIA radio group with the full keyboard pattern: one tab stop, arrows
    move-and-select (wrapping), Home/End jump to the edges. */
function OptionList({
  options,
  value,
  onPick,
  onEnter,
  labelledBy,
}: {
  options: string[];
  value: string;
  onPick: (option: string) => void;
  /** Enter on a radio advances the step, like a native radio submits a form. */
  onEnter: () => void;
  labelledBy: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveTo = (index: number) => {
    const next = (index + options.length) % options.length;
    onPick(options[next]);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = Math.max(0, options.indexOf(value));
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      moveTo(current + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      moveTo(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveTo(options.length - 1);
    } else if (e.key === "Enter") {
      // don't let the button's native click re-pick — advance instead
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div className="cxq-options" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {options.map((option, i) => {
        const picked = value === option;
        // one tab stop: the picked option, or the first while nothing is picked
        const tabStop = picked || (!value && i === 0);
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={picked}
            tabIndex={tabStop ? 0 : -1}
            className={`cxq-opt${picked ? " cxq-opt--picked" : ""}`}
            onClick={() => onPick(option)}
          >
            {option}
          </button>
        );
      })}
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

  const questionId = useId();
  const questionRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);

  // keep keyboard users oriented: focus the new question after each step
  // change (WebKit otherwise drops focus to <body> when the old button
  // unmounts) — but leave page-load focus alone.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    questionRef.current?.focus();
  }, [step]);

  const canAdvance = step === 0 ? teamSize !== "" : ticketsPerMonth !== "";

  const stepState = (i: number): "done" | "active" | "todo" =>
    i < step ? "done" : i === step ? "active" : "todo";

  const finish = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter a full work email, like hello@example.com.");
      return;
    }
    setEmailError(null);
    onComplete({ teamSize, ticketsPerMonth, email: email.trim() });
  };

  const advance = () => {
    if (step < 2) {
      if (canAdvance) setStep(step + 1);
    } else {
      finish();
    }
  };

  return (
    <div className="cxq-frame">
      <Card tone="cream" radius="lg" padding="none" className="cxq-card">
        <form
          className="cxq-form"
          onSubmit={(e) => {
            e.preventDefault();
            advance();
          }}
        >
          <div className="cxq-steps">
            {STEPS.map((s, i) => (
              <StepChip key={s.key} index={i} state={stepState(i)} label={s.label} />
            ))}
          </div>

          {step === 0 && (
            <div className="cxq-body" key="s0">
              <h2 className="cxq-question" id={questionId} ref={questionRef} tabIndex={-1}>
                How big is your customer service team?
              </h2>
              <OptionList
                options={TEAM_SIZES}
                value={teamSize}
                onPick={setTeamSize}
                onEnter={advance}
                labelledBy={questionId}
              />
            </div>
          )}

          {step === 1 && (
            <div className="cxq-body" key="s1">
              <h2 className="cxq-question" id={questionId} ref={questionRef} tabIndex={-1}>
                How many tickets do you get per month?
              </h2>
              <OptionList
                options={TICKET_BANDS}
                value={ticketsPerMonth}
                onPick={setTicketsPerMonth}
                onEnter={advance}
                labelledBy={questionId}
              />
            </div>
          )}

          {step === 2 && (
            <div className="cxq-body cxq-body--email" key="s2">
              <h2 className="cxq-question" ref={questionRef} tabIndex={-1}>
                What&rsquo;s the best way to reach you?
              </h2>
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
              <Button variant="primary" size="md" disabled={!canAdvance} onClick={advance}>
                Next Step
              </Button>
            ) : (
              // not disabled: an invalid email gets the inline error instead
              // of a dead button
              <Button variant="primary" size="md" onClick={advance}>
                Run audit
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
