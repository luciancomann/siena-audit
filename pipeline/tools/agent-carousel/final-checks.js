const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();

  // ---- c2 slide timing at 390: clone vs live
  for (const [label, url] of [['CLONE', 'http://localhost:3200/'], ['LIVE', 'https://www.siena.cx/']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.framer-66vi1x-container').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const res = await page.evaluate(async () => {
      const c = document.querySelector('.framer-66vi1x-container');
      const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
      const track = visVariant.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
      const items = [...track.children];
      const btns = [...visVariant.querySelectorAll('button')];
      const t0 = performance.now();
      btns[btns.length - 1].click();
      let maxTx = 0, settle = 0, lockH = null;
      while (performance.now() - t0 < 700) {
        await new Promise(r => requestAnimationFrame(r));
        const m = getComputedStyle(items[0]).transform;
        const tx = m.startsWith('matrix') ? parseFloat(m.split(',')[4]) : 0;
        if (tx < maxTx) { maxTx = tx; settle = performance.now() - t0; }
        if (!lockH && track.style.overflow === 'hidden') lockH = track.style.height;
      }
      return { maxTx: Math.round(maxTx), settle: Math.round(settle), lockH, counter: visVariant.querySelector('button + div span').textContent };
    });
    console.log(label + ' c2@390 slide:', JSON.stringify(res));
    await ctx.close();
  }

  // ---- tablet 1024: clone vs live rest + modes
  for (const [label, url] of [['CLONE', 'http://localhost:3200/'], ['LIVE', 'https://www.siena.cx/']]) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    const res = await page.evaluate(() => {
      const out = {};
      for (const cls of ['framer-1kknw4s-container', 'framer-66vi1x-container']) {
        const c = document.querySelector('.' + cls);
        const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
        const track = visVariant.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
        const items = [...track.children];
        const visible = items.map((el, i) => el.style.display !== 'none' ? i : -1).filter(i => i >= 0);
        out[cls] = {
          H: Math.round(c.getBoundingClientRect().height),
          visible,
          counter: [...visVariant.querySelectorAll('button + div span')].map(s => s.textContent).join(''),
          item0: (b => [Math.round(b.width), Math.round(b.height)])(items[visible[0]].getBoundingClientRect()),
        };
      }
      return out;
    });
    console.log(label + ' @1024:', JSON.stringify(res));
    await ctx.close();
  }

  // ---- clone reduced motion: instant swap policy
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  await rp.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 90000 });
  await rp.waitForTimeout(2500);
  const rm = await rp.evaluate(async () => {
    const c = document.querySelector('.framer-1kknw4s-container');
    c.scrollIntoView({ block: 'center' });
    const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
    const track = visVariant.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
    const btns = [...visVariant.querySelectorAll('button')];
    const t0 = performance.now();
    btns[btns.length - 1].click();
    await new Promise(r => requestAnimationFrame(r));
    const counter = visVariant.querySelector('button + div span').textContent;
    const anyTransform = [...track.children].some(el => el.style.transform);
    return { counterAfter1Frame: counter, ms: Math.round(performance.now() - t0), anyTransform };
  });
  console.log('CLONE reduced-motion:', JSON.stringify(rm));
  await rctx.close();
  await browser.close();
})();
