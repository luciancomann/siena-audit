/**
 * Verifies HoverRuntime + VideoRuntime on the clone (localhost:3200) and
 * captures the same style snapshots as the live captures for diffing.
 * Usage: node agent-hover/verify-clone.js [url] [outfile]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'http://localhost:3200/';
const OUTFILE = process.argv[3] || 'hover-clone.json';

const TARGETS = [
  { name: 'navBookDemo', find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => { const r = a.getBoundingClientRect(); return r.top < 120 && r.top > 0 && r.width > 0; })` },
  { name: 'heroCtaXlg', find: `return [...document.querySelectorAll('a.framer-usqbM[data-framer-name="xlg"]')].find(a => a.getBoundingClientRect().width > 0)` },
  { name: 'exploreIntegrations', find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => /Explore all integrations/.test(a.textContent) && a.getBoundingClientRect().width > 0)` },
  { name: 'navCustomersLink', find: `return [...document.querySelectorAll('a.framer-A6ifb')].find(a => a.textContent.trim() === 'Customers' && a.getBoundingClientRect().top < 120 && a.getBoundingClientRect().width > 0)` },
  { name: 'footerLink', find: `return [...document.querySelectorAll('a.framer-XXLkB')].find(a => a.textContent.trim() === 'Shopping Agent' && a.getBoundingClientRect().width > 0)` },
  { name: 'footerSocial', find: `return [...document.querySelectorAll('a.framer-rCoMe')].find(a => a.getBoundingClientRect().width > 0)` },
  { name: 'customerStoryCard', find: `return [...document.querySelectorAll('a.framer-2kXtq')].find(a => a.getBoundingClientRect().width > 100)` },
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
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err).slice(0, 300)));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(SNAP_FN);

  const results = {};
  const snapNow = () => page.evaluate(`window.__snap(window.__target)`);

  for (const t of TARGETS) {
    try {
      await page.evaluate(SNAP_FN);
      const found = await page.evaluate(`(() => { const el = (function(){ ${t.find} })(); if (!el) return null; window.__target = el; return true; })()`);
      console.log(`${t.name}: found=${found}`);
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

      results[t.name] = { rect, before, samples, hoverSettled, exitSamples };
      await page.waitForTimeout(300);
    } catch (e) {
      results[t.name] = { error: String(e).slice(0, 300) };
      console.log(`  ERROR ${String(e).slice(0, 200)}`);
    }
  }

  // ---- mini-icon (synthetic hover; dropdown may be closed/invisible) ----
  try {
    const ok = await page.evaluate(`(() => {
      const el = [...document.querySelectorAll('a.framer-frCsL')].find(a => a.querySelector('.framer-icnbas-container'));
      if (!el) return null;
      window.__mi = el;
      window.__vc = el.querySelector('.framer-icnbas-container');
      return true;
    })()`);
    if (ok) {
      const vcSnap = () => page.evaluate(`(() => { const cs = getComputedStyle(window.__vc); const v = window.__vc.querySelector('video'); return { opacity: cs.opacity, transform: cs.transform, filter: cs.filter, height: cs.height, bottom: cs.bottom, cls: window.__mi.className, video: v ? { paused: v.paused, ct: v.currentTime, rs: v.readyState } : null }; })()`);
      const before = await vcSnap();
      await page.evaluate(`window.__mi.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))`);
      const samples = [];
      const t0 = Date.now();
      for (const ms of [40, 80, 120, 180, 240, 320, 420, 560, 750, 1000]) {
        const w = ms - (Date.now() - t0);
        if (w > 0) await page.waitForTimeout(w);
        samples.push({ ms: Date.now() - t0, ...(await vcSnap()) });
      }
      await page.waitForTimeout(400);
      const hover = await vcSnap();
      await page.evaluate(`window.__mi.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))`);
      const exit = [];
      const tE = Date.now();
      for (const ms of [40, 90, 150, 250, 400, 700]) {
        const w = ms - (Date.now() - tE);
        if (w > 0) await page.waitForTimeout(w);
        exit.push({ ms: Date.now() - tE, ...(await vcSnap()) });
      }
      results.miniIconItem = { before, samples, hover, exit };
    } else results.miniIconItem = { error: 'not found' };
  } catch (e) {
    results.miniIconItem = { error: String(e).slice(0, 300) };
  }

  // ---- announcement link (pure CSS hover) ----
  try {
    const a = await page.evaluate(`(() => {
      const el = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Find out more' && x.getBoundingClientRect().width > 0);
      if (!el) return null;
      window.__a = el;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`);
    if (a) {
      await page.waitForTimeout(600);
      const beforeColor = await page.evaluate(`getComputedStyle(window.__a).color`);
      await page.mouse.move(a.x + a.w / 2, a.y + a.h / 2, { steps: 3 });
      await page.waitForTimeout(300);
      const hoverColor = await page.evaluate(`getComputedStyle(window.__a).color`);
      results.announcementLink = { beforeColor, hoverColor };
      await page.mouse.move(10, 880);
    } else results.announcementLink = { error: 'not found' };
  } catch (e) {
    results.announcementLink = { error: String(e).slice(0, 300) };
  }

  // ---- videos ----
  results.videos = await page.evaluate(`[...document.querySelectorAll('video')].map(v => ({ src: (v.currentSrc || v.src).slice(-40), paused: v.paused, ct: v.currentTime, rs: v.readyState, muted: v.muted, playsinline: v.hasAttribute('playsinline') || v.playsInline, rect: (() => { const r = v.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() }))`);
  await page.waitForTimeout(3000);
  results.videosAfter3s = await page.evaluate(`[...document.querySelectorAll('video')].map(v => ({ paused: v.paused, ct: Math.round(v.currentTime * 1000) / 1000, rs: v.readyState }))`);

  results.consoleErrors = consoleErrors;
  fs.writeFileSync(path.join(__dirname, OUTFILE), JSON.stringify(results));
  console.log('saved', OUTFILE);
  console.log('console errors:', JSON.stringify(consoleErrors, null, 1));
  await browser.close();
})();
