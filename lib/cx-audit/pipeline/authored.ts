/**
 * Authored sample content for "Verabloom" — used by the insight and writer
 * stages when mode === "sample" and no ANTHROPIC_API_KEY is configured, so
 * the demo path never needs a model call.
 *
 * Re-exports the data agent's typed module (lib/cx-audit/authored-verabloom.ts),
 * which is the single source of truth for authored LLM-stage outputs. The
 * precompute script asserts the generated report matches these exactly.
 */
import {
  AUTHORED_CHAT_MOCKUPS,
  AUTHORED_COPY,
  AUTHORED_INSIGHTS,
} from "../authored-verabloom";
import type { ChatMockup, Insight, ReportCopy } from "../types";

export interface AuthoredSample {
  insights: Insight[];
  copy: ReportCopy;
  chatMockups: ChatMockup[];
}

export function getAuthoredSample(): AuthoredSample {
  return {
    insights: AUTHORED_INSIGHTS,
    copy: AUTHORED_COPY,
    chatMockups: AUTHORED_CHAT_MOCKUPS,
  };
}
