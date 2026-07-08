const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  for (const [cls, itemCls] of [['framer-66vi1x-container','framer-i2kkua'], ['framer-1kknw4s-container','framer-1tbaed4']]) {
    await page.evaluate((cls) => document.querySelector('.' + cls).scrollIntoView({ block: 'center' }), cls);
    await page.waitForTimeout(300);
    const log = await page.evaluate(async ({ cls, itemCls }) => {
      const c = document.querySelector('.' + cls);
      const items = [...c.querySelectorAll('.' + itemCls)];
      const idx = (el) => { const i = items.indexOf(el); return i >= 0 ? 'item' + i : (el.className && String(el.className).slice(0,30)) || el.tagName; };
      const entries = [];
      const t0 = performance.now();
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'attributes' && m.attributeName === 'style') {
            entries.push({ t: Math.round(performance.now() - t0), el: idx(m.target), style: (m.target.getAttribute('style') || '').slice(0, 300) });
          } else if (m.type === 'childList') {
            entries.push({ t: Math.round(performance.now() - t0), el: idx(m.target), added: m.addedNodes.length, removed: m.removedNodes.length });
          }
        }
      });
      mo.observe(c, { attributes: true, attributeFilter: ['style'], subtree: true, childList: true });
      const btns = [...c.querySelectorAll('button')];
      btns[btns.length - 1].click();
      await new Promise(r => setTimeout(r, 1200));
      mo.disconnect();
      return entries;
    }, { cls, itemCls });
    fs.writeFileSync('mutations-' + cls + '.json', JSON.stringify(log, null, 1));
    console.log('==== ' + cls + ' (' + log.length + ' mutations)');
    const seen = new Set();
    for (const e of log) {
      const k = e.el + '|' + (e.style || 'child');
      if (!seen.has(k)) { console.log(e.t, e.el, e.style || ('+'+e.added+' -'+e.removed)); seen.add(k); }
    }
  }
  await browser.close();
})();
