/**
 * Verifies the clone's TickerRuntime against the live measurements:
 *  - speed/direction at 1440 / 1024 / 390 (same regression method as measure-live.js)
 *  - li counts unchanged (24 / 23) — no DOM duplication
 *  - seamless tiling invariant at every sample: visible strip of items is
 *    perfectly spaced by the flex gap across the recycle seam (no hole/overlap)
 *  - screenshots around an item-wrap (bump flip) moment
 *  - prefers-reduced-motion => static but visible
 *  - zero console errors
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.TARGET || 'http://localhost:3200';
const TICKERS = [
  { cls: 'framer-1ygwzxs', expect: 30 },
  { cls: 'framer-1l9mfm0', expect: -30 },
];
const LIVE = { // from measure-live.js out/live-report.json
  1440: { 'framer-1ygwzxs': 30.0, 'framer-1l9mfm0': -30.0 },
  1024: { 'framer-1ygwzxs': 30.01, 'framer-1l9mfm0': -30.0 },
  390: { 'framer-1ygwzxs': 30.0, 'framer-1l9mfm0': -30.0 },
};

async function sampleTicker(page, cls, durMs, stepMs) {
  return page.evaluate(async ({ cls, durMs, stepMs }) => {
    const els = [...document.querySelectorAll('.' + cls)];
    const vis = els.find(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none');
    if (!vis) return { error: 'no visible ticker' };
    const ul = vis.querySelector('ul');
    const gap = parseFloat(getComputedStyle(ul).columnGap);
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < durMs) {
      const m = new DOMMatrixReadOnly(getComputedStyle(ul).transform);
      const x = m.m41;
      // effective screen-left of every item (layout left + inline bump + ul x)
      const rects = [...ul.children].map(li => {
        const bm = new DOMMatrixReadOnly(getComputedStyle(li).transform);
        return { left: x + li.offsetLeft + bm.m41, w: li.offsetWidth, bumped: bm.m41 !== 0 };
      });
      // tiling check across the recycle seam: sort by left, verify each
      // consecutive pair is exactly `gap` apart (within 0.1px)
      rects.sort((a, b) => a.left - b.left);
      let worstGapErr = 0;
      for (let i = 1; i < rects.length; i++) {
        const g = rects[i].left - (rects[i - 1].left + rects[i - 1].w);
        worstGapErr = Math.max(worstGapErr, Math.abs(g - gap));
      }
      samples.push({
        t: performance.now() - t0,
        x,
        worstGapErr,
        bumpedCount: rects.filter(r => r.bumped).length,
      });
      await new Promise(r => setTimeout(r, stepMs));
    }
    const style = getComputedStyle(ul);
    return {
      samples,
      liCount: ul.children.length,
      gap,
      opacity: style.opacity,
      willChange: style.willChange,
      ulTransform: style.transform,
    };
  }, { cls, durMs, stepMs });
}

function fit(samples) {
  const segs = [[]];
  for (const s of samples) {
    const cur = segs[segs.length - 1];
    if (cur.length) {
      const prev = cur[cur.length - 1];
      if (Math.abs(s.x - prev.x) > ((s.t - prev.t) / 1000) * 200) { segs.push([s]); continue; }
    }
    cur.push(s);
  }
  const seg = segs.reduce((a, b) => (b.length > a.length ? b : a), []);
  const n = seg.length;
  const mt = seg.reduce((s, p) => s + p.t, 0) / n;
  const mx = seg.reduce((s, p) => s + p.x, 0) / n;
  let num = 0, den = 0;
  for (const p of seg) { num += (p.t - mt) * (p.x - mx); den += (p.t - mt) ** 2; }
  let ssRes = 0, ssTot = 0;
  for (const p of seg) {
    const pred = mx + (num / den) * (p.t - mt);
    ssRes += (p.x - pred) ** 2; ssTot += (p.x - mx) ** 2;
  }
  return { speed: (num / den) * 1000, r2: 1 - ssRes / ssTot, segments: segs.length };
}

(async () => {
  const browser = await chromium.launch();
  const results = { pass: true, checks: [] };
  const check = (name, ok, detail) => {
    results.checks.push({ name, ok, detail });
    if (!ok) results.pass = false;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  };

  for (const width of [1440, 1024, 390]) {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('.framer-1ygwzxs')];
      const vis = els.find(e => e.offsetParent !== null);
      if (vis) vis.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(600);

    for (const { cls, expect } of TICKERS) {
      const data = await sampleTicker(page, cls, 6500, 150);
      if (data.error) { check(`${width} ${cls} present`, false, data.error); continue; }
      const f = fit(data.samples);
      const liveSpeed = LIVE[width][cls];
      const pctDiff = Math.abs((f.speed - liveSpeed) / liveSpeed) * 100;
      const worstGap = Math.max(...data.samples.map(s => s.worstGapErr));
      check(`${width} ${cls} speed`, pctDiff < 5,
        `clone=${f.speed.toFixed(2)}px/s live=${liveSpeed}px/s diff=${pctDiff.toFixed(2)}% r2=${f.r2.toFixed(5)}`);
      check(`${width} ${cls} liCount`, data.liCount === (cls === 'framer-1ygwzxs' ? 24 : 23), `liCount=${data.liCount}`);
      check(`${width} ${cls} seamless tiling`, worstGap < 0.1, `worst gap error=${worstGap.toFixed(4)}px over ${data.samples.length} samples`);
      check(`${width} ${cls} visible`, data.opacity === '1', `opacity=${data.opacity} willChange=${data.willChange}`);
    }
    check(`${width} console errors`, errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
    await ctx.close();
  }

  // item-wrap screenshots: wait for a bump flip, screenshot before/after
  {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('.framer-1ygwzxs')];
      const vis = els.find(e => e.offsetParent !== null);
      if (vis) vis.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(600);
    const section = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.framer-13naqo6')];
      const vis = els.find(e => e.offsetParent !== null);
      const r = vis.getBoundingClientRect();
      return { x: 0, y: Math.max(0, r.y - 10), width: 1440, height: r.height + 20 };
    });
    const bumpState = () => page.evaluate(() => {
      const out = {};
      for (const cls of ['framer-1ygwzxs', 'framer-1l9mfm0']) {
        const vis = [...document.querySelectorAll('.' + cls)].find(e => e.offsetParent !== null);
        const ul = vis.querySelector('ul');
        out[cls] = [...ul.children].map(li => (li.style.transform !== 'none' && li.style.transform !== '' ? 1 : 0)).join('');
      }
      return out;
    });
    let before = await bumpState();
    let flipped = false;
    const t0 = Date.now();
    await page.screenshot({ path: path.join(OUT, 'wrap-before.png'), clip: section });
    while (Date.now() - t0 < 20000) {
      await page.waitForTimeout(250);
      const now = await bumpState();
      if (now['framer-1ygwzxs'] !== before['framer-1ygwzxs'] || now['framer-1l9mfm0'] !== before['framer-1l9mfm0']) {
        flipped = true;
        await page.screenshot({ path: path.join(OUT, 'wrap-after.png'), clip: section });
        break;
      }
    }
    check('item recycle occurred within 20s', flipped, flipped ? 'bump flip captured, screenshots saved' : 'no flip seen');
    await ctx.close();
  }

  // reduced motion
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('.framer-1ygwzxs')];
      const vis = els.find(e => e.offsetParent !== null);
      if (vis) vis.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(800);
    for (const { cls } of TICKERS) {
      const data = await sampleTicker(page, cls, 2000, 200);
      const f = fit(data.samples);
      check(`reduced-motion ${cls}`, Math.abs(f.speed) < 0.01 && data.opacity === '1' || (isNaN(f.speed) && data.opacity === '1'),
        `speed=${isNaN(f.speed) ? '0 (static)' : f.speed.toFixed(3)} opacity=${data.opacity}`);
    }
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, 'verify-report.json'), JSON.stringify(results, null, 1));
  await browser.close();
  console.log(results.pass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
  process.exit(results.pass ? 0 : 1);
})();
