/**
 * POST /api/cx-audit — runs the audit pipeline and streams ProgressEvent
 * JSON-lines (ndjson). Accepts either:
 *   - multipart/form-data with a "file" field (CSV export) and optional "brand"
 *   - JSON { sample: true } for the precomputed Verabloom sample
 *
 * Sample mode never runs the pipeline: it replays the stage sequence
 * quickly and serves the hand-authored report at slug "verabloom".
 * On completion: store.save(report) then {type:"done", slug}.
 */
import { runPipeline } from "@/lib/cx-audit/pipeline";
import { IngestError, NoApiKeyError, VoiceViolationError } from "@/lib/cx-audit/pipeline/errors";
import * as store from "@/lib/cx-audit/store";
import { PIPELINE_STAGES, type CrmContact, type ProgressEvent } from "@/lib/cx-audit/types";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB of CSV is plenty

const NDJSON_HEADERS = {
  "content-type": "application/x-ndjson; charset=utf-8",
  "cache-control": "no-store",
  "x-accel-buffering": "no", // disable proxy buffering so events land live
};

function errorMessage(error: unknown): string {
  if (
    error instanceof NoApiKeyError ||
    error instanceof IngestError ||
    error instanceof VoiceViolationError
  ) {
    return error.message;
  }
  console.error("[cx-audit] pipeline failed:", error);
  return "Something went wrong while running the audit. Nothing was saved — try again, or start with the sample report.";
}

function ndjsonStream(
  run: (send: (event: ProgressEvent) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ProgressEvent): void => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await run(send);
      } catch (error) {
        send({ type: "error", error: errorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Sample mode: replay the stage sequence, then point at the stored report. */
function respondWithSample(): Response {
  return ndjsonStream(async (send) => {
    const report = await store.load("verabloom");
    if (!report) {
      send({
        type: "error",
        error:
          "The sample report isn't available on this server right now. Upload your own export instead.",
      });
      return;
    }
    for (const stage of PIPELINE_STAGES) {
      send({ type: "stage", stage: stage.key, status: "start" });
      await sleep(150);
      send({ type: "stage", stage: stage.key, status: "end" });
    }
    send({ type: "done", slug: report.slug });
  });
}

function respondWithUpload(
  csvText: string,
  brand: string,
  contact: CrmContact | undefined,
): Response {
  return ndjsonStream(async (send) => {
    const report = await runPipeline(csvText, { brand, mode: "upload", contact }, send);
    const slug = await store.save(report);
    send({ type: "done", slug });
  });
}

/** Read the qualify-step fields; all three must be present to count. */
function contactFromForm(form: FormData): CrmContact | undefined {
  const field = (name: string): string => {
    const v = form.get(name);
    return typeof v === "string" ? v.trim().slice(0, 120) : "";
  };
  const email = field("contact_email");
  const teamSize = field("team_size");
  const ticketsPerMonth = field("tickets_per_month");
  if (!email || !email.includes("@")) return undefined;
  return { email, team_size: teamSize, tickets_per_month: ticketsPerMonth };
}

/** Derive a presentable brand name from an uploaded file's name. */
function brandFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(tickets?|export|helpdesk|gorgias|zendesk|csv|data)\b/gi, "")
    .trim();
  if (!base) return "Your brand";
  return base
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  // ---- JSON body: { sample: true } -----------------------------------------
  if (contentType.includes("application/json")) {
    let body: { sample?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // fall through to the 400 below
    }
    if (body.sample === true) return respondWithSample();
    return Response.json(
      { error: 'Send { "sample": true } or a multipart form with a "file" field.' },
      { status: 400 },
    );
  }

  // ---- multipart: file upload ----------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json(
        { error: "That upload didn't come through cleanly. Try the file again." },
        { status: 400 },
      );
    }

    if (form.get("sample") === "true") return respondWithSample();

    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { error: "Attach your helpdesk CSV export as the \"file\" field." },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return Response.json(
        { error: "That file is empty. Export your tickets as CSV and try again." },
        { status: 400 },
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error:
            "That file is over 20 MB. Export a shorter date range — 30 days is plenty for an honest read.",
        },
        { status: 413 },
      );
    }

    const brandField = form.get("brand");
    const brand =
      typeof brandField === "string" && brandField.trim()
        ? brandField.trim().slice(0, 80)
        : brandFromFilename(file.name);

    const csvText = await file.text();
    return respondWithUpload(csvText, brand, contactFromForm(form));
  }

  return Response.json(
    { error: 'Send { "sample": true } as JSON, or a multipart form with a "file" field.' },
    { status: 415 },
  );
}
