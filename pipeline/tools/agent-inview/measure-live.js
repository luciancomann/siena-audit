/**
 * Measure live in-view entrance animations on https://www.siena.cx (homepage).
 *
 * Per group: (1) slow step-scroll to find per-element trigger points,
 * (2) reload + instant jump to capture full rAF timelines,
 * (3) scroll away and back to test re-entry behavior.
 *
 * Usage: node measure-live.js [groupName]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const REMOTE = 'https://www.siena.cx';

const GROUPS = {
  feature1: {
    width: 390,
    sels: ['.framer-st32cd', '.framer-1wa6tng', '.framer-g4cbwm', '.framer-w0jts', '.framer-1uh8716'],
    counter: false,
  },
  gruns: {
    width: 390,
    sels: ['.framer-vncnon', '.framer-1o5w0mx', '.framer-go2wqk'],
    counter: false,
  },
  counter1440: { width: 1440, sels: ['[aria-label="Counter ends at 80"]'], counter: true },
  counter390: { width: 390, sels: ['[aria-label="Counter ends at 80"]'], counter: true },
};

function visibleFilterFn() {
  // returns the visible instance of each selector (not inside display:none)
  window.__pick = (sel) => {
    for (const el of document.querySelectorAll(sel)) {
      let p = el, hidden = false;
      while (p) {
        if (p instanceof HTMLElement && getComputedStyle(p).display === 'none') { hidden = true; break; }
        p = p.parentElement;
      }
      if (!hidden) return el;
    }
    return null;
  };
}

async function newPage(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com|facebook|linkedin\.com\/px/, r => r.abort());
  await page.goto(REMOTE + '/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(visibleFilterFn);
  return page;
}

(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch();
  const results = {};

  for (const [name, g] of Object.entries(GROUPS)) {
    if (only && name !== only) continue;
    console.log(`\n### group ${name} @${g.width}`);

    // ---- pass 1: step scroll to find trigger scrollY per element ----
    let page = await newPage(browser, g.width);
    const trigger = await page.evaluate(async (sels) => {
      const els = sels.map(s => window.__pick(s));
      if (els.some(e => !e)) return { error: 'missing: ' + sels.filter((s, i) => !els[i]).join(',') };
      const info = els.map(el => ({ startOpacity: getComputedStyle(el).opacity }));
      const fired = sels.map(() => null);
      const vh = innerHeight;
      const docTop = (el) => el.getBoundingClientRect().top + scrollY;
      const tops = els.map(docTop);
      const startScroll = Math.max(0, Math.min(...tops) - vh - 200);
      window.scrollTo(0, startScroll);
      await new Promise(r => setTimeout(r, 300));
      for (let y = startScroll; y < Math.max(...tops) + 400; y += 40) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 90));
        els.forEach((el, i) => {
          if (fired[i] !== null) return;
          const o = parseFloat(getComputedStyle(el).opacity);
          if (o > parseFloat(info[i].startOpacity) + 0.02) {
            const r2 = el.getBoundingClientRect();
            fired[i] = {
              scrollY: y,
              rectTopAtFire: Math.round(r2.top),
              vh,
              // how far the element's top is above the viewport bottom when it fired
              distIntoView: Math.round(vh - r2.top),
              elHeight: Math.round(r2.height),
            };
          }
        });
        if (fired.every(f => f)) break;
      }
      return { fired, tops: tops.map(Math.round), vh };
    }, g.sels);
    console.log('trigger pass:', JSON.stringify(trigger));
    await page.close();

    // ---- pass 2: instant jump, rAF timeline ----
    page = await newPage(browser, g.width);
    const timeline = await page.evaluate(async ({ sels, counter }) => {
      const els = sels.map(s => window.__pick(s));
      if (els.some(e => !e)) return { error: 'missing' };
      const docTop = (el) => el.getBoundingClientRect().top + scrollY;
      const tops = els.map(docTop);
      const vh = innerHeight;
      // land so the group is well within view (mimic user scrolling to it)
      const target = Math.min(...tops) - Math.round(vh * 0.35);
      const samples = els.map(() => []);
      let jumpT = null;
      let stop = false;
      const t0 = performance.now();
      function sample() {
        const t = performance.now() - t0;
        els.forEach((el, i) => {
          const cs = getComputedStyle(el);
          const s = { t: +t.toFixed(1), o: +parseFloat(cs.opacity).toFixed(4), tr: cs.transform };
          if (counter) s.text = el.textContent;
          samples[i].push(s);
        });
        if (!stop) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      await new Promise(r => setTimeout(r, 200));
      jumpT = performance.now() - t0;
      window.scrollTo(0, target);
      // wait until settled: all opacities stable ~1 for 800ms, max 12s
      await new Promise((resolve) => {
        let stableSince = null;
        const iv = setInterval(() => {
          const now = performance.now() - t0;
          const allDone = els.every((el, i) => {
            const last = samples[i].slice(-8);
            if (last.length < 8) return false;
            const o = last.map(x => x.o), tr = last.map(x => x.tr);
            return o.every(v => Math.abs(v - o[0]) < 0.001) && tr.every(v => v === tr[0]) && o[0] > 0.5
              && (!counter || last.every(x => x.text === last[0].text));
          });
          if (allDone) { if (stableSince === null) stableSince = now; if (now - stableSince > 600) { clearInterval(iv); resolve(); } }
          else stableSince = null;
          if (now > 14000) { clearInterval(iv); resolve(); }
        }, 100);
      });
      stop = true;
      // compress: keep only frames where something changed, plus first/last
      const compressed = samples.map((arr) => {
        const keep = [];
        for (let i = 0; i < arr.length; i++) {
          if (i === 0 || i === arr.length - 1) { keep.push(arr[i]); continue; }
          const prev = arr[i - 1];
          if (arr[i].o !== prev.o || arr[i].tr !== prev.tr || (arr[i].text !== prev.text)) keep.push(arr[i]);
        }
        return keep;
      });
      return { jumpT: +jumpT.toFixed(1), vh, target, tops: tops.map(Math.round), samples: compressed };
    }, { sels: g.sels, counter: g.counter });
    if (timeline.error) { console.log('timeline error', timeline.error); await page.close(); continue; }
    console.log(`jump at t=${timeline.jumpT}ms target=${timeline.target}`);
    timeline.samples.forEach((arr, i) => {
      const changing = arr.filter(s => s.t > timeline.jumpT);
      const first = changing[0], last = arr[arr.length - 1];
      console.log(` ${g.sels[i]}: frames=${arr.length} firstChange=${first ? (first.t - timeline.jumpT).toFixed(0) : '-'}ms settle=${(last.t - timeline.jumpT).toFixed(0)}ms finalO=${last.o} finalTr=${last.tr}${g.counter ? ' text:' + arr.map(s=>s.text).filter((v,i,a)=>a.indexOf(v)===i).join('>') : ''}`);
    });

    // ---- pass 3: re-entry check (same page) ----
    const reentry = await page.evaluate(async (sels) => {
      const els = sels.map(s => window.__pick(s));
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));
      const afterAway = els.map(el => getComputedStyle(el).opacity);
      const tops = els.map(el => el.getBoundingClientRect().top + scrollY);
      window.scrollTo(0, Math.min(...tops) - Math.round(innerHeight * 0.35));
      await new Promise(r => setTimeout(r, 500));
      const midReturn = els.map(el => getComputedStyle(el).opacity);
      await new Promise(r => setTimeout(r, 2500));
      const settled = els.map(el => getComputedStyle(el).opacity);
      return { afterAway, midReturn, settled };
    }, g.sels);
    console.log('re-entry:', JSON.stringify(reentry));
    await page.close();

    results[name] = { trigger, timeline, reentry };
  }

  await browser.close();
  const file = __dirname + '/live-measure' + (only ? '-' + only : '') + '.json';
  fs.writeFileSync(file, JSON.stringify(results, null, 1));
  console.log('\nsaved → ' + file);
})();
