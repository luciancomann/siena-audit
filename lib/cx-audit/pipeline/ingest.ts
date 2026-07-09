/**
 * Stage 1 — Ingest agent.
 * papaparse CSV -> NormalizedTicket[]. Knows Gorgias and Zendesk exports by
 * their column names, with a fuzzy fallback (case/space/underscore-insensitive
 * header matching plus best-guess by content) for everything else.
 */
import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { NormalizedTicket } from "../types";
import { IngestError } from "./errors";

type Row = Record<string, string>;
type Field =
  | "id"
  | "created_at"
  | "first_response_at"
  | "resolved_at"
  | "channel"
  | "subject"
  | "body"
  | "customer_email"
  | "csat";

/** lowercase + strip everything that isn't a letter or digit. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Candidate normalized headers per field, best match first. Covers the
 * Gorgias map (id, created_at, channel, subject, body, customer_email,
 * first_response_at, resolved_at, satisfaction_score) and the Zendesk map
 * (Id, Created at, Channel/Via, Subject, Description, Requester email,
 * First reply time, Solved at, Satisfaction Score), plus common variants.
 */
const CANDIDATES: Record<Field, string[]> = {
  id: ["id", "ticketid", "ticketnumber", "ticket", "conversationid", "number", "ref"],
  created_at: [
    "createdat",
    "created",
    "createddate",
    "createdon",
    "creationdate",
    "openedat",
    "opendate",
    "date",
    "timestamp",
  ],
  first_response_at: [
    "firstresponseat",
    "firstreplytime",
    "firstresponsetime",
    "firstrepliedat",
    "firstresponse",
    "firstreply",
    "firstreplytimeinminutes",
    "firstresponsetimeinminutes",
    "firstreplyat",
  ],
  resolved_at: [
    "resolvedat",
    "solvedat",
    "closedat",
    "resolved",
    "solved",
    "closed",
    "resolutiondate",
    "closeddate",
    "fullresolutiontime",
    "fullresolutiontimeinminutes",
    "resolutiontime",
  ],
  channel: ["channel", "via", "channelvia", "source", "medium", "origin"],
  subject: ["subject", "title", "summary", "topic"],
  body: [
    "body",
    "description",
    "message",
    "content",
    "text",
    "firstmessage",
    "transcript",
    "comment",
  ],
  customer_email: [
    "customeremail",
    "requesteremail",
    "email",
    "requester",
    "customer",
    "fromemail",
    "fromaddress",
    "from",
  ],
  csat: [
    "satisfactionscore",
    "csat",
    "csatscore",
    "satisfaction",
    "satisfactionrating",
    "rating",
    "score",
  ],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function resolveColumns(headers: string[], rows: Row[]): Partial<Record<Field, string>> {
  const normalized = new Map<string, string>(); // normalized -> original
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (n && !normalized.has(n)) normalized.set(n, h);
  }

  const map: Partial<Record<Field, string>> = {};
  const claimed = new Set<string>();

  for (const field of Object.keys(CANDIDATES) as Field[]) {
    for (const candidate of CANDIDATES[field]) {
      const original = normalized.get(candidate);
      if (original && !claimed.has(original)) {
        map[field] = original;
        claimed.add(original);
        break;
      }
    }
  }

  // ---- best-guess by content for anything still unmapped ----
  const probe = rows.slice(0, 25);
  const unclaimed = headers.filter((h) => !claimed.has(h));

  const shareMatching = (header: string, test: (v: string) => boolean): number => {
    const values = probe.map((r) => (r[header] ?? "").trim()).filter(Boolean);
    if (values.length === 0) return 0;
    return values.filter(test).length / values.length;
  };

  if (!map.customer_email) {
    const guess = unclaimed.find((h) => shareMatching(h, (v) => EMAIL_RE.test(v)) > 0.5);
    if (guess) {
      map.customer_email = guess;
      claimed.add(guess);
    }
  }
  if (!map.created_at) {
    const guess = unclaimed.find(
      (h) =>
        !claimed.has(h) &&
        shareMatching(h, (v) => !/^\d+(\.\d+)?$/.test(v) && !Number.isNaN(Date.parse(v))) > 0.5,
    );
    if (guess) {
      map.created_at = guess;
      claimed.add(guess);
    }
  }
  if (!map.body) {
    // The message body is almost always the longest text column.
    let best: string | undefined;
    let bestLen = 40; // require a meaningful average length
    for (const h of unclaimed) {
      if (claimed.has(h)) continue;
      const values = probe.map((r) => (r[h] ?? "").trim()).filter(Boolean);
      if (values.length === 0) continue;
      const avg = values.reduce((sum, v) => sum + v.length, 0) / values.length;
      if (avg > bestLen) {
        best = h;
        bestLen = avg;
      }
    }
    if (best) {
      map.body = best;
      claimed.add(best);
    }
  }

  return map;
}

