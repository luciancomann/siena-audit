"use client";

/**
 * Copies the report URL to the clipboard with a brief confirmation state.
 * Falls back to a hidden textarea when the async clipboard API is missing.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@siena/design-system";

export function CopyLinkButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="secondary" size="xl" onClick={copy} className={className}>
      {copied ? "Link copied" : "Copy share link"}
    </Button>
  );
}
