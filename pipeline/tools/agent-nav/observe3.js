/** Pass 3: mobile submenu captures (all four), clean mobile open/close/sub timelines,
 *  desktop long-unhover persistence, resources geometry. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'live');
const BLOCK = /cookieyes|googletagmanager|events\.framer\.com/;

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
      const o = { h: +r.height.toFixed(1), y: +r.top.toFixed(1) };
      for (const p of props) o[p] = cs[p];
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

  // ---------- DESKTOP: unhover persistence + resources geometry ----------
  let ctx = await browser.newContext({ deviceScaleFactor: 1 });
  let page = await ctx.newPage();
  await page.route(BLOCK, r => r.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const variant = () => page.evaluate(() => document.querySelector('div.framer-abxou').className.split(' ').filter(c => c.startsWith('framer-v-')).join(','));

  results.initial = await variant();
  await page.mouse.move(250, 80, { steps: 3 });
  await page.waitForTimeout(400);
  results.afterHover = await variant();
  await page.mouse.move(250, 500, { steps: 3 });
  await page.waitForTimeout(8000);
  results.after8sUnhover = await variant();
  // tiny scroll down and back
  await page.evaluate(() => window.scrollTo(0, 5));
  await page.waitForTimeout(400);
  results.afterScroll5 = await variant();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  results.afterScrollBack0 = await variant();

  // resources geometry
  await page.locator('div.framer-1ms5aq1 a:has(p:text-is("Resources"))').first().hover();
  await page.waitForTimeout(1200);
  results.resourcesGeom = await page.evaluate(() => {
    const g = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    return { abxou: g('div.framer-abxou'), menuArea: g('div.framer-k27yhv'), resources: g('div.framer-6do8do') };
  });
  // company geometry too
  await page.locator('div.framer-1ms5aq1 a:has(p:text-is("Company"))').first().hover();
  await page.waitForTimeout(1200);
  results.companyGeom = await page.evaluate(() => {
    const g = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    return { abxou: g('div.framer-abxou'), footer: g('div.framer-1vjakz0'), companyRow: g('div.framer-x14izb') };
  });
  await page.close();
  await ctx.close();

  // ---------- MOBILE ----------
  ctx = await browser.newContext({ deviceScaleFactor: 1, hasTouch: true });
  page = await ctx.newPage();
  await page.route(BLOCK, r => r.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SAMPLER);

  const burgerPos = () => page.evaluate(() => {
    const r = document.querySelector('.framer-x592o9').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const navName = () => page.evaluate(() => document.querySelector('nav').getAttribute('data-framer-name'));

  const mobileWatch = [
    ['nav', 'nav', ['height', 'backgroundColor']],
    ['links', 'div.framer-1ozj9u4', ['opacity', 'transform', 'height']],
    ['row1', 'div.framer-8ynei1', ['opacity', 'transform']],
    ['cta', 'div.framer-6srs9l', ['opacity', 'transform']],
    ['burgerP', '.framer-x592o9 p', ['opacity', 'transform']],
  ];

  // clean open timeline
  await page.evaluate((s) => window.__watch(s), mobileWatch);
  let b = await burgerPos();
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1600);
  results.mobileOpenTl = (await page.evaluate(() => window.__stop())).map(s => ({
    t: s.t, navH: s.nav && s.nav.h,
    linksOp: s.links && s.links.opacity, linksH: s.links && s.links.h, linksTf: s.links && s.links.transform && s.links.transform.slice(0, 42),
    row1: s.row1 && (s.row1.opacity + '|' + (s.row1.transform || '').slice(0, 38)),
    cta: s.cta && s.cta.opacity, burgerP: s.burgerP && s.burgerP.opacity,
  }));
  results.openName = await navName();

  // clean close timeline
  await page.evaluate((s) => window.__watch(s), mobileWatch);
  b = await burgerPos();
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1600);
  results.mobileCloseTl = (await page.evaluate(() => window.__stop())).map(s => ({
    t: s.t, navH: s.nav && s.nav.h, linksOp: s.links && s.links.opacity, linksExists: !!s.links,
  }));
  results.closedName = await navName();

  // open again, then capture each submenu
  const tapRow = async (label) => {
    const box = await page.evaluate((label) => {
      const rows = [...document.querySelectorAll('nav div[data-framer-name="Phone"]')];
      for (const row of rows) {
        if ((row.textContent || '').trim().startsWith(label)) {
          const r = row.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    }, label);
    if (box) await page.mouse.click(box.x, box.y);
    return box;
  };
  const tapBack = async () => {
    const box = await page.evaluate(() => {
      const el = document.querySelector('nav .framer-y2su2r');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (box) await page.mouse.click(box.x, box.y);
    return box;
  };

  b = await burgerPos();
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1300);

  // submenu open timeline for Product
  await page.evaluate((s) => window.__watch(s), [
    ['nav', 'nav', ['height']],
    ['links', 'div.framer-1ozj9u4', ['opacity', 'transform']],
  ]);
  await tapRow('Product');
  await page.waitForTimeout(1400);
  results.subOpenTl = (await page.evaluate(() => window.__stop())).map(s => ({ t: s.t, navH: s.nav && s.nav.h, linksOp: s.links && s.links.opacity, linksEx: !!s.links }));

  for (const label of ['Product', 'Resources', 'Partners', 'Company']) {
    if (label !== 'Product') {
      const t = await tapRow(label);
      await page.waitForTimeout(1300);
      if (!t) { results['sub_' + label] = 'ROW NOT FOUND'; continue; }
    }
    const nm = await navName();
    results['sub_' + label] = nm;
    const html = await page.evaluate(() => document.querySelector('nav').outerHTML);
    fs.writeFileSync(path.join(OUT, `mobile-sub-${label.toLowerCase()}.html`), html);
    await page.screenshot({ path: path.join(OUT, `mobile-sub-${label.toLowerCase()}.png`) });
    const back = await tapBack();
    await page.waitForTimeout(1100);
    results['back_' + label] = { back: !!back, name: await navName() };
  }

  // links in each submenu with hrefs (re-open product submenu quickly to list all a hrefs)
  results.subLinks = {};
  for (const label of ['Product', 'Resources', 'Partners', 'Company']) {
    await tapRow(label);
    await page.waitForTimeout(1100);
    results.subLinks[label] = await page.evaluate(() =>
      [...document.querySelectorAll('nav a')].map(a => ({ t: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50), h: a.getAttribute('href') })).filter(x => x.h || x.t)
    );
    await tapBack();
    await page.waitForTimeout(900);
  }

  await page.close();
  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results3.json'), JSON.stringify(results, null, 1));
  console.log('done pass3:', JSON.stringify({ ...results, mobileOpenTl: results.mobileOpenTl.length, mobileCloseTl: results.mobileCloseTl.length, subOpenTl: results.subOpenTl.length, subLinks: Object.keys(results.subLinks) }, null, 1).slice(0, 2200));
})();
