/**
 * Pure formatting helpers shared by the report page and the CRM preview.
 * Locale is pinned to en-US so server and client render identically.
 */

const nf = new Intl.NumberFormat("en-US");

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatNumber(n: number): string {
  return nf.format(n);
}

/** Whole-dollar money: 18413 -> "$18,413". */
export function formatMoney(n: number): string {
  return `$${nf.format(Math.round(n))}`;
}

/** Per-ticket money keeps cents when present: 0.9 -> "$0.90", 8 -> "$8". */
export function formatPerTicket(n: number): string {
  return Number.isInteger(n) ? `$${nf.format(n)}` : `$${n.toFixed(2)}`;
}

/** Minutes -> "4h 12m" (or "45m" under an hour). */
export function formatMins(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** 0.28 -> "28%". */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function datePart(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** "2026-06-01" + "2026-06-30" -> "Jun 1 – Jun 30, 2026". */
export function formatDateRange(from: string, to: string): string {
  const a = datePart(from);
  const b = datePart(to);
  const left =
    a.y === b.y ? `${MONTHS[a.m - 1]} ${a.d}` : `${MONTHS[a.m - 1]} ${a.d}, ${a.y}`;
  const right = `${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  return `${left} – ${right}`;
}

/** ISO timestamp -> "Jul 8, 2026, 09:00 UTC" (UTC getters, no TZ drift). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}
