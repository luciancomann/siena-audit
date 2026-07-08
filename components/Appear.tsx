"use client";

/**
 * Replicates Framer's SSR "appear" animations without altering the DOM tree.
 *
 * Framer ships elements at their initial keyframe state (e.g. opacity 0.001,
 * translateY(200px)) plus a JSON spec per appear-id and per responsive
 * breakpoint. At runtime it animates them to their final state. AppearRunner
 * does the same: rendered once per page, it finds every [data-appear-id]
 * element and animates it with the variant matching the current breakpoint.
 * No wrapper nodes are added, so Framer's CSS selectors are untouched.
 */
import { useEffect } from "react";
import { animate, type AnimationPlaybackControls } from "framer-motion";

type Keyframe = {
  opacity?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  scale?: number;
  skewX?: number;
  skewY?: number;
  x?: number;
  y?: number;
  transition?: {
    delay?: number;
    duration?: number;
    ease?: number[] | string;
    type?: string;
  };
};

type Variant = { initial: Keyframe; animate: Keyframe };
export type AppearSpec = Record<string, Record<string, Variant>>; // appearId → breakpointHash|default → variant
export type Breakpoint = { hash: string; mediaQuery: string };

function pickVariant(variants: Record<string, Variant>, breakpoints: Breakpoint[]): Variant | undefined {
  for (const bp of breakpoints) {
    if (variants[bp.hash] && window.matchMedia(bp.mediaQuery).matches) return variants[bp.hash];
  }
  return variants.default;
}

function toTransform(k: {
  x?: number; y?: number; rotate?: number; rotateX?: number; rotateY?: number;
  scale?: number; skewX?: number; skewY?: number;
}): string {
  const parts: string[] = [];
  if (k.x || k.y) parts.push(`translate(${k.x ?? 0}px, ${k.y ?? 0}px)`);
  if (k.rotate) parts.push(`rotate(${k.rotate}deg)`);
  if (k.rotateX) parts.push(`rotateX(${k.rotateX}deg)`);
  if (k.rotateY) parts.push(`rotateY(${k.rotateY}deg)`);
  if (k.scale !== undefined && k.scale !== 1) parts.push(`scale(${k.scale})`);
  if (k.skewX) parts.push(`skewX(${k.skewX}deg)`);
  if (k.skewY) parts.push(`skewY(${k.skewY}deg)`);
  return parts.length ? parts.join(" ") : "none";
}

export function AppearRunner({ spec, breakpoints }: { spec: AppearSpec; breakpoints: Breakpoint[] }) {
  useEffect(() => {
    const controls: AnimationPlaybackControls[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (const [appearId, variants] of Object.entries(spec)) {
      const els = document.querySelectorAll<HTMLElement>(`[data-appear-id="${appearId}"]`);
      if (!els.length) continue;
      const variant = pickVariant(variants, breakpoints);
      if (!variant) continue;
      const { initial: from, animate: to } = variant;
      const t = to.transition ?? {};

      els.forEach((el) => {
        if (reduced) {
          el.style.opacity = String(to.opacity ?? 1);
          el.style.transform = toTransform(to);
          return;
        }
        el.style.opacity = String(from.opacity ?? 1);
        el.style.transform = toTransform(from);

        const options = {
          delay: t.delay ?? 0,
          duration: t.duration ?? 0.5,
          ease: (Array.isArray(t.ease) ? (t.ease as [number, number, number, number]) : t.ease) as never,
        };
        const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
        controls.push(
          animate(0, 1, {
            ...options,
            onUpdate: (p) => {
              el.style.opacity = String(lerp(from.opacity ?? 1, to.opacity ?? 1, p));
              el.style.transform = toTransform({
                x: lerp(from.x ?? 0, to.x ?? 0, p),
                y: lerp(from.y ?? 0, to.y ?? 0, p),
                rotate: lerp(from.rotate ?? 0, to.rotate ?? 0, p),
                rotateX: lerp(from.rotateX ?? 0, to.rotateX ?? 0, p),
                rotateY: lerp(from.rotateY ?? 0, to.rotateY ?? 0, p),
                scale: lerp(from.scale ?? 1, to.scale ?? 1, p),
                skewX: lerp(from.skewX ?? 0, to.skewX ?? 0, p),
                skewY: lerp(from.skewY ?? 0, to.skewY ?? 0, p),
              });
            },
            onComplete: () => {
              el.style.opacity = String(to.opacity ?? 1);
              el.style.transform = toTransform(to);
            },
          }),
        );
      });
    }
    return () => controls.forEach((c) => c.stop());
  }, [spec, breakpoints]);

  return null;
}
