/**
 * Recon: enumerate hoverable candidates + videos on live homepage.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      const b = el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
      return b;
    };
    const anchors = [...document.querySelectorAll('a')].filter(vis).map(a => ({
      text: (a.innerText || '').trim().slice(0, 60).replace(/\n/g, ' | '),
      href: a.getAttribute('href'),
      cls: a.className.toString().slice(0, 120),
      name: a.getAttribute('data-framer-name'),
      rect: (() => { const r = a.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    }));
    const videos = [...document.querySelectorAll('video')].map(v => ({
      src: v.currentSrc || v.src,
      autoplay: v.autoplay, loop: v.loop, muted: v.muted, preload: v.preload,
      playsinline: v.hasAttribute('playsinline'),
      paused: v.paused, currentTime: v.currentTime, readyState: v.readyState,
      poster: v.poster,
      cls: v.className.toString().slice(0, 100),
      parentCls: v.parentElement ? v.parentElement.className.toString().slice(0, 100) : '',
      rect: (() => { const r = v.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      inSsrVariant: !!v.closest('.ssr-variant'),
      ssrVariantCls: v.closest('.ssr-variant') ? v.closest('.ssr-variant').className : null,
      visible: !!(v.offsetWidth || v.offsetHeight || v.getClientRects().length),
    }));
    // nav top-level items
    const navItems = [...document.querySelectorAll('nav [data-framer-name], header [data-framer-name]')]
      .filter(el => /product|resources|partners|company|pricing|customers/i.test(el.getAttribute('data-framer-name') || ''))
      .slice(0, 30)
      .map(el => ({ name: el.getAttribute('data-framer-name'), tag: el.tagName, cls: el.className.toString().slice(0, 100), text: (el.innerText || '').slice(0, 40) }));
    return { anchors, videos, navItems, scrollHeight: document.body.scrollHeight };
  });
  fs.writeFileSync(path.join(__dirname, 'recon.json'), JSON.stringify(data, null, 1));
  console.log('videos:', JSON.stringify(data.videos, null, 1));
  console.log('anchors count:', data.anchors.length);
  console.log('navItems:', JSON.stringify(data.navItems.slice(0, 12), null, 1));
  await browser.close();
})();
