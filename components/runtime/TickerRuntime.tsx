"use client";

/**
 * Infinite logo tickers/marquees in the homepage "Logos" section.
 *
 * Replicates Framer's Ticker runtime exactly as measured on www.siena.cx
 * (see scratchpad siena/tools/agent-ticker/measure-live.js):
 *
 *  - Two tickers, each SSR'd as 3 breakpoint variants of
 *    div[data-framer-name="Ticker"] > ul > li.ticker-item. The ul ships at
 *    opacity 0 / translateX(-gap); the runtime flips opacity to 1 and drives
 *    the transform.
 *  - .framer-1ygwzxs (24 logos) moves RIGHT at exactly 30 px/s;
 *    .framer-1l9mfm0 (23 logos) moves LEFT at exactly 30 px/s. Same speed at
 *    1440 / 1024 / 390 (r² = 1.00000, linear — no easing).
 *  - No content duplication. Seamless wrap uses item recycling: with the ul
 *    x kept in [-W, 0] (W = row width + one gap), any li fully past the left
 *    viewport edge (x + left + width < 0) gets an inline
 *    `transform: translateX(W px)` bump that re-tiles it one period to the
 *    right; all others get `transform: none`. Verified against live per-item
 *    inline transforms (bump 4977px at 1440 for ticker 1, 5259px for ticker 2).
 *  - Start phase 0: leftward ul starts at x = 0, rightward at x = -W (all
 *    items bumped — visually identical to x = 0).
 *  - Pauses when the ticker is off-screen (live delta over 3 s scrolled away
 *    was exactly 0) and when the tab is hidden. No hover pause (live hover
 *    speed measured 29.81/-30.03 px/s — unchanged).
 *  - prefers-reduced-motion: no motion, but the ul is still made visible at
 *    its resting arrangement (live shows opacity 1, speed 0).
 */
import { useEffect } from "react";

type TickerConfig = {
  /** stable framer class of the ticker root div (one per breakpoint variant) */
  cls: string;
  /** px/s, measured on live at 1440/1024/390 */
  speed: number;
  /** +1 = drifts right, -1 = drifts left */
  direction: 1 | -1;
};

const TICKERS: TickerConfig[] = [
  { cls: "framer-1ygwzxs", speed: 30, direction: 1 },
  { cls: "framer-1l9mfm0", speed: 30, direction: -1 },
];

/** Frame deltas above this are treated as a pause (tab hidden, IO gap). */
const MAX_FRAME_DELTA_MS = 100;

type ItemGeom = { el: HTMLElement; left: number; width: number; bumped: boolean };

class TickerInstance {
  private root: HTMLElement;
  private ul: HTMLElement;
  private config: TickerConfig;
  private items: ItemGeom[] = [];
  /** period: natural row width + one flex gap */
  private W = 0;
  /** distance travelled within the current period, px in [0, W) */
  private phase = 0;
  private measured = false;
  private inView = false;
  private io: IntersectionObserver;
  private ro: ResizeObserver;

  constructor(root: HTMLElement, ul: HTMLElement, config: TickerConfig) {
    this.root = root;
    this.ul = ul;
    this.config = config;

    // Live flips these at hydration with no fade (opacity 0 -> 1 in one frame).
    ul.style.opacity = "1";
    ul.style.willChange = "transform";

    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        this.inView = e.isIntersecting;
        if (this.inView && !this.measured) this.measure();
        if (this.inView) this.apply();
      }
    });
    this.io.observe(root);

    // Re-measure when the variant's layout size changes (breakpoint flip,
    // window resize). offsetLeft/offsetWidth ignore transforms, so bumped
    // items measure at their natural flex positions.
    this.ro = new ResizeObserver(() => {
      if (this.root.offsetWidth > 0) {
        this.measure();
        this.apply();
      } else {
        this.measured = false; // hidden variant: stale geometry
      }
    });
    this.ro.observe(ul);

    if (root.offsetWidth > 0) {
      this.measure();
      this.apply();
    }
  }

  private measure() {
    const lis = Array.from(this.ul.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );
    if (!lis.length) return;
    this.items = lis.map((el) => ({
      el,
      left: el.offsetLeft,
      width: el.offsetWidth,
      bumped: el.style.transform !== "none" && el.style.transform !== "",
    }));
    const last = this.items[this.items.length - 1];
    const cs = getComputedStyle(this.ul);
    const gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 0;
    const W = last.left + last.width + gap;
    if (W <= 0) return;
    if (this.measured && this.W > 0) this.phase = this.phase % W;
    this.W = W;
    this.measured = true;
  }

  /** Advance by dt (seconds) and repaint. Returns true if it animated. */
  tick(dt: number): boolean {
    if (!this.inView || !this.measured || this.W <= 0) return false;
    this.phase = (this.phase + this.config.speed * dt) % this.W;
    this.apply();
    return true;
  }

  /** Paint the current phase: ul transform + per-item recycling bumps. */
  private apply() {
    if (!this.measured || this.W <= 0) return;
    // x stays within [-W, 0]: leftward runs 0 -> -W, rightward -W -> 0.
    const x = this.config.direction < 0 ? -this.phase : this.phase - this.W;
    this.ul.style.transform = `translateX(${x}px)`;
    for (const item of this.items) {
      // Fully past the left viewport edge => show its copy one period right.
      const bump = x + item.left + item.width < 0;
      if (bump !== item.bumped) {
        item.el.style.transform = bump ? `translateX(${this.W}px)` : "none";
        item.bumped = bump;
      }
    }
  }

  /** Reduced motion: resting arrangement, visible, no animation. */
  applyStatic() {
    if (this.root.offsetWidth > 0 && !this.measured) this.measure();
    this.phase = 0;
    this.apply();
  }

  destroy() {
    this.io.disconnect();
    this.ro.disconnect();
  }
}

export function TickerRuntime() {
  useEffect(() => {
    const instances: TickerInstance[] = [];
    for (const config of TICKERS) {
      for (const root of document.querySelectorAll<HTMLElement>(`.${config.cls}`)) {
        const ul = root.querySelector<HTMLElement>(":scope > ul");
        if (ul) instances.push(new TickerInstance(root, ul, config));
      }
    }
    if (!instances.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let lastTs: number | null = null;

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (lastTs !== null) {
        const deltaMs = ts - lastTs;
        // A long gap means we were paused (hidden tab / throttled) — hold
        // position instead of jumping ahead, like the live site.
        const dt = deltaMs > MAX_FRAME_DELTA_MS ? 0 : deltaMs / 1000;
        if (dt > 0) for (const inst of instances) inst.tick(dt);
      }
      lastTs = ts;
    };

    const start = () => {
      if (!raf) {
        lastTs = null;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTs = null;
    };

    const onMotionPref = () => {
      if (reduced.matches) {
        stop();
        for (const inst of instances) inst.applyStatic();
      } else {
        start();
      }
    };
    onMotionPref();
    reduced.addEventListener("change", onMotionPref);

    const onVisibility = () => {
      // rAF already halts in hidden tabs; this just resets the clock so the
      // first frame back doesn't integrate the hidden interval.
      if (!document.hidden) lastTs = null;
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      reduced.removeEventListener("change", onMotionPref);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const inst of instances) inst.destroy();
    };
  }, []);

  return null;
}
