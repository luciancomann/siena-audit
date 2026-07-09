/**
 * Shared page chrome for the CX Audit surfaces — the minimal nav and the
 * honest little footer. Server-safe (no state, no handlers beyond hrefs),
 * styled entirely with --sds-* tokens.
 */
import Link from "next/link";
import { Badge, Button } from "@siena/design-system";

export function CxaNav() {
  return (
    <header
      className="cxa-no-print"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sds-space-3)",
        padding: "var(--sds-space-5) 0",
      }}
    >
      <Link
        href="/cx-audit"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sds-space-3)",
          textDecoration: "none",
          color: "var(--sds-text-primary)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--sds-font-display)",
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          siena
        </span>
        <Badge variant="filled">CX Audit</Badge>
      </Link>
      <Button variant="secondary" size="sm" href="/cx-audit/report/verabloom">
        See a sample audit
      </Button>
    </header>
  );
}

export function CxaFooter() {
  return (
    <footer
      className="cxa-no-print"
      style={{
        borderTop: "1px solid var(--sds-black-alpha-20)",
        marginTop: "var(--sds-space-8)",
        padding: "var(--sds-space-6) 0",
      }}
    >
      <p
        className="sds-mono-label"
        style={{ color: "var(--sds-text-muted)", textAlign: "center", margin: 0 }}
      >
        A Siena testing playground. Not affiliated with production siena.cx.
      </p>
    </footer>
  );
}
