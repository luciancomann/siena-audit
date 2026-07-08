/**
 * Final spot checks on the clone:
 *  - dot color overshoot (matches live's spring bounce)
 *  - hover works at 1024 breakpoint
 *  - videos + reduced-motion behavior (no autoplay, instant hover states)
 *  - 390 viewport: no errors, videos unaffected by hover runtime
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // ---- 1440: dot overshoot ----
  {
    const page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-A6ifb')].find(a => a.textContent.trim() === 'Customers' && a.getBoundingClientRect().top < 120 && a.getBoundingClientRect().width > 0); window.__d = el.querySelector('.framer-1wllu0q'); const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
    await page.mouse.move(10, 880);
    await page.waitForTimeout(400);
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
    const t0 = Date.now();
    const out = [];
    for (const ms of [180, 240, 320, 420]) {
      const w = ms - (Date.now() - t0);
      if (w > 0) await page.waitForTimeout(w);
      out.push(`${Date.now() - t0}ms ${await page.evaluate(`getComputedStyle(window.__d).backgroundColor`)}`);
    }
    console.log('1440 dot overshoot:', out.join(' | '));
    await page.close();
  }

  // ---- 1024: button hover ----
  {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-usqbM')].find(a => { const b = a.getBoundingClientRect(); return b.top < 120 && b.top > 0 && b.width > 0; }); if (!el) return null; window.__b = el; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, name: el.getAttribute('data-framer-name') }; })()`);
    if (r) {
      const before = await page.evaluate(`getComputedStyle(window.__b).backgroundColor`);
      await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
      await page.waitForTimeout(700);
      const after = await page.evaluate(`({ bg: getComputedStyle(window.__b).backgroundColor, img: getComputedStyle(window.__b).backgroundImage.slice(0, 60) })`);
      console.log(`1024 nav button (${r.name}): before=${before} after=${JSON.stringify(after)}`);
    } else console.log('1024: no visible nav button (breakpoint variant)');
    console.log('1024 pageerrors:', errors.length ? errors : 'none');
    await page.close();
  }

  // ---- 390: load + videos ----
  {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    const vids = await page.evaluate(`[...document.querySelectorAll('video')].map(v => ({ paused: v.paused, vis: !!(v.offsetWidth || v.offsetHeight) }))`);
    console.log('390 videos:', JSON.stringify(vids));
    console.log('390 pageerrors:', errors.length ? errors : 'none');
    await page.close();
  }

  // ---- reduced motion: videos stay paused, hover applies instantly ----
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    const vids = await page.evaluate(`[...document.querySelectorAll('video')].map(v => v.paused)`);
    console.log('reduced-motion videos paused:', JSON.stringify(vids));
    const r = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-usqbM')].find(a => { const b = a.getBoundingClientRect(); return b.top < 120 && b.top > 0 && b.width > 0; }); window.__b = el; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 2 });
    await page.waitForTimeout(80);
    const bg = await page.evaluate(`getComputedStyle(window.__b).backgroundColor`);
    console.log('reduced-motion hover bg at 80ms (should be instant transparent):', bg);
    await page.close();
  }

  await browser.close();
})();
