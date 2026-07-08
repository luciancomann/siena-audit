const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Scroll carousel 1 into view (it may need visibility to auto-advance)
  await page.evaluate(() => document.querySelector('.framer-1kknw4s-container').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);

  // Poll counter text + visible slide index + slide styles over 35s at 100ms
  const samples = await page.evaluate(async () => {
    const getState = (cls, itemCls) => {
      const c = document.querySelector('.' + cls);
      const counter = c.querySelector('button + div span');
      const items = [...c.querySelectorAll('.' + itemCls)];
      const visible = items.map((el, i) => el.style.display !== 'none' ? i : -1).filter(i => i >= 0);
      const first = items[visible[0]];
      return {
        counter: counter ? counter.textContent : null,
        visible,
        style: first ? { opacity: getComputedStyle(first).opacity, transform: getComputedStyle(first).transform, transition: getComputedStyle(first).transition } : null
      };
    };
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 35000) {
      out.push({
        t: Math.round(performance.now() - t0),
        c1: getState('framer-1kknw4s-container', 'framer-1tbaed4'),
        c2: getState('framer-66vi1x-container', 'framer-i2kkua')
      });
      await new Promise(r => setTimeout(r, 100));
    }
    return out;
  });
  fs.writeFileSync('poll-1440.json', JSON.stringify(samples));
  // summarize transitions
  let prev = null;
  for (const s of samples) {
    const key = s.c1.counter + '|' + JSON.stringify(s.c1.visible) + '||' + s.c2.counter + '|' + JSON.stringify(s.c2.visible);
    if (key !== prev) {
      console.log(s.t, 'c1:', s.c1.counter, JSON.stringify(s.c1.visible), s.c1.style ? s.c1.style.opacity : '', '| c2:', s.c2.counter, JSON.stringify(s.c2.visible));
      prev = key;
    }
  }
  await browser.close();
})();
