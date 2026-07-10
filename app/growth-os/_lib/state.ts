"use client";

/**
 * Growth OS client state — one localStorage document, versioned, shared by
 * every module. Pages render the seed defaults on the server, then hydrate
 * the persisted overrides after mount (no hydration mismatch, interactions
 * survive refresh).
 *
 * SEED VERSIONING: the storage key carries the seed version. Any dataset
 * change bumps KEY (v2, v3, …) so every visitor — new or returning — is
 * re-seeded on next load. Old keys are ignored and cleaned up.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { BetStatus, ChannelId, CostToRun, Deal } from "./data";
import { BETS, CHANNELS, DEALS } from "./data";

/** Bump on ANY seed/dataset change. */
export const SEED_VERSION = 3;
const KEY = `growth-os-v${SEED_VERSION}`;
const OLD_KEYS = ["growth-os-v1", "growth-os-v2"];

// ---------------------------------------------------------------- shapes

export interface KilledChannel {
  reason: string;
  date: string; // ISO
  spendAtDeath: number;
  meetingsAtDeath: number;
  costPerMeetingAtDeath: number | null;
  /** where the freed budget went (channel id → $), so a restore can pull it back */
  reallocated?: Partial<Record<ChannelId, number>>;
}

export interface BetKill {
  reason: string;
  date: string; // ISO
  numbersAtDeath: string; // one line, e.g. "score 16 · Queued · 4w to signal"
}

/** A bet drafted from a signal — lives in state, merges into the board. */
export interface DraftBet {
  id: string;
  name: string;
  what: string;
  whatFull: string;
  why: string;
  killCriteria: string;
  nextAction: string;
  owner: string;
  metric: string;
  compounds: boolean;
  timeToSignalWeeks: number;
  costToRun: CostToRun;
  categoryFit: 1 | 2 | 3 | 4 | 5;
  sourceSignal: string; // the objection text it was drafted from
}

export interface ActionLog {
  text: string;
  at: string; // ISO
}

/** A signal appended by the board when a deal is lost to a named competitor. */
export interface LostSignal {
  text: string;
  at: string; // ISO
}

export interface GrowthState {
  seedVersion: number;
  betStatus: Record<string, BetStatus>;
  /** Manual drag order (bet ids); null = composite score order. */
  betOrder: string[] | null;
  spend: Record<ChannelId, number>;
  killedChannels: Partial<Record<ChannelId, KilledChannel>>;
  betKills: Record<string, BetKill>;
  draftBets: DraftBet[];
  /** objection text -> draft bet id */
  signalDrafts: Record<string, string>;
  digestGeneratedAt: string | null;
  /** session decisions the digest narrates (kills, reallocations, deal moves) */
  actions: ActionLog[];
  /** the deals board — full objects; "synced from HubSpot" in production */
  deals: Deal[];
  /** signal entries appended by lost-to-competitor events */
  lostSignals: LostSignal[];
}

export function defaultState(): GrowthState {
  return {
    seedVersion: SEED_VERSION,
    betStatus: Object.fromEntries(BETS.map((b) => [b.id, b.defaultStatus])),
    betOrder: null,
    spend: Object.fromEntries(
      CHANNELS.map((c) => [c.id, c.defaultSpend]),
    ) as Record<ChannelId, number>,
    killedChannels: {},
    betKills: {},
    draftBets: [],
    signalDrafts: {},
    digestGeneratedAt: null,
    actions: [],
    deals: DEALS,
    lostSignals: [],
  };
}

function read(): GrowthState {
  const base = defaultState();
  try {
    for (const old of OLD_KEYS) window.localStorage.removeItem(old);
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<GrowthState>;
    if (saved.seedVersion !== SEED_VERSION) return base; // stale seed — re-seed
    return {
      ...base,
      betStatus: { ...base.betStatus, ...(saved.betStatus ?? {}) },
      betOrder: Array.isArray(saved.betOrder) ? saved.betOrder : null,
      spend: { ...base.spend, ...(saved.spend ?? {}) },
      killedChannels: saved.killedChannels ?? {},
      betKills: saved.betKills ?? {},
      draftBets: Array.isArray(saved.draftBets) ? saved.draftBets : [],
      signalDrafts: saved.signalDrafts ?? {},
      digestGeneratedAt: saved.digestGeneratedAt ?? null,
      actions: Array.isArray(saved.actions) ? saved.actions : [],
      deals: Array.isArray(saved.deals) && saved.deals.length > 0 ? saved.deals : base.deals,
      lostSignals: Array.isArray(saved.lostSignals) ? saved.lostSignals : [],
    };
  } catch {
    return base;
  }
}

function write(state: GrowthState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — state still lives for the session */
  }
}

// One shared store for every useGrowthState() instance — pages, the command
// bar, and the shell all read the same document, so an edit made anywhere is
// live everywhere immediately (no per-hook snapshots to go stale, no two
// instances clobbering each other's writes).
const SERVER_SNAPSHOT = defaultState();
let current: GrowthState = SERVER_SNAPSHOT;
let storeHydrated = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

function hydrateStore(): void {
  if (storeHydrated) return;
  storeHydrated = true;
  current = read();
  emit();
}

function applyPatch(
  patch: Partial<GrowthState> | ((prev: GrowthState) => Partial<GrowthState>),
): void {
  current = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
  write(current);
  emit();
}

/** Load-after-mount localStorage state, write-through on every update. */
export function useGrowthState(): [
  GrowthState,
  (patch: Partial<GrowthState> | ((prev: GrowthState) => Partial<GrowthState>)) => void,
  boolean,
] {
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => SERVER_SNAPSHOT,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateStore();
    setHydrated(true);
  }, []);

  const update = useCallback(applyPatch, []);

  return [state, update, hydrated];
}
