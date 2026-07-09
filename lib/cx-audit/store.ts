/**
 * Report persistence — JSON files under data/reports/<slug>.json.
 * Resolved from process.cwd() so it works in dev and prod alike.
 *
 * On read-only filesystems (Vercel and friends) writes fall back to the
 * OS temp dir, and reads check both places. Temp storage is ephemeral and
 * per-instance — good enough for the just-generated-report redirect, and
 * the precomputed sample never needs a write at all.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AuditReport } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "data/reports");
const FALLBACK_DIR = path.join(os.tmpdir(), "cx-audit-reports");

/** Slugs are nanoid(8) or "verabloom" — anything else is rejected. */
const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function reportPath(dir: string, slug: string): string {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid report slug: ${JSON.stringify(slug)}`);
  }
  return path.join(dir, `${slug}.json`);
}

/** Persist a report; returns its slug. */
export async function save(report: AuditReport): Promise<string> {
  const body = JSON.stringify(report, null, 2);
  try {
    await mkdir(REPORTS_DIR, { recursive: true });
    await writeFile(reportPath(REPORTS_DIR, report.slug), body, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EROFS" && code !== "EACCES" && code !== "EPERM") throw error;
    await mkdir(FALLBACK_DIR, { recursive: true });
    await writeFile(reportPath(FALLBACK_DIR, report.slug), body, "utf8");
  }
  return report.slug;
}

/** Load a report by slug; null when it doesn't exist (or the slug is bogus). */
export async function load(slug: string): Promise<AuditReport | null> {
  if (!isValidSlug(slug)) return null;
  for (const dir of [REPORTS_DIR, FALLBACK_DIR]) {
    try {
      const raw = await readFile(reportPath(dir, slug), "utf8");
      return JSON.parse(raw) as AuditReport;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
  return null;
}
