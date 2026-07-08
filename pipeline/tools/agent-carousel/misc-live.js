const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();

  // ---- Phone 390 ----
  const mctx = await browser.newContext({ viewport: {width:390,height:844}, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  await mctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const mp = await mctx.newPage();
  await mp.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await mp.waitForTimeout(2500);

  // c1 phone structure
  const phone = await mp.evaluate(() => {
    const out = {};
    for (const cls of ['framer-1kknw4s-container','framer-66vi1x-container']) {
      const c = document.querySelector('.' + cls);
      const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
      const outerPad = visVariant.firstElementChild;
      const fixedH = outerPad.firstElementChild;
      const column = fixedH.firstElementChild;
      const trackWrapper = column.firstElementChild;
      const track = trackWrapper.firstElementChild;
      out[cls] = {
        fixedHInline: fixedH.getAttribute('style'),
        trackCls: track.getAttribute('class'),
        trackName: track.getAttribute('data-framer-name'),
        trackInline: track.getAttribute('style'),
        childCount: track.children.length,
        childCls: [...new Set([...track.children].map(ch => ch.getAttribute('class')))],
        visibleIdx: [...track.children].map((ch,i)=>ch.style.display!=='none'?i:-1).filter(i=>i>=0),
        firstItemInline: track.children[0].getAttribute('style')
      };
    }
    return out;
  });
  console.log('PHONE STRUCTURE:', JSON.stringify(phone, null, 1));

  // c1 phone transition on next click (mutation observe)
  await mp.evaluate(() => document.querySelector('.framer-1kknw4s-container').scrollIntoView({block:'center'}));
  await mp.waitForTimeout(400);
  const phoneMut = await mp.evaluate(async () => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const entries = []; const t0 = performance.now();
    const mo = new MutationObserver(muts => { for (const m of muts) if (m.attributeName === 'style') entries.push({ t: Math.round(performance.now()-t0), cls: (m.target.getAttribute('class')||'').slice(0,20), style: (m.target.getAttribute('style')||'').slice(0,220) }); });
    mo.observe(c, { attributes: true, attributeFilter: ['style'], subtree: true });
    const btns = [...c.querySelectorAll('button')].filter(b => b.offsetParent);
    btns[btns.length-1].click();
    await new Promise(r=>setTimeout(r, 800)); mo.disconnect(); return entries;
  });
  const seen = new Set();
  console.log('PHONE C1 CLICK MUTATIONS:');
  for (const e of phoneMut) { const k = e.cls+'|'+e.style; if (!seen.has(k)) { console.log(' ', e.t, e.cls, e.style); seen.add(k); } }

  // touch swipe test on c1 (phone): swipe left over the slide area
  const before = await mp.evaluate(() => document.querySelector('.framer-1kknw4s-container').querySelector('button + div span').textContent);
  const box = await mp.evaluate(() => { const c = document.querySelector('.framer-1kknw4s-container'); c.scrollIntoView({block:'center'}); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await mp.waitForTimeout(300);
  // perform swipe via touchscreen
  const startX = box.x + box.w * 0.8, endX = box.x + box.w * 0.2, y = box.y + 200;
  await mp.touchscreen.tap(startX, y); // ensure touch works
  await mp.waitForTimeout(200);
  // manual swipe with dispatchTouchEvents via CDP is complex; use pan gesture
  const cdp = await mctx.newCDPSession(mp);
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(startX), y: Math.round(y), xDistance: -250, yDistance: 0, speed: 800, preventFling: true });
  await mp.waitForTimeout(800);
  const after = await mp.evaluate(() => document.querySelector('.framer-1kknw4s-container').querySelector('button + div span').textContent);
  console.log('SWIPE TEST c1: before=', before, 'after=', after);
  await mctx.close();

  // ---- Desktop: prev direction, rapid clicks, hover, reduced motion ----
  const ctx = await browser.newContext({ viewport: {width:1440,height:900} });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('.framer-1kknw4s-container').scrollIntoView({block:'center'}));

  // prev click mutations
  const prevMut = await page.evaluate(async () => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const entries = []; const t0 = performance.now();
    const mo = new MutationObserver(muts => { for (const m of muts) if (m.attributeName==='style') entries.push({ t: Math.round(performance.now()-t0), cls: (m.target.getAttribute('class')||'').slice(0,20), style: (m.target.getAttribute('style')||'').slice(0,230) }); });
    mo.observe(c, { attributes: true, attributeFilter: ['style'], subtree: true });
    const btns = [...c.querySelectorAll('button')];
    btns[0].click(); // prev from page 1 -> wraps to 11
    await new Promise(r=>setTimeout(r, 700)); mo.disconnect(); return entries;
  });
  console.log('DESKTOP C1 PREV MUTATIONS:');
  const seen2 = new Set();
  for (const e of prevMut) { const k = e.cls+'|'+e.style; if (!seen2.has(k)) { console.log(' ', e.t, e.cls, e.style); seen2.add(k); } }

  // rapid double click
  const rapid = await page.evaluate(async () => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const btns = [...c.querySelectorAll('button')];
    const counter = () => c.querySelector('button + div span').textContent;
    const start = counter();
    btns[btns.length-1].click();
    await new Promise(r=>setTimeout(r, 50));
    btns[btns.length-1].click(); // click again mid-animation
    await new Promise(r=>setTimeout(r, 900));
    return { start, end: counter() };
  });
  console.log('RAPID DOUBLE CLICK c1:', JSON.stringify(rapid));

  // hover button style
  const btnSel = '.framer-1kknw4s-container button';
  const normalBg = await page.evaluate(() => getComputedStyle(document.querySelector('.framer-1kknw4s-container button')).background);
  await page.hover(btnSel);
  await page.waitForTimeout(400);
  const hoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('.framer-1kknw4s-container button')).background);
  console.log('BTN normal bg:', normalBg.slice(0,80));
  console.log('BTN hover  bg:', hoverBg.slice(0,80));
  await ctx.close();

  // reduced motion
  const rctx = await browser.newContext({ viewport: {width:1440,height:900}, reducedMotion: 'reduce' });
  await rctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const rp = await rctx.newPage();
  await rp.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await rp.waitForTimeout(2000);
  const rm = await rp.evaluate(async () => {
    const c = document.querySelector('.framer-1kknw4s-container');
    c.scrollIntoView({block:'center'});
    const entries = []; const t0 = performance.now();
    const mo = new MutationObserver(muts => { for (const m of muts) if (m.attributeName==='style') entries.push({ t: Math.round(performance.now()-t0), style: (m.target.getAttribute('style')||'').slice(0,200) }); });
    mo.observe(c, { attributes: true, attributeFilter: ['style'], subtree: true });
    const btns = [...c.querySelectorAll('button')];
    btns[btns.length-1].click();
    await new Promise(r=>setTimeout(r, 700)); mo.disconnect();
    return entries;
  });
  console.log('REDUCED MOTION c1 next mutations:');
  const seen3 = new Set();
  for (const e of rm) { if (!seen3.has(e.style)) { console.log(' ', e.t, e.style); seen3.add(e.style); } }
  await rctx.close();
  await browser.close();
})();
