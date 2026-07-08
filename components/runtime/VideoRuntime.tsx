"use client";

/**
 * Video playback enhancer.
 *
 * Homepage videos (6x ambient loop clips inside the nav "Products" dropdown
 * Mini-Icon items) ship as <video loop muted playsinline preload="none">
 * with NO autoplay attribute. Framer's runtime calls play() the moment the
 * hosting component becomes visible (verified live: all videos flip
 * paused=false when the dropdown opens, and keep playing afterwards — they
 * are never paused again).
 *
 * This enhancer reproduces that contract without coupling to how NavRuntime
 * shows/hides the dropdown: every ~300ms it checks not-yet-started videos and
 * calls play() once the element is laid out (non-zero rect), inside the
 * viewport and not display:none / visibility:hidden. Opacity is deliberately
 * NOT part of the gate — on live, videos play while their container is still
 * at opacity 0 (the hover reveal only fades them in). A MutationObserver
 * picks up videos injected later (e.g. dropdown DOM created at runtime).
 *
 * prefers-reduced-motion: auto-playback is skipped entirely, matching the
 * project convention of suppressing auto-motion.
 */
import { useEffect } from "react";

type CheckVisibilityOpts = {
  checkOpacity?: boolean;
  checkVisibilityCSS?: boolean;
  contentVisibilityAuto?: boolean;
  opacityProperty?: boolean;
  visibilityProperty?: boolean;
};

function isRevealed(v: HTMLVideoElement): boolean {
  if (!v.isConnected) return false;
  const r = v.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
  const check = (v as HTMLVideoElement & { checkVisibility?: (o?: CheckVisibilityOpts) => boolean }).checkVisibility;
  if (typeof check === "function") {
    // display:none / visibility:hidden gate only — opacity intentionally ignored
    return check.call(v, { checkVisibilityCSS: true, visibilityProperty: true });
  }
  for (let n: HTMLElement | null = v; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
  }
  return true;
}

export function VideoRuntime() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // no auto playback under reduced motion

    const started = new WeakSet<HTMLVideoElement>();
    const pending = new Set<HTMLVideoElement>();

    const register = (v: HTMLVideoElement) => {
      if (started.has(v) || pending.has(v)) return;
      // Framer background videos are always muted inline loops; enforce the
      // attributes autoplay policies require in case injected DOM missed them.
      v.muted = true;
      v.playsInline = true;
      pending.add(v);
    };

    document.querySelectorAll("video").forEach(register);

    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        rec.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node instanceof HTMLVideoElement) register(node);
          node.querySelectorAll?.("video").forEach((v) => register(v as HTMLVideoElement));
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const tick = () => {
      for (const v of pending) {
        if (!v.isConnected) continue;
        if (!isRevealed(v)) continue;
        pending.delete(v);
        started.add(v);
        v.play().catch(() => {
          // autoplay rejected (e.g. power saver) — retry on next reveal cycle
          started.delete(v);
          pending.add(v);
        });
      }
    };
    tick();
    const interval = window.setInterval(tick, 300);

    return () => {
      window.clearInterval(interval);
      mo.disconnect();
    };
  }, []);

  return null;
}
