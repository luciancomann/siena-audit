import type { Metadata } from "next";
import "@siena/design-system/styles.css";
import "./cx-audit.css";

export const metadata: Metadata = {
  title: "CX Audit — your tickets already know | Siena",
  description:
    "Most brands guess what AI could automate. Your last 500 tickets hold the real answer. Free audit, 5 minutes.",
};

export default function CxAuditLayout({ children }: { children: React.ReactNode }) {
  return <div className="cxa-root">{children}</div>;
}
