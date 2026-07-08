const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const html = fs.readFileSync('../../pages/home.html', 'utf8');
  const browser = await chromium.launch();
  for (const [label, w] of [['1440',1440],['390',390]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.route(/framerusercontent|cookieyes|googletagmanager|events\.framer/, r => r.abort());
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('setContent warn:', e.message.slice(0,80)));
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const out = {};
      for (const cls of ['framer-1kknw4s-container','framer-66vi1x-container']) {
        const c = document.querySelector('.' + cls);
        if (!c) { out[cls] = 'MISSING'; continue; }
        const variants = [...c.children].filter(e => e.classList && e.classList.contains('ssr-variant'));
        out[cls] = {
          containerRect: (r => [Math.round(r.width), Math.round(r.height)])(c.getBoundingClientRect()),
          variants: variants.map(v => {
            const visible = getComputedStyle(v).display !== 'none';
            const track = v.firstElementChild && v.firstElementChild.firstElementChild && v.firstElementChild.firstElementChild.firstElementChild && v.firstElementChild.firstElementChild.firstElementChild.firstElementChild && v.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
            if (!track) return { visible, err: 'no track' };
            const items = [...track.children];
            const cs = getComputedStyle(track);
            return {
              cls: v.getAttribute('class'), visible,
              trackCls: track.getAttribute('class'),
              trackCS: visible ? { display: cs.display, flexDirection: cs.flexDirection, gap: cs.gap, overflow: cs.overflow, width: cs.width, height: cs.height } : null,
              itemRects: visible ? items.slice(0,5).map(it => (r => [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)])(it.getBoundingClientRect())) : null,
              itemCount: items.length
            };
          })
        };
      }
      return out;
    });
    console.log('==== ' + label + ' ====');
    console.log(JSON.stringify(info, null, 1));
    await ctx.close();
  }
  await browser.close();
})();
