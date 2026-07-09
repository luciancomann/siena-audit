/**
 * CRM preview — "what sales sees". Renders report.crm as a HubSpot-style
 * contact/company card so the handoff payload is a designed object, not an
 * abstract webhook. Server component; reads the same report JSON as the
 * report page.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Card, StatCard } from "@siena/design-system";
import { INTENT_LABELS } from "@/lib/cx-audit/types";
import { CxaLogo } from "../../audit/_components/Chrome";
import { loadReport } from "../../report/_components/load-report";
import {
  formatDateTime,
  formatMins,
  formatNumber,
  formatPerTicket,
  formatShare,
} from "../../report/_components/format";
import "../crm-preview.css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) return { title: "Sales handoff | Siena CX Audit" };
  return {
    title: `What sales sees — ${report.brand} | Siena CX Audit`,
    description: `The audit context a rep gets before the call with ${report.brand}.`,
    robots: { index: false },
  };
}

export default async function CrmPreviewPage({ params }: PageProps) {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) notFound();

  const { crm } = report;
  const maxShare = Math.max(...crm.top_intents.map((t) => t.share), 0.01);

  return (
    <main className="cxa-crm">
      <div className="cxa-no-print cxa-topbar">
        <div className="cxa-container cxa-topbar-inner">
          <Link className="cxa-wordmark" href="/cx-audit">
            <CxaLogo />
          </Link>
          <Link className="cxa-topbar-link" href={crm.report_url}>
            Back to the report
          </Link>
        </div>
      </div>

      <header className="cxa-crm-hero">
        <div className="cxa-container">
          <p className="cxa-crm-hero-eyebrow">
            Internal handoff · not shown to the brand
          </p>
          <h1 className="sds-display-lg cxa-crm-hero-title">What sales sees</h1>
          <p className="cxa-crm-hero-sub">
            The audit context, packaged for the follow-up — so {crm.company} never
            has to repeat themselves on the call.
          </p>
        </div>
      </header>

      <div className="cxa-container cxa-section cxa-crm-body">
        <Card tone="white" radius="lg" padding="md" className="cxa-crm-card">
          {/* company header */}
          <div className="cxa-crm-head">
            <Avatar initials={crm.company} size="lg" />
            <div className="cxa-crm-head-id">
              <h2 className="sds-display-md cxa-crm-company">{crm.company}</h2>
              <p className="cxa-crm-source">
                source: {crm.source}
                {crm.contact ? (
                  <>
                    {" · "}
                    <span className="cxa-crm-email">{crm.contact.email}</span>
                    {` · team ${crm.contact.team_size} · ${crm.contact.tickets_per_month} tickets/mo (self-reported)`}
                  </>
                ) : (
                  " · no contact captured — audit ran without the qualify step"
                )}
              </p>
            </div>
            {crm.fast_track && (
              <Badge variant="filled" className="cxa-crm-fasttrack">
                Fast track
              </Badge>
            )}
          </div>

          {/* headline numbers */}
          <div className="cxa-crm-stats">
            <StatCard
              value={`${crm.automation_potential_score}%`}
              label="automation potential"
              size="md"
            />
            <StatCard
              value={formatNumber(crm.monthly_volume_estimate)}
              label="tickets a month"
              size="md"
            />
            <StatCard
              value={formatMins(crm.median_first_response_mins)}
              label="median first response"
              size="md"
            />
            <StatCard
              value={String(crm.repeat_contact_customers)}
              label="repeat-contact customers"
              size="md"
            />
          </div>

          {/* top intents */}
          <div className="cxa-crm-block">
            <p className="cxa-crm-block-title">Top intents</p>
            <div className="cxa-crm-minibars">
              {crm.top_intents.map((t) => (
                <div className="cxa-crm-minibar-row" key={t.intent}>
                  <span className="cxa-crm-minibar-label">
                    {INTENT_LABELS[t.intent]}
                  </span>
                  <span className="cxa-crm-minibar-track">
                    <span
                      className="cxa-crm-minibar-fill"
                      style={{ width: `${(t.share / maxShare) * 100}%` }}
                    />
                  </span>
                  <span className="cxa-crm-minibar-value">{formatShare(t.share)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* insights, compact */}
          <div className="cxa-crm-block">
            <p className="cxa-crm-block-title">What the tickets said</p>
            <div className="cxa-crm-insights">
              {crm.insights.map((insight) => (
                <div className="cxa-crm-insight" key={insight.title}>
                  <div className="cxa-crm-insight-head">
                    <h3 className="cxa-crm-insight-title">{insight.title}</h3>
                    <Badge variant="outline">{insight.evidence_count} tickets</Badge>
                  </div>
                  <p className="cxa-crm-insight-pattern">{insight.pattern}</p>
                  <div className="cxa-crm-insight-memory">
                    <Avatar variant="agent" size="sm" />
                    <p className="cxa-crm-insight-memory-text">
                      {insight.what_siena_memory_would_do}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* handoff properties */}
          <div className="cxa-crm-block">
            <p className="cxa-crm-block-title">Handoff details</p>
            <dl className="cxa-crm-props">
              <div className="cxa-crm-prop">
                <dt>Assumptions</dt>
                <dd>
                  {crm.assumptions.handleTimeMins} min handle ·{" "}
                  {formatPerTicket(crm.assumptions.loadedCostPerTicket)} loaded ·{" "}
                  {formatPerTicket(crm.assumptions.automatedCostPerTicket)} automated
                </dd>
              </div>
              <div className="cxa-crm-prop">
                <dt>Fast track</dt>
                <dd>
                  {crm.fast_track
                    ? "Yes — score above 70 and volume above 3,000"
                    : "Not yet — below the score-and-volume bar"}
                </dd>
              </div>
              <div className="cxa-crm-prop">
                <dt>Generated</dt>
                <dd>{formatDateTime(crm.generated_at)}</dd>
              </div>
              <div className="cxa-crm-prop">
                <dt>Audit slug</dt>
                <dd>{crm.audit_slug}</dd>
              </div>
              <div className="cxa-crm-prop">
                <dt>Report</dt>
                <dd>
                  <Link className="cxa-crm-report-link" href={crm.report_url}>
                    Open the full report
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <p className="cxa-crm-footnote">
          POSTed to HubSpot webhook (stubbed) — payload below is the design.
        </p>

        <details className="cxa-crm-raw">
          <summary>Raw payload</summary>
          <pre>{JSON.stringify(crm, null, 2)}</pre>
        </details>
      </div>
    </main>
  );
}
