const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('.framer-1kknw4s-container').scrollIntoView({block:'center'}));
  await page.waitForTimeout(300);
  const res = await page.evaluate(async () => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const items = [...c.querySelectorAll('.framer-1tbaed4')];
    const btns = [...c.querySelectorAll('button')];
    const t0 = performance.now();
    const out = [];
    const snap = () => out.push({ t: Math.round(performance.now()-t0),
      i0: { d: items[0].style.display, m: getComputedStyle(items[0]).transform },
      i10: { d: items[10].style.display, m: getComputedStyle(items[10]).transform } });
    btns[0].click(); // prev from slide 1 (idx0) -> slide 11 (idx10)
    while (performance.now() - t0 < 500) { await new Promise(r=>requestAnimationFrame(r)); snap(); }
    return out;
  });
  for (const s of res.filter((_,i)=>i%3===0)) console.log(s.t, 'i0:', s.i0.d||'shown', s.i0.m.slice(0,40), '| i10:', s.i10.d||'shown', s.i10.m.slice(0,40));
  await browser.close();
})();
