"use client";

/**
 * Growth OS client state — one localStorage document, versioned, shared by
 * every module. Pages render the seed defaults on the server, then hydrate
 * the persisted overrides after mount (no hydration mismatch, interactions
 * survive refresh).
 */
import { useCallback, useEffect, useState } from "react";
import type { BetStatus, ChannelId } from "./data";
import { BETS, CHANNELS } from "./data";

const KEY = "growth-os-v1";

export interface GrowthState {
  betStatus: Record<string, BetStatus>;
  /** Manual drag order (bet ids); null = composite score order. */
  betOrder: string[] | null;
  spend: Record<ChannelId, number>;
}

export function defaultState(): GrowthState {
  return {
    betStatus: Object.fromEntries(BETS.map((b) => [b.id, b.defaultStatus])),
    betOrder: null,
    spend: Object.fromEntries(
      CHANNELS.map((c) => [c.id, c.defaultSpend]),
    ) as Record<ChannelId, number>,
  };
}

function read(): GrowthState {
  const base = defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<GrowthState>;
    return {
      betStatus: { ...base.betStatus, ...(saved.betStatus ?? {}) },
      betOrder: Array.isArray(saved.betOrder) ? saved.betOrder : null,
      spend: { ...base.spend, ...(saved.spend ?? {}) },
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

/** Load-after-mount localStorage state, write-through on every update. */
export function useGrowthState(): [
  GrowthState,
  (patch: Partial<GrowthState> | ((prev: GrowthState) => Partial<GrowthState>)) => void,
  boolean,
] {
  const [state, setState] = useState<GrowthState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(read());
    setHydrated(true);
  }, []);

  const update = useCallback(
    (patch: Partial<GrowthState> | ((prev: GrowthState) => Partial<GrowthState>)) => {
      setState((prev) => {
        const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
        write(next);
        return next;
      });
    },
    [],
  );

  return [state, update, hydrated];
}
