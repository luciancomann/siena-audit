/**
 * Report persistence — JSON files under data/reports/<slug>.json.
 * Resolved from process.cwd() so it works in dev and prod alike.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditReport } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "data/reports");

/** Slugs are nanoid(8) or "verabloom" — anything else is rejected. */
const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function reportPath(slug: string): string {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid report slug: ${JSON.stringify(slug)}`);
  }
  return path.join(REPORTS_DIR, `${slug}.json`);
}

/** Persist a report; returns its slug. */
export async function save(report: AuditReport): Promise<string> {
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(reportPath(report.slug), JSON.stringify(report, null, 2), "utf8");
  return report.slug;
}

/** Load a report by slug; null when it doesn't exist (or the slug is bogus). */
export async function load(slug: string): Promise<AuditReport | null> {
  if (!isValidSlug(slug)) return null;
  try {
    const raw = await readFile(reportPath(slug), "utf8");
    return JSON.parse(raw) as AuditReport;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
