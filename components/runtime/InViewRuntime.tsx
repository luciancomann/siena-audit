"use client";

/**
 * Replays Framer's scroll-into-view entrance animations (homepage).
 *
 * Three element groups ship in SSR at their initial hidden keyframe (inline
 * opacity 0, translateY 50/80px) and are animated to their final state by
 * Framer's runtime when scrolled into view. All values below were measured on
 * the live site by rAF-sampling computed opacity/transform at 1440/1024/390:
 *
 * 1. Phone «Scroll Area» chat scenes (390): the Feature-1 order-tracking
 *    conversation and the Grüns shopping conversation. Each bubble has its
 *    own viewport trigger (fires as soon as it enters) plus a fixed delay,
 *    then a spring (fit: stiffness 86, damping 15, mass 1 — overshoots
 *    translateY by ~1.5% and settles in ~1s) drives translateY→0 with
 *    opacity = clamp(progress). Plays once per element; live does not
 *    re-animate on re-entry.
 *
 * 2. Desktop/tablet sticky-showcase scene-1 conversation: same bubbles
 *    with the same delays/spring, but triggered when the showcase scroll
 *    track (.framer-1wk619m) reaches the viewport top (sticky engagement) —
 *    measured trigger point on live. These live inside the MountedRuntime
 *    container (harvested at their initial hidden state), so they are found
 *    via a MutationObserver after injection.
 *
 * 3. The «80%» stat counter: fades in with a stiff spring (fit: 270/27,
 *    ~320ms) every time it enters the viewport (opacity resets to 0 when it
 *    leaves — live re-fades on every re-entry), and counts 25→80 once with
 *    duration 1.5s and cubic-bezier(.42,0,.58,1) (fit err 4e-4 across all
 *    55 integer crossings).
 *
 * prefers-reduced-motion: all targets jump straight to their final state.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { animate, type AnimationPlaybackControls } from "framer-motion";

type ChatItem = { sel: string; y: number; delay: number; trigger: "self" | "track" };

/** Sticky scroll track of the desktop/tablet feature showcase (SSR, unique). */
const TRACK_SEL = ".framer-1wk619m";

const CHAT_ITEMS: ChatItem[] = [
  // Phone «Feature 1» order-tracking conversation — delays 0.5s * k (measured)
  { sel: ".framer-st32cd", y: 80, delay: 0.5, trigger: "self" },
  { sel: ".framer-1wa6tng", y: 50, delay: 1.0, trigger: "self" },
  { sel: ".framer-g4cbwm", y: 50, delay: 1.5, trigger: "self" },
  { sel: ".framer-w0jts", y: 50, delay: 2.0, trigger: "self" },
  { sel: ".framer-1uh8716", y: 50, delay: 2.5, trigger: "self" },
  // Phone «Gruns» shopping conversation — delays 0.3/0.5/0.9 (measured)
  { sel: ".framer-vncnon", y: 80, delay: 0.3, trigger: "self" },
  { sel: ".framer-go2wqk", y: 80, delay: 0.5, trigger: "self" },
  { sel: ".framer-1o5w0mx", y: 80, delay: 0.9, trigger: "self" },
  // Desktop/tablet showcase scene 1 — same conversation, injected by MountedRuntime
  { sel: ".framer-1p1zvvd", y: 80, delay: 0.5, trigger: "track" },
  { sel: ".framer-20bhxt", y: 50, delay: 1.0, trigger: "track" },
  { sel: ".framer-19o1pgd", y: 50, delay: 1.5, trigger: "track" },
  { sel: ".framer-1ncs5z5", y: 50, delay: 2.0, trigger: "track" },
  { sel: ".framer-14e6dka", y: 50, delay: 2.5, trigger: "track" },
];

/** Spring driving both translateY→0 and opacity→clamp(progress). Fit to live. */
const CHAT_SPRING = { type: "spring", stiffness: 86, damping: 15, mass: 1 } as const;

const COUNTER_SEL = '[aria-label="Counter ends at 80"]';
const COUNT_FROM = 25;
const COUNT_TO = 80;
/** Counter fade spring, re-run on every viewport entry. Fit to live. */
const FADE_SPRING = { type: "spring", stiffness: 270, damping: 27, mass: 1 } as const;

