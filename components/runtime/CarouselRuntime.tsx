"use client";

/**
 * Replicates Framer's runtime behavior for the two homepage testimonial
 * carousels (custom code component "Carousel" on the live site):
 *
 *   .framer-1kknw4s-container — "Wall of love" testimonials
 *       11 slides, 1 per page at every breakpoint, SLIDE transition
 *   .framer-66vi1x-container — "Customer Stories" cards
 *       14 cards; 3 per page (desktop ≥1200), 2 (tablet 810–1199.98),
 *       1 (phone ≤809.98); FADE transition when a page holds several cards,
 *       SLIDE at phone (measured: live's mode follows items-per-page)
 *
 * Everything below was measured on https://www.siena.cx with Playwright
 * (capture scripts in the scratchpad's tools/agent-carousel/):
 *
 * Rest state — Framer's hydration overrides the SSR canvas CSS with inline
 * layout styles; without them the static clone renders the slides as a
 * 923px-wide vertical stack. We apply the exact same inline styles:
 *   c1 track  "width: 100%; height: auto; min/max-width/height: unset"
 *   c1 item   "height: auto; …unset…; width: 100%"
 *   c2 track  same + "display: flex; gap: 16px; flex-flow: row; align-items: stretch"
 *   c2 item   "width: calc(33.3333% - 10.6667px)" (3-up) / "calc(50% - 8px)" (2-up)
 * Non-current pages get inline `display: none`, exactly like live.
 *
 * Controls — one row injected after the fixed-height wrapper inside each
 * ssr-variant: 40px round prev/next buttons + "1 / N" counter (verbatim
 * outerHTML from the live DOM; 40px tall row, margin-top 24px → this is the
 * 64px of height the static clone was missing).
 *
 * SLIDE transition (c1), measured: track locks to its current pixel height
 * with position:relative + overflow:hidden; outgoing and incoming slides go
 * position:absolute; incoming starts at translateX(100%); both animate with
 * `transform 300ms ease-in-out` (outgoing → -100%, incoming → 0). Cleanup
 * (display swap + style restore + counter update) lands on the first frame
 * after the transition — live mutation timeline: styles set at t≈2ms,
 * cleaned at t≈322ms. Both next AND prev animate in the same direction
 * (incoming always enters from the right) — verified by rAF-polling
 * computed transforms during prev clicks.
 *
 * FADE transition (c2), measured: the column wrapper (parent of the track)
 * gets `transition: opacity 150ms ease-in-out; opacity: 0`; ~170ms later the
 * page's items are display-swapped, the counter updates and opacity returns
 * to 1; ~170ms after that the transition/opacity inline styles are removed
 * (live mutation timeline: t≈1ms fade-out, t≈172ms swap, t≈343ms cleanup).
 *
 * Other measured behaviors matched here:
 *  - wrap-around in both directions (prev from page 1 → last page)
 *  - clicks ignored while a transition runs (live rapid double-click
 *    advances only once)
 *  - counter updates at transition END for slide mode, at the swap for fade
 *  - NO auto-advance (live counter polled for 35s: never moved), so there
 *    is nothing to pause on tab hide
 *  - no drag/swipe (live shows default cursor; synthesized touch pans do
 *    not change the page) and no button hover style change
 *  - last c2 page shows only the remainder (2 cards on desktop: items 12,13)
 *
 * Phone slides — Framer SSRs the phone ssr-variant of the "Wall of love"
 * carousel with the desktop slide layout (framer-1tbaed4 items) and its
 * hydration swaps in a phone-specific layout (framer-1iacnpu items, 614px
 * tall at 390px vs 527px for the desktop markup). The static clone only has
 * the SSR markup, so the live phone slides were harvested post-hydration
 * (assets rewritten to /assets/) and are swapped in here the same way —
 * see carousel-phone-slides.ts.
 *
 * prefers-reduced-motion: the live site keeps these click-triggered
 * transitions as-is (verified with reducedMotion:"reduce" emulation), but
 * per project policy we swap pages instantly when reduced motion is set.
 */
