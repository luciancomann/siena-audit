/**
 * Framer SVG components reference sprite symbols (<use href="#svg-...">) that
 * the runtime injects post-hydration. This script loads each live page,
 * waits for hydration, and harvests every element with an id starting "svg-",
 * emitting a single deduped sprite component for the clone's root layout.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROUTES = ['/', '/pricing', '/memory', '/video', '/order-tracking', '/shopping-agent',
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

// ids actually referenced by the clone
const referenced = new Set();
function scanDir(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) scanDir(p);
    else if (f.name.endsWith('.tsx')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/href="#(svg[^"]+)"/g)) referenced.add(m[1]);
    }
  }
}
scanDir('/Users/lucistation/Desktop/siena-clone/app');
console.log('referenced sprite ids:', referenced.size);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const defs = new Map();
  for (const r of ROUTES) {
    if ([...referenced].every(id => defs.has(id))) break;
    try {
      await page.goto('https://www.siena.cx' + r, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2500);
      // scroll to force any lazy hydration
      await page.evaluate(async () => {
        const h = document.body.scrollHeight;
        for (let y = 0; y < h; y += 1500) { window.scrollTo(0, y); await new Promise(res => setTimeout(res, 40)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(800);
      const found = await page.evaluate(() =>
        [...document.querySelectorAll('[id^="svg"]')].map(el => ({ id: el.id, html: el.outerHTML, tag: el.tagName }))
      );
      let added = 0;
      for (const f of found) if (!defs.has(f.id)) { defs.set(f.id, f.html); added++; }
      console.log(r, `found ${found.length}, new ${added}, total ${defs.size}`);
    } catch (e) {
      console.log(r, 'ERROR', String(e).slice(0, 100));
    }
  }
  await browser.close();

  const missing = [...referenced].filter(id => !defs.has(id));
  console.log('missing after harvest:', missing.length, missing.slice(0, 10));

  // keep only referenced ids (plus everything harvested is fine too — keep referenced to stay lean)
  const keep = [...defs].filter(([id]) => referenced.has(id));
  const sprite = keep.map(([, html]) => html).join('\n');
  fs.writeFileSync(path.join(__dirname, 'sprite-defs.html'), sprite);

  const component = `/**
 * SVG sprite definitions harvested from the original site's hydrated DOM.
 * Framer injects these at runtime; the clone ships them statically so every
 * <use href="#svg-..."> resolves. Rendered hidden in the root layout.
 */
export function SvgSprite() {
  return (
    <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs dangerouslySetInnerHTML={{ __html: ${JSON.stringify(sprite)} }} />
    </svg>
  );
}
`;
  fs.writeFileSync('/Users/lucistation/Desktop/siena-clone/components/SvgSprite.tsx', component);
  console.log(`sprite component written: ${keep.length} symbols, ${(sprite.length / 1024).toFixed(0)}kb`);
})();
