/**
 * Side-by-side verification of the clone carousels (localhost:3200) vs live
 * (www.siena.cx) at 1440 and 390. Usage: node verify.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

const CONTAINERS = [
  ['framer-1kknw4s-container', 'c1'],
  ['framer-66vi1x-container', 'c2'],
];

async function newPage(browser, url, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 150)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}

async function restState(page) {
  return page.evaluate(() => {
    const out = {};
    for (const cls of ['framer-1kknw4s-container', 'framer-66vi1x-container']) {
      const c = document.querySelector('.' + cls);
      const r = c.getBoundingClientRect();
      const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
      const btns = [...visVariant.querySelectorAll('button')];
      const rowInner = btns[0] ? btns[0].parentElement : null;
      const row = rowInner ? rowInner.parentElement : null;
      const counterSpans = rowInner ? [...rowInner.querySelectorAll('div span')] : [];
      const outerPad = visVariant.firstElementChild;
      const fixedH = outerPad.firstElementChild;
      const column = fixedH.firstElementChild;
      const track = column.firstElementChild.firstElementChild;
      const items = [...track.children];
      const visible = items.map((el, i) => el.style.display !== 'none' ? i : -1).filter(i => i >= 0);
      const pick = (el, props) => { const cs = getComputedStyle(el); const o = {}; props.forEach(p => o[p] = cs.getPropertyValue(p)); return o; };
      out[cls] = {
        containerWH: [Math.round(r.width), Math.round(r.height)],
        rowRect: row ? (b => [Math.round(b.width), Math.round(b.height)])(row.getBoundingClientRect()) : null,
        rowMarginTop: row ? getComputedStyle(row).marginTop : null,
        btn: btns[0] ? pick(btns[0], ['width', 'height', 'border-radius', 'background-color', 'cursor']) : null,
        btnCount: btns.length,
        counterText: counterSpans.map(s => s.textContent).join(''),
        counterCss: counterSpans[0] ? pick(counterSpans[0].parentElement, ['font-size', 'color']) : null,
        span2Opacity: counterSpans[1] ? getComputedStyle(counterSpans[1]).opacity : null,
        visible,
        itemCount: items.length,
        item0: (b => [Math.round(b.width), Math.round(b.height)])(items[visible[0] ?? 0].getBoundingClientRect()),
        trackWH: (b => [Math.round(b.width), Math.round(b.height)])(track.getBoundingClientRect()),
        svgStroke: btns[0] ? getComputedStyle(btns[0].querySelector('svg')).stroke : null,
      };
    }
    return out;
  });
}

async function slideTiming(page, cls) {
  await page.evaluate((cls) => document.querySelector('.' + cls).scrollIntoView({ block: 'center' }), cls);
  await page.waitForTimeout(400);
  return page.evaluate(async (cls) => {
    const c = document.querySelector('.' + cls);
    const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
    const track = visVariant.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
    const items = [...track.children];
    const btns = [...visVariant.querySelectorAll('button')];
    const counter = () => visVariant.querySelector('button + div span').textContent;
    const startCounter = counter();
    const curIdx = items.findIndex(el => el.style.display !== 'none');
    const t0 = performance.now();
    btns[btns.length - 1].click();
    const frames = [];
    let firstMove = null, lastMove = null, trackAnim = null;
    while (performance.now() - t0 < 700) {
      await new Promise(r => requestAnimationFrame(r));
      const t = performance.now() - t0;
      const m = getComputedStyle(items[curIdx]).transform;
      const tx = m.startsWith('matrix') ? parseFloat(m.split(',')[4]) : 0;
      if (tx < -1 && firstMove === null) firstMove = t;
      if (items[curIdx].style.display !== 'none') lastMove = { t, tx };
      if (!trackAnim && track.style.overflow === 'hidden') trackAnim = { t, h: track.style.height };
      frames.push({ t: Math.round(t), tx: Math.round(tx) });
    }
    return { startCounter, endCounter: counter(), firstMove: Math.round(firstMove || -1), settle: lastMove, trackAnim, maxTx: Math.min(...frames.map(f => f.tx)), frames: frames.filter((_, i) => i % 4 === 0) };
  }, cls);
}

async function fadeTiming(page, cls) {
  await page.evaluate((cls) => document.querySelector('.' + cls).scrollIntoView({ block: 'center' }), cls);
  await page.waitForTimeout(400);
  return page.evaluate(async (cls) => {
    const c = document.querySelector('.' + cls);
    const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
    const column = visVariant.firstElementChild.firstElementChild.firstElementChild;
    const track = column.firstElementChild.firstElementChild;
    const items = [...track.children];
    const btns = [...visVariant.querySelectorAll('button')];
    const counter = () => visVariant.querySelector('button + div span').textContent;
    const vis = () => items.map((el, i) => el.style.display !== 'none' ? i : -1).filter(i => i >= 0).join(',');
    const startVis = vis(), startCounter = counter();
    const t0 = performance.now();
    btns[btns.length - 1].click();
    let minOpacity = 1, swapT = null, opacityRestoredT = null, cleanT = null;
    while (performance.now() - t0 < 800) {
      await new Promise(r => requestAnimationFrame(r));
      const t = performance.now() - t0;
      const o = parseFloat(getComputedStyle(column).opacity);
      minOpacity = Math.min(minOpacity, o);
      if (swapT === null && vis() !== startVis) swapT = t;
      if (swapT !== null && opacityRestoredT === null && o > 0.99) opacityRestoredT = t;
      if (cleanT === null && swapT !== null && !column.style.transition) cleanT = t;
    }
    return { startCounter, endCounter: counter(), startVis, endVis: vis(), minOpacity, swapT: Math.round(swapT || -1), opacityRestoredT: Math.round(opacityRestoredT || -1), cleanT: Math.round(cleanT || -1) };
  }, cls);
}

async function behavior(page) {
  // wrap-around + rapid click lock on c1; c2 page walk
  return page.evaluate(async () => {
    const get = (cls) => {
      const c = document.querySelector('.' + cls);
      const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
      const track = visVariant.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
      const btns = [...visVariant.querySelectorAll('button')];
      return {
        prev: btns[0], next: btns[btns.length - 1],
        counter: () => [...visVariant.querySelectorAll('button + div span')].map(s => s.textContent).join(''),
        vis: () => [...track.children].map((el, i) => el.style.display !== 'none' ? i : -1).filter(i => i >= 0).join(','),
      };
    };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const out = {};
    const g1 = get('framer-1kknw4s-container');
    out.c1_start = g1.counter();
    g1.prev.click(); await wait(500);
    out.c1_prevWrap = { counter: g1.counter(), vis: g1.vis() };
    // rapid double click
    g1.next.click(); await wait(40); g1.next.click(); await wait(600);
    out.c1_rapid = { counter: g1.counter(), vis: g1.vis() };
    const g2 = get('framer-66vi1x-container');
    out.c2_pages = [{ counter: g2.counter(), vis: g2.vis() }];
    for (let i = 0; i < 5; i++) { g2.next.click(); await wait(500); out.c2_pages.push({ counter: g2.counter(), vis: g2.vis() }); }
    return out;
  });
}

(async () => {
  const target = process.argv[2] || 'both'; // clone | live | both
  const urls = [];
  if (target !== 'live') urls.push(['CLONE', 'http://localhost:3200/']);
  if (target !== 'clone') urls.push(['LIVE', 'https://www.siena.cx/']);
  const browser = await chromium.launch();
  const all = {};
  for (const [label, url] of urls) {
    all[label] = {};
    for (const width of [1440, 390]) {
      const { ctx, page, errors } = await newPage(browser, url, width, width < 500 ? 844 : 900);
      const rest = await restState(page);
      const slide = await slideTiming(page, 'framer-1kknw4s-container');
      const fade = await fadeTiming(page, 'framer-66vi1x-container');
      const behav = width === 1440 ? await behavior(page) : null;
      // region screenshots
      for (const [cls, short] of CONTAINERS) {
        const el = page.locator('.' + cls).first();
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await el.screenshot({ path: `shot-${label}-${width}-${short}.png` }).catch(e => console.log('shot fail', e.message.slice(0, 60)));
      }
      all[label][width] = { rest, slide, fade, behav, consoleErrors: errors };
      await ctx.close();
    }
  }
  fs.writeFileSync('verify-results.json', JSON.stringify(all, null, 1));
  // summary
  for (const label of Object.keys(all)) for (const width of Object.keys(all[label])) {
    const d = all[label][width];
    console.log(`\n===== ${label} @ ${width}`);
    for (const cls of Object.keys(d.rest)) {
      const r = d.rest[cls];
      console.log(` ${cls}: container=${r.containerWH} row=${r.rowRect} mt=${r.rowMarginTop} counter="${r.counterText}" visible=[${r.visible}] item0=${r.item0} btn=${r.btn && r.btn.width}x${r.btn && r.btn.height} bg=${r.btn && r.btn['background-color']}`);
    }
    console.log(` slide: ${d.slide.startCounter}->${d.slide.endCounter} firstMove=${d.slide.firstMove}ms settle=${d.slide.settle && Math.round(d.slide.settle.t)}ms maxTx=${d.slide.maxTx} trackLock=${JSON.stringify(d.slide.trackAnim)}`);
    console.log(` fade: ${d.fade.startCounter}->${d.fade.endCounter} vis ${d.fade.startVis} -> ${d.fade.endVis} minOpacity=${d.fade.minOpacity} swapT=${d.fade.swapT} restored=${d.fade.opacityRestoredT} clean=${d.fade.cleanT}`);
    if (d.behav) console.log(` behavior:`, JSON.stringify(d.behav));
    console.log(` consoleErrors:`, d.consoleErrors.length ? d.consoleErrors : 'none');
  }
  await browser.close();
})();
