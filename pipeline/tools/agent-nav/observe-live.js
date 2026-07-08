/**
 * Observe live siena.cx nav behavior:
 *  - desktop dropdown open/close/switch timelines (rAF sampling)
 *  - fresh open-state DOM for all four dropdowns (waiting for stable open)
 *  - scroll behavior of the nav at 1440 and 390
 *  - mobile hamburger: find it, open, sample animation, capture DOM
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'live');
fs.mkdirSync(OUT, { recursive: true });

const BLOCK = /cookieyes|googletagmanager|events\.framer\.com/;

async function newPage(browser, w, h) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(BLOCK, r => r.abort());
  await page.setViewportSize({ width: w, height: h });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  return page;
}

// injected sampler: records styles of watched elements every rAF
const SAMPLER = `
window.__samples = [];
window.__sampling = false;
window.__watch = (specs) => {
  window.__samples = [];
  window.__sampling = true;
  const t0 = performance.now();
  const step = () => {
    if (!window.__sampling) return;
    const rec = { t: Math.round(performance.now() - t0) };
    for (const [key, sel, props] of specs) {
      const el = document.querySelector(sel);
      if (!el) { rec[key] = null; continue; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const o = { h: +r.height.toFixed(1), w: +r.width.toFixed(1), y: +r.top.toFixed(1) };
      for (const p of props) o[p] = cs[p];
      o.cls = el.className.split(' ').filter(c => c.startsWith('framer-v-')).join(',');
      rec[key] = o;
    }
    window.__samples.push(rec);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
window.__stop = () => { window.__sampling = false; return window.__samples; };
`;

(async () => {
  const browser = await chromium.launch();
  const results = {};

  // ---------- DESKTOP ----------
  let page = await newPage(browser, 1440, 900);
  await page.evaluate(SAMPLER);

  const watchSpecs = [
    ['abxou', 'div.framer-abxou', ['backgroundColor', 'boxShadow', 'borderRadius', 'height']],
    ['menuArea', 'div.framer-k27yhv', ['opacity', 'height', 'position']],
    ['products', 'div.framer-160figo', ['opacity', 'transform']],
    ['resources', 'div.framer-6do8do', ['opacity', 'transform']],
    ['footer', 'div.framer-1vjakz0', ['opacity', 'height']],
    ['navwrap', 'div.framer-1dkosii-container', ['position', 'top', 'transform', 'zIndex']],
    ['chevProd', 'div.framer-1kgdahl-container .framer-uGclp', ['transform']],
    ['chevProdInner', 'div.framer-1kgdahl-container .framer-u1z6g4', ['transform']],
    ['linkProd', 'div.framer-1kgdahl-container a', ['opacity', 'color']],
    ['linkProdP', 'div.framer-1kgdahl-container a p', ['opacity', 'color']],
  ];

  async function hoverLabel(label) {
    const el = page.locator(`div.framer-1ms5aq1 a:has(p:text-is("${label}"))`).first();
    await el.hover({ timeout: 5000 });
  }

  // -- open timeline for Product
  await page.evaluate((s) => window.__watch(s), watchSpecs);
  await hoverLabel('Product');
  await page.waitForTimeout(1600);
  results.openProduct = await page.evaluate(() => window.__stop());

  // capture stable open DOM for product (fresh hrefs)
  const capture = async (name) => {
    const html = await page.evaluate(() => document.querySelectorAll('nav')[1]?.outerHTML || document.querySelector('nav').outerHTML);
    fs.writeFileSync(path.join(OUT, `open-${name}.html`), html);
    await page.screenshot({ path: path.join(OUT, `open-${name}.png`) });
  };
  await capture('product');

  // -- switch timeline product -> resources
  await page.evaluate((s) => window.__watch(s), watchSpecs);
  await hoverLabel('Resources');
  await page.waitForTimeout(1600);
  results.switchToResources = await page.evaluate(() => window.__stop());
  await capture('resources');

  // -- switch to partners, company; capture
  await hoverLabel('Partners');
  await page.waitForTimeout(1400);
  await capture('partners');
  await hoverLabel('Company');
  await page.waitForTimeout(1400);
  await capture('company');

  // -- close timeline (mouse out from company)
  await page.evaluate((s) => window.__watch(s), watchSpecs);
  await page.mouse.move(720, 700, { steps: 5 });
  await page.waitForTimeout(1600);
  results.close = await page.evaluate(() => window.__stop());

  // -- hover a non-dropdown link (Customers) — what variant does abxou get?
  await hoverLabel('Customers').catch(() => {});
  await page.waitForTimeout(900);
  results.hoverCustomers = await page.evaluate(() => {
    const a = document.querySelector('div.framer-abxou');
    return { cls: a.className, style: a.getAttribute('style') };
  });
  await page.mouse.move(720, 700);
  await page.waitForTimeout(800);

  // -- scroll behavior at 1440
  results.scrollDesktop = await page.evaluate(async () => {
    const out = [];
    const grab = (tag) => {
      const wrap = document.querySelector('div.framer-1dkosii-container');
      const nav = document.querySelectorAll('nav')[1] || document.querySelector('nav');
      const abxou = document.querySelector('div.framer-abxou');
      const banner = document.querySelector('div.framer-1cxaaoi');
      const cs = (el) => el ? { pos: getComputedStyle(el).position, top: getComputedStyle(el).top, transform: getComputedStyle(el).transform, bg: getComputedStyle(el).backgroundColor, rectY: el.getBoundingClientRect().top, h: el.getBoundingClientRect().height, display: getComputedStyle(el).display } : null;
      out.push({ tag, scrollY: window.scrollY, wrap: cs(wrap), nav: cs(nav), abxou: cs(abxou), banner: cs(banner) });
    };
    grab('top');
    window.scrollTo(0, 100); await new Promise(r => setTimeout(r, 700)); grab('y100');
    window.scrollTo(0, 400); await new Promise(r => setTimeout(r, 700)); grab('y400');
    window.scrollTo(0, 1200); await new Promise(r => setTimeout(r, 700)); grab('y1200');
    // scroll back up
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 700)); grab('backTop');
    return out;
  });

  // does dropdown still work after scrolling? and does open dropdown close on scroll?
  await hoverLabel('Product');
  await page.waitForTimeout(1200);
  results.scrollWhileOpen = await page.evaluate(async () => {
    window.scrollTo(0, 300);
    await new Promise(r => setTimeout(r, 800));
    const a = document.querySelector('div.framer-abxou');
    return { cls: a.className.split(' ').filter(c => c.startsWith('framer-v-')).join(','), scrollY: window.scrollY };
  });

  await page.close();

  // ---------- MOBILE 390 ----------
  page = await newPage(browser, 390, 844);
  await page.evaluate(SAMPLER);

  // find hamburger: all elements with cursor:pointer inside nav, with boxes
  results.mobileCandidates = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const els = [...nav.querySelectorAll('*')];
    const cands = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (cs.cursor === 'pointer' || el.getAttribute('data-highlight') === 'true' || el.tagName === 'BUTTON')) {
        cands.push({ tag: el.tagName, cls: el.className.toString().slice(0, 90), name: el.getAttribute('data-framer-name'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 20) });
      }
    }
    return cands;
  });
  fs.writeFileSync(path.join(OUT, 'results-partial.json'), JSON.stringify(results, null, 1));

  // click the framer-x592o9 (suspected hamburger) center via mouse
  const burgerBox = await page.evaluate(() => {
    const el = document.querySelector('.framer-x592o9') || document.querySelector('nav [data-highlight="true"]:not(a)');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, cls: el.className.toString() };
  });
  results.burgerBox = burgerBox;

  if (burgerBox) {
    const mobileWatch = [
      ['nav', 'nav', ['height', 'backgroundColor', 'position']],
      ['navMain', 'nav > div.framer-14il9xh', ['height', 'opacity']],
      ['burger', '.framer-x592o9', ['transform', 'opacity']],
      ['body', 'body', ['overflow']],
    ];
    await page.evaluate((s) => window.__watch(s), mobileWatch);
    await page.mouse.click(burgerBox.x, burgerBox.y);
    await page.waitForTimeout(2000);
    results.mobileOpenTimeline = await page.evaluate(() => window.__stop());

    // capture opened DOM + all styles of new elements
    const openDom = await page.evaluate(() => ({
      nav: document.querySelector('nav').outerHTML,
      bodyClass: document.body.className,
      bodyStyle: document.body.getAttribute('style'),
      htmlStyle: document.documentElement.getAttribute('style'),
      overlay: document.querySelector('#overlay')?.outerHTML || null,
    }));
    fs.writeFileSync(path.join(OUT, 'mobile-open.json'), JSON.stringify(openDom, null, 1));
    fs.writeFileSync(path.join(OUT, 'mobile-open-nav.html'), openDom.nav);
    await page.screenshot({ path: path.join(OUT, 'mobile-open.png') });

    // menu links
    results.mobileLinks = await page.evaluate(() =>
      [...document.querySelectorAll('nav a')].map(a => ({ text: (a.textContent || '').trim().slice(0, 40), href: a.getAttribute('href') }))
    );

    // accordion sections inside mobile menu? click "Product" row if present
    // then close: click burger again
    await page.evaluate((s) => window.__watch(s), mobileWatch);
    await page.mouse.click(burgerBox.x, burgerBox.y);
    await page.waitForTimeout(1500);
    results.mobileCloseTimeline = await page.evaluate(() => window.__stop());
    await page.screenshot({ path: path.join(OUT, 'mobile-closed-after.png') });
  }

  // mobile scroll behavior
  results.scrollMobile = await page.evaluate(async () => {
    const out = [];
    const grab = (tag) => {
      const nav = document.querySelector('nav');
      const cs = getComputedStyle(nav);
      const r = nav.getBoundingClientRect();
      const wrap = nav.parentElement;
      out.push({ tag, scrollY: window.scrollY, navPos: cs.position, navTop: cs.top, rectY: r.top, wrapCls: wrap.className, wrapPos: getComputedStyle(wrap).position });
    };
    grab('top');
    window.scrollTo(0, 500); await new Promise(r => setTimeout(r, 700)); grab('y500');
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 500)); grab('back');
    return out;
  });

  await page.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  console.log('done. keys:', Object.keys(results));
})();
