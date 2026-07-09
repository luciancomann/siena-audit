"use client";

/**
 * The three-path audit chooser and the live pipeline run.
 *
 * Paths: upload a CSV (streams ndjson ProgressEvents from /api/cx-audit),
 * connect a helpdesk (scaffolded OAuth screens), or open the precomputed
 * sample. While a run is live the chooser gives way to the progress board;
 * errors land on a warm, honest card that always offers the sample.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@siena/design-system";
import type { PipelineStageKey, ProgressEvent } from "@/lib/cx-audit/types";
import {
  PipelineProgress,
  initialStageStatus,
  type StageStatus,
} from "./PipelineProgress";
import type { QualifyAnswers } from "./QualifyWizard";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type Phase =
  | { kind: "choose" }
  | { kind: "running"; fileName: string; finished: boolean }
  | { kind: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function validateFile(file: File): string | null {
  const looksCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type.toLowerCase().includes("csv");
  if (!looksCsv) {
    return "We can only read .csv exports right now. Most helpdesks have one under Reports or Exports.";
  }
  if (file.size > MAX_BYTES) {
    return `That file is ${formatBytes(file.size)} — the cap is 10 MB. A one-month export is usually plenty.`;
  }
  if (file.size === 0) {
    return "That file looks empty. Try re-exporting from your helpdesk.";
  }
  return null;
}

export function AuditFlow({
  contact,
  onBusyChange,
}: {
  contact?: QualifyAnswers | null;
  /** True while a run is streaming — the parent hides anything (like the
      qualify edit link) that would unmount a live run. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stageStatus, setStageStatus] = useState<Record<PipelineStageKey, StageStatus>>(
    initialStageStatus,
  );
  const [stageNotes, setStageNotes] = useState<Partial<Record<PipelineStageKey, string>>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const redirectTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onBusyChange?.(phase.kind === "running");
  }, [phase.kind, onBusyChange]);

  // if this component ever unmounts mid-run, cancel the stream and the
  // pending redirect so nothing fires into a dead tree (or worse, yanks
  // the user to a report they navigated away from)
  useEffect(
    () => () => {
      abortRef.current?.abort();
      window.clearTimeout(redirectTimerRef.current);
    },
    [],
  );

  const acceptFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validateFile(candidate);
    if (problem) {
      setFile(null);
      setFileError(problem);
      return;
    }
    setFileError(null);
    setFile(candidate);
  }, []);

  const resetToChooser = useCallback(() => {
    setPhase({ kind: "choose" });
    setFile(null);
    setFileError(null);
    setStageStatus(initialStageStatus());
    setStageNotes({});
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const runAudit = useCallback(
    async (upload: File) => {
      setStageStatus(initialStageStatus());
      setStageNotes({});
      setPhase({ kind: "running", fileName: upload.name, finished: false });

      let settled = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        setPhase({ kind: "error", message });
      };

      const handleEvent = (event: ProgressEvent) => {
        if (settled) return;
        if (event.type === "stage") {
          const stageKey = event.stage;
          if (!stageKey) return;
          const nextStatus: StageStatus = event.status === "end" ? "done" : "active";
          setStageStatus((prev) => ({ ...prev, [stageKey]: nextStatus }));
          const note = event.note;
          if (note) setStageNotes((prev) => ({ ...prev, [stageKey]: note }));
          return;
        }
        if (event.type === "done") {
          const slug = event.slug;
          if (!slug) {
            fail("The audit finished but never told us where the report lives. Nothing was stored.");
            return;
          }
          settled = true;
          setStageStatus((prev) => {
            const all = { ...prev };
            for (const key of Object.keys(all) as PipelineStageKey[]) all[key] = "done";
            return all;
          });
          setPhase({ kind: "running", fileName: upload.name, finished: true });
          redirectTimerRef.current = window.setTimeout(() => {
            router.push(`/cx-audit/report/${slug}`);
          }, 700);
          return;
        }
        if (event.type === "error") {
          fail(
            event.note ??
              event.error ??
              "The pipeline stopped without saying why. Nothing was stored.",
          );
        }
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const form = new FormData();
        form.append("file", upload);
        if (contact) {
          form.append("contact_email", contact.email);
          form.append("team_size", contact.teamSize);
          form.append("tickets_per_month", contact.ticketsPerMonth);
        }
        const res = await fetch("/api/cx-audit", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let message = "The audit service didn't answer. Your file stayed in memory and is already gone.";
          try {
            const data = (await res.json()) as { error?: string; note?: string };
            if (typeof data.note === "string" && data.note) message = data.note;
            else if (typeof data.error === "string" && data.error) message = data.error;
          } catch {
            /* non-JSON body — keep the plain message */
          }
          fail(message);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const consume = (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              handleEvent(JSON.parse(trimmed) as ProgressEvent);
            } catch {
              /* skip malformed lines rather than kill a live run */
            }
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          consume(decoder.decode(value, { stream: true }));
        }
        consume(decoder.decode());
        const tail = buffer.trim();
        if (tail) {
          try {
            handleEvent(JSON.parse(tail) as ProgressEvent);
          } catch {
            /* ignore a torn final line */
          }
        }

        if (!settled) {
          fail("The audit stream ended early. Nothing was stored — try again, or open the sample.");
        }
      } catch {
        // an unmount-triggered abort is not an error to surface
        if (controller.signal.aborted) return;
        fail("We couldn't reach the audit service. Check your connection and try again — or open the sample.");
      }
    },
    [router, contact],
  );

  // ---------------------------------------------------------------- running
  if (phase.kind === "running") {
    return (
      <PipelineProgress
        fileName={phase.fileName}
        status={stageStatus}
        notes={stageNotes}
        finished={phase.finished}
      />
    );
  }

  // ------------------------------------------------------------------ error
  if (phase.kind === "error") {
    return (
      <div className="cxa-error-wrap">
        <Card tone="sand" radius="lg" padding="md" className="cxa-error">
          <span className="cxa-option__tag">Audit paused</span>
          <h2 className="cxa-error__title">We hit a snag — your data is fine.</h2>
          <p className="cxa-error__note">{phase.message}</p>
          <p className="cxa-error__body">
            Whatever we read stayed in memory and is already gone. The sample report is
            ready right now if you&rsquo;d rather see the audit first.
          </p>
          <div className="cxa-error__actions">
            <Button variant="primary" size="md" href="/cx-audit/report/verabloom">
              Try the sample instead
            </Button>
            <Button variant="secondary" size="md" onClick={resetToChooser}>
              Start over
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------- chooser
  return (
    <div>
      <div className="cxa-options">
        {/* -------------------------------------------------- 1. upload CSV */}
        <Card tone="cream" radius="lg" padding="md" className="cxa-option">
          <span className="cxa-option__tag">Option 01 · CSV</span>
          <h2 className="cxa-option__title">Upload your export</h2>
          <p className="cxa-option__body">
            Any helpdesk CSV up to 10 MB. We sample 500 tickets, strip the PII, and read
            what&rsquo;s left.
          </p>

          {file ? (
            <div className="cxa-file-row">
              <span className="cxa-file-row__name" title={file.name}>
                {file.name}
              </span>
              <span className="cxa-file-row__size">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="cxa-file-row__remove"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div
              className={`cxa-drop${dragOver ? " cxa-drop--over" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="Upload a CSV export — drag a file here or press Enter to browse"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
            >
              <span className="cxa-drop__label">
                Drag your CSV here, or <span className="cxa-drop__browse">browse</span>
              </span>
              <span className="cxa-drop__hint">.csv · up to 10 MB</span>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          {fileError ? <p className="cxa-file-error">{fileError}</p> : null}

          <div className="cxa-option__actions">
            <Button
              variant="primary"
              size="md"
              disabled={!file}
              onClick={() => {
                if (file) void runAudit(file);
              }}
            >
              Audit this CSV
            </Button>
          </div>
        </Card>

        {/* ------------------------------------------------ 2. connect */}
        <Card tone="cream" radius="lg" padding="md" className="cxa-option">
          <span className="cxa-option__tag">Option 02 · Connect</span>
          <h2 className="cxa-option__title">Connect your helpdesk</h2>
          <p className="cxa-option__body">
            Read-only access to tickets and customers — the audit never writes back to
            your queue.
          </p>
          <div className="cxa-option__actions">
            <Button variant="secondary" size="md" href="/cx-audit/connect/gorgias">
              Connect Gorgias
            </Button>
            <Button variant="secondary" size="md" href="/cx-audit/connect/zendesk">
              Connect Zendesk
            </Button>
          </div>
        </Card>

        {/* ------------------------------------------------- 3. sample */}
        <Card tone="cream" radius="lg" padding="md" className="cxa-option">
          <span className="cxa-option__tag">Option 03 · Sample</span>
          <h2 className="cxa-option__title">See a sample audit</h2>
          <p className="cxa-option__body">
            Verabloom is a skincare brand we invented — 4,183 tickets that read like the
            real thing. The report is precomputed, so it opens instantly.
          </p>
          <div className="cxa-option__actions">
            <Button variant="primary" size="md" href="/cx-audit/report/verabloom">
              Open the sample report
            </Button>
          </div>
        </Card>
      </div>

      <p className="cxa-smallprint">
        Processed in memory · PII redacted before any model call · nothing stored beyond
        your report
      </p>
    </div>
  );
}
