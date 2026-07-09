/**
 * Stage 2 — Sampler.
 * If the export holds more than 500 tickets, draw a seeded random sample of
 * 500. The seed is sha256 of the raw file content, so the same file always
 * produces the same sample — deterministic reruns.
 */
import { createHash } from "node:crypto";
import type { NormalizedTicket } from "../types";

export const SAMPLE_CAP = 500;

export interface SampleResult {
  tickets: NormalizedTicket[];
  sampleSize: number;
  totalInExport: number;
  dateRange: { from: string; to: string };
}

/** mulberry32 — small deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromContent(rawFileContent: string): number {
  const digest = createHash("sha256").update(rawFileContent).digest();
  // Fold the first 4 bytes into a uint32 seed.
  return digest.readUInt32BE(0);
}

export function sampleTickets(
  tickets: NormalizedTicket[],
  rawFileContent: string,
  cap: number = SAMPLE_CAP,
): SampleResult {
  const totalInExport = tickets.length;

  // Date range comes from the full export — it drives the volume estimate.
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const t of tickets) {
    const ms = Date.parse(t.created_at);
    if (Number.isNaN(ms)) continue;
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  }
  if (!Number.isFinite(minMs)) {
    const today = new Date().toISOString();
    minMs = Date.parse(today);
    maxMs = minMs;
  }
  const dateRange = {
    from: new Date(minMs).toISOString().slice(0, 10),
    to: new Date(maxMs).toISOString().slice(0, 10),
  };

  if (totalInExport <= cap) {
    return { tickets: [...tickets], sampleSize: totalInExport, totalInExport, dateRange };
  }

  // Seeded Fisher–Yates shuffle on a copy, then take the first `cap`.
  const rand = mulberry32(seedFromContent(rawFileContent));
  const shuffled = [...tickets];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, cap);
  // Chronological order keeps downstream reading (and diffs) stable.
  sample.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  return { tickets: sample, sampleSize: sample.length, totalInExport, dateRange };
}
