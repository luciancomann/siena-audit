/**
 * Sweep: after scrolling through the whole page and settling, list elements
 * whose own computed opacity < 0.5 (with real area, not display:none) on the
 * clone, and check the matching element's settled opacity on live. Elements
 * hidden on clone but visible on live = missed in-view animations.
 */
const { chromium } = require('playwright');

const LOCAL = process.env.LOCAL_BASE || 'http://localhost:3200';
const REMOTE = 'https://www.siena.cx';
const widths = (process.argv[2] ? process.argv[2].split(',') : ['1440', '1024', '390']).map(Number);

async function settledHidden(page) {
  return page.evaluate(async () => {
    // scroll through slowly enough for IO triggers, then to top
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    // wait for staggered animations to finish
    await new Promise(r => setTimeout(r, 4000));
    const out = [];
    for (const el of document.querySelectorAll('#main *')) {
      if (!(el instanceof HTMLElement)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const o = parseFloat(cs.opacity);
      if (o >= 0.5) continue;
      // skip if an ancestor already reported (only report the animated root)
      let p = el.parentElement, anc = false;
      while (p && p !== document.body) {
        if (parseFloat(getComputedStyle(p).opacity) < 0.5 || getComputedStyle(p).display === 'none') { anc = true; break; }
        p = p.parentElement;
      }
      if (anc) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 100) continue;
      const fc = [...el.classList].filter(c => /^framer-/.test(c)).join('.');
      const chain = [];
      p = el;
      for (let i = 0; i < 5 && p; i++) {
        const c = [...p.classList].find(c => /^framer-[a-z0-9]+$/.test(c));
        if (c) chain.push(c);
        p = p.parentElement;
      }
      out.push({
        cls: fc, chain: chain.join('<'), o: +o.toFixed(3),
        y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
        mounted: !!el.closest('[data-mounted]'),
        text: (el.textContent || '').trim().slice(0, 40),
        aria: el.getAttribute('aria-label'),
      });
    }
    return out;
  });
}

async function opacityOf(page, items) {
  return page.evaluate((items) => {
    return items.map((it) => {
      const sel = it.cls ? '.' + it.cls.split('.')[0] : (it.aria ? `[aria-label="${it.aria}"]` : null);
      if (!sel) return null;
      let match = null;
      for (const el of document.querySelectorAll(sel)) {
        let p = el, hidden = false;
        while (p) { if (p instanceof HTMLElement && getComputedStyle(p).display === 'none') { hidden = true; break; } p = p.parentElement; }
        if (!hidden) { match = el; break; }
      }
      if (!match) return { found: false };
      return { found: true, o: +parseFloat(getComputedStyle(match).opacity).toFixed(3) };
    });
  }, items);
}

(async () => {
  const browser = await chromium.launch();
  for (const width of widths) {
    const vh = width === 390 ? 844 : 900;
    console.log(`\n===== width ${width} =====`);
    const ctx = await browser.newContext({ viewport: { width, height: vh } });
    await ctx.route(/cookieyes|googletagmanager|events\.framer\.com|facebook|linkedin\.com\/px/, r => r.abort());

    const clonePage = await ctx.newPage();
    await clonePage.goto(LOCAL + '/', { waitUntil: 'networkidle' }).catch(() => {});
    await clonePage.waitForTimeout(2000);
    const hidden = await settledHidden(clonePage);

    const livePage = await ctx.newPage();
    await livePage.goto(REMOTE + '/', { waitUntil: 'networkidle' }).catch(() => {});
    await livePage.waitForTimeout(1500);
    // same settle scroll on live
    await livePage.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      await new Promise(r => setTimeout(r, 4000));
    });
    const live = await opacityOf(livePage, hidden);

    hidden.forEach((it, i) => {
      const lv = live[i];
      const flag = lv && lv.found && lv.o > 0.5 ? ' <<< LIVE VISIBLE, CLONE HIDDEN' : '';
      console.log(`clone o=${it.o} y=${it.y} ${it.w}x${it.h} .${it.cls} mounted=${it.mounted} live=${lv ? JSON.stringify(lv) : '?'} "${it.text}"${flag}`);
    });
    if (!hidden.length) console.log('(no hidden elements on settled clone)');
    await ctx.close();
  }
  await browser.close();
})();
