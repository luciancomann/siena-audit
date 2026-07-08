const { chromium, devices } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const [label, vp, touch] of [['1440', {width:1440,height:900}, false], ['1024', {width:1024,height:800}, false], ['390', {width:390,height:844}, true]]) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
    await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const out = {};
      for (const [cls, itemCls] of [['framer-1kknw4s-container','framer-1tbaed4'],['framer-66vi1x-container','framer-i2kkua']]) {
        const c = document.querySelector('.' + cls);
        if (!c) { out[cls] = null; continue; }
        const r = c.getBoundingClientRect();
        const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
        const items = [...visVariant.querySelectorAll('*')].filter(el => (el.getAttribute('class')||'').split(' ').includes(itemCls));
        const visible = items.map((el,i)=>el.style.display!=='none'?i:-1).filter(i=>i>=0);
        const counterSpans = [...visVariant.querySelectorAll('button + div span')];
        const fixedH = visVariant.querySelector('div > div'); // wrapper with fixed height
        const controls = [...visVariant.querySelectorAll('button')];
        out[cls] = {
          containerRect: [Math.round(r.width), Math.round(r.height)],
          variantCls: visVariant.getAttribute('class'),
          itemCount: items.length, visible,
          counter: counterSpans.map(s=>s.textContent),
          itemInline: items[visible[0]] ? items[visible[0]].getAttribute('style') : null,
          fixedHStyle: fixedH ? fixedH.getAttribute('style') : null,
          hasControls: controls.length,
          controlsRow: (() => { const b = controls[0] && controls[0].closest('div[style*="margin-top"]'); return b ? b.getAttribute('style') : null; })(),
          outerPad: visVariant.firstElementChild ? visVariant.firstElementChild.getAttribute('style') : null
        };
      }
      return out;
    });
    results[label] = info;
    console.log('==== ' + label + ' ====');
    console.log(JSON.stringify(info, null, 1));
    await ctx.close();
  }
  fs.writeFileSync('breakpoints.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
