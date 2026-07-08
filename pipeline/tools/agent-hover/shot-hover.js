/** Screenshots of hovered nav CTA + footer social, live vs clone, plus pixel diff. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

async function shoot(url, tag) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, (r) => r.abort());
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  // nav CTA hovered
  let r = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-usqbM')].find(a => { const b = a.getBoundingClientRect(); return b.top < 120 && b.top > 0 && b.width > 0; }); const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, `btn-${tag}.png`), clip: { x: r.x - 6, y: r.y - 6, width: r.w + 12, height: r.h + 12 } });
  // footer social hovered
  r = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-rCoMe')].find(a => a.getBoundingClientRect().width > 0); el.scrollIntoView({ block: 'center', behavior: 'instant' }); return null; })()`);
  await page.waitForTimeout(1200);
  r = await page.evaluate(`(() => { const el = [...document.querySelectorAll('a.framer-rCoMe')].find(a => a.getBoundingClientRect().width > 0); const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2, { steps: 3 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, `social-${tag}.png`), clip: { x: r.x - 6, y: r.y - 6, width: r.w + 12, height: r.h + 12 } });
  await browser.close();
}

function diff(name) {
  const a = PNG.sync.read(fs.readFileSync(path.join(__dirname, `${name}-live.png`)));
  const b = PNG.sync.read(fs.readFileSync(path.join(__dirname, `${name}-clone.png`)));
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const crop = (img) => {
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
    return out;
  };
  const ca = crop(a), cb = crop(b);
  const out = new PNG({ width: w, height: h });
  const n = pixelmatch(ca.data, cb.data, out.data, w, h, { threshold: 0.12 });
  console.log(`${name}: ${n}/${w * h} pixels differ (${((n / (w * h)) * 100).toFixed(2)}%) [sizes live ${a.width}x${a.height} clone ${b.width}x${b.height}]`);
}

(async () => {
  await shoot('https://www.siena.cx/', 'live');
  await shoot('http://localhost:3200/', 'clone');
  diff('btn');
  diff('social');
})();
