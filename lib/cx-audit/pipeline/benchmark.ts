/**
 * Stage 6 — Benchmark agent.
 * A static table keyed by monthly volume band. Monthly volume is estimated
 * upstream in metrics (dateRange + totalInExport). Deliberately directional
 * — the caveat line ships with every report.
 */
import type { Benchmark, Metrics } from "../types";

interface Band {
  max: number; // exclusive upper bound on monthly volume
  volumeBand: string;
  peerScore: number;
  peerFirstResponseMins: number;
  automationCeiling: number;
}

const BANDS: Band[] = [
  {
    max: 1_000,
    volumeBand: "under 1,000 tickets/month",
    peerScore: 52,
    peerFirstResponseMins: 96,
    automationCeiling: 78,
  },
  {
    max: 2_500,
    volumeBand: "1,000–2,500 tickets/month",
    peerScore: 55,
    peerFirstResponseMins: 118,
    automationCeiling: 82,
  },
  {
    max: 7_500,
    volumeBand: "2,500–7,500 tickets/month",
    peerScore: 58,
    peerFirstResponseMins: 138,
    automationCeiling: 85,
  },
  {
    max: 20_000,
    volumeBand: "7,500–20,000 tickets/month",
    peerScore: 61,
    peerFirstResponseMins: 155,
    automationCeiling: 87,
  },
  {
    max: Number.POSITIVE_INFINITY,
    volumeBand: "over 20,000 tickets/month",
    peerScore: 64,
    peerFirstResponseMins: 170,
    automationCeiling: 90,
  },
];

export const BENCHMARK_CAVEAT =
  "Benchmarks are directional — drawn from anonymized patterns across consumer brands at your volume, not a certified study.";

export function buildBenchmark(metrics: Metrics): Benchmark {
  const volume = Math.max(0, metrics.monthlyVolumeEstimate);
  const band = BANDS.find((b) => volume < b.max) ?? BANDS[BANDS.length - 1];
  return {
    volumeBand: band.volumeBand,
    peerScore: band.peerScore,
    peerFirstResponseMins: band.peerFirstResponseMins,
    automationCeiling: band.automationCeiling,
    caveatLine: BENCHMARK_CAVEAT,
  };
}
