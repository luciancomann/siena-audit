const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [label, w, touch] of [['tablet-1024', 1024, false], ['phone-390', 390, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch });
    await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.framer-66vi1x-container').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const log = await page.evaluate(async () => {
      const c = document.querySelector('.framer-66vi1x-container');
      const entries = []; const t0 = performance.now();
      const mo = new MutationObserver(muts => { for (const m of muts) if (m.attributeName === 'style') entries.push({ t: Math.round(performance.now() - t0), cls: (m.target.getAttribute('class') || '(anon)').slice(0, 24), style: (m.target.getAttribute('style') || '').slice(0, 160) }); });
      mo.observe(c, { attributes: true, attributeFilter: ['style'], subtree: true });
      const btns = [...c.querySelectorAll('button')].filter(b => b.offsetParent);
      btns[btns.length - 1].click();
      await new Promise(r => setTimeout(r, 900)); mo.disconnect(); return entries;
    });
    console.log('==== live c2 ' + label);
    const seen = new Set();
    for (const e of log) { const k = e.cls + '|' + e.style; if (!seen.has(k)) { console.log(' ', e.t, e.cls, e.style); seen.add(k); } }
    await ctx.close();
  }
  await browser.close();
})();
