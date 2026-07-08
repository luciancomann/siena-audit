const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const out = {};
  for (const cls of ['framer-1kknw4s-container', 'framer-66vi1x-container']) {
    const info = await page.evaluate((cls) => {
      const c = document.querySelector('.' + cls);
      if (!c) return null;
      const r = c.getBoundingClientRect();
      // structure summary
      const summarize = (el, depth, max) => {
        if (depth > max) return null;
        const o = {
          tag: el.tagName.toLowerCase(),
          cls: el.className && el.className.baseVal !== undefined ? '' : (el.getAttribute('class') || ''),
          name: el.getAttribute('data-framer-name') || undefined,
          style: (el.getAttribute('style') || '').slice(0, 400),
          aria: el.getAttribute('aria-label') || undefined,
          role: el.getAttribute('role') || undefined,
          rect: (() => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })(),
          children: []
        };
        for (const ch of el.children) {
          const s = summarize(ch, depth + 1, max);
          if (s) o.children.push(s);
        }
        return o;
      };
      return {
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        height: r.height,
        tree: summarize(c, 0, 7),
        outerLen: c.outerHTML.length
      };
    }, cls);
    out[cls] = info;
    // full outerHTML
    const html = await page.evaluate((cls) => document.querySelector('.' + cls).outerHTML, cls);
    fs.writeFileSync('live-' + cls + '.html', html);
  }
  fs.writeFileSync('live-structure.json', JSON.stringify(out, null, 2));
  console.log('heights:', out['framer-1kknw4s-container'].rect, out['framer-66vi1x-container'].rect);
  await browser.close();
})();
