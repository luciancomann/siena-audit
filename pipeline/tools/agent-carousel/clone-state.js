const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const out = {};
    for (const [cls, itemSel] of [['framer-1kknw4s-container','framer-1tbaed4'],['framer-66vi1x-container','framer-i2kkua']]) {
      const c = document.querySelector('.' + cls);
      const r = c.getBoundingClientRect();
      const variants = [...c.children].filter(e => e.classList.contains('ssr-variant')).map(v => ({
        cls: v.getAttribute('class'),
        display: getComputedStyle(v).display,
        rect: (b => [Math.round(b.width), Math.round(b.height)])(v.getBoundingClientRect())
      }));
      // items in the VISIBLE variant
      const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
      const items = visVariant ? [...visVariant.querySelectorAll('.' + itemSel)].filter(el => el.classList.contains(itemSel)) : [];
      const track = items[0] ? items[0].parentElement : null;
      out[cls] = {
        rect: [Math.round(r.width), Math.round(r.height)],
        variants,
        itemCount: items.length,
        itemStates: items.slice(0, 15).map(el => {
          const b = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return { d: cs.display, w: Math.round(b.width), h: Math.round(b.height), inl: (el.getAttribute('style')||'').slice(0,120) };
        }),
        trackCls: track ? track.getAttribute('class') : null,
        trackCS: track ? (cs => ({ display: cs.display, overflow: cs.overflow, height: cs.height, flexDirection: cs.flexDirection }))(getComputedStyle(track)) : null,
        trackScopeChain: (() => { let el = track, chain = []; while (el && el !== c) { chain.push((el.getAttribute('class')||'') + ' {' + (el.getAttribute('style')||'').slice(0,80) + '}'); el = el.parentElement; } return chain; })()
      };
    }
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
