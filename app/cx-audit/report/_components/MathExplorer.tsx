"use client";

/**
 * "The math" — three stats over three editable assumptions. Recomputes live
 * in the client with the exact arithmetic the pipeline's MathSection uses:
 * round the automatable ticket count first, then hours and dollars. With the
 * report's default assumptions this reproduces report.math to the dollar.
 */
import { useState } from "react";
import { Card, Input, StatCard } from "@siena/design-system";
import type { Assumptions } from "@/lib/cx-audit/types";
import {
  formatMoney,
  formatNumber,
  formatPerTicket,
} from "./format";

interface MathExplorerProps {
  monthlyVolumeEstimate: number;
  automatableShare: number;
  defaults: Assumptions;
  revenueNote: string;
}

interface Field {
  value: number;
  error?: string;
}

function parseField(raw: string, fallback: number): Field {
  if (raw.trim() === "") return { value: fallback, error: `Blank — using ${fallback}` };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { value: fallback, error: `Numbers only — using ${fallback}` };
  }
  return { value: n };
}

export function MathExplorer({
  monthlyVolumeEstimate,
  automatableShare,
  defaults,
  revenueNote,
}: MathExplorerProps) {
  const [handleRaw, setHandleRaw] = useState(String(defaults.handleTimeMins));
  const [loadedRaw, setLoadedRaw] = useState(String(defaults.loadedCostPerTicket));
  const [autoRaw, setAutoRaw] = useState(String(defaults.automatedCostPerTicket));

  const handleTime = parseField(handleRaw, defaults.handleTimeMins);
  const loadedCost = parseField(loadedRaw, defaults.loadedCostPerTicket);
  const autoCost = parseField(autoRaw, defaults.automatedCostPerTicket);

  // Mirrors MathSection: pure arithmetic, no model math.
  const autoTickets = Math.round(automatableShare * monthlyVolumeEstimate);
  const hours = Math.round((autoTickets * handleTime.value) / 60);
  const costToday = Math.round(autoTickets * loadedCost.value);
  const costAutomated = Math.round(autoTickets * autoCost.value);
  const savings = costToday - costAutomated;

  return (
    <Card tone="cream" radius="lg" padding="md" className="cxa-math-card">
      <div className="cxa-math-stats">
        <StatCard
          value={formatNumber(hours)}
          label="hours back for your team, monthly"
          size="md"
        />
        <StatCard
          value={formatMoney(costToday)}
          label={`today — vs ${formatMoney(costAutomated)} at ${formatPerTicket(autoCost.value)} a ticket`}
          size="md"
        />
        <div className="cxa-math-savings">
          <StatCard
            value={formatMoney(savings)}
            label="saved every month, at your volume"
            size="md"
          />
          <p className="cxa-math-annual">
            {formatMoney(savings * 12)} a year, at your volume
          </p>
        </div>
      </div>
      <p className="cxa-math-basis">
        Basis: {formatNumber(autoTickets)} of your {formatNumber(monthlyVolumeEstimate)}{" "}
        monthly tickets — the ones Siena could resolve end to end.
      </p>
      <div className="cxa-math-inputs">
        <Input
          label="Handle time (minutes per ticket)"
          type="number"
          value={handleRaw}
          onChange={(e) => setHandleRaw(e.target.value)}
          error={handleTime.error}
        />
        <Input
          label="Loaded cost per ticket ($)"
          type="number"
          value={loadedRaw}
          onChange={(e) => setLoadedRaw(e.target.value)}
          error={loadedCost.error}
        />
        <Input
          label="Automated cost per ticket ($)"
          type="number"
          value={autoRaw}
          onChange={(e) => setAutoRaw(e.target.value)}
          error={autoCost.error}
        />
      </div>
      <p className="cxa-math-note">{revenueNote}</p>
    </Card>
  );
}
