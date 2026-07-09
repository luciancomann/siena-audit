/**
 * Typed errors for the CX audit pipeline. The API route maps these to
 * clear, plain-language progress errors.
 */

/** Thrown by LLM-dependent stages when ANTHROPIC_API_KEY is missing. */
export class NoApiKeyError extends Error {
  readonly code = "no_api_key";
  constructor(stage: string) {
    super(
      `The ${stage} step needs a model call, and no API key is configured on this server. ` +
        `The sample report works without one — or set ANTHROPIC_API_KEY and run the audit again.`,
    );
    this.name = "NoApiKeyError";
  }
}

/** Thrown when a CSV export can't be read into tickets. */
export class IngestError extends Error {
  readonly code = "ingest_failed";
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}

/** Thrown when the report writer can't produce copy that passes the voice rules. */
export class VoiceViolationError extends Error {
  readonly code = "voice_violation";
  readonly violations: string[];
  constructor(violations: string[]) {
    super(
      `The report writer produced copy that breaks the voice rules (${violations.join(", ")}) ` +
        `even after a retry. Failing loudly rather than shipping off-voice copy.`,
    );
    this.name = "VoiceViolationError";
    this.violations = violations;
  }
}
