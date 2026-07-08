/**
 * Harvests Framer's runtime-mounted component subtrees from the live homepage.
 *
 * Eight containers are empty (fallback-only) in SSR and get their real content
 * mounted at hydration. For each target container this captures the mounted
 * children's outerHTML at desktop + phone widths, plus every runtime-injected
 * <style> tag, so the clone can inject identical content statically.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGETS = [
  'framer-1w8e3we-container',
  'framer-tejwr8-container',
  'framer-15olgsr-container',
  'framer-1vlomzq-container',
  'framer-azsqkk-container',
  'framer-qbapak-container',
  'framer-1qre5h9-container',
  'framer-1cdh5oy-container', // sticky scroll-showcase («Homepage 1»)
];

const OUT = path.join(__dirname, '..', 'interactive');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());

  const result = {};
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(3000);
    // scroll through slowly so every mounted component and lazy image loads
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 120));
      }
      await new Promise(r => setTimeout(r, 800));
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));
    });
    const captured = await page.evaluate((targets) => {
      const out = {};
      for (const t of targets) {
        const el = document.querySelector('.' + t);
        if (!el) { out[t] = null; continue; }
        out[t] = {
          childrenHtml: [...el.children].map(c => c.outerHTML),
          rect: (() => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
        };
      }
      return out;
    }, TARGETS);
    result[width] = captured;
    console.log(`@${width}:`, TARGETS.map(t => `${t.replace('framer-', '').replace('-container', '')}=${captured[t] ? captured[t].childrenHtml.join('').length : 'null'}`).join(' '));
  }

  // runtime style tags (post-hydration, desktop)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('style')].map(s => s.textContent)
  );
  result.styles = styles;
  console.log('style tags:', styles.length, 'total css:', (styles.join('').length / 1024).toFixed(0) + 'kb');

  fs.writeFileSync(path.join(OUT, 'mounted-components.json'), JSON.stringify(result));
  console.log('written → interactive/mounted-components.json');
  await browser.close();
})();
