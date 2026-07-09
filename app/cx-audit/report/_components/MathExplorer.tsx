"use client";

/**
 * "The math" — the savings stats over editable assumptions, plus the
 * revenue scenario: a separately-labeled model of what answering
 * pre-purchase questions in seconds is worth. The two are never summed —
 * savings are savings, the scenario is a scenario. Both recompute live
 * with the exact arithmetic the pipeline's MathSection uses, so the
 * defaults reproduce report.math to the dollar.
 */
import { useState } from "react";
import { Card, Input, StatCard } from "@siena/design-system";
import type { Assumptions, RevenueScenario } from "@/lib/cx-audit/types";
import {
  formatMoney,
  formatNumber,
  formatPerTicket,
} from "./format";

interface MathExplorerProps {
  monthlyVolumeEstimate: number;
  automatableShare: number;
  defaults: Assumptions;
  /** Absent when the export shows no pre-purchase volume — no scenario then. */
  revenueDefaults?: RevenueScenario;
}

interface Field {
  value: number;
  error?: string;
}

function parseField(raw: string, fallback: number, max: number): Field {
  if (raw.trim() === "") return { value: fallback, error: `Blank — using ${fallback}` };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { value: fallback, error: `Numbers only — using ${fallback}` };
  }
  // per-field ceilings keep the products inside safe-integer land — no "$∞"
  if (n > max) {
    return { value: fallback, error: `Too large — using ${fallback}` };
  }
  return { value: n };
}

export function MathExplorer({
  monthlyVolumeEstimate,
  automatableShare,
  defaults,
  revenueDefaults,
}: MathExplorerProps) {
  const [handleRaw, setHandleRaw] = useState(String(defaults.handleTimeMins));
  const [loadedRaw, setLoadedRaw] = useState(String(defaults.loadedCostPerTicket));
  const [autoRaw, setAutoRaw] = useState(String(defaults.automatedCostPerTicket));
  const [preRaw, setPreRaw] = useState(String(revenueDefaults?.prePurchasePerMonth ?? 0));
  const [convRaw, setConvRaw] = useState(String(revenueDefaults?.incrementalConversionPct ?? 12));
  const [aovRaw, setAovRaw] = useState(String(revenueDefaults?.averageOrderValue ?? 65));

  const handleTime = parseField(handleRaw, defaults.handleTimeMins, 1440);
  const loadedCost = parseField(loadedRaw, defaults.loadedCostPerTicket, 100_000);
  const autoCost = parseField(autoRaw, defaults.automatedCostPerTicket, 100_000);
  const prePurchase = parseField(preRaw, revenueDefaults?.prePurchasePerMonth ?? 0, 10_000_000);
  const conversion = parseField(convRaw, revenueDefaults?.incrementalConversionPct ?? 12, 100);
  const aov = parseField(aovRaw, revenueDefaults?.averageOrderValue ?? 65, 1_000_000);

  // Mirrors MathSection: pure arithmetic, no model math.
  const autoTickets = Math.round(automatableShare * monthlyVolumeEstimate);
  const hours = Math.round((autoTickets * handleTime.value) / 60);
  const costToday = Math.round(autoTickets * loadedCost.value);
  const costAutomated = Math.round(autoTickets * autoCost.value);
  const savings = costToday - costAutomated;

  // Mirrors computeRevenueScenario: annual from the unrounded monthly, so
  // the two lines never disagree by a rounding step.
  const revenueExact = prePurchase.value * (conversion.value / 100) * aov.value;
  const revenueMonthly = Math.round(revenueExact);
  const revenueAnnual = Math.round(revenueExact * 12);

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
        {/* the revenue side — a labeled scenario, never summed with savings */}
        {revenueDefaults && (
          <div className="cxa-revenue-card">
            <span className="cxa-revenue-card__tag">Revenue scenario</span>
            <StatCard
              value={formatMoney(revenueMonthly)}
              label="recovered revenue per month, modeled"
              size="md"
            />
            <p className="cxa-math-annual">
              {formatMoney(revenueAnnual)} a year, at your volume
            </p>
          </div>
        )}
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
      {revenueDefaults && (
        <>
          <div className="cxa-math-inputs cxa-math-inputs--revenue">
            <Input
              label="Pre-purchase conversations / month"
              type="number"
              value={preRaw}
              onChange={(e) => setPreRaw(e.target.value)}
              error={prePurchase.error}
            />
            <Input
              label="Incremental conversion rate (%)"
              type="number"
              value={convRaw}
              onChange={(e) => setConvRaw(e.target.value)}
              error={conversion.error}
            />
            <Input
              label="Average order value ($)"
              type="number"
              value={aovRaw}
              onChange={(e) => setAovRaw(e.target.value)}
              error={aov.error}
            />
          </div>
          <p className="cxa-math-note">
            The scenario: shoppers get an answer in seconds instead of five hours,
            and a portion of them buy instead of moving on. Change the
            assumptions — it&rsquo;s your math now.
          </p>
        </>
      )}
    </Card>
  );
}
