/**
 * Hover capture v3 — homepage-only targets, with hard navigation blocking:
 * after initial load, all main-frame navigation requests are aborted.
 * Usage: node agent-hover/capture-hover3.js [url] [outfile]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'https://www.siena.cx/';
const OUTFILE = process.argv[3] || 'hover-live4.json';

const TARGETS = [
  { name: 'navBookDemo', find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => { const r = a.getBoundingClientRect(); return r.top < 120 && r.top > 0 && r.width > 0; })` },
  { name: 'heroCtaXlg', find: `return [...document.querySelectorAll('a.framer-usqbM[data-framer-name="xlg"]')].find(a => a.getBoundingClientRect().width > 0)` },
  { name: 'exploreIntegrations', find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => /Explore all integrations/.test(a.textContent) && a.getBoundingClientRect().width > 0)` },
  { name: 'customerStoryCard', find: `return [...document.querySelectorAll('a.framer-2kXtq')].find(a => a.getBoundingClientRect().width > 100)` },
  { name: 'testimonialMasonry', find: `return [...document.querySelectorAll('[data-framer-name="Testimonial"]')].filter(el => el.getBoundingClientRect().width > 100)[2] || null` },
  { name: 'integrationTile', find: `return [...document.querySelectorAll('.framer-80k0qc')].find(el => el.getBoundingClientRect().width > 0)` },
];

const SNAP_FN = `
window.__snap = function (el, maxNodes = 80) {
  const nodes = [el, ...el.querySelectorAll('*')].slice(0, maxNodes);
  return nodes.map((n) => {
    const cs = getComputedStyle(n);
    return {
      tag: n.tagName,
      cls: (typeof n.className === 'string' ? n.className : (n.className.baseVal || '')).slice(0, 220),
      bg: cs.backgroundColor,
      bgImg: cs.backgroundImage === 'none' ? 'none' : cs.backgroundImage.slice(0, 600),
      color: cs.color,
      transform: cs.transform,
      shadow: cs.boxShadow.slice(0, 200),
      borderColor: cs.borderTopColor,
      borderWidth: cs.borderTopWidth,
      filter: cs.filter,
      opacity: cs.opacity,
      radius: cs.borderTopLeftRadius,
      width: Math.round(n.getBoundingClientRect().width * 10) / 10,
    };
  });
};
true;
`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  let blockNav = false;
  await page.route('**/*', (route) => {
    const req = route.request();
    if (/cookieyes|googletagmanager|events\.framer\.com/.test(req.url())) return route.abort();
    if (blockNav && req.isNavigationRequest() && req.frame() === page.mainFrame()) return route.abort('aborted');
    return route.continue();
  });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  blockNav = true;
  await page.evaluate(SNAP_FN);

  const results = {};
  const snapNow = () => page.evaluate(`window.__snap(window.__target)`);

  for (const t of TARGETS) {
    try {
      // re-install helpers in case a navigation slipped through
      await page.evaluate(SNAP_FN);
      const found = await page.evaluate(`(() => { const el = (function(){ ${t.find} })(); if (!el) return null; window.__target = el; return true; })()`);
      console.log(`${t.name}: url=${page.url()} found=${found}`);
      if (!found) { results[t.name] = { error: 'not found' }; continue; }
      await page.evaluate(`window.__target.scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await page.waitForTimeout(1600);
      await page.mouse.move(10, 880);
      await page.waitForTimeout(700);

      const rect = await page.evaluate(`(() => { const r = window.__target.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
      const before = await snapNow();

      await page.mouse.move(rect.x + rect.w / 2, rect.y + rect.h / 2, { steps: 4 });
      const samples = [];
      const t0 = Date.now();
      for (const ms of [40, 80, 120, 180, 240, 320, 420, 560, 750, 1000]) {
        const wait = ms - (Date.now() - t0);
        if (wait > 0) await page.waitForTimeout(wait);
        samples.push({ ms: Date.now() - t0, snap: await snapNow() });
      }
      await page.waitForTimeout(400);
      const hoverSettled = await snapNow();


      await page.mouse.move(10, 880, { steps: 4 });
      const exitSamples = [];
      const tExit = Date.now();
      for (const ms of [40, 90, 150, 220, 320, 450, 700, 1100]) {
        const wait = ms - (Date.now() - tExit);
        if (wait > 0) await page.waitForTimeout(wait);
        exitSamples.push({ ms: Date.now() - tExit, snap: await snapNow() });
      }

      results[t.name] = { url: page.url(), rect, before, samples, hoverSettled, exitSamples };
      console.log(`  captured ${before.length} nodes`);
      await page.waitForTimeout(400);
    } catch (e) {
      results[t.name] = { error: String(e).slice(0, 300) };
      console.log(`  ERROR ${String(e).slice(0, 200)}`);
    }
  }

  fs.writeFileSync(path.join(__dirname, OUTFILE), JSON.stringify(results));
  console.log('saved', OUTFILE, 'final url', page.url());
  await browser.close();
})();
