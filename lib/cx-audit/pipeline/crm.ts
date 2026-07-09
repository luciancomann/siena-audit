/**
 * Stage 9 — Handoff agent.
 * Builds the CrmPayload and POSTs it to the HubSpot webhook when
 * CX_AUDIT_HUBSPOT_WEBHOOK is configured; otherwise a stub logs and
 * resolves. Delivery failures never fail the pipeline — the payload is
 * always included in the report JSON regardless.
 */
import type { Assumptions, CrmContact, CrmPayload, Insight, Metrics } from "../types";

export interface CrmInput {
  brand: string;
  slug: string;
  metrics: Metrics;
  insights: Insight[];
  assumptions: Assumptions;
  contact?: CrmContact;
  preparedFor?: string;
}

export function buildCrmPayload(input: CrmInput): CrmPayload {
  const { brand, slug, metrics, insights, assumptions, contact, preparedFor } = input;
  const score = metrics.automationPotentialScore;
  const monthlyVolume = metrics.monthlyVolumeEstimate;

  return {
    company: brand,
    audit_slug: slug,
    ...(preparedFor ? { prepared_for: preparedFor } : {}),
    ...(contact ? { contact } : {}),
    automation_potential_score: score,
    monthly_volume_estimate: monthlyVolume,
    fast_track: score > 70 && monthlyVolume > 3000,
    top_intents: metrics.intents.slice(0, 3).map((i) => ({ intent: i.intent, share: i.share })),
    insights,
    median_first_response_mins: metrics.medianFirstResponseMins,
    repeat_contact_customers: metrics.repeatContacts.customers,
    assumptions,
    report_url: `/cx-audit/report/${slug}`,
    generated_at: new Date().toISOString(),
    source: "cx-audit-agent",
  };
}

/** POST the payload to the webhook, or log via the stub. Never throws. */
export async function sendCrmPayload(payload: CrmPayload): Promise<void> {
  const webhook = process.env.CX_AUDIT_HUBSPOT_WEBHOOK;

  if (!webhook) {
    console.log(
      `[cx-audit] CRM handoff (stub — set CX_AUDIT_HUBSPOT_WEBHOOK to deliver): ` +
        `${payload.company} score=${payload.automation_potential_score} ` +
        `volume=${payload.monthly_volume_estimate} fast_track=${payload.fast_track}`,
    );
    return;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(
        `[cx-audit] CRM webhook responded ${response.status} for ${payload.audit_slug}`,
      );
    }
  } catch (error) {
    console.error(`[cx-audit] CRM webhook delivery failed for ${payload.audit_slug}:`, error);
  }
}
