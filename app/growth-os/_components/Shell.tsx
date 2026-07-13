"use client";

/**
 * Growth OS chrome: fixed left sidebar (six modules + a pointer back to
 * the audit tool), top header with the quiet "runs inside Siena OS" label,
 * the Ask Growth command bar (cmd-K), and the user chip. Built on the DS
 * Avatar marks; dense, no marketing.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "@siena/design-system";
import { resetGrowthState } from "../_lib/state";
import { AskGrowth } from "./AskGrowth";

const NAV = [
  { href: "/growth-os", label: "This Week", key: "week" },
  { href: "/growth-os/deals", label: "Deals Board", key: "deals" },
  { href: "/growth-os/bets", label: "Bets", key: "bets" },
  { href: "/growth-os/loop", label: "The Loop", key: "loop" },
  { href: "/growth-os/metrics", label: "Metrics", key: "metrics" },
  { href: "/growth-os/brain", label: "GTM Brain", key: "brain" },
  { href: "/growth-os/graveyard", label: "Graveyard", key: "graveyard" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hidden demo reset: any Growth OS page with ?reset=1 restores the pristine
  // seed and strips the param. No UI — it exists so the live-demo choreography
  // can be rehearsed and reset.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") !== "1") return;
    resetGrowthState();
    url.searchParams.delete("reset");
    const qs = url.searchParams.toString();
    window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : "") + url.hash);
  }, [pathname]);
  return (
    <div className="gos">
      <aside className="gos-side">
        <div className="gos-side__brand">
          <Avatar variant="agent" size="sm" className="gos-side__mark" />
          Growth OS
        </div>
        <nav className="gos-side__nav" aria-label="Growth OS modules">
          {NAV.map((item) => {
            const active =
              item.href === "/growth-os"
                ? pathname === "/growth-os"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`gos-side__item${active ? " gos-side__item--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="gos-side__foot">
          <Link href="/cx-audit" className="gos-side__item gos-side__item--ext">
            CX Audit tool ↗
          </Link>
          <span className="gos-side__wip sds-mono-label">WIP rule: max 3 bets live</span>
        </div>
      </aside>

      <div className="gos-main">
        <header className="gos-head">
          <div className="gos-head__left">
            <span className="gos-head__title">Growth OS</span>
            <span className="gos-head__quiet">runs inside Siena OS</span>
          </div>
          <div className="gos-head__right">
            <AskGrowth />
            <span className="gos-user">
              <Avatar initials="L" size="sm" className="gos-user__avatar" />
              Lucian · Growth
            </span>
          </div>
        </header>
        <main className="gos-content">{children}</main>
      </div>
    </div>
  );
}
