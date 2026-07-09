"use client";

/**
 * Scaffolded OAuth connect screen for the supported helpdesks (see
 * providers.ts — Gorgias, Zendesk, Kustomer, Intercom, Gladly).
 *
 * Realistic chrome — provider mark, read-only scope list, authorize button —
 * but demo-honest: Authorize shows a brief "Connecting…" state, then routes
 * to the precomputed sample report with ?demo=1. No request leaves the page.
 * The production flow is documented in the README.
 */
import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card } from "@siena/design-system";
import { CxaNav, CxaFooter } from "../../audit/_components/Chrome";
import {
  HELPDESK_PROVIDERS,
  type HelpdeskProvider,
} from "../../audit/_components/providers";
import "../../audit/audit.css";

const PROVIDERS: Record<string, HelpdeskProvider> = Object.fromEntries(
  HELPDESK_PROVIDERS.map((p) => [p.slug, p]),
);

const SCOPES = [
  {
    label: "Read tickets",
    detail: "Subjects, bodies, and timestamps — the raw material of the audit.",
  },
  {
    label: "Read customers",
    detail:
      "Hashed into repeat-contact patterns. Names never survive the redaction pass.",
  },
];

function ScopeCheckIcon() {
  return (
    <svg
      className="cxc-scope__icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.8 8.3 7 10.4l4.2-4.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ConnectProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = use(params);
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const timerRef = useRef<number | null>(null);

  const config = PROVIDERS[provider];

  const authorize = () => {
    if (connecting || timerRef.current !== null) return;
    setConnecting(true);
    timerRef.current = window.setTimeout(() => {
      router.push("/cx-audit/report/verabloom?demo=1");
    }, 1400);
  };

  return (
    <>
      <div className="cxa-container">
        <CxaNav />

        <section className="cxa-section">
          <div className="cxc-wrap">
            {config ? (
              <Card tone="white" radius="lg" padding="md" className="cxc-card">
                <div className="cxc-avatars">
                  <span className="cxc-provider-mark">
                    <img src={config.logo} alt={config.name} />
                  </span>
                  <span className="cxc-avatars__link" aria-hidden="true">
                    ⇄
                  </span>
                  <Avatar variant="agent" size="lg" />
                </div>

                <div className="cxc-head">
                  <span className="cxc-head__tag">OAuth · read-only</span>
                  <h1 className="cxc-head__title">
                    Connect {config.name} to your CX audit
                  </h1>
                  <p className="cxc-head__sub">
                    The audit agent is requesting read-only access to{" "}
                    {config.workspaceHint}.
                  </p>
                </div>

                <ul className="cxc-scopes">
                  {SCOPES.map((scope) => (
                    <li key={scope.label} className="cxc-scope">
                      <ScopeCheckIcon />
                      <span className="cxc-scope__text">
                        <span className="cxc-scope__label">{scope.label}</span>
                        <span className="cxc-scope__detail">{scope.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="cxc-nowrite">
                  No write access. Nothing is posted back to your queue.
                </p>

                <div className="cxc-actions">
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={connecting}
                    onClick={authorize}
                  >
                    {connecting ? (
                      <span className="cxc-connecting">
                        <span className="cxa-spinner" aria-hidden="true" />
                        Connecting to {config.name}…
                      </span>
                    ) : (
                      `Authorize ${config.name}`
                    )}
                  </Button>
                  <Button variant="secondary" size="md" href="/cx-audit/audit">
                    Back to audit options
                  </Button>
                </div>

                <p className="cxc-smallprint">
                  Demo mode — no request leaves this page.
                </p>
              </Card>
            ) : (
              <Card tone="sand" radius="lg" padding="md" className="cxc-card">
                <div className="cxc-head">
                  <span className="cxc-head__tag">Not connected</span>
                  <h1 className="cxc-head__title">
                    We can&rsquo;t connect that helpdesk yet.
                  </h1>
                  <p className="cxc-head__sub">
                    Gorgias, Zendesk, Kustomer, Intercom, and Gladly are wired up
                    today. For anything else, a CSV export gets you the same audit.
                  </p>
                </div>
                <div className="cxc-actions">
                  <Button variant="primary" size="md" href="/cx-audit/connect/gorgias">
                    Connect Gorgias
                  </Button>
                  <Button variant="secondary" size="md" href="/cx-audit/connect/zendesk">
                    Connect Zendesk
                  </Button>
                  <Button variant="secondary" size="md" href="/cx-audit/audit">
                    Upload a CSV instead
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </section>

        <CxaFooter />
      </div>
    </>
  );
}
