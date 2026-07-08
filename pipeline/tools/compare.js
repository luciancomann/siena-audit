/**
 * Pixel-compares the clone (localhost) against the original site.
 *
 * For each route × viewport width: loads both, neutralizes dynamic noise
 * (cookie banner blocked, appear animations forced to final state, lazy
 * images forced by scrolling through the page, CSS animations paused),
 * takes full-page screenshots, and reports pixelmatch mismatch ratios.
 *
 * Usage: node compare.js [routesCsv] [widthsCsv]
 *   e.g. node compare.js /,/pricing 1440,390
 */
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const fs = require('fs');
const path = require('path');

const LOCAL = process.env.LOCAL_BASE || 'http://localhost:3100';
const REMOTE = 'https://www.siena.cx';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const ALL_ROUTES = ['/', '/pricing', '/memory', '/video', '/order-tracking', '/shopping-agent',
  '/ai-review-management', '/ask-siena', '/qa-agent', '/products/docs', '/topics-explorer',
  '/insights', '/insights/sentiment-analysis-online', '/insights/voice-of-customer-software',
  '/insights/customer-feedback-analytics-software', '/book-a-demo', '/community', '/roi-calculator',
  '/refer-a-friend', '/siena-ai-certification-in-customer-experience', '/partner-with-siena',
  '/integrations', '/about-us', '/customers', '/blog', '/product-updates', '/webinars', '/events',
  '/terms-of-service', '/privacy-policy', '/ai-lab', '/ai-native-customer-service-vs-help-desk-ai-add-ons',
  '/compare/siena-ai-vs-gorgias-ai', '/compare/siena-ai-vs-kustomer-ai',
  '/blog/seed', '/blog/testing-ai-agents-playground',
  '/customer-stories/hexclad-customer-service-automation', '/customer-stories/simple-modern',
  '/integrations/shopify', '/integrations/klaviyo', '/product-updates/siena-memory',
  '/webinar/help-desk-vs-dedicated-ai'];

const routes = process.argv[2] ? process.argv[2].split(',') : ALL_ROUTES;
const widths = (process.argv[3] ? process.argv[3].split(',') : ['1440', '1024', '390']).map(Number);

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-play-state: paused !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await (document.fonts && document.fonts.ready);
    // force appear elements (both original's and clone's attribute names) to final state
    for (const el of document.querySelectorAll('[data-framer-appear-id],[data-appear-id]')) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
    // normalize ticker/marquee phase: pin all marquee ULs to x=0 on both sides
    for (const ul of document.querySelectorAll('#main ul')) {
      const s = getComputedStyle(ul);
      if (s.display === 'flex' && ul.parentElement) {
        ul.style.transform = 'translateX(0)';
        ul.getAnimations?.().forEach(a => a.cancel());
      }
    }
    // scroll through page to trigger lazy loads
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 800) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
    // force-load any remaining lazy imgs
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
  });
  await page.waitForLoadState('networkidle').catch(() => {});
  // decode every image so the full-page screenshot paints them all
  await page.evaluate(() =>
    Promise.allSettled([...document.images].map(i => i.decode().catch(() => {})))
  );
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
}

async function shoot(context, url, file, width, { blockCookieBanner }) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });
  if (blockCookieBanner) {
    await page.route(/cookieyes|googletagmanager|events\.framer\.com|facebook|linkedin\.com\/px/, r => r.abort());
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

function diff(fileA, fileB, diffFile) {
  const a = PNG.sync.read(fs.readFileSync(fileA));
  const b = PNG.sync.read(fs.readFileSync(fileB));
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (img) => {
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const ca = crop(a), cb = crop(b);
  const d = new PNG({ width, height });
  const bad = pixelmatch(ca.data, cb.data, d.data, width, height, { threshold: 0.12 });
  fs.writeFileSync(diffFile, PNG.sync.write(d));
  return {
    mismatch: +(100 * bad / (width * height)).toFixed(3),
    heightA: a.height, heightB: b.height,
  };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const route of routes) {
    for (const width of widths) {
      const slug = (route === '/' ? 'home' : route.slice(1).replace(/\//g, '__')) + '-' + width;
      const orig = path.join(OUT, `${slug}-orig.png`);
      const clone = path.join(OUT, `${slug}-clone.png`);
      const diffP = path.join(OUT, `${slug}-diff.png`);
      try {
        const ctx = await browser.newContext({ deviceScaleFactor: 1 });
        await shoot(ctx, REMOTE + route, orig, width, { blockCookieBanner: true });
        await shoot(ctx, LOCAL + route, clone, width, { blockCookieBanner: false });
        await ctx.close();
        const r = diff(orig, clone, diffP);
        results.push({ route, width, ...r });
        console.log(`${route} @${width}: ${r.mismatch}% mismatch (h ${r.heightA} vs ${r.heightB})`);
      } catch (e) {
        results.push({ route, width, error: String(e).slice(0, 200) });
        console.log(`${route} @${width}: ERROR ${String(e).slice(0, 120)}`);
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.error || r.mismatch > 1).length;
  console.log(`\n${results.length} comparisons, ${bad} need attention → shots/report.json`);
})();
