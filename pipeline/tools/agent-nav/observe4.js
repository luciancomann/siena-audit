/** Pass 4: menu item hover micro-interactions + missing sprite defs + item hover DOM diffs. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'live');
const BLOCK = /cookieyes|googletagmanager|events\.framer\.com/;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(BLOCK, r => r.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const results = {};

  // missing sprite defs
  results.sprites = await page.evaluate(() => {
    const out = {};
    for (const id of ['svg438111121_1382', 'svg-1019157664_1330']) {
      const el = document.getElementById(id);
      out[id] = el ? el.outerHTML : null;
    }
    return out;
  });

  // open product menu
  await page.locator('div.framer-1ms5aq1 a:has(p:text-is("Product"))').first().hover();
  await page.waitForTimeout(1300);

  // hover "Reviews Agent" item; capture before/after outerHTML + computed styles
  const item = page.locator('div.framer-k27yhv a:has(p:text-is("Reviews Agent"))').first();
  results.itemBefore = await page.evaluate(() => {
    const items = [...document.querySelectorAll('div.framer-k27yhv a')];
    const el = items.find(a => a.textContent.includes('Reviews Agent'));
    const vid = el.querySelector('video');
    return { html: el.outerHTML, cls: el.className, videoPlaying: vid ? !vid.paused : null };
  });
  await item.hover();
  await page.waitForTimeout(700);
  results.itemAfter = await page.evaluate(() => {
    const items = [...document.querySelectorAll('div.framer-k27yhv a')];
    const el = items.find(a => a.textContent.includes('Reviews Agent'));
    const vid = el.querySelector('video');
    const iconWrap = el.querySelector('.framer-icnbas-container');
    const glyph = el.querySelector('.framer-8trnac');
    return {
      html: el.outerHTML, cls: el.className, videoPlaying: vid ? !vid.paused : null,
      videoAttrs: vid ? [...vid.attributes].map(a => a.name + '=' + a.value).join(' ') : null,
      iconWrapStyle: iconWrap && iconWrap.getAttribute('style'),
      glyphStyle: glyph && glyph.getAttribute('style'),
      glyphOpacity: glyph && getComputedStyle(glyph).opacity,
    };
  });

  // hover an ICON link in resources menu (arrow underline animation)
  await page.locator('div.framer-1ms5aq1 a:has(p:text-is("Resources"))').first().hover();
  await page.waitForTimeout(1200);
  results.iconLinkBefore = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div.framer-6do8do a')].find(a => a.textContent.trim().startsWith('Blog'));
    return el ? { html: el.outerHTML.slice(0, 3000), cls: el.className } : null;
  });
  const blogLink = page.locator('div.framer-6do8do a', { hasText: 'Blog' }).first();
  await blogLink.hover();
  await page.waitForTimeout(700);
  results.iconLinkAfter = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div.framer-6do8do a')].find(a => a.textContent.trim().startsWith('Blog'));
    if (!el) return null;
    const line = el.querySelector('.framer-19484f4');
    return { cls: el.className, lineHtml: line ? line.outerHTML : null, style: el.getAttribute('style') };
  });

  // nav top-level link hover (no dropdown open): Customers link color change?
  await page.mouse.move(720, 700);
  await page.waitForTimeout(900);
  const cust = page.locator('div.framer-1uwyr6h-container a').first();
  results.custBefore = await page.evaluate(() => {
    const el = document.querySelector('div.framer-1uwyr6h-container a');
    return { style: el.getAttribute('style'), p: getComputedStyle(el.querySelector('p')).color, cls: el.className };
  });
  await cust.hover();
  await page.waitForTimeout(600);
  results.custAfter = await page.evaluate(() => {
    const el = document.querySelector('div.framer-1uwyr6h-container a');
    return { style: el.getAttribute('style'), p: getComputedStyle(el.querySelector('p')).color, cls: el.className, container: document.querySelector('div.framer-1uwyr6h-container').getAttribute('style') };
  });

  // "Book a demo" button hover style change
  results.ctaBefore = await page.evaluate(() => {
    const el = document.querySelector('div.framer-167oinb-container a');
    return { cls: el.className, style: el.getAttribute('style'), bg: getComputedStyle(el).backgroundColor };
  });
  await page.locator('div.framer-167oinb-container a').first().hover();
  await page.waitForTimeout(600);
  results.ctaAfter = await page.evaluate(() => {
    const el = document.querySelector('div.framer-167oinb-container a');
    return { cls: el.className, style: el.getAttribute('style'), bg: getComputedStyle(el).backgroundColor };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results4.json'), JSON.stringify(results, null, 1));
  console.log('sprites found:', Object.entries(results.sprites).map(([k, v]) => k + ':' + (v ? 'YES' : 'NO')).join(' '));
  console.log('item video before/after playing:', results.itemBefore.videoPlaying, results.itemAfter.videoPlaying);
  console.log('item cls after:', results.itemAfter.cls);
  console.log('iconWrapStyle after:', results.itemAfter.iconWrapStyle);
  console.log('glyph after:', results.itemAfter.glyphOpacity, results.itemAfter.glyphStyle);
  console.log('cust color before/after:', results.custBefore.p, results.custAfter.p);
  console.log('cta bg before/after:', results.ctaBefore.bg, results.ctaAfter.bg);
  console.log('cta cls after:', results.ctaAfter.cls);
  console.log('iconLink line after:', results.iconLinkAfter && (results.iconLinkAfter.lineHtml || '').slice(0, 300));
})();
