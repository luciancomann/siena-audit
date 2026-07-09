/**
 * Server-only report loader. Reads data/reports/<slug>.json from disk and
 * parses it as the shared AuditReport contract. Returns null when the slug
 * is malformed or the file does not exist — callers translate that into
 * notFound().
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { AuditReport } from "@/lib/cx-audit/types";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

export const loadReport = cache(async (slug: string): Promise<AuditReport | null> => {
  if (!SLUG_PATTERN.test(slug)) return null;
  const file = path.join(process.cwd(), "data", "reports", `${slug}.json`);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as AuditReport;
  } catch {
    return null;
  }
});
