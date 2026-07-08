const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  console.log('visibilityState:', await page.evaluate(() => document.visibilityState));

  const study = async (cls, itemCls) => {
    console.log('======== ' + cls);
    await page.evaluate((cls) => document.querySelector('.' + cls).scrollIntoView({ block: 'center' }), cls);
    await page.waitForTimeout(300);

    // capture transition on next click with rAF-precision polling
    const res = await page.evaluate(async ({ cls, itemCls }) => {
      const c = document.querySelector('.' + cls);
      const btns = [...c.querySelectorAll('button')];
      const next = btns[btns.length - 1];
      const items = [...c.querySelectorAll('.' + itemCls)];
      const track = items[0].parentElement;
      const snap = () => ({
        t: Math.round(performance.now() - t0),
        counter: c.querySelector('button + div span').textContent,
        visible: items.map((el, i) => el.style.display !== 'none' ? i : -1).filter(i => i >= 0),
        styles: items.slice(0, 15).map((el) => el.style.display !== 'none' ? { o: getComputedStyle(el).opacity, tr: getComputedStyle(el).transform, inl: el.getAttribute('style').slice(0,250) } : null).filter(Boolean),
        trackStyle: { o: getComputedStyle(track).opacity, tr: getComputedStyle(track).transform, inl: (track.getAttribute('style')||'').slice(0,300) }
      });
      const t0 = performance.now();
      const out = [snap()];
      next.click();
      while (performance.now() - t0 < 1500) {
        await new Promise(r => requestAnimationFrame(r));
        out.push(snap());
      }
      return out;
    }, { cls, itemCls });
    fs.writeFileSync('click-' + cls + '.json', JSON.stringify(res, null, 1));
    // print condensed
    let prev = '';
    for (const s of res) {
      const k = s.counter + JSON.stringify(s.visible) + s.trackStyle.o + s.trackStyle.tr + (s.styles[0] ? s.styles[0].o + s.styles[0].tr : '');
      if (k !== prev) { console.log(s.t, s.counter, JSON.stringify(s.visible), 'track:', s.trackStyle.o, s.trackStyle.tr.slice(0,60), 'item0:', s.styles[0] && s.styles[0].o, s.styles[0] && s.styles[0].tr.slice(0,60)); prev = k; }
    }
  };

  await study('framer-1kknw4s-container', 'framer-1tbaed4');
  await study('framer-66vi1x-container', 'framer-i2kkua');

  // wrap-around checks: click prev from page1, and next through the end
  const wrap = await page.evaluate(async () => {
    const get = (cls, itemCls) => {
      const c = document.querySelector('.' + cls);
      const btns = [...c.querySelectorAll('button')];
      return { c, prevB: btns[0], nextB: btns[btns.length-1], items: [...c.querySelectorAll('.' + itemCls)] };
    };
    const state = (g) => ({ counter: g.c.querySelector('button + div span').textContent + g.c.querySelectorAll('button + div span')[0].nextElementSibling.textContent, visible: g.items.map((el,i)=>el.style.display!=='none'?i:-1).filter(i=>i>=0) });
    const out = {};
    // c1 prev from current (page2 now)
    const g1 = get('framer-1kknw4s-container', 'framer-1tbaed4');
    g1.prevB.click(); await new Promise(r=>setTimeout(r,700));
    out.c1_afterPrev = state(g1);
    g1.prevB.click(); await new Promise(r=>setTimeout(r,700));
    out.c1_prevFromFirst = state(g1);
    // c2: advance all the way
    const g2 = get('framer-66vi1x-container', 'framer-i2kkua');
    out.c2_pages = [state(g2)];
    for (let i=0;i<6;i++){ g2.nextB.click(); await new Promise(r=>setTimeout(r,700)); out.c2_pages.push(state(g2)); }
    return out;
  });
  console.log('WRAP:', JSON.stringify(wrap, null, 1));

  // drag/swipe + cursor check
  const drag = await page.evaluate(() => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const item = c.querySelector('.framer-1tbaed4');
    const track = item.parentElement;
    return { trackCursor: getComputedStyle(track).cursor, itemCursor: getComputedStyle(item).cursor, trackParentCursor: getComputedStyle(track.parentElement).cursor };
  });
  console.log('CURSORS:', JSON.stringify(drag));
  await browser.close();
})();
