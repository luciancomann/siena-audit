/**
 * The audit report — the taste centerpiece. Server component: loads
 * data/reports/<slug>.json and renders the AuditReport contract with the
 * Siena Design System. Interactivity (editable math, copy link, print)
 * lives in small client components under ../_components.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChatBubble,
  SectionHeading,
  StatCard,
} from "@siena/design-system";
import type { AuditReport } from "@/lib/cx-audit/types";
import { CxaLogo } from "../../audit/_components/Chrome";
import { loadReport } from "../_components/load-report";
import { IntentBars } from "../_components/IntentBars";
import { Ladder } from "../_components/Ladder";
import { MathExplorer } from "../_components/MathExplorer";
import { BookingEmbed } from "../_components/BookingEmbed";
import { CopyLinkButton } from "../_components/CopyLinkButton";
import { PrintButton } from "../_components/PrintButton";
import {
  formatDateRange,
  formatMins,
  formatNumber,
} from "../_components/format";
import "../report.css";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ internal?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) return { title: "CX audit report | Siena" };
  return {
    title: `${report.brand} — CX audit report | Siena`,
    description: report.copy.headlineHuman,
  };
}

/** Warm initials for the customer side of the chat mockups. */
const CUSTOMER_INITIALS = ["AL", "MJ", "SR", "KT", "DP"];

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { internal } = await searchParams;
  const report = await loadReport(slug);
  if (!report) notFound();

  const { metrics, benchmark, copy, math } = report;

  return (
    <main className="cxa-report">
      <TopBar report={report} showInternal={internal === "1"} />

      {/* 1 — Headline */}
      <header className="cxa-container cxa-section cxa-hero">
        <p className="cxa-hero-eyebrow">
          {report.prepared_for ? `Prepared for ${report.prepared_for} · ` : ""}
          {report.brand} · {formatNumber(metrics.sampleSize)} of{" "}
          {formatNumber(metrics.totalInExport)} tickets ·{" "}
          {formatDateRange(metrics.dateRange.from, metrics.dateRange.to)}
        </p>
        <div className="cxa-hero-score">
          <StatCard
            value={`${copy.headlineStat}%`}
            label="automation potential"
            size="xl"
            gradient
          />
        </div>
        <h1 className="sds-display-lg cxa-hero-human">{copy.headlineHuman}</h1>
        {math.prePurchaseTicketsPerMonth > 0 && (
          <p className="cxa-hero-revenue">
            <span className="cxa-hero-revenue__num">
              {formatNumber(math.prePurchaseTicketsPerMonth)}
            </span>{" "}
            of them were trying to buy.
          </p>
        )}
        <p className="cxa-hero-reconcile">
          {Math.round(metrics.automatableShare * 1000) / 10}% of your volume maps to
          actions Siena resolves end to end. Confidence-weighting what we could read
          brings the score to {metrics.automationPotentialScore}.
        </p>
      </header>

      {/* 2 — Volume by intent */}
      <section className="cxa-container cxa-section">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="01 · The queue"
          title="Volume by intent"
          subtitle={copy.volumeIntro}
        />
        <IntentBars intents={metrics.intents} longTail={metrics.longTail} />
      </section>

      {/* 2b — The complexity ladder */}
      <section className="cxa-container cxa-section">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="02 · The ladder"
          title="Where the ladder ends"
          subtitle="Not all automation is equal. Here's where each rung stops on your queue."
        />
        <Ladder intents={metrics.intents} sampleSize={metrics.sampleSize} />
      </section>

      {/* 3 — What Siena would say */}
      <section className="cxa-container cxa-section">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="03 · Conversations"
          title="What Siena would say"
          subtitle={copy.chatIntro}
        />
        <div className="cxa-chat-grid">
          {report.chatMockups.map((mock, i) => (
            <Card
              key={mock.intentLabel}
              tone="white"
              radius="lg"
              padding="sm"
              className="cxa-chat-card"
            >
              <p className="cxa-chat-card-label">{mock.intentLabel}</p>
              <div className="cxa-chat-lines">
                {mock.lines.map((line, j) => (
                  <ChatBubble
                    key={j}
                    variant={line.role === "siena" ? "agent" : "customer"}
                    size="md"
                    avatarInitials={CUSTOMER_INITIALS[i % CUSTOMER_INITIALS.length]}
                  >
                    {line.text}
                  </ChatBubble>
                ))}
              </div>
              {mock.endsInCart && (
                <>
                  <div className="cxa-chat-cart">
                    <Badge variant="filled">adds to cart</Badge>
                  </div>
                  {math.prePurchaseTicketsPerMonth > 0 && (
                    <p className="cxa-chat-revenue-caption">
                      This conversation ended in an order. There were{" "}
                      {formatNumber(math.prePurchaseTicketsPerMonth)} questions like
                      this one last month.
                    </p>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* 4 — Insights (new page in print) */}
      <section className="cxa-container cxa-section cxa-page-break">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="04 · Patterns"
          title="What your tickets know that you don't"
          subtitle={copy.insightsIntro}
        />
        <div className="cxa-insights">
          {report.insights.map((insight) => (
            <Card
              key={insight.title}
              tone="sand"
              radius="lg"
              padding="md"
              className="cxa-insight-card"
            >
              <div className="cxa-insight-head">
                <h3 className="sds-display-md cxa-insight-title">{insight.title}</h3>
                <Badge variant="outline">
                  {insight.evidence_count} in this sample
                  {insight.title.includes("a month")
                    ? ` · ~${formatNumber(math.prePurchaseTicketsPerMonth)}/mo`
                    : ""}
                </Badge>
              </div>
              <p className="cxa-insight-pattern">{insight.pattern}</p>
              <div className="cxa-insight-memory">
                <Avatar variant="agent" size="sm" />
                <p className="cxa-insight-memory-text">
                  {insight.what_siena_memory_would_do}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 5 — The math */}
      <section className="cxa-container cxa-section">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="05 · Cost, hours, and the upside"
          title="The math"
          subtitle={copy.mathIntro}
        />
        <MathExplorer
          monthlyVolumeEstimate={metrics.monthlyVolumeEstimate}
          automatableShare={metrics.automatableShare}
          defaults={report.assumptions}
          revenueDefaults={
            math.prePurchaseTicketsPerMonth > 0 ? math.revenueScenario : undefined
          }
        />
        {math.prePurchaseTicketsPerMonth > 0 && (
          <p className="cxa-math-exclusion">
            We left your {formatNumber(math.prePurchaseTicketsPerMonth)}{" "}
            pre-purchase tickets out of the savings math on purpose. Selling
            isn&rsquo;t a cost to cut — it gets its own model, and its own agent.
          </p>
        )}
      </section>

      {/* 6 — Benchmark (new page in print) */}
      <section className="cxa-container cxa-section cxa-page-break">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="06 · Benchmark"
          title="Next to brands your size"
          subtitle={copy.benchmarkIntro}
        />
        <div className="cxa-bench-grid">
          <Card tone="cream" radius="lg" padding="md" className="cxa-bench-col">
            <p className="cxa-bench-col-label">{report.brand}</p>
            <div className="cxa-bench-stats">
              <StatCard
                value={`${metrics.automationPotentialScore}%`}
                label="automation potential"
                size="md"
              />
              <StatCard
                value={formatMins(metrics.medianFirstResponseMins)}
                label="median first response"
                size="md"
              />
            </div>
          </Card>
          <Card tone="white" radius="lg" padding="md" className="cxa-bench-col">
            <p className="cxa-bench-col-label">
              Brands your size · {benchmark.volumeBand}
            </p>
            <div className="cxa-bench-stats">
              <StatCard
                value={`${benchmark.peerScore}%`}
                label="automation potential"
                size="md"
              />
              <StatCard
                value={formatMins(benchmark.peerFirstResponseMins)}
                label="median first response"
                size="md"
              />
            </div>
          </Card>
        </div>
        {metrics.medianFirstResponseMins > benchmark.peerFirstResponseMins * 1.5 && (
          <p className="cxa-bench-takeaway">
            Your customers wait almost twice as long as brands your size.
            That&rsquo;s the gap Siena closes first.
          </p>
        )}
        <p className="cxa-bench-ceiling">
          The strongest brands in this band reach {benchmark.automationCeiling}% — a
          ceiling worth aiming at, not the average.
        </p>
        <p className="cxa-bench-caveat">{benchmark.caveatLine}</p>
      </section>

      {/* 7 — What we couldn't see */}
      <section className="cxa-container cxa-section cxa-couldnt">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="07 · Honest limits"
          title="What we couldn't see"
        />
        <ul className="cxa-couldnt-list">
          {copy.couldntSee.map((line, i) => (
            <li key={i} className="cxa-couldnt-item">
              <span className="cxa-couldnt-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="cxa-couldnt-text">{line}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 8 — CTA (screen only) */}
      <section id="book" className="cxa-container cxa-section cxa-no-print">
        <Card tone="sand" radius="xl" padding="lg" className="cxa-cta-card">
          <h2 className="sds-display-md cxa-cta-line">{copy.ctaLine}</h2>
          {math.prePurchaseTicketsPerMonth > 0 && (
            <p className="cxa-cta-aov">
              Bring your real AOV. We&rsquo;ll turn the scenario into your number.
            </p>
          )}
          <div className="cxa-cta-actions">
            <Button
              variant="primary"
              size="xl"
              href="https://www.siena.cx/book-a-demo"
              target="_blank"
              rel="noopener"
            >
              Book 30 minutes
            </Button>
            <CopyLinkButton />
          </div>
          <BookingEmbed />
        </Card>
      </section>
    </main>
  );
}

function TopBar({
  report,
  showInternal,
}: {
  report: AuditReport;
  showInternal: boolean;
}) {
  return (
    <div className="cxa-no-print cxa-topbar">
      <div className="cxa-container cxa-topbar-inner">
        <Link className="cxa-wordmark" href="/cx-audit">
          <CxaLogo />
        </Link>
        <div className="cxa-topbar-actions">
          {/* Reviewer-only: the prospect never sees the sales handoff.
              Append ?internal=1 to the report URL to reveal it. */}
          {showInternal && (
            <Link
              className="cxa-topbar-link cxa-topbar-link--internal"
              href={`/cx-audit/crm-preview/${report.slug}`}
            >
              <span className="cxa-internal-tag">Internal</span>
              View the sales handoff
            </Link>
          )}
          <Button variant="secondary" size="sm" href="#book">
            Walk through it with us
          </Button>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
