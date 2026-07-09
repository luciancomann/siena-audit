"use client";

/**
 * Chili Piper concierge booking, embedded under the report's CTA line.
 * Loads Siena's concierge script once and runs the inbound-router deploy
 * the moment it lands. If the script can't load (offline playground, ad
 * blocker), the card falls back to the plain booking link so the CTA
 * never dead-ends.
 */
import { useEffect, useState } from "react";
import { Button, Card } from "@siena/design-system";

declare global {
  interface Window {
    ChiliPiper?: {
      deploy: (account: string, router: string, options?: Record<string, unknown>) => void;
    };
  }
}

const SCRIPT_ID = "chilipiper-concierge";
const SCRIPT_SRC = "https://siena.chilipiper.com/concierge-js/cjs/concierge.js";
const ACCOUNT = "siena";
const ROUTER = "updated-dec2025--inbound_router_demo-request";

export function BookingEmbed() {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;

    const deploy = () => {
      if (cancelled) return;
      try {
        window.ChiliPiper?.deploy(ACCOUNT, ROUTER, { formType: "HTML" });
        setState("ready");
      } catch {
        setState("failed");
      }
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.ChiliPiper) deploy();
      else {
        existing.addEventListener("load", deploy);
        existing.addEventListener("error", () => !cancelled && setState("failed"));
      }
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.crossOrigin = "anonymous";
    script.type = "text/javascript";
    script.async = true;
    script.onload = deploy;
    script.onerror = () => {
      if (!cancelled) setState("failed");
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "failed") {
    return (
      <Card tone="white" radius="md" padding="sm" className="cxa-cta-calendar">
        <p className="cxa-cta-calendar-note">
          The calendar couldn&rsquo;t load here — the button above books the same
          30 minutes.
        </p>
        <Button
          variant="secondary"
          size="md"
          href="https://www.siena.cx/book-a-demo"
          target="_blank"
          rel="noopener"
        >
          Open the booking page
        </Button>
      </Card>
    );
  }

  return (
    <Card tone="white" radius="md" padding="sm" className="cxa-cta-calendar">
      <div id="cxa-booking" className="cxa-booking" aria-label="Pick a time for the walkthrough" />
      {state === "loading" && (
        <p className="cxa-cta-calendar-note">Loading live availability…</p>
      )}
    </Card>
  );
}
