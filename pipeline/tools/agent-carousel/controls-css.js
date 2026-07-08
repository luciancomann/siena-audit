const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  const res = await page.evaluate(() => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const btn = c.querySelector('button');
    const counter = c.querySelector('button + div');
    const pick = (el, props) => { const cs = getComputedStyle(el); const o = {}; props.forEach(p => o[p] = cs.getPropertyValue(p)); return o; };
    return {
      btn: pick(btn, ['width','height','border-radius','background-color','cursor','font-family']),
      counter: pick(counter, ['font-family','font-size','font-weight','line-height','color','letter-spacing']),
      counterRect: (b => [b.width, b.height])(counter.getBoundingClientRect()),
      svgStroke: getComputedStyle(c.querySelector('button svg')).stroke,
      rowParent: c.querySelector('button').closest('div[style*="margin-top"]').parentElement.getAttribute('style')
    };
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