function normalizeChannel(raw: string | undefined): NormalizedTicket["channel"] {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return "other";
  if (v.includes("mail")) return "email";
  if (v.includes("chat") || v.includes("widget") || v.includes("messenger") || v.includes("web"))
    return "chat";
  if (v.includes("sms") || v.includes("text") || v.includes("whatsapp")) return "sms";
  if (
    v.includes("social") ||
    v.includes("twitter") ||
    v.includes("facebook") ||
    v.includes("instagram") ||
    v.includes("tiktok") ||
    v === "x" ||
    v.includes("dm")
  )
    return "social";
  if (v.includes("phone") || v.includes("call") || v.includes("voice")) return "phone";
  return "other";
}

function parseDate(raw: string | undefined): Date | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/**
 * Parses a timestamp column that may instead hold a duration in minutes
 * (Zendesk's "First reply time" / "Full resolution time" style). Numeric
 * values are treated as minutes offset from created_at.
 */
function parseTimeOrOffset(raw: string | undefined, createdAt: Date): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const minutes = Number(v);
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    return new Date(createdAt.getTime() + minutes * 60_000).toISOString();
  }
  const date = parseDate(v);
  return date ? date.toISOString() : null;
}

function parseCsat(raw: string | undefined): number | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n >= 1 && n <= 5) return Math.round(n);
    if (n > 5 && n <= 100) return Math.max(1, Math.min(5, Math.round(n / 20))); // 0-100 scales
    return null;
  }
  if (v.startsWith("good")) return 5;
  if (v.startsWith("bad")) return 1;
  return null;
}

export function hashCustomer(emailOrId: string): string {
  return createHash("sha256")
    .update(emailOrId.trim().toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

/** Parse a raw CSV export into normalized tickets. Throws IngestError when unusable. */
export function ingestCsv(csvText: string): NormalizedTicket[] {
  const parsed = Papa.parse<Row>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data.filter((r) => r && typeof r === "object");
  if (rows.length === 0) {
    throw new IngestError(
      "We couldn't find any rows in that file. Export your tickets as CSV with a header row and try again — or start with the sample report.",
    );
  }

  const headers = parsed.meta.fields ?? Object.keys(rows[0]);
  const columns = resolveColumns(headers, rows);

  if (!columns.subject && !columns.body) {
    throw new IngestError(
      "We couldn't find a subject or message column in that export, so there's nothing to read. Include the ticket text (Gorgias: body, Zendesk: Description) and try again.",
    );
  }
  if (!columns.created_at) {
    throw new IngestError(
      "We couldn't find a created-date column in that export. Include when each ticket was opened (Gorgias: created_at, Zendesk: Created at) and try again.",
    );
  }

  const tickets: NormalizedTicket[] = [];
  const seenIds = new Set<string>();
  rows.forEach((row, index) => {
    const subject = (columns.subject ? row[columns.subject] : "")?.trim() ?? "";
    const body = (columns.body ? row[columns.body] : "")?.trim() ?? "";
    if (!subject && !body) return; // nothing to read

    const createdAt = parseDate(columns.created_at ? row[columns.created_at] : undefined);
    if (!createdAt) return; // unusable without a timeline

    let id = (columns.id ? row[columns.id] : "")?.trim() || `row-${index + 1}`;
    if (seenIds.has(id)) id = `${id}#${index + 1}`; // downstream stages key by id
    seenIds.add(id);
    const email = (columns.customer_email ? row[columns.customer_email] : "")?.trim() ?? "";

    tickets.push({
      id,
      created_at: createdAt.toISOString(),
      first_response_at: parseTimeOrOffset(
        columns.first_response_at ? row[columns.first_response_at] : undefined,
        createdAt,
      ),
      resolved_at: parseTimeOrOffset(
        columns.resolved_at ? row[columns.resolved_at] : undefined,
        createdAt,
      ),
      channel: normalizeChannel(columns.channel ? row[columns.channel] : undefined),
      subject,
      body,
      customer_hash: hashCustomer(email || `no-email:${id}`),
      csat: parseCsat(columns.csat ? row[columns.csat] : undefined),
    });
  });

  if (tickets.length < 5) {
    throw new IngestError(
      `Only ${tickets.length} usable ticket${tickets.length === 1 ? "" : "s"} came through — too few to say anything honest about your queue. Check that the export has ticket text and created dates, then try again.`,
    );
  }

  return tickets;
}
