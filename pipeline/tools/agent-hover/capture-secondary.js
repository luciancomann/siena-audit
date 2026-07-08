/** Secondary / md button hover (Read full story) — captured on /customers where visible. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, (r) => r.abort());
  await page.goto('https://www.siena.cx/customers', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  for (let y = 0; y < 6000; y += 800) { await page.evaluate(`window.scrollTo(0, ${y})`); await page.waitForTimeout(200); }
  const found = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('a.framer-usqbM[data-framer-name="Secondary / md"]')].find(a => a.getBoundingClientRect().width > 50);
    if (!el) return null;
    window.__t = el;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return el.className;
  })()`);
  console.log('found:', found);
  const out = {};
  if (found) {
    await page.waitForTimeout(1400);
    await page.mouse.move(10, 880);
    await page.waitForTimeout(500);
    const snap = () => page.evaluate(`(() => [window.__t, ...window.__t.querySelectorAll('*')].slice(0,10).map(n => { const cs = getComputedStyle(n); return { tag: n.tagName, cls: n.className.toString().slice(0,140), bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0,400), color: cs.color, tf: cs.transform, op: cs.opacity, bc: cs.borderTopColor, bw: cs.borderTopWidth }; }))()`);
    const r = await page.evaluate(`(() => { const b = window.__t.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
    out.before = await snap();
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
    out.samples = [];
    const t0 = Date.now();
    for (const ms of [50, 120, 200, 320, 500, 800]) {
      const w = ms - (Date.now() - t0);
      if (w > 0) await page.waitForTimeout(w);
      out.samples.push({ ms: Date.now() - t0, snap: await snap() });
    }
    out.hover = await snap();
  }
  fs.writeFileSync(path.join(__dirname, 'secondary-live.json'), JSON.stringify(out));
  // print diff
  if (out.before) {
    for (let i = 0; i < out.before.length; i++) {
      for (const k of Object.keys(out.before[i])) {
        if (out.before[i][k] !== out.hover[i][k]) console.log(`[${i}] ${out.before[i].tag} ${k}: ${out.before[i][k]} -> ${out.hover[i][k]}`);
      }
    }
    for (const s of out.samples) console.log(`t=${s.ms} bg=${s.snap[0].bg}`);
  }
  await browser.close();
})();
