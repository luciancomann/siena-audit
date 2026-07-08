"use client";

/**
 * Injects Framer's runtime-mounted component subtrees.
 *
 * Eight homepage containers (the agent chat-scene cards, a stat card, and the
 * sticky scroll showcase) ship only a background-photo fallback in SSR — the
 * original site mounts their real content at hydration. Their settled DOM was
 * harvested from the live site (assets rewritten to local paths) into
 * /mounted-content.json; this enhancer swaps it in, exactly like Framer's
 * hydration does. The page stylesheet already contains all needed CSS.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type MountedContent = { css: string; containers: Record<string, string> };

let cache: MountedContent | null = null;

export function MountedRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function apply() {
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

      for (const [cls, html] of Object.entries(cache.containers)) {
        for (const el of document.querySelectorAll<HTMLElement>(`.${cls}`)) {
          if (el.dataset.mounted === "true") continue;
          el.innerHTML = html;
          el.dataset.mounted = "true";
          // muted autoplay videos injected via innerHTML need a nudge
          el.querySelectorAll<HTMLVideoElement>("video[autoplay], video[loop]").forEach((v) => {
            v.muted = true;
            v.play().catch(() => {});
          });
        }
      }
    }

    apply();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