import { useEffect } from "react";

import {
  PHONE_SLIDES,
  PHONE_SPRITE_DEF,
  PHONE_SPRITE_ID,
} from "./carousel-phone-slides";

const SLIDE_MS = 300;
const FADE_MS = 150;
// Live cleanup fires on the first frame after the transition finishes.
const FRAME_PAD_MS = 20;

/* ---------------------------------------------------------------- styles */

// Verbatim inline styles captured from the hydrated live DOM.
const TRACK_PLAIN =
  "width: 100%; height: auto; min-width: unset; min-height: unset; max-width: unset; max-height: unset;";
const TRACK_ROW =
  "width: 100%; height: auto; min-width: unset; min-height: unset; max-width: unset; max-height: unset; display: flex; gap: 16px; flex-flow: row; align-items: stretch;";
const ITEM_FULL =
  "height: auto; min-width: unset; min-height: unset; max-width: unset; max-height: unset; width: 100%;";
const ITEM_THIRD =
  "width: calc(33.3333% - 10.6667px); flex-shrink: 0; height: auto; min-width: unset; min-height: unset; max-width: unset; max-height: unset; flex-grow: 0;";
const ITEM_HALF =
  "width: calc(50% - 8px); flex-shrink: 0; height: auto; min-width: unset; min-height: unset; max-width: unset; max-height: unset; flex-grow: 0;";

const BUTTON_STYLE =
  "width: 40px; height: 40px; min-width: 40px; border-radius: 40px; background: rgba(244, 237, 222, 0.6); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0px; overflow: hidden; flex-shrink: 0; z-index: 10; position: relative;";
const COUNTER_STYLE =
  "font-size: 14px; color: var(--token-76690f9a-b442-46af-8a97-1e9974f4bb5d, rgb(18, 32, 35)); user-select: none; font-variant-numeric: tabular-nums;";

const chevron = (points: string) =>
  `<svg width="45%" height="45%" viewBox="0 0 24 24" fill="none" stroke="var(--token-7148f7d7-7330-4820-a9d3-9d5e947c2a3f, rgb(167, 160, 146))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"></polyline></svg>`;

/* ---------------------------------------------------------------- config */

type VariantLayout = {
  perPage: number;
  mode: "slide" | "fade";
  track: string;
  item: string;
};
type CarouselConfig = {
  containerClass: string;
  /** replace the phone variant's slides with the live-harvested markup */
  bakePhoneSlides?: boolean;
  layouts: { desktop: VariantLayout; tablet: VariantLayout; phone: VariantLayout };
};

const SINGLE: VariantLayout = {
  perPage: 1,
  mode: "slide",
  track: TRACK_PLAIN,
  item: ITEM_FULL,
};

const CONFIGS: CarouselConfig[] = [
  {
    containerClass: "framer-1kknw4s-container",
    bakePhoneSlides: true,
    layouts: { desktop: SINGLE, tablet: SINGLE, phone: SINGLE },
  },
  {
    containerClass: "framer-66vi1x-container",
    layouts: {
      desktop: { perPage: 3, mode: "fade", track: TRACK_ROW, item: ITEM_THIRD },
      tablet: { perPage: 2, mode: "fade", track: TRACK_ROW, item: ITEM_HALF },
      phone: SINGLE,
    },
  },
];

/**
 * Breakpoint an .ssr-variant belongs to, from its hidden-* classes
 * (page.css: hidden-72rtr7 hides ≥1200, hidden-1vabw2g hides 810–1199.98,
 * hidden-1un5pxf hides ≤809.98).
 */
function variantBreakpoint(variant: HTMLElement): "desktop" | "tablet" | "phone" {
  if (!variant.classList.contains("hidden-72rtr7")) return "desktop";
  if (!variant.classList.contains("hidden-1vabw2g")) return "tablet";
  return "phone";
}

/* ----------------------------------------------------------------- setup */

