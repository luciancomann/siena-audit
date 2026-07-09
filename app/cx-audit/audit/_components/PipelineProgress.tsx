"use client";

/**
 * The nine-agent progress board. Rows render from PIPELINE_STAGES and light
 * up as ndjson events arrive from /api/cx-audit — pending rows sit dim, the
 * active row carries a spinner, finished rows get a check. No fake speed:
 * timing is whatever the pipeline actually reports.
 */
import { Card } from "@siena/design-system";
import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/cx-audit/types";

export type StageStatus = "pending" | "active" | "done";

export function initialStageStatus(): Record<PipelineStageKey, StageStatus> {
  const record = {} as Record<PipelineStageKey, StageStatus>;
  for (const stage of PIPELINE_STAGES) {
    record[stage.key] = "pending";
  }
  return record;
}

function CheckIcon() {
  return (
    <svg
      className="cxa-check"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8.5 6.2 11.7 13 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StageStatusIcon({ status }: { status: StageStatus }) {
  if (status === "done") return <CheckIcon />;
  if (status === "active") return <span className="cxa-spinner" aria-hidden="true" />;
  return <span className="cxa-dot" aria-hidden="true" />;
}

export interface PipelineProgressProps {
  fileName: string;
  status: Record<PipelineStageKey, StageStatus>;
  notes: Partial<Record<PipelineStageKey, string>>;
  finished: boolean;
}

export function PipelineProgress({ fileName, status, notes, finished }: PipelineProgressProps) {
  return (
    <div className="cxa-progress-wrap">
      <Card tone="white" radius="lg" padding="md" className="cxa-progress">
        <div className="cxa-progress__head">
          <span className="cxa-option__tag">Audit in progress</span>
          <h2 className="cxa-progress__title">Nine agents, reading your tickets.</h2>
          <p className="cxa-progress__sub">
            {finished
              ? "All done — opening your report."
              : `Working through ${fileName}. Each stage reports in as it finishes; most audits take about two minutes.`}
          </p>
        </div>

        <ol className="cxa-stages" aria-label="Audit pipeline stages">
          {PIPELINE_STAGES.map((stage, index) => {
            const stageStatus = status[stage.key];
            return (
              <li key={stage.key} className={`cxa-stage cxa-stage--${stageStatus}`}>
                <span className="cxa-stage__num">{String(index + 1).padStart(2, "0")}</span>
                <span className="cxa-stage__text">
                  <span className="cxa-stage__label">{stage.label}</span>
                  <span className="cxa-stage__detail">{notes[stage.key] ?? stage.detail}</span>
                </span>
                <span className="cxa-stage__status">
                  <StageStatusIcon status={stageStatus} />
                  <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    {stageStatus === "done" ? "finished" : stageStatus === "active" ? "running" : "waiting"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <p className="cxa-progress__footnote">
          Redaction runs as a regex pre-pass before any model call. The numbers come from
          code — the model only phrases them.
        </p>
      </Card>
    </div>
  );
}
