/**
 * Hover/press capture v2 — live siena.cx homepage.
 * Fixes v1: prevents anchor navigation during press tests, logs URL per target,
 * captures full gradient strings, adds dropdown mini-icon + video flow.
 * Usage: node agent-hover/capture-hover2.js [url] [outfile]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'https://www.siena.cx/';
const OUTFILE = process.argv[3] || 'hover-live2.json';

const TARGETS = [
  { name: 'navBookDemo', find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => { const r = a.getBoundingClientRect(); return r.top < 120 && r.top > 0 && r.width > 0; })` },
  { name: 'heroCtaXlg', find: `return [...document.querySelectorAll('a.framer-usqbM[data-framer-name="xlg"]')].find(a => a.getBoundingClientRect().width > 0)` },
  { name: 'exploreIntegrations', find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => /Explore all integrations/.test(a.textContent) && a.getBoundingClientRect().width > 0)` },
  { name: 'navCustomersLink', find: `return [...document.querySelectorAll('a.framer-A6ifb')].find(a => a.textContent.trim() === 'Customers' && a.getBoundingClientRect().top < 120 && a.getBoundingClientRect().width > 0)` },
  { name: 'footerLink', find: `return [...document.querySelectorAll('a.framer-XXLkB')].find(a => a.textContent.trim() === 'Shopping Agent' && a.getBoundingClientRect().width > 0)` },
  { name: 'footerSocial', find: `return [...document.querySelectorAll('a.framer-rCoMe')].find(a => a.getBoundingClientRect().width > 0)` },
  { name: 'customerStoryCard', find: `return [...document.querySelectorAll('a.framer-2kXtq')].find(a => a.getBoundingClientRect().width > 100)` },
  { name: 'testimonialMasonry', find: `return [...document.querySelectorAll('[data-framer-name="Testimonial"]')].filter(el => el.getBoundingClientRect().width > 100)[2] || null` },
  { name: 'integrationTile', find: `return [...document.querySelectorAll('.framer-80k0qc')].find(el => el.getBoundingClientRect().width > 0)` },
  { name: 'announcementLink', find: `return [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Find out more' && a.getBoundingClientRect().width > 0)` },
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
      left: cs.left,
      right: cs.right,
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
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    // block anchor navigation during press tests
    document.addEventListener('click', (e) => e.preventDefault(), true);
  });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.evaluate(SNAP_FN);

  const results = {};
  const snapNow = () => page.evaluate(`window.__snap(window.__target)`);

  for (const t of TARGETS) {
    try {
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

      await page.mouse.down();
      await page.waitForTimeout(80);
      const press80 = await snapNow();
      await page.waitForTimeout(220);
      const press300 = await snapNow();
      await page.mouse.up();
      await page.waitForTimeout(300);
      const released = await snapNow();

      await page.mouse.move(10, 880, { steps: 4 });
      const exitSamples = [];
      const tExit = Date.now();
      for (const ms of [40, 90, 150, 220, 320, 450, 700, 1100]) {
        const wait = ms - (Date.now() - tExit);
        if (wait > 0) await page.waitForTimeout(wait);
        exitSamples.push({ ms: Date.now() - tExit, snap: await snapNow() });
      }

      results[t.name] = { url: page.url(), rect, before, samples, hoverSettled, press80, press300, released, exitSamples };
      console.log(`  captured ${before.length} nodes`);
      await page.waitForTimeout(400);
    } catch (e) {
      results[t.name] = { error: String(e).slice(0, 300) };
      console.log(`  ERROR ${String(e).slice(0, 200)}`);
    }
  }

  // ---- dropdown mini-icon + video flow ----
  try {
    await page.evaluate(`window.scrollTo(0, 0)`);
    await page.waitForTimeout(800);
    const videoState = () => page.evaluate(`[...document.querySelectorAll('video')].map(v => ({ paused: v.paused, ct: v.currentTime, rs: v.readyState, vis: !!(v.offsetWidth || v.offsetHeight) }))`);
    const vBefore = await videoState();

    // hover Product nav item to open dropdown
    const prodRect = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Product' && a.getBoundingClientRect().top < 120); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    await page.mouse.move(prodRect.x + prodRect.w / 2, prodRect.y + prodRect.h / 2, { steps: 3 });
    await page.waitForTimeout(1200);
    const vDropdownOpen = await videoState();
    await page.waitForTimeout(1000);
    const vDropdownOpen2 = await videoState();

    // find first visible Mini - Icon link
    const itemFound = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a[data-framer-name="Mini - Icon"]')].find(a => { const r = a.getBoundingClientRect(); return r.width > 100 && r.top > 100; }); if (!el) return null; window.__target = el; window.__vc = el.querySelector('.framer-icnbas-container'); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    console.log('miniIcon found:', JSON.stringify(itemFound));
    if (itemFound) {
      const vcSnap = () => page.evaluate(`(() => { const vc = window.__vc; const v = vc ? vc.querySelector('video') : null; const cs = vc ? getComputedStyle(vc) : null; return { vc: cs ? { opacity: cs.opacity, filter: cs.filter, transform: cs.transform, height: cs.height, order: cs.order, bottom: cs.bottom, left: cs.left, right: cs.right } : null, video: v ? { paused: v.paused, ct: v.currentTime, rs: v.readyState } : null, itemSnap: window.__snap(window.__target, 40) }; })()`);
      const itemBefore = await vcSnap();
      await page.mouse.move(itemFound.x + itemFound.w / 2, itemFound.y + itemFound.h / 2, { steps: 3 });
      const itemSamples = [];
      const t0 = Date.now();
      for (const ms of [40, 80, 120, 180, 240, 320, 420, 560, 750, 1000, 1400]) {
        const wait = ms - (Date.now() - t0);
        if (wait > 0) await page.waitForTimeout(wait);
        itemSamples.push({ ms: Date.now() - t0, ...(await vcSnap()) });
      }
      await page.waitForTimeout(400);
      const itemHover = await vcSnap();
      // move to a sibling item (exit for this one)
      await page.mouse.move(itemFound.x + itemFound.w / 2, itemFound.y + itemFound.h + 30, { steps: 3 });
      const itemExit = [];
      const tE = Date.now();
      for (const ms of [40, 90, 150, 250, 400, 700, 1100]) {
        const wait = ms - (Date.now() - tE);
        if (wait > 0) await page.waitForTimeout(wait);
        itemExit.push({ ms: Date.now() - tE, ...(await vcSnap()) });
      }
      results.miniIconItem = { rect: itemFound, vBefore, vDropdownOpen, vDropdownOpen2, itemBefore, itemSamples, itemHover, itemExit };
      console.log('miniIconItem: captured');
    } else {
      results.miniIconItem = { error: 'mini icon not found', vBefore, vDropdownOpen, vDropdownOpen2 };
    }
  } catch (e) {
    results.miniIconItem = { error: String(e).slice(0, 300) };
    console.log('miniIconItem ERROR', String(e).slice(0, 200));
  }

  fs.writeFileSync(path.join(__dirname, OUTFILE), JSON.stringify(results));
  console.log('saved', OUTFILE, 'final url', page.url());
  await browser.close();
})();
