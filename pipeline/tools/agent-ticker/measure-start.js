/**
 * Captures ticker start behavior on a fresh load of https://www.siena.cx:
 * initial x, opacity fade-in timing, and whether animation pauses off-screen.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());

  // install sampler before any site JS runs
  await page.addInitScript(() => {
    window.__samples = [];
    const t0 = performance.now();
    const tick = () => {
      const out = { t: performance.now() - t0 };
      for (const [key, cls] of [['a', 'framer-1ygwzxs'], ['b', 'framer-1l9mfm0']]) {
        const els = [...document.querySelectorAll('.' + cls)];
        const vis = els.find(e => e.offsetParent !== null);
        const ul = vis && vis.querySelector('ul');
        if (ul) {
          const cs = getComputedStyle(ul);
          const m = new DOMMatrixReadOnly(cs.transform);
          out[key] = { x: Math.round(m.m41 * 100) / 100, o: cs.opacity };
        }
      }
      window.__samples.push(out);
      setTimeout(tick, 100);
    };
    tick();
  });

  await page.goto('https://www.siena.cx/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  const early = await page.evaluate(() => window.__samples.splice(0));
  // print the transition region (where x starts changing / opacity flips)
  let printed = 0;
  for (let i = 0; i < early.length; i++) {
    const s = early[i], p = early[i - 1];
    const changed = p && s.a && p.a && (s.a.x !== p.a.x || s.a.o !== p.a.o || (s.b && p.b && (s.b.x !== p.b.x || s.b.o !== p.b.o)));
    if (!p || changed || printed < 3 || i > early.length - 3) {
      console.log(JSON.stringify(s));
      printed++;
      if (printed > 40) break;
    }
  }

  // off-screen pause test: scroll far away, wait, compare
  const grab = () => page.evaluate(() => {
    const out = {};
    for (const [key, cls] of [['a', 'framer-1ygwzxs'], ['b', 'framer-1l9mfm0']]) {
      const els = [...document.querySelectorAll('.' + cls)];
      const vis = els.find(e => e.offsetParent !== null);
      const ul = vis && vis.querySelector('ul');
      if (ul) out[key] = new DOMMatrixReadOnly(getComputedStyle(ul).transform).m41;
    }
    return out;
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const p1 = await grab();
  await page.waitForTimeout(3000);
  const p2 = await grab();
  console.log('OFFSCREEN 3s delta:', { a: p2.a - p1.a, b: p2.b - p1.b }, '(0 => paused, ~±90 => running)');

  await browser.close();
})();