/** Laid out at the current breakpoint (no display:none ancestor)? */
function isDisplayed(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

export function InViewRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls: AnimationPlaybackControls[] = [];
    const handled = new WeakSet<HTMLElement>(); // element instances already played/observed
    const itemOf = new WeakMap<HTMLElement, ChatItem>();
    const fadeControls = new WeakMap<HTMLElement, AnimationPlaybackControls>();
    const counted = new WeakSet<HTMLElement>();
    let trackEngaged = false;
    /** Track-triggered elements played in the current mount cycle. */
    const played = new WeakSet<HTMLElement>();
    /** Running entrance animation per element (stoppable for resets). */
    const chatControls = new WeakMap<HTMLElement, AnimationPlaybackControls>();

    function playChat(el: HTMLElement, item: ChatItem) {
      if (reduced) {
        el.style.opacity = "1";
        el.style.transform = "none";
        return;
      }
      const control = animate(0, 1, {
        ...CHAT_SPRING,
        delay: item.delay,
        onUpdate: (p) => {
          el.style.opacity = String(Math.min(1, p));
          el.style.transform = `translateY(${(1 - p) * item.y}px)`;
        },
        onComplete: () => {
          el.style.opacity = "1";
          el.style.transform = "none";
        },
      });
      controls.push(control);
      chatControls.set(el, control);
    }

    const trackItems = CHAT_ITEMS.filter((i) => i.trigger === "track");

    /** Play every displayed, not-yet-played showcase bubble. */
    function fireTrack() {
      for (const item of trackItems) {
        for (const el of document.querySelectorAll<HTMLElement>(item.sel)) {
          if (played.has(el) || !isDisplayed(el)) continue;
          played.add(el);
          playChat(el, item);
        }
      }
    }

    /**
     * Restore showcase bubbles to their initial hidden keyframe. Live unmounts
     * scene 1 once the showcase advances past it and remounts it hidden, so
     * after scrolling past the section the settled state is hidden again and
     * the entrance replays on the next engagement.
     */
    function resetTrack() {
      if (reduced) return;
      for (const item of trackItems) {
        for (const el of document.querySelectorAll<HTMLElement>(item.sel)) {
          if (!played.has(el)) continue;
          chatControls.get(el)?.stop();
          el.style.opacity = "0";
          el.style.transform = `translateY(${item.y}px)`;
          played.delete(el);
        }
      }
    }

    // --- per-element viewport trigger (phone chat scenes) ---
    const selfIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          selfIO.unobserve(el);
          const item = itemOf.get(el);
          if (item) playChat(el, item); // plays once; live doesn't re-animate on re-entry
        }
      },
      { threshold: 0 },
    );

    // --- sticky-showcase trigger: track top crosses the viewport top ---
    // rootMargin collapses the root to a line at the viewport top, so the
    // observer fires exactly when sticky engagement begins (as measured live).
    // Disengaging downward (track scrolled past, bottom above the viewport)
    // resets the scene, mirroring live's scene-1 unmount; disengaging upward
    // leaves it settled (measured live behavior).
    const trackIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          trackEngaged = entry.isIntersecting;
          if (entry.isIntersecting) fireTrack();
          else if (entry.boundingClientRect.bottom < 0) resetTrack();
        }
      },
      { rootMargin: "0px 0px -100% 0px", threshold: 0 },
    );

    // --- «80%» counter: count once, fade on every entry/exit ---
    const counterIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            fadeControls.get(el)?.stop();
            fadeControls.set(
              el,
              animate(0, 1, {
                ...FADE_SPRING,
                onUpdate: (p) => {
                  el.style.opacity = String(Math.min(1, p));
                },
              }),
            );
            if (!counted.has(el)) {
              counted.add(el);
              // write the text node directly: characterData mutations don't
              // retrigger the MutationObserver below (childList would)
              const textNode = el.firstChild;
              const setText = (v: string) => {
                if (textNode && textNode.nodeType === Node.TEXT_NODE) textNode.nodeValue = v;
                else el.textContent = v;
              };
              controls.push(
                animate(0, 1, {
                  duration: 1.5,
                  delay: 0.08,
                  ease: [0.42, 0, 0.58, 1],
                  onUpdate: (p) => {
                    setText(String(Math.round(COUNT_FROM + (COUNT_TO - COUNT_FROM) * p)));
                  },
                }),
              );
            }
          } else {
            // live resets the fade whenever the counter leaves the viewport
            fadeControls.get(el)?.stop();
            el.style.opacity = "0";
          }
        }
      },
      { threshold: 0 },
    );

    /** Find current DOM matches and wire them up (idempotent, re-run on mutations). */
    function scan() {
      for (const item of CHAT_ITEMS) {
        if (item.trigger === "track") continue; // handled by trackIO/fireTrack
        for (const el of document.querySelectorAll<HTMLElement>(item.sel)) {
          if (handled.has(el)) continue;
          // only elements still at their initial hidden keyframe
          const o = parseFloat(el.style.opacity || "1");
          if (!(o <= 0.01)) continue;
          handled.add(el);
          itemOf.set(el, item);
          selfIO.observe(el); // fires immediately if already in view
        }
      }
      // showcase bubbles injected while the track is already engaged
      // (e.g. MountedRuntime re-injection on a breakpoint change)
      if (trackEngaged) fireTrack();
      for (const el of document.querySelectorAll<HTMLElement>(COUNTER_SEL)) {
        if (handled.has(el)) continue;
        handled.add(el);
        if (reduced) {
          el.style.opacity = "1";
          el.textContent = String(COUNT_TO);
          continue;
        }
        counterIO.observe(el);
      }
    }

    for (const track of document.querySelectorAll<HTMLElement>(TRACK_SEL)) trackIO.observe(track);
    scan();

    // MountedRuntime injects the showcase subtree after a fetch (and re-injects
    // on breakpoint changes) — pick up fresh copies as they appear.
    let scanQueued = false;
    const mo = new MutationObserver(() => {
      if (scanQueued) return;
      scanQueued = true;
      requestAnimationFrame(() => {
        scanQueued = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      selfIO.disconnect();
      trackIO.disconnect();
      counterIO.disconnect();
      controls.forEach((c) => c.stop());
    };
  }, [pathname]);

  return null;
}
