import type { Metadata } from "next";
import { Banner } from "@siena/design-system";
import { CxaNav, CxaFooter } from "./_components/Chrome";
import { AuditOnboarding } from "./_components/AuditOnboarding";
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

        <AuditOnboarding />

        <CxaFooter />
      </div>
    </>
  );
}
