/**
 * Timeline check: rAF-sample chat bubble entrances + the counter on clone vs
 * live, and compare start/duration/settle.
 *
 * Usage: node verify-timeline.js
 */
const { chromium } = require('playwright');

const LOCAL = process.env.LOCAL_BASE || 'http://localhost:3200';
const REMOTE = 'https://www.siena.cx';

const CASES = [
  { name: 'feature1-bubble1', width: 390, sels: ['.framer-st32cd', '.framer-1uh8716'] },
  { name: 'gruns', width: 390, sels: ['.framer-vncnon', '.framer-1o5w0mx'] },
  { name: 'counter', width: 1440, sels: ['[aria-label="Counter ends at 80"]'], counter: true },
];

async function run(browser, base, c, blockThirdParty) {
  const page = await browser.newPage({ viewport: { width: c.width, height: c.width === 390 ? 844 : 900 } });
  if (blockThirdParty) await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  await page.goto(base + '/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  const res = await page.evaluate(async ({ sels, counter }) => {
    const pick = (sel) => [...document.querySelectorAll(sel)].find(el => el.getClientRects().length > 0);
    const els = sels.map(pick);
    if (els.some(e => !e)) return { error: 'missing' };
    const tops = els.map(el => el.getBoundingClientRect().top + scrollY);
    const target = Math.min(...tops) - Math.round(innerHeight * 0.35);
    const samples = els.map(() => []);
    let stop = false;
    const t0 = performance.now();
    function sample() {
      const t = performance.now() - t0;
      els.forEach((el, i) => {
        const cs = getComputedStyle(el);
        const s = { t, o: +parseFloat(cs.opacity).toFixed(4), tr: cs.transform };
        if (counter) s.text = el.textContent;
        samples[i].push(s);
      });
      if (!stop) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    await new Promise(r => setTimeout(r, 200));
    const jumpT = performance.now() - t0;
    window.scrollTo(0, target);
    await new Promise(r => setTimeout(r, 6000));
    stop = true;
    const ty = (tr) => { if (!tr || tr === 'none') return 0; const m = tr.match(/matrix\(([^)]+)\)/); return m ? +parseFloat(m[1].split(',')[5]).toFixed(2) : 0; };
    return samples.map((arr) => {
      const first = arr.find(s => s.t > jumpT && s.o > 0.003);
      let last = arr[0];
      for (let j = 1; j < arr.length; j++) {
        const a = arr[j], b = arr[j - 1];
        if (a.o !== b.o || a.tr !== b.tr || a.text !== b.text) last = a;
      }
      let minTy = Infinity;
      for (const s of arr) { const v = ty(s.tr); if (v < minTy) minTy = v; }
      const fin = arr[arr.length - 1];
      return {
        start: first ? +(first.t - jumpT).toFixed(0) : null,
        settle: +(last.t - jumpT).toFixed(0),
        minTy,
        finalO: fin.o, finalTr: fin.tr, finalText: fin.text,
      };
    });
  }, { sels: c.sels, counter: !!c.counter });
  await page.close();
  return res;
}

(async () => {
  const browser = await chromium.launch();
  for (const c of CASES) {
    const live = await run(browser, REMOTE, c, true);
    const clone = await run(browser, LOCAL, c, false);
    console.log(`\n### ${c.name} @${c.width}`);
    c.sels.forEach((sel, i) => {
      const l = live[i] || live.error, cl = clone[i] || clone.error;
      console.log(` ${sel}`);
      console.log(`  live : ${JSON.stringify(l)}`);
      console.log(`  clone: ${JSON.stringify(cl)}`);
      if (l && cl && l.start != null && cl.start != null) {
        const dur = (x) => x.settle - x.start;
        const pct = (a, b) => (b === 0 ? '∞' : Math.abs((a - b) / b * 100).toFixed(1) + '%');
        console.log(`  Δstart=${pct(cl.start, l.start)} Δduration=${pct(dur(cl), dur(l))} Δsettle=${pct(cl.settle, l.settle)}`);
      }
    });
  }
  await browser.close();
})();
