import type { Metadata } from "next";
import { Banner, SectionHeading } from "@siena/design-system";
import { CxaNav, CxaFooter } from "./_components/Chrome";
import { AuditFlow } from "./_components/AuditFlow";
import "./audit.css";

export const metadata: Metadata = {
  title: "Run your audit | Siena CX Audit",
  description:
    "Upload a helpdesk CSV, connect Gorgias or Zendesk, or open the sample. Nine agents read your tickets and hand back an honest audit.",
};

export default function AuditInputPage() {
  return (
    <>
      <Banner
        className="cxa-no-print"
        lead="Demo mode —"
        href="/cx-audit/report/verabloom"
        linkLabel="See a sample audit"
      >
        OAuth scaffolded, production flow documented in the README.
      </Banner>

      <div className="cxa-container">
        <CxaNav />

        <section className="cxa-section cxa-audit-head">
          <SectionHeading
            as="h1"
            eyebrow="Free CX audit"
            title="Start with your last 500 tickets."
            subtitle="Three ways in — a CSV export, a helpdesk connection, or the sample. The same nine agents read them either way."
          />
          <AuditFlow />
        </section>

        <CxaFooter />
      </div>
    </>
  );
}
