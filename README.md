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
- **Interactive (homepage, verified against live):** nav dropdowns + mobile hamburger, both testimonial carousels (arrows/counter/transitions), logo tickers (exact ±30px/s), hover/press states, videos, appear animations, runtime-mounted scene components (chat cards, sticky scroll showcase), in-view entrance animations (chat bubbles, the 25→80 counter), gradient-text masks.
- **Not implemented:** Framer's real hydration bundle, analytics/cookie banners (intentionally stripped), backend form submission (simulated locally), and interactivity on non-homepage routes.

## Measured fidelity (homepage vs live, full-page pixelmatch)

| Viewport | Mismatch | Page height |
|---|---|---|
| 1440 px | 0.119% | exact (11345px) |
| 1024 px | 0.124% | exact (10657px) |
| 390 px  | 0.198% | exact (13829px) |

## CX Audit Agent (`/cx-audit`)

A free-audit lead magnet built on `@siena/design-system`: upload a helpdesk export (or click the sample) and a chain of nine agents returns a Siena-voiced audit — automation potential score, resolution gaps, benchmark, and the insights sitting unread in the queue. Routes: `/cx-audit` (landing), `/cx-audit/audit` (input + live agent progress), `/cx-audit/report/[slug]`, `/cx-audit/crm-preview/[slug]`.

**Stated out loud — what's real and what's staged:**

- **OAuth is simulated.** "Connect Gorgias / Zendesk" renders a realistic consent screen and then routes to the sample in demo mode. A production flow would exchange a real OAuth code server-side and pull tickets via the provider API; the connect screens mark this.
- **Benchmarks are synthetic and directional** — a static table by monthly-volume band, labeled as such in the report.
- **Cost assumptions are visible and editable** in the report (8 min handle time, $6.50 loaded cost, $0.90 automated) — change them and the math recomputes client-side.
- **The HubSpot webhook is stubbed.** The payload and the routing rule (score > 70 AND volume > 3,000/month ⇒ fast-track) are the design; set `CX_AUDIT_HUBSPOT_WEBHOOK` to POST for real. `/cx-audit/crm-preview/[slug]` shows exactly what sales would see — it's reviewer-only: the prospect-facing report hides the handoff link unless you append `?internal=1` to the report URL.
- **Redaction is designed as pre-processing** (regex strip of emails, phones, order numbers, addresses, names before any model call) and exercised on synthetic data only in this build.
- **Sampling**: a seeded random 500-ticket sample (seed = file hash, reproducible reruns). Production would offer 30/60/90-day windows.
- **Model calls need `ANTHROPIC_API_KEY`** (`claude-sonnet-4-6`, structured outputs, classification in batches of 25). Without a key: uploads fall back to keyword-only classification and fail the insight stage with an honest error; **the sample path needs no key at all** — it serves a precomputed report whose deterministic stages (ingest → sample → redact → classify → metrics → benchmark → CRM) really ran over the generated CSV, with the two LLM-stage outputs (insights, report copy) hand-authored to the voice rules and verified against the pipeline's numbers by `scripts/precompute-verabloom.ts` (fails loudly on drift).
- **Synthetic dataset**: `scripts/generate-verabloom.ts` — 500 seeded, byte-reproducible tickets with three planted, discoverable stories (23 untagged pump-defect reports, 14% pre-purchase volume, 31 repeat-contact subscription customers).

## Pipeline

`pipeline/` contains everything used to produce and verify the clone — capture
(`capture.sh`), conversion (`tools/convert.js`), asset localization, sprite +
mounted-component harvesters, the pixel comparator (`tools/compare.js`), the
captured SSR HTML of all 43 pages, and the per-agent measurement/verification
scripts. `cd pipeline/tools && npm i cheerio playwright pixelmatch pngjs` to
re-run any of it.
