const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, (r) => r.abort());
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);

  const out = await page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    return {
      usqbM: q('a.framer-usqbM').map((a) => ({ name: a.getAttribute('data-framer-name'), text: a.textContent.trim().slice(0, 30), y: Math.round(a.getBoundingClientRect().top + scrollY), cls: a.className.slice(0, 160) })),
      kXtq: q('a.framer-2kXtq').length,
      NlcvS: q('.framer-NlcvS').length,
      tile: q('.framer-80k0qc').length,
      tileAlt: q('[data-framer-name="integrations"]').map((el) => ({ cls: el.className.slice(0, 60), y: Math.round(el.getBoundingClientRect().top + scrollY), w: Math.round(el.getBoundingClientRect().width) })).slice(0, 12),
      storyCards: q('a[href*="customer-stories"]').map((a) => ({ cls: a.className.slice(0, 120), y: Math.round(a.getBoundingClientRect().top + scrollY), w: Math.round(a.getBoundingClientRect().width), name: a.getAttribute('data-framer-name') })),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
