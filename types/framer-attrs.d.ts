/**
 * Framer's SSR output carries a handful of non-standard attributes on plain
 * DOM elements (internal layout metadata). We reproduce the DOM verbatim for
 * pixel fidelity, so teach TypeScript about them.
 */
import "react";

declare module "csstype" {
  interface Properties {
    // Framer relies heavily on CSS custom properties in inline styles
    [index: `--${string}`]: string | number | undefined;
    // Bleeding-edge CSS used by Framer that csstype doesn't know yet
    cornerShape?: string;
  }
}

declare module "react" {
  interface HTMLAttributes<T> {
    _constraints?: string;
    parentsize?: string;
    radius?: string;
    rotation?: string;
    shadows?: string;
  }
  interface SVGAttributes<T> {
    _constraints?: string;
    parentsize?: string;
    radius?: string;
    rotation?: string;
    shadows?: string;
  }
}