/**
 * variant > outerPad > fixedH > column > trackWrapper > track > item*
 * (same shape as the live DOM).
 */
function findTrack(variant: HTMLElement) {
  const outerPad = variant.firstElementChild as HTMLElement | null;
  const fixedH = outerPad?.firstElementChild as HTMLElement | null;
  const column = fixedH?.firstElementChild as HTMLElement | null;
  const trackWrapper = column?.firstElementChild as HTMLElement | null;
  const track = trackWrapper?.firstElementChild as HTMLElement | null;
  if (!outerPad || !fixedH || !column || !trackWrapper || !track) return null;
  return { outerPad, column, track };
}

function setupVariant(
  variant: HTMLElement,
  layout: VariantLayout
): (() => void) | null {
  const parts = findTrack(variant);
  if (!parts) return null;
  const { outerPad, column, track } = parts;
  const { mode } = layout;

  const items = Array.from(track.children) as HTMLElement[];
  const { perPage } = layout;
  if (items.length <= perPage) return null;
  const pageCount = Math.ceil(items.length / perPage);

  // Snapshot pristine inline styles so unmount can restore the static DOM.
  const originals = {
    track: track.getAttribute("style"),
    column: column.getAttribute("style"),
    items: items.map((el) => el.getAttribute("style")),
  };
  const columnBase = originals.column ?? "";

  let page = 0;
  let animating = false;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const itemStyle = (visible: boolean) =>
    layout.item + (visible ? "" : " display: none;");

  const onPage = (i: number, p: number) =>
    i >= p * perPage && i < (p + 1) * perPage;

  const applyPage = (p: number) => {
    items.forEach((el, i) => {
      el.style.cssText = itemStyle(onPage(i, p));
    });
  };

  // ---- rest-state layout (what Framer's hydration produces on live)
  track.style.cssText = layout.track;
  applyPage(0);

  // ---- controls row (verbatim from the live runtime DOM)
  const row = document.createElement("div");
  row.style.cssText =
    "width: 100%; display: flex; justify-content: center; margin-top: 24px;";
  row.innerHTML =
    `<div style="display: flex; align-items: center; gap: 12px;">` +
    `<button style="${BUTTON_STYLE}">${chevron("15 18 9 12 15 6")}</button>` +
    `<div style="${COUNTER_STYLE}"><span>1</span><span style="opacity: 0.4;"> / ${pageCount}</span></div>` +
    `<button style="${BUTTON_STYLE}">${chevron("9 18 15 12 9 6")}</button>` +
    `</div>`;
  outerPad.appendChild(row);

  const buttons = row.querySelectorAll("button");
  const prevButton = buttons[0] as HTMLButtonElement;
  const nextButton = buttons[1] as HTMLButtonElement;
  const currentSpan = row.querySelector("span") as HTMLSpanElement;

  const setCounter = (p: number) => {
    currentSpan.textContent = String(p + 1);
  };

  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- transitions ---- */

  const slideTo = (target: number) => {
    // perPage is always 1 in slide mode.
    const outgoing = items[page];
    const incoming = items[target];
    const lockHeight = track.offsetHeight;

    track.style.cssText =
      layout.track +
      ` height: ${lockHeight}px; position: relative; overflow: hidden;`;
    outgoing.style.cssText =
      layout.item +
      " position: absolute; top: 0px; left: 0px; width: 100%; transform: translateX(0px);";
    incoming.style.cssText =
      layout.item +
      " position: absolute; top: 0px; left: 0px; width: 100%; transform: translateX(100%);";

    // Commit start positions, then transition (as live does — the incoming
    // slide always enters from the right, for prev as well as next).
    void track.offsetWidth;
    outgoing.style.transition = `transform ${SLIDE_MS}ms ease-in-out`;
    incoming.style.transition = `transform ${SLIDE_MS}ms ease-in-out`;
    outgoing.style.transform = "translateX(-100%)";
    incoming.style.transform = "translateX(0px)";

    later(() => {
      outgoing.style.cssText = itemStyle(false);
      incoming.style.cssText = itemStyle(true);
      track.style.cssText = layout.track;
      page = target;
      setCounter(page); // live updates the counter after the slide completes
      animating = false;
    }, SLIDE_MS + FRAME_PAD_MS);
  };

  const fadeTo = (target: number) => {
    column.style.cssText =
      columnBase + `; transition: opacity ${FADE_MS}ms ease-in-out; opacity: 0;`;
    later(() => {
      applyPage(target);
      page = target;
      setCounter(page); // live updates the counter at the swap
      column.style.opacity = "1";
      later(() => {
        column.style.cssText = columnBase; // live strips transition + opacity
        animating = false;
      }, FADE_MS + FRAME_PAD_MS);
    }, FADE_MS + FRAME_PAD_MS);
  };

  const goTo = (target: number) => {
    if (animating || target === page) return;
    if (reducedMotion()) {
      applyPage(target);
      page = target;
      setCounter(page);
      return;
    }
    animating = true;
    if (mode === "slide") slideTo(target);
    else fadeTo(target);
  };

  const onPrev = () => goTo((page - 1 + pageCount) % pageCount);
  const onNext = () => goTo((page + 1) % pageCount);
  prevButton.addEventListener("click", onPrev);
  nextButton.addEventListener("click", onNext);

  return () => {
    timers.forEach((t) => window.clearTimeout(t));
    prevButton.removeEventListener("click", onPrev);
    nextButton.removeEventListener("click", onNext);
    row.remove();
    const restore = (el: HTMLElement, style: string | null) => {
      if (style === null) el.removeAttribute("style");
      else el.setAttribute("style", style);
    };
    restore(track, originals.track);
    restore(column, originals.column);
    items.forEach((el, i) => restore(el, originals.items[i]));
  };
}

