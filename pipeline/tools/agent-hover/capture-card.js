/** Focused: customer story card padding animation + testimonial retry + button exit timing. */
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

  // slow scroll through page to trigger lazy sections
  for (let y = 0; y < 12000; y += 800) {
    await page.evaluate(`window.scrollTo(0, ${y})`);
    await page.waitForTimeout(250);
  }

  // ---- customer story card padding ----
  const cardRect = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('a.framer-2kXtq')].find(a => a.getBoundingClientRect().width > 100);
    if (!el) return null;
    window.__card = el;
    window.__pad = el.querySelector('.framer-4u6w5a');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  })()`);
  if (cardRect) {
    await page.waitForTimeout(1500);
    await page.mouse.move(10, 880);
    await page.waitForTimeout(600);
    const r = await page.evaluate(`(() => { const b = window.__card.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
    const padSnap = () => page.evaluate(`(() => { const cs = getComputedStyle(window.__pad); const img = window.__card.querySelector('img'); const ics = img ? getComputedStyle(img) : null; return { padding: cs.padding, cls: window.__card.className, imgTransform: ics ? ics.transform : null, imgFilter: ics ? ics.filter : null }; })()`);
    out.cardBefore = await padSnap();
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
    out.cardSamples = [];
    const t0 = Date.now();
    for (const ms of [40, 80, 120, 180, 240, 320, 420, 560, 750, 1000]) {
      const w = ms - (Date.now() - t0);
      if (w > 0) await page.waitForTimeout(w);
      out.cardSamples.push({ ms: Date.now() - t0, ...(await padSnap()) });
    }
    await page.mouse.move(10, 880, { steps: 3 });
    out.cardExit = [];
    const tE = Date.now();
    for (const ms of [40, 90, 150, 250, 400, 700]) {
      const w = ms - (Date.now() - tE);
      if (w > 0) await page.waitForTimeout(w);
      out.cardExit.push({ ms: Date.now() - tE, ...(await padSnap()) });
    }
  } else out.cardBefore = 'card not found';

  // ---- testimonial retry (after scroll) ----
  out.testimonials = await page.evaluate(`(() => {
    const els = [...document.querySelectorAll('[data-framer-name="Testimonial"]')];
    return { total: els.length, wide: els.filter(e => e.getBoundingClientRect().width > 100).length };
  })()`);
  const tFound = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('[data-framer-name="Testimonial"]')].find(e => e.getBoundingClientRect().width > 100);
    if (!el) return null;
    window.__t = el;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  })()`);
  if (tFound) {
    await page.waitForTimeout(1500);
    await page.mouse.move(10, 880);
    await page.waitForTimeout(500);
    const r = await page.evaluate(`(() => { const b = window.__t.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
    const snap = () => page.evaluate(`(() => [window.__t, ...window.__t.querySelectorAll('*')].slice(0, 40).map(n => { const cs = getComputedStyle(n); return { cls: (n.className.toString()).slice(0, 80), bg: cs.backgroundColor, tf: cs.transform, sh: cs.boxShadow.slice(0, 80), op: cs.opacity }; }))()`);
    out.testimonialBefore = await snap();
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
    await page.waitForTimeout(800);
    out.testimonialHover = await snap();
    await page.mouse.move(10, 880);
  }

  // ---- button exit timing (nav Book a demo bg fade back) ----
  await page.evaluate(`window.scrollTo(0, 0)`);
  await page.waitForTimeout(800);
  const bFound = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('a.framer-usqbM')].find(a => { const r = a.getBoundingClientRect(); return r.top < 120 && r.top > 0 && r.width > 0; });
    if (!el) return null;
    window.__b = el;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  if (bFound) {
    const bSnap = () => page.evaluate(`(() => { const cs = getComputedStyle(window.__b); return { bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0, 120) }; })()`);
    await page.mouse.move(bFound.x + bFound.w / 2, bFound.y + bFound.h / 2, { steps: 3 });
    await page.waitForTimeout(1000);
    await page.mouse.move(10, 880, { steps: 2 });
    out.buttonExit = [];
    const tB = Date.now();
    for (const ms of [30, 60, 90, 130, 180, 240, 320, 450, 650]) {
      const w = ms - (Date.now() - tB);
      if (w > 0) await page.waitForTimeout(w);
      out.buttonExit.push({ ms: Date.now() - tB, ...(await bSnap()) });
    }
  }

  fs.writeFileSync(path.join(__dirname, 'card-live.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
  await browser.close();
})();
