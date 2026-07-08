/**
 * Precisely measures the two homepage logo tickers on https://www.siena.cx
 * at 1440 / 1024 / 390 widths:
 *  - direction + speed (px/s) via linear regression over ~6s of transform samples
 *  - wrap mechanics: ul content width, per-li bump transforms, wrap jumps
 *  - hover-pause behavior
 *  - whether the runtime duplicates li children
 *  - prefers-reduced-motion behavior
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const TICKERS = ['framer-1ygwzxs', 'framer-1l9mfm0'];

function visibleUlHandleExpr(cls) {
  // among the 3 ssr-variants pick the visible one
  return `(() => {
    const els = [...document.querySelectorAll('.${cls}')];
    const vis = els.find(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none');
    return vis ? vis.querySelector('ul') : null;
  })()`;
}

async function sampleTicker(page, cls, durMs = 6000, stepMs = 200) {
  return page.evaluate(async ({ cls, durMs, stepMs }) => {
    const els = [...document.querySelectorAll('.' + cls)];
    const vis = els.find(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none');
    if (!vis) return { error: 'no visible ticker' };
    const ul = vis.querySelector('ul');
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < durMs) {
      const m = new DOMMatrixReadOnly(getComputedStyle(ul).transform);
      samples.push({ t: performance.now() - t0, x: m.m41 });
      await new Promise(r => setTimeout(r, stepMs));
    }
    // per-li transforms + geometry
    const lis = [...ul.children].map((li, i) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(li).transform);
      return { i, x: m.m41, w: li.offsetWidth, left: li.offsetLeft };
    });
    const style = getComputedStyle(ul);
    return {
      samples,
      liCount: ul.children.length,
      lis,
      ulScrollWidth: ul.scrollWidth,
      ulClientWidth: ul.clientWidth,
      containerWidth: vis.clientWidth,
      gap: style.gap,
      opacity: style.opacity,
      willChange: style.willChange,
      ulInlineStyle: ul.getAttribute('style'),
    };
  }, { cls, durMs, stepMs });
}

function fit(samples) {
  // detect wraps (jumps), regress on longest continuous segment
  const segs = [[]];
  for (let i = 0; i < samples.length; i++) {
    const cur = segs[segs.length - 1];
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const dt = (samples[i].t - prev.t) / 1000;
      const dx = samples[i].x - prev.x;
      if (Math.abs(dx) > Math.abs(dt) * 200) { segs.push([samples[i]]); continue; } // jump > 200px/s => wrap
    }
    cur.push(samples[i]);
  }
  const seg = segs.reduce((a, b) => (b.length > a.length ? b : a), []);
  const n = seg.length;
  const mt = seg.reduce((s, p) => s + p.t, 0) / n;
  const mx = seg.reduce((s, p) => s + p.x, 0) / n;
  let num = 0, den = 0;
  for (const p of seg) { num += (p.t - mt) * (p.x - mx); den += (p.t - mt) ** 2; }
  const slope = num / den * 1000; // px/s
  let ssRes = 0, ssTot = 0;
  for (const p of seg) {
    const pred = mx + (num / den) * (p.t - mt);
    ssRes += (p.x - pred) ** 2; ssTot += (p.x - mx) ** 2;
  }
  const wraps = [];
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1][segs[i - 1].length - 1], b = segs[i][0];
    wraps.push({ from: a.x, to: b.x, jump: b.x - a.x });
  }
  return { speed: slope, r2: 1 - ssRes / ssTot, segments: segs.length, wraps, first: samples[0], last: samples[samples.length - 1] };
}

(async () => {
  const browser = await chromium.launch();
  const report = {};

  for (const width of [1440, 1024, 390]) {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
    await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    // scroll tickers into view
    await page.evaluate((cls) => {
      const els = [...document.querySelectorAll('.' + cls)];
      const vis = els.find(e => e.offsetParent !== null);
      if (vis) vis.scrollIntoView({ block: 'center' });
    }, TICKERS[0]);
    await page.waitForTimeout(1000);

    report[width] = {};
    for (const cls of TICKERS) {
      const data = await sampleTicker(page, cls, 6500, 150);
      if (data.error) { report[width][cls] = data; continue; }
      const f = fit(data.samples);
      report[width][cls] = { ...data, fit: f };
      console.log(`[${width}] ${cls}: speed=${f.speed.toFixed(2)}px/s r2=${f.r2.toFixed(5)} segs=${f.segments} liCount=${data.liCount} scrollW=${data.ulScrollWidth} contW=${data.containerWidth} gap=${data.gap} wraps=${JSON.stringify(f.wraps)}`);
      delete report[width][cls].samples; // keep report small, but save raw separately
      fs.writeFileSync(path.join(OUT, `samples-${width}-${cls}.json`), JSON.stringify(data.samples));
    }

    // hover test at this width (only once, on first ticker)
    if (width === 1440) {
      for (const cls of TICKERS) {
        const box = await page.evaluate((cls) => {
          const els = [...document.querySelectorAll('.' + cls)];
          const vis = els.find(e => e.offsetParent !== null);
          const r = vis.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, cls);
        await page.mouse.move(box.x, box.y);
        await page.waitForTimeout(400);
        const data = await sampleTicker(page, cls, 3000, 150);
        const f = fit(data.samples);
        report[width][cls].hoverSpeed = f.speed;
        console.log(`[${width}] ${cls} HOVER: speed=${f.speed.toFixed(2)}px/s`);
        await page.mouse.move(10, 10);
        await page.waitForTimeout(300);
      }
    }
    await ctx.close();
  }

  // reduced-motion test
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
    await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate((cls) => {
      const els = [...document.querySelectorAll('.' + cls)];
      const vis = els.find(e => e.offsetParent !== null);
      if (vis) vis.scrollIntoView({ block: 'center' });
    }, TICKERS[0]);
    await page.waitForTimeout(1500);
    report.reducedMotion = {};
    for (const cls of TICKERS) {
      const data = await sampleTicker(page, cls, 2500, 200);
      const f = data.error ? null : fit(data.samples);
      report.reducedMotion[cls] = { speed: f ? f.speed : null, opacity: data.opacity, ulInlineStyle: data.ulInlineStyle && data.ulInlineStyle.slice(0, 200) };
      console.log(`[reduced] ${cls}: speed=${f ? f.speed.toFixed(3) : 'n/a'} opacity=${data.opacity}`);
    }
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  console.log('saved', path.join(OUT, 'live-report.json'));
})();