/**
 * Swaps the phone variant's SSR slides (desktop markup) for the harvested
 * live phone markup, and makes sure the sprite it references exists.
 * Returns a restore function.
 */
function bakePhoneSlides(variant: HTMLElement): (() => void) | null {
  const parts = findTrack(variant);
  if (!parts) return null;
  const { track } = parts;
  const originalHTML = track.innerHTML;
  track.innerHTML = PHONE_SLIDES.join("");

  let spriteHost: HTMLElement | null = null;
  if (!document.getElementById(PHONE_SPRITE_ID)) {
    spriteHost = document.createElement("div");
    // Same hidden container Framer parks hydration-created sprites in.
    spriteHost.style.cssText =
      "position: absolute; overflow: hidden; bottom: 0; left: 0; width: 0; height: 0; z-index: 0; contain: strict";
    spriteHost.innerHTML = PHONE_SPRITE_DEF;
    document.body.appendChild(spriteHost);
  }

  return () => {
    track.innerHTML = originalHTML;
    spriteHost?.remove();
  };
}

export function CarouselRuntime() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    for (const config of CONFIGS) {
      const container = document.querySelector<HTMLElement>(
        `.${config.containerClass}`
      );
      if (!container || container.dataset.carouselEnhanced) continue;
      container.dataset.carouselEnhanced = "true";
      const variants = container.querySelectorAll<HTMLElement>(
        ":scope > .ssr-variant"
      );
      variants.forEach((variant) => {
        const breakpoint = variantBreakpoint(variant);
        if (config.bakePhoneSlides && breakpoint === "phone") {
          const restore = bakePhoneSlides(variant);
          if (restore) cleanups.push(restore);
        }
        const cleanup = setupVariant(variant, config.layouts[breakpoint]);
        if (cleanup) cleanups.push(cleanup);
      });
      cleanups.push(() => delete container.dataset.carouselEnhanced);
    }
    // Cleanups restore most-recent first so baked slides are re-instated
    // after the carousel styling that was applied on top of them.
    return () => cleanups.reverse().forEach((fn) => fn());
  }, []);

  return null;
}
