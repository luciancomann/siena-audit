/**
 * Shared Anthropic client plumbing for the pipeline's LLM stages.
 *
 * Model + parameter policy (per product spec):
 * - model is EXACTLY "claude-sonnet-4-6"; no temperature/top_p/top_k anywhere.
 * - classification calls: thinking disabled + effort "low".
 * - insight/writer calls: omit thinking, default effort.
 * - structured output via output_config.format json_schema; parse first text block.
 */
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-4-6";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;

/** Returns a client, or null when no API key is configured. */
export function getClient(): Anthropic | null {
  if (!hasApiKey()) return null;
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

/**
 * Extracts and parses the JSON payload of a structured-output response.
 * Handles "refusal" and "max_tokens" stop reasons defensively by returning
 * null so callers can fall back rather than crash.
 */
export function parseStructuredResponse<T>(response: Anthropic.Message): T | null {
  if (response.stop_reason === "refusal") return null;
  if (response.stop_reason === "max_tokens") return null;
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!textBlock) return null;
  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    return null;
  }
}
