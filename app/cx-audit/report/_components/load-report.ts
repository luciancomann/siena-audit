/**
 * Server-only report loader — a per-request-cached wrapper over the store,
 * so metadata and page render share one read. Returns null when the slug is
 * malformed or the report does not exist — callers translate that into
 * notFound().
 */
import { cache } from "react";
import type { AuditReport } from "@/lib/cx-audit/types";
import * as store from "@/lib/cx-audit/store";

export const loadReport = cache(
  async (slug: string): Promise<AuditReport | null> => store.load(slug),
);
