/** Pass 2: hover-variant lifecycle, computed link colors, warm open/close timelines,
 *  mobile submenus + hamburger glyphs + scroll-while-open. */
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

  // ---------------- DESKTOP ----------------
  let ctx = await browser.newContext({ deviceScaleFactor: 1 });
  let page = await ctx.newPage();
  await page.route(BLOCK, r => r.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SAMPLER);

  const q = {
    abxou: 'div.framer-abxou',
    prodP: 'div.framer-1kgdahl-container a p',
    custP: 'div.framer-1uwyr6h-container a p',
    resP: 'div.framer-4bxy1r-container a p',
  };

  const colorsOf = () => page.evaluate((q) => {
    const out = {};
    for (const [k, sel] of Object.entries(q)) {
      const el = document.querySelector(sel);
      if (!el) { out[k] = null; continue; }
      const cs = getComputedStyle(el);
      // effective opacity: multiply up the tree
      let op = 1, n = el;
      while (n && n !== document.body) { op *= parseFloat(getComputedStyle(n).opacity || '1'); n = n.parentElement; }
      out[k] = { color: cs.color, effOpacity: +op.toFixed(3) };
    }
    return out;
  }, q);

  results.colorsClosed = await colorsOf();

  // hover nav empty area (not a link): does card get Hover variant?
  await page.mouse.move(250, 80, { steps: 3 });
  await page.waitForTimeout(600);
  results.hoverNavEmpty = await page.evaluate(() => document.querySelector('div.framer-abxou').className.split(' ').filter(c => c.startsWith('framer-v-')).join(','));
  // move out below
  await page.evaluate((s) => window.__watch(s), [['abxou', 'div.framer-abxou', ['backgroundColor', 'boxShadow']]]);
  await page.mouse.move(250, 500, { steps: 3 });
  await page.waitForTimeout(2500);
  results.unhoverTimeline = (await page.evaluate(() => window.__stop())).map(s => ({ t: s.t, bg: s.abxou.backgroundColor, cls: s.abxou.cls, sh: s.abxou.boxShadow === 'none' ? 'none' : 'YES' }));

  // warm open: hover Product (first time, throwaway), close, then sample reopen
  const hoverLabel = async (label) => {
    await page.locator(`div.framer-1ms5aq1 a:has(p:text-is("${label}"))`).first().hover({ timeout: 5000 });
  };
  await hoverLabel('Product');
  await page.waitForTimeout(1200);
  results.colorsProductOpen = await colorsOf();
  results.openGeom = await page.evaluate(() => {
    const g = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    return { abxou: g('div.framer-abxou'), menuArea: g('div.framer-k27yhv'), products: g('div.framer-160figo'), footer: g('div.framer-1vjakz0'), navwrap: g('div.framer-1dkosii-container') };
  });
  await page.mouse.move(720, 700, { steps: 3 });
  await page.waitForTimeout(1500);

  await page.evaluate((s) => window.__watch(s), [
    ['abxou', 'div.framer-abxou', ['backgroundColor']],
    ['products', 'div.framer-160figo', ['opacity', 'transform']],
    ['chev', 'div.framer-1kgdahl-container .framer-odbusp', ['transform']],
  ]);
  await hoverLabel('Product');
  await page.waitForTimeout(1300);
  results.warmOpen = (await page.evaluate(() => window.__stop())).map(s => ({
    t: s.t, h: s.abxou && s.abxou.h, bg: s.abxou && s.abxou.backgroundColor, cls: s.abxou && s.abxou.cls,
    prodOp: s.products && s.products.opacity, prodTf: s.products && s.products.transform,
    chev: s.chev && s.chev.transform,
  }));

  // switch product -> partners (menu area -> footer-only variant)
  await page.evaluate((s) => window.__watch(s), [
    ['abxou', 'div.framer-abxou', ['backgroundColor']],
    ['products', 'div.framer-160figo', ['opacity']],
    ['partners', 'div.framer-1957rwz', ['opacity']],
  ]);
  await hoverLabel('Partners');
  await page.waitForTimeout(1300);
  results.switchToPartners = (await page.evaluate(() => window.__stop())).map(s => ({
    t: s.t, h: s.abxou && s.abxou.h, cls: s.abxou && s.abxou.cls,
    prodOp: s.products && s.products.opacity, partOp: s.partners && s.partners.opacity, partH: s.partners && s.partners.h,
  }));
  results.partnersGeom = await page.evaluate(() => {
    const g = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    return { abxou: g('div.framer-abxou'), footer: g('div.framer-1vjakz0'), partnersRow: g('div.framer-1957rwz') };
  });

  // does the dropdown open have an entry delay? measure: pointerenter -> class change
  await page.mouse.move(720, 700, { steps: 3 });
  await page.waitForTimeout(1200);
  results.openDelay = await page.evaluate(async () => {
    const link = document.querySelectorAll('div.framer-1ms5aq1 a')[0];
    const abxou = document.querySelector('div.framer-abxou');
    const r = link.getBoundingClientRect();
    const t0 = performance.now();
    const ev = (type) => link.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: 'mouse' }));
    ev('pointerover'); ev('pointerenter'); ev('mouseover'); ev('mouseenter');
    return await new Promise((res) => {
      const iv = setInterval(() => {
        if (abxou.className.includes('framer-v-wctfne')) { clearInterval(iv); res(Math.round(performance.now() - t0)); }
        if (performance.now() - t0 > 2000) { clearInterval(iv); res(-1); }
      }, 5);
    });
  });

  await page.close();
  await ctx.close();

  // ---------------- MOBILE ----------------
  ctx = await browser.newContext({ deviceScaleFactor: 1, hasTouch: true });
  page = await ctx.newPage();
  await page.route(BLOCK, r => r.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SAMPLER);

  // hamburger glyphs closed
  results.burgerClosed = await page.evaluate(() => {
    const el = document.querySelector('.framer-x592o9');
    const p = el.querySelector('p');
    const cs = getComputedStyle(el);
    return {
      cls: el.className, style: el.getAttribute('style'),
      text: p.textContent, codes: [...p.textContent].map(c => c.codePointAt(0)),
      pStyle: p.getAttribute('style'), font: getComputedStyle(p).fontFamily,
      border: cs.border, borderRadius: cs.borderRadius, bg: cs.backgroundColor,
      outer: el.outerHTML,
    };
  });

  const burger = await page.evaluate(() => {
    const r = document.querySelector('.framer-x592o9').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  // warm open once (throwaway), close, then fine-sample reopen
  await page.mouse.click(burger.x, burger.y);
  await page.waitForTimeout(1500);
  await page.mouse.click(burger.x, burger.y);
  await page.waitForTimeout(1200);

  await page.evaluate((s) => window.__watch(s), [
    ['nav', 'nav', ['height', 'backgroundColor']],
    ['links', 'div.framer-1ozj9u4', ['opacity', 'transform', 'height']],
    ['row1', 'div.framer-8ynei1', ['opacity', 'transform']],
    ['row5', 'div.framer-17c8bde', ['opacity', 'transform']],
    ['cta', 'div.framer-6srs9l', ['opacity', 'transform']],
  ]);
  await page.mouse.click(burger.x, burger.y);
  await page.waitForTimeout(1500);
  results.mobileWarmOpen = (await page.evaluate(() => window.__stop())).map(s => ({
    t: s.t, navH: s.nav && s.nav.h,
    links: s.links && { h: s.links.h, op: s.links.opacity, tf: s.links.transform && s.links.transform.slice(0, 40) },
    row1: s.row1 && { op: s.row1.opacity, tf: s.row1.transform && s.row1.transform.slice(0, 40) },
    row5: s.row5 && { op: s.row5.opacity, tf: s.row5.transform && s.row5.transform.slice(0, 40) },
    cta: s.cta && { op: s.cta.opacity },
  }));

  // burger open state
  results.burgerOpen = await page.evaluate(() => {
    const el = document.querySelector('.framer-x592o9');
    const p = el.querySelector('p');
    return { cls: el.className, style: el.getAttribute('style'), text: p.textContent, codes: [...p.textContent].map(c => c.codePointAt(0)), outer: el.outerHTML.slice(0, 1200) };
  });

  // scroll while open?
  results.mobileScrollWhileOpen = await page.evaluate(async () => {
    window.scrollTo(0, 200);
    await new Promise(r => setTimeout(r, 500));
    return { scrollY: window.scrollY, navName: document.querySelector('nav').getAttribute('data-framer-name') };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // tap "Product" row -> submenu
  const tapRow = async (label) => {
    const box = await page.evaluate((label) => {
      const rows = [...document.querySelectorAll('nav div[data-framer-name="Phone"], nav a[data-framer-name="Phone"]')];
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

  for (const label of ['Product', 'Resources', 'Partners', 'Company']) {
    const box = await tapRow(label);
    await page.waitForTimeout(1400);
    const dom = await page.evaluate(() => ({
      name: document.querySelector('nav').getAttribute('data-framer-name'),
      cls: document.querySelector('nav').className,
      nav: document.querySelector('nav').outerHTML,
    }));
    results[`mobileSub_${label}`] = { tapped: !!box, name: dom.name, cls: dom.cls };
    fs.writeFileSync(path.join(OUT, `mobile-sub-${label.toLowerCase()}.html`), dom.nav);
    await page.screenshot({ path: path.join(OUT, `mobile-sub-${label.toLowerCase()}.png`) });
    // go back: find back control — capture candidates first time
    if (label === 'Product') {
      results.mobileSubBackCandidates = await page.evaluate(() =>
        [...document.querySelectorAll('nav *')].filter(el => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return r.width > 0 && cs.cursor === 'pointer' && r.y < 200;
        }).map(el => ({ tag: el.tagName, cls: el.className.toString().slice(0, 80), name: el.getAttribute('data-framer-name'), x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), text: (el.textContent || '').trim().slice(0, 15) })));
    }
    // press back (arrow at top-left of submenu?) — try clicking element named like back, else burger to fully close and reopen
    const back = await page.evaluate(() => {
      const cand = document.querySelector('nav [data-framer-name*="Back" i], nav [data-framer-name*="back" i]');
      if (!cand) return null;
      const r = cand.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (back) { await page.mouse.click(back.x, back.y); await page.waitForTimeout(1000); }
    else {
      // close menu entirely and reopen for next label
      await page.mouse.click(burger.x, burger.y); await page.waitForTimeout(1000);
      await page.mouse.click(burger.x, burger.y); await page.waitForTimeout(1200);
    }
  }

  await page.close();
  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results2.json'), JSON.stringify(results, null, 1));
  console.log('done pass2:', Object.keys(results));
})();
