# siena-clone

A pixel-faithful Next.js 16 rebuild of [siena.cx](https://www.siena.cx) for use as a **private testing playground**.

> ⚠️ All design, copy, imagery, and brand assets belong to Siena AI. This clone exists purely for local testing/learning. Don't deploy it publicly or use the assets elsewhere.

## How it was built

The original site is published with **Framer**, which serves fully server-rendered HTML with responsive CSS baked in. This repo was produced by a deterministic pipeline:

1. **Capture** — every unique page design (34 top-level pages) plus representative CMS template samples (blog post, customer story, integration, product update, webinar) were captured as raw Framer SSR HTML. The CMS archives were deliberately *not* bulk-copied — each template exists with a couple of sample entries.
2. **Convert** — a converter (cheerio-based) turned each page's `#main` DOM subtree into exact JSX (`app/<route>/page.tsx`), extracted Framer's per-page CSS into `page.css`, moved fonts/base styles into `app/styles/`, and rewrote every asset URL to a local path.
3. **Localize** — all ~840 assets (images incl. srcset variants, fonts, videos) were downloaded into `public/assets/`.
4. **Sprites** — Framer injects SVG sprite symbols at hydration; all 131 referenced symbols were harvested from the live hydrated DOM into `components/SvgSprite.tsx`.
5. **Interactivity** — Framer's runtime behaviors are reimplemented as **runtime enhancers**: client components that find their target DOM (via stable `framer-*` classes) and add behavior without touching the static layout. See `components/runtime/`. Scope: homepage.
6. **Verify** — Playwright screenshot comparison against the live site at 1440/1024/390 widths (pixelmatch).

## Architecture

```
app/
  layout.tsx            root layout: fonts, base CSS, SVG sprite, runtime enhancers
  styles/               fonts.css (localized @font-face), base.css
  page.tsx + page.css   homepage (generated 1:1 from Framer SSR — huge files, machine-written)
  <route>/…             41 more routes, same shape
  not-found.tsx         Framer 404 page
components/
  Appear.tsx            replays Framer's appear animations (from its SSR animation spec)
  SvgSprite.tsx         131 harvested sprite symbols
  runtime/              interactive behavior, one enhancer per subsystem:
                        Nav (dropdowns + hamburger), Carousel, Ticker,
                        Hover, Video, Accordion, Forms
public/assets/          all localized assets (images, fonts, video, media)
```

Notes on the generated pages:

- `page.tsx` files are intentionally verbatim conversions of Framer's SSR output — one giant JSX tree per page. That's what guarantees pixel fidelity. Don't hand-edit them; they're machine output.
- Responsive behavior is pure CSS: Framer publishes all three breakpoint variants (`≥1200`, `810–1199`, `≤809`) in the DOM, toggled by media-queried `hidden-*` classes.
- Text nodes are emitted as `{"…"}` expression strings so whitespace survives JSX exactly.

## Running

```bash
npm install
npm run build && npm run start     # production — recommended
```

**Heads-up:** `next dev` OOMs on the giant generated pages (dev-mode SSR instrumentation). Use production builds, or `scripts/watch-rebuild.sh` which serves prod on :3200 and rebuilds automatically when `components/` or `app/` change.

## Scope

- **Pixel-complete:** all 42 routes render statically pixel-faithful.
- **Interactive (homepage):** nav dropdowns, mobile menu, testimonial carousels, logo tickers, hover states, videos, appear animations.
- **Not implemented:** Framer's real hydration bundle, analytics/cookie banners (intentionally stripped), backend form submission (simulated locally), and interactivity on non-homepage routes.
