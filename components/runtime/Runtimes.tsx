"use client";

/**
 * Mounts every runtime enhancer. Mirrors Framer's architecture: the server
 * output is a pixel-exact static DOM; these client components hydrate it with
 * the interactive behaviors the original site gets from Framer's runtime
 * (carousels, nav menus, tickers, accordions, forms, video).
 *
 * Each enhancer targets existing DOM — none of them alter the static layout.
 */
import { CarouselRuntime } from "./CarouselRuntime";
import { NavRuntime } from "./NavRuntime";
import { TickerRuntime } from "./TickerRuntime";
import { AccordionRuntime } from "./AccordionRuntime";
import { FormsRuntime } from "./FormsRuntime";
import { VideoRuntime } from "./VideoRuntime";

export function Runtimes() {
  return (
    <>
      <CarouselRuntime />
      <NavRuntime />
      <TickerRuntime />
      <AccordionRuntime />
      <FormsRuntime />
      <VideoRuntime />
    </>
  );
}
