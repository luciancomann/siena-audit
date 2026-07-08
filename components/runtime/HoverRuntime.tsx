"use client";

/**
 * Replicates Framer's JS-driven hover micro-interactions on the homepage.
 *
 * Framer does not use CSS :hover for component variants. Instead its runtime
 * adds a literal `hover` class (some layout deltas ship as `.hover` CSS rules
 * in the SSR stylesheet) and animates style props (colors, gradients,
 * transforms, opacity) with springs. Every behavior below was captured from
 * the live site with timed computed-style sampling (see
 * tools/agent-hover/hover-live*.json captures):
 *
 * - Primary CTA buttons (a.framer-usqbM, "md"/"xlg"): background-color cover
 *   fades out revealing a rainbow gradient whose stop positions spring from
 *   even 20% spacing to design positions. Colors switch instantly (verified:
 *   fully saturated at t=55ms while positions were at ~7% progress).
 * - Nav top-level items (a.framer-1cncyf0): chevron rotates 0 -> 180deg with
 *   a spring; snaps back instantly on exit.
 * - ICON links (a.framer-A6ifb, nav "Customers" + dropdown footer links):
 *   `hover` class expands the pill (.framer-1wllu0q) via existing CSS, its
 *   background springs grey -> red; exit is instant.
 * - Footer links (a.framer-XXLkB): text color switches instantly to
 *   rgb(151,189,255); instant revert.
 * - Footer social buttons (a.framer-rCoMe): background springs dark -> light
 *   (both background-color and the flat gradient), glyph color switches
 *   instantly.
 * - Nav dropdown "Mini - Icon" items (a.framer-frCsL): `hover` class applies
 *   CSS layout deltas; the blurred video container (.framer-icnbas-container)
 *   springs opacity 0 -> 0.5 and rotate 90 -> 180deg; ~150ms ease-out exit.
 * - Dropdown blog cards (a.framer-stcy1): beige background fades to
 *   transparent with the shared spring.
 * - Customer story cards (a.framer-2kXtq): instant variant class swap
 *   framer-v-1vv2cil <-> framer-v-1oanct6 (CSS shifts content padding).
 *
 * Testimonial cards and integration tiles were verified to have NO hover
 * state on live. Rich-text links ("Find out more") are covered by the
 * existing a.framer-text:hover CSS rules and need no JS.
 *
 * Live color mixing follows framer-motion's sqrt-RGB blend, reproduced here.
 * Press/:active states were probed on live and only browser defaults exist.
 */
import { useEffect } from "react";
import { animate, type AnimationPlaybackControls } from "framer-motion";

type Transition = Parameters<typeof animate>[2];

// All transitions below were fitted numerically (grid search over
// framer-motion's spring generator) against timed samples of the live site;
// rmse < 0.04 on every curve. Delays reproduce the observed dead time before
// live starts animating and are only applied when starting from rest.
const BTN_ENTER: Transition = { type: "spring", duration: 0.2, bounce: 0.15 };
const BTN_ENTER_DELAY = 0.06;
const BTN_EXIT: Transition = { type: "spring", duration: 0.25, bounce: 0.05 };
const CHEVRON_SPRING: Transition = { type: "spring", duration: 0.4, bounce: 0.25 };
const CHEVRON_DELAY = 0.06;
const DOT_SPRING: Transition = { type: "spring", duration: 0.45, bounce: 0.25 };
const SOCIAL_ENTER: Transition = { type: "spring", duration: 0.475, bounce: 0.25 };
const SOCIAL_EXIT: Transition = { type: "spring", duration: 0.35, bounce: 0.15 };
const CARD_SPRING: Transition = { type: "spring", duration: 0.325, bounce: 0.1 };
// Mini-icon video reveal: opacity 0 -> 0.5 / rotation settled ~450ms with 50ms dead time.
const MINI_SPRING: Transition = { type: "spring", duration: 0.45, bounce: 0.1 };
const MINI_DELAY = 0.05;
// Mini-icon exit measured ~150ms ease-out (opacity 0.17@60ms, 0 by 157ms).
const MINI_EXIT: Transition = { duration: 0.15, ease: "easeOut" };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// framer-motion blends rgb channels in sqrt space (verified against live
// samples, e.g. bg rgba(17,31,34,0.933) at p~0.067 while fading to transparent).
// p is intentionally NOT clamped: live's springs overshoot color channels
// (e.g. the ICON dot briefly hits rgb(251,82,65) past its rgb(251,86,70) target).
const mixCh = (a: number, b: number, p: number) =>
  Math.min(255, Math.round(Math.sqrt(Math.max(0, a * a * (1 - p) + b * b * p))));
const mixRgb = (a: number[], b: number[], p: number) =>
  [mixCh(a[0], b[0], p), mixCh(a[1], b[1], p), mixCh(a[2], b[2], p)] as const;
