/**
 * POST /api/growth-os/ask — the command bar's fallback for questions the
 * pattern matcher can't answer. Sends the question plus the full live state
 * JSON to Claude with a system prompt that enforces the operator voice.
 * No key configured (or any error): { ok: false } and the client lists the
 * intents it can answer locally. No state is stored.
 */
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM = `You are the reporting agent inside Growth OS, Siena's internal
growth operations tool. Answer in 2-3 sentences of plain operator language —
numbers first, no hype, no hedging, em dashes fine. Only use numbers present
in the state JSON provided; if the state can't answer the question, say what
you'd need. Never invent metrics. Banned words: revolutionary, seamless,
game-changing, cutting-edge, leverage, chatbot, deflection, supercharge,
unlock, robust.`;

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no key" }, { status: 200 });
  }

  let body: { question?: string; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.slice(0, 500) : "";
  if (!question) {
    return Response.json({ ok: false, reason: "no question" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Current Growth OS state JSON:\n${JSON.stringify(body.state ?? {}).slice(0, 20_000)}\n\nQuestion: ${question}`,
        },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return Response.json({ ok: false, reason: "empty" }, { status: 200 });
    return Response.json({ ok: true, text });
  } catch (error) {
    console.error("[growth-os/ask] fallback failed:", error);
    return Response.json({ ok: false, reason: "api error" }, { status: 200 });
  }
}
