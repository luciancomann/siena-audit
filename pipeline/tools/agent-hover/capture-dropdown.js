/** Resources dropdown: blog card hover + ICON link hover. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'https://www.siena.cx/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, (r) => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const out = {};

  const SNAP = `window.__snap = (el, max=50) => [el, ...el.querySelectorAll('*')].slice(0, max).map(n => { const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); return { tag: n.tagName, cls: n.className.toString().slice(0,120), bg: cs.backgroundColor, color: cs.color, tf: cs.transform, filt: cs.filter, op: cs.opacity, sh: cs.boxShadow.slice(0,100), w: Math.round(r.width*10)/10, left: cs.left, right: cs.right, width: cs.width }; }); true;`;
  await page.evaluate(SNAP);

  // open Resources dropdown
  const res = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Resources' && a.getBoundingClientRect().top < 120); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  await page.mouse.move(res.x + res.w / 2, res.y + res.h / 2, { steps: 3 });
  await page.waitForTimeout(1200);

  // blog card
  const card = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-stcy1')].find(a => a.getBoundingClientRect().width > 100); if (!el) return null; window.__c = el; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  console.log('blog card:', JSON.stringify(card));
  if (card) {
    out.cardBefore = await page.evaluate(`window.__snap(window.__c)`);
    await page.mouse.move(card.x + card.w / 2, card.y + card.h / 2, { steps: 3 });
    out.cardSamples = [];
    const t0 = Date.now();
    for (const ms of [50, 120, 200, 320, 500, 800]) {
      const w = ms - (Date.now() - t0);
      if (w > 0) await page.waitForTimeout(w);
      out.cardSamples.push({ ms: Date.now() - t0, snap: await page.evaluate(`window.__snap(window.__c)`) });
    }
    out.cardHover = await page.evaluate(`window.__snap(window.__c)`);
    // back to Resources trigger (keeps dropdown open), then check exit
    await page.mouse.move(res.x + res.w / 2, res.y + res.h / 2, { steps: 3 });
    await page.waitForTimeout(700);
    out.cardExit = await page.evaluate(`window.__snap(window.__c)`);
  }

  // ICON link inside dropdown (e.g. Blog / Community links col) — a.framer-A6ifb visible below nav
  const icon = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-A6ifb')].find(a => { const r = a.getBoundingClientRect(); return r.top > 130 && r.width > 0; }); if (!el) return null; window.__i = el; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cls: el.className, text: el.textContent.trim().slice(0, 30) }; })()`);
  console.log('dropdown icon link:', JSON.stringify(icon));
  if (icon) {
    out.iconBefore = await page.evaluate(`window.__snap(window.__i)`);
    await page.mouse.move(icon.x + icon.w / 2, icon.y + icon.h / 2, { steps: 3 });
    out.iconSamples = [];
    const t0 = Date.now();
    for (const ms of [50, 120, 200, 320, 500, 800]) {
      const w = ms - (Date.now() - t0);
      if (w > 0) await page.waitForTimeout(w);
      out.iconSamples.push({ ms: Date.now() - t0, snap: await page.evaluate(`window.__snap(window.__i)`) });
    }
    out.iconHover = await page.evaluate(`window.__snap(window.__i)`);
  }

  fs.writeFileSync(path.join(__dirname, 'dropdown-live.json'), JSON.stringify(out));
  console.log('saved');
  await browser.close();
})();