const rgba = (c: readonly number[], alpha: number) =>
  alpha >= 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.round(alpha * 1000) / 1000})`;

// ---- primary CTA gradient (captured verbatim from live hover states) ----
const GRAD_COLORS = [
  [242, 229, 154],
  [254, 199, 150],
  [251, 86, 70],
  [130, 122, 204],
  [46, 121, 216],
  [41, 79, 186],
];
const REST_STOPS = [0, 20, 40, 60, 80, 100];
// Stop positions differ per size variant (measured on live).
const HOVER_STOPS: Record<string, number[]> = {
  md: [0, 17.5676, 34.2342, 54.0541, 80.6306, 100],
  xlg: [0, 21.4087, 36.0976, 60.5158, 89, 100],
};
const BTN_DARK = [18, 32, 35];

function ctaGradient(p: number, hoverStops: number[]): string {
  const stops = GRAD_COLORS.map((c, i) => {
    const pos = REST_STOPS[i] + (hoverStops[i] - REST_STOPS[i]) * p; // positions may overshoot (spring)
    return `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${Math.round(pos * 10000) / 10000}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

const flatGradient = (c: readonly number[]) =>
  `linear-gradient(90deg, ${REST_STOPS.map((s) => `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${s}%`).join(", ")})`;

export function HoverRuntime() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];
    const controls = new WeakMap<Element, AnimationPlaybackControls>();
    const progress = new WeakMap<Element, number>();

    /**
     * Animate a progress value on `key` (interruptible mid-flight).
     * `delay` (seconds) reproduces live's dead time and is only applied when
     * starting from rest, so interrupted reversals stay responsive.
     */
    function springTo(
      key: Element,
      target: number,
      transition: Transition,
      onUpdate: (p: number) => void,
      onSettle?: () => void,
      delay = 0,
    ) {
      controls.get(key)?.stop();
      const from = progress.get(key) ?? 0;
      if (reduced || from === target) {
        progress.set(key, target);
        onUpdate(target);
        onSettle?.();
        return;
      }
      const ctrl = animate(from, target, {
        ...(transition as object),
        delay: from === 0 || from === 1 ? delay : 0,
        onUpdate: (v: number) => {
          progress.set(key, v);
          onUpdate(v);
        },
        onComplete: () => {
          progress.set(key, target);
          onSettle?.();
        },
      } as Transition);
      controls.set(key, ctrl);
    }

    function bindHover(el: Element, enter: () => void, leave: () => void) {
      const onEnter = (e: Event) => {
        if ((e as PointerEvent).pointerType === "touch") return;
        enter();
      };
      const onLeave = (e: Event) => {
        if ((e as PointerEvent).pointerType === "touch") return;
        leave();
      };
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
      });
    }

    // ---- 1. Primary CTA buttons (nav "Book a demo", hero CTA, section CTAs) ----
    document.querySelectorAll<HTMLAnchorElement>("a.framer-usqbM").forEach((el) => {
      const name = el.getAttribute("data-framer-name") ?? "";
      const hoverStops = HOVER_STOPS[name];
      if (!hoverStops) return; // "Secondary / md" etc.: no capture, leave untouched
      const orig = { color: el.style.backgroundColor, image: el.style.backgroundImage };
      const apply = (p: number) => {
        el.style.backgroundColor = rgba(mixRgb(BTN_DARK, [0, 0, 0], p), clamp01(1 - p));
        el.style.backgroundImage = ctaGradient(p, hoverStops);
      };
      bindHover(
        el,
        () => {
          el.classList.add("hover");
          springTo(el, 1, BTN_ENTER, apply, undefined, BTN_ENTER_DELAY);
        },
        () => {
          el.classList.remove("hover");
          springTo(el, 0, BTN_EXIT, apply, () => {
            if ((progress.get(el) ?? 0) === 0) {
              el.style.backgroundColor = orig.color;
              el.style.backgroundImage = orig.image;
            }
          });
        },
      );
    });

    // ---- 2. Nav top-level items: chevron rotates 180deg on hover ----
    document.querySelectorAll<HTMLAnchorElement>("a.framer-1cncyf0").forEach((el) => {
      const chevron = el.querySelector<HTMLElement>(".framer-odbusp");
      if (!chevron) return;
      const origTransform = chevron.style.transform;
      bindHover(
        el,
        () => {
          springTo(
            chevron,
            1,
            CHEVRON_SPRING,
            (p) => {
              chevron.style.transform = `rotate(${180 * p}deg)`;
            },
            undefined,
            CHEVRON_DELAY,
          );
        },
        () => {
          // live snaps back instantly (transform "none" within 80ms of exit)
          controls.get(chevron)?.stop();
          progress.set(chevron, 0);
          chevron.style.transform = origTransform;
        },
      );
    });

    // ---- 3. ICON links: pill expands (CSS .hover rule) + grey -> red spring ----
    const DOT_GREY = [228, 230, 231];
    const DOT_RED = [251, 86, 70];
    document.querySelectorAll<HTMLAnchorElement>("a.framer-A6ifb").forEach((el) => {
      const dot = el.querySelector<HTMLElement>(".framer-1wllu0q");
      if (!dot) return;
      const origBg = dot.style.backgroundColor;
      bindHover(
        el,
        () => {
          el.classList.add("hover");
          springTo(dot, 1, DOT_SPRING, (p) => {
            dot.style.backgroundColor = rgba(mixRgb(DOT_GREY, DOT_RED, p), 1);
          });
        },
        () => {
          // live reverts instantly (<80ms) on exit
          el.classList.remove("hover");
          controls.get(dot)?.stop();
          progress.set(dot, 0);
          dot.style.backgroundColor = origBg;
        },
      );
    });

    // ---- 4. Footer links: instant text color swap (verified instant on live) ----
    document.querySelectorAll<HTMLAnchorElement>("a.framer-XXLkB").forEach((el) => {
      const texts = [...el.querySelectorAll<HTMLElement>(".framer-text")];
      if (!texts.length) return;
      const orig = texts.map((t) => t.style.color);
      bindHover(
        el,
        () => {
          el.classList.add("hover");
          texts.forEach((t) => (t.style.color = "rgb(151, 189, 255)"));
        },
        () => {
          el.classList.remove("hover");
          texts.forEach((t, i) => (t.style.color = orig[i]));
        },
      );
    });

    // ---- 5. Footer social buttons: bg springs dark -> light, glyph instant ----
    const SOCIAL_DARK = [18, 32, 35];
    const SOCIAL_LIGHT = [244, 245, 245];
    document.querySelectorAll<HTMLAnchorElement>("a.framer-rCoMe").forEach((el) => {
      const texts = [...el.querySelectorAll<HTMLElement>(".framer-text")];
      const orig = {
        color: el.style.backgroundColor,
        image: el.style.backgroundImage,
        texts: texts.map((t) => t.style.color),
      };
      const apply = (p: number) => {
        const c = mixRgb(SOCIAL_DARK, SOCIAL_LIGHT, p);
        el.style.backgroundColor = rgba(c, 1);
        el.style.backgroundImage = flatGradient(c);
      };
      bindHover(
        el,
        () => {
          el.classList.add("hover");
          texts.forEach((t) => (t.style.color = "rgb(18, 32, 35)"));
          springTo(el, 1, SOCIAL_ENTER, apply);
        },
        () => {
          el.classList.remove("hover");
          texts.forEach((t, i) => (t.style.color = orig.texts[i]));
          springTo(el, 0, SOCIAL_EXIT, apply, () => {
            if ((progress.get(el) ?? 0) === 0) {
              el.style.backgroundColor = orig.color;
              el.style.backgroundImage = orig.image;
            }
          });
        },
      );
    });

    // ---- 6. Nav dropdown "Mini - Icon" items: blurred video reveal ----
    document.querySelectorAll<HTMLAnchorElement>("a.framer-frCsL").forEach((el) => {
      const vc = el.querySelector<HTMLElement>(".framer-icnbas-container");
      if (!vc) return;
      const orig = { opacity: vc.style.opacity, transform: vc.style.transform };
      const apply = (p: number) => {
        vc.style.opacity = String(Math.round(0.5 * clamp01(p) * 1000) / 1000);
        vc.style.transform = `rotate(${90 + 90 * p}deg)`;
      };
      bindHover(
        el,
        () => {
          el.classList.add("hover"); // CSS: height 42px / bottom -12px / order flips
          if (!reduced) el.querySelector("video")?.play().catch(() => undefined);
          springTo(vc, 1, MINI_SPRING, apply, undefined, MINI_DELAY);
        },
        () => {
          el.classList.remove("hover"); // layout snaps back immediately, like live
          springTo(vc, 0, MINI_EXIT, apply, () => {
            if ((progress.get(vc) ?? 0) === 0) {
              vc.style.opacity = orig.opacity;
              vc.style.transform = orig.transform;
            }
          });
        },
      );
    });

    // ---- 7. Dropdown blog cards: beige bg fades to transparent ----
    const CARD_BEIGE = [239, 229, 208];
    document.querySelectorAll<HTMLAnchorElement>("a.framer-stcy1").forEach((el) => {
      const origBg = el.style.backgroundColor;
      const apply = (p: number) => {
        el.style.backgroundColor = rgba(mixRgb(CARD_BEIGE, [0, 0, 0], p), clamp01(1 - p));
      };
      bindHover(
        el,
        () => {
          el.classList.add("hover");
          springTo(el, 1, CARD_SPRING, apply);
        },
        () => {
          el.classList.remove("hover");
          springTo(el, 0, CARD_SPRING, apply, () => {
            if ((progress.get(el) ?? 0) === 0) el.style.backgroundColor = origBg;
          });
        },
      );
    });

    // ---- 8. Customer story cards: instant variant class swap (CSS padding) ----
    document.querySelectorAll<HTMLAnchorElement>("a.framer-2kXtq.framer-v-1vv2cil").forEach((el) => {
      bindHover(
        el,
        () => el.classList.replace("framer-v-1vv2cil", "framer-v-1oanct6"),
        () => el.classList.replace("framer-v-1oanct6", "framer-v-1vv2cil"),
      );
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
