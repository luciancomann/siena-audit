/**
 * Shared page chrome for the CX Audit surfaces — the minimal nav and the
 * honest little footer. Server-safe (no state, no handlers beyond hrefs),
 * styled entirely with --sds-* tokens.
 */
import Link from "next/link";
import { Badge, Button } from "@siena/design-system";
import "./chrome.css";

/** The Siena wordmark (from the clone's harvested sprite) + CX Audit pill —
    the one logo cluster every CX Audit surface shares. */
export function CxaLogo() {
  return (
    <>
      <svg
        viewBox="0 0 120.976 31.324"
        style={{
          width: 108,
          height: 28,
          display: "block",
          color: "var(--sds-ink-900)",
          fill: "currentColor",
        }}
        role="img"
        aria-label="Siena"
      >
        <use href="#svg1470285565_4871" />
      </svg>
      <Badge variant="filled" className="cxa-nav-pill">
        CX Audit
      </Badge>
    </>
  );
}

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
        <CxaLogo />
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
