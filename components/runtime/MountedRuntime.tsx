"use client";

/**
 * Injects Framer's runtime-mounted component subtrees.
 *
 * Eight homepage containers (the agent chat-scene cards, a stat card, and the
 * sticky scroll showcase) ship only a fallback in SSR — the original site
 * mounts their real content at hydration, with slightly different DOM per
 * breakpoint. Their settled DOM was harvested from the live site at
 * 1440/1024/390 (assets rewritten to local paths) into /mounted-content.json;
 * this enhancer swaps in the variant matching the current breakpoint, exactly
 * like Framer's hydration does. The page stylesheet already contains all
 * needed CSS.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Variants = { d: string | null; t: string | null; p: string | null };
type MountedContent = { css: string; containers: Record<string, Variants> };

let cache: MountedContent | null = null;

const PHONE = "(max-width: 809.98px)";
const TABLET = "(min-width: 810px) and (max-width: 1199.98px)";

function pick(v: Variants): string | null {
  if (window.matchMedia(PHONE).matches) return v.p ?? v.d;
  if (window.matchMedia(TABLET).matches) return v.t ?? v.d;
  return v.d;
}

function currentBp(): string {
  if (window.matchMedia(PHONE).matches) return "p";
  if (window.matchMedia(TABLET).matches) return "t";
  return "d";
}

export function MountedRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    function inject() {
      if (!cache) return;
      const bp = currentBp();
      for (const [cls, variants] of Object.entries(cache.containers)) {
        const html = pick(variants);
        if (!html) continue;
        for (const el of document.querySelectorAll<HTMLElement>(`.${cls}`)) {
          if (el.dataset.mounted === bp) continue;
          // skip containers nested inside an already-injected subtree: their
          // parent's harvested HTML already includes their mounted content
          // (e.g. the shared visual component inside each feature card)
          const outer = el.parentElement?.closest<HTMLElement>("[data-mounted]");
          if (outer) continue;
          el.innerHTML = html;
          el.dataset.mounted = bp;
          // muted autoplay videos injected via innerHTML need a nudge
          el.querySelectorAll<HTMLVideoElement>("video[autoplay], video[loop]").forEach((v) => {
            v.muted = true;
            v.play().catch(() => {});
          });
        }
      }
    }

    async function load() {
      if (!cache) {
        const res = await fetch("/mounted-content.json");
        if (!res.ok) return;
        cache = (await res.json()) as MountedContent;
      }
      if (cancelled) return;

      if (cache.css && !document.getElementById("mounted-runtime-css")) {
        const style = document.createElement("style");
        style.id = "mounted-runtime-css";
        style.textContent = cache.css;
        document.head.appendChild(style);
      }
      inject();
    }

    load();

    // re-inject the right variant when crossing a breakpoint
    const queries = [window.matchMedia(PHONE), window.matchMedia(TABLET)];
    const onChange = () => inject();
    queries.forEach((q) => q.addEventListener("change", onChange));
    return () => {
      cancelled = true;
      queries.forEach((q) => q.removeEventListener("change", onChange));
    };
  }, [pathname]);

  return null;
}
