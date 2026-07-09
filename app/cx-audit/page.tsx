import {
  Button,
  Card,
  ChatBubble,
  SectionHeading,
  TestimonialCard,
} from "@siena/design-system";
import { CxaNav, CxaFooter } from "./audit/_components/Chrome";
import "./landing.css";

const STEPS = [
  {
    num: "01",
    title: "Upload your export",
    body: "A CSV from your helpdesk, or a Gorgias or Zendesk connection. 500 tickets is enough to see the pattern.",
  },
  {
    num: "02",
    title: "Nine agents read it",
    body: "Ingest, redaction, classification, insight — each stage reports in as it runs, and PII is stripped before any model reads a word.",
  },
  {
    num: "03",
    title: "Get the audit",
    body: "An automation score, the gaps behind it, and the insights your queue has been trying to surface.",
  },
];

const TRUST_ROWS = [
  {
    title: "Processed in memory",
    body: "Your export is parsed, sampled, and audited without ever landing in a database.",
  },
  {
    title: "PII redacted before analysis",
    body: "A regex pre-pass strips emails, phone numbers, order numbers, and addresses before any model call is made.",
  },
  {
    title: "Nothing stored beyond your report",
    body: "The finished report lives at its link so you can share it. The raw tickets are gone the moment it's built.",
  },
];

export default function CxAuditLandingPage() {
  return (
    <div className="cxa-container">
      <CxaNav />

      {/* ------------------------------------------------------------ hero */}
      <section className="cxa-section cxl-hero">
        <div className="cxl-hero__copy">
          <SectionHeading
            as="h1"
            align="left"
            eyebrow="Free CX audit"
            title="Your tickets already know."
            subtitle="Most brands guess what AI could automate. Your last 500 tickets hold the real answer. Free audit, 5 minutes."
          />
          <div className="cxl-hero__ctas">
            <Button variant="primary" size="xl" href="/cx-audit/audit">
              Run your audit
            </Button>
            <Button variant="secondary" size="xl" href="/cx-audit/report/verabloom">
              See a sample audit
            </Button>
          </div>
        </div>

        <Card tone="white" radius="xl" padding="sm" className="cxl-chat-card">
          <span className="sds-mono-label">Ticket #1,204 · Where is my order?</span>
          <div className="cxl-chat-lines">
            <ChatBubble variant="customer" avatarInitials="MR">
              Hi! My order says &ldquo;in transit&rdquo; but it hasn&rsquo;t moved in four
              days — it&rsquo;s a birthday gift and I&rsquo;m getting nervous.
            </ChatBubble>
            <ChatBubble variant="agent">
              I see it — your package cleared the carrier&rsquo;s Memphis hub this morning
              and lands Thursday, two days before the party. Fresh tracking link is in
              your inbox. Sorry the quiet made you worry.
            </ChatBubble>
            <ChatBubble variant="customer" avatarInitials="MR">
              Oh, that&rsquo;s such a relief. Thank you!
            </ChatBubble>
          </div>
          <p className="cxl-chat-caption">
            Answered in seconds, in your voice — that&rsquo;s the bar for every ticket the
            audit counts as automatable.
          </p>
        </Card>
      </section>

      {/* ---------------------------------------------------- how it works */}
      <section className="cxa-section cxl-stack">
        <SectionHeading
          as="h2"
          eyebrow="How it works"
          title="Five minutes, nine agents, one honest answer."
        />
        <div className="cxl-steps">
          {STEPS.map((step) => (
            <Card key={step.num} tone="cream" radius="lg" padding="md" className="cxl-step">
              <span className="cxl-step__num">{step.num}</span>
              <h3 className="cxl-step__title">{step.title}</h3>
              <p className="cxl-step__body">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- trust block */}
      <section className="cxa-section">
        <Card tone="dark" radius="lg" padding="lg" className="cxl-trust">
          <span className="sds-mono-label cxl-trust__eyebrow">
            What happens to your data
          </span>
          <div className="cxl-trust__rows">
            {TRUST_ROWS.map((row) => (
              <div key={row.title} className="cxl-trust-row">
                <h3 className="cxl-trust-row__title">{row.title}</h3>
                <p className="cxl-trust-row__body">{row.body}</p>
              </div>
            ))}
          </div>
          <p className="cxl-trust__footnote">
            That&rsquo;s the whole list. If a claim isn&rsquo;t here, we&rsquo;re not
            making it.
          </p>
        </Card>
      </section>

      {/* -------------------------------------------------------- quotes */}
      <section className="cxa-section cxl-stack">
        <SectionHeading as="h2" eyebrow="Customer stories" title="Teams that stopped guessing." />
        <div className="cxl-quotes">
          <TestimonialCard
            quote="Siena felt like a girlfriend from day one. It handles 50% of our conversations at 90%+ CSAT, cut handle time in half, and customers ask for it by name. I'm winning budget conversations against marketing because I can tie CX directly to revenue."
            brand="SPANX"
            author="Kylah Field"
            role="VP of Global CX & Insights at Spanx"
          />
          <TestimonialCard
            quote="Siena's unique responses are what people love most. We've had customers say her answers inspired them to purchase, because they just felt so comfortable with her. They feel that safety with Siena, which helps them purchase."
            brand="@everydaydose"
            author="Beatriz Lopes"
            role="Head of Customer Experience"
          />
        </div>
      </section>

      {/* ---------------------------------------------------- closing CTA */}
      <section className="cxa-section">
        <div className="cxl-cta">
          <SectionHeading
            as="h2"
            title="Your queue is already talking."
            subtitle="Five minutes from export to answer. Free, and honest about what it can't see."
          />
          <div className="cxl-hero__ctas">
            <Button variant="primary" size="xl" href="/cx-audit/audit">
              Run your audit
            </Button>
            <Button variant="secondary" size="xl" href="/cx-audit/report/verabloom">
              See a sample audit
            </Button>
          </div>
        </div>
      </section>

      <CxaFooter />
    </div>
  );
}
