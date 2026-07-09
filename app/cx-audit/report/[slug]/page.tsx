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
import { loadReport } from "../_components/load-report";
import { IntentBars } from "../_components/IntentBars";
import { MathExplorer } from "../_components/MathExplorer";
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

export default async function ReportPage({ params }: PageProps) {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) notFound();

  const { metrics, benchmark, copy, math } = report;

  return (
    <main className="cxa-report">
      <TopBar report={report} />

      {/* 1 — Headline */}
      <header className="cxa-container cxa-section cxa-hero">
        <p className="cxa-hero-eyebrow">
          {report.brand} · {formatNumber(metrics.sampleSize)} of{" "}
          {formatNumber(metrics.totalInExport)} tickets ·{" "}
          {formatDateRange(metrics.dateRange.from, metrics.dateRange.to)}
        </p>
        <div className="cxa-hero-score">
          <StatCard
            value={copy.headlineStat}
            label="automation potential, out of 100"
            size="xl"
            gradient
          />
        </div>
        <h1 className="sds-display-lg cxa-hero-human">{copy.headlineHuman}</h1>
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
        <IntentBars intents={metrics.intents} />
      </section>

      {/* 3 — What Siena would say */}
      <section className="cxa-container cxa-section">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="02 · Conversations"
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
                <div className="cxa-chat-cart">
                  <Badge variant="filled">adds to cart</Badge>
                </div>
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
          eyebrow="03 · Patterns"
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
                <Badge variant="outline">{insight.evidence_count} tickets</Badge>
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
          eyebrow="04 · Cost and hours"
          title="The math"
          subtitle={copy.mathIntro}
        />
        <MathExplorer
          monthlyVolumeEstimate={metrics.monthlyVolumeEstimate}
          automatableShare={metrics.automatableShare}
          defaults={report.assumptions}
          revenueNote={math.prePurchaseRevenueNote}
        />
      </section>

      {/* 6 — Benchmark (new page in print) */}
      <section className="cxa-container cxa-section cxa-page-break">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="05 · Benchmark"
          title="Next to brands your size"
          subtitle={copy.benchmarkIntro}
        />
        <div className="cxa-bench-grid">
          <Card tone="cream" radius="lg" padding="md" className="cxa-bench-col">
            <p className="cxa-bench-col-label">{report.brand}</p>
            <div className="cxa-bench-stats">
              <StatCard
                value={String(metrics.automationPotentialScore)}
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
                value={String(benchmark.peerScore)}
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
        <p className="cxa-bench-ceiling">
          The strongest brands in this band reach {benchmark.automationCeiling} — a
          ceiling worth aiming at, not the average.
        </p>
        <p className="cxa-bench-caveat">{benchmark.caveatLine}</p>
      </section>

      {/* 7 — What we couldn't see */}
      <section className="cxa-container cxa-section cxa-couldnt">
        <SectionHeading
          align="left"
          as="h2"
          eyebrow="06 · Honest limits"
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
      <section className="cxa-container cxa-section cxa-no-print">
        <Card tone="sand" radius="xl" padding="lg" className="cxa-cta-card">
          <h2 className="sds-display-md cxa-cta-line">{copy.ctaLine}</h2>
          <div className="cxa-cta-actions">
            <Button
              variant="primary"
              size="xl"
              href="https://www.siena.cx/book-a-demo"
              target="_blank"
              rel="noopener"
            >
              Walk through your audit with us
            </Button>
            <CopyLinkButton />
          </div>
          <Card tone="white" radius="md" padding="sm" className="cxa-cta-calendar">
            <p className="cxa-cta-calendar-note">
              calendar embed — live availability goes here
            </p>
          </Card>
        </Card>
      </section>
    </main>
  );
}

function TopBar({ report }: { report: AuditReport }) {
  return (
    <div className="cxa-no-print cxa-topbar">
      <div className="cxa-container cxa-topbar-inner">
        <Link className="cxa-wordmark" href="/cx-audit">
          <span className="cxa-wordmark-siena">Siena</span>
          <span className="cxa-wordmark-sub">CX Audit</span>
        </Link>
        <div className="cxa-topbar-actions">
          <Link
            className="cxa-topbar-link"
            href={`/cx-audit/crm-preview/${report.slug}`}
          >
            View the sales handoff
          </Link>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
