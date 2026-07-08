/**
 * Loads live + clone versions of a route, walks matching DOM elements
 * (by framer- class fingerprint), and reports the first elements whose
 * rendered heights diverge — pinpointing collapsed sections.
 * Usage: node height-audit.js /route 1440
 */
const { chromium } = require('playwright');

const route = process.argv[2] || '/';
const width = parseInt(process.argv[3] || '1440', 10);

async function measure(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 1200) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
  });
  return page.evaluate(() => {
    const out = [];
    const walk = (el, depth) => {
      if (depth > 7 || !el.getBoundingClientRect) return;
      const r = el.getBoundingClientRect();
      const cls = [...el.classList].filter(c => c.startsWith('framer-')).slice(0, 2).join('.');
      if (cls && r.height > 0) {
        out.push({ key: `${depth}:${cls}`, h: Math.round(r.height), top: Math.round(r.top + window.scrollY), name: el.getAttribute('data-framer-name') || '' });
      }
      for (const c of el.children) walk(c, depth + 1);
    };
    const main = document.querySelector('#main');
    if (main) walk(main, 0);
    return out;
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const live = await measure(page, 'https://www.siena.cx' + route);
  const clone = await measure(page, 'http://localhost:3100' + route);
  await browser.close();

  // align by key sequence, report height mismatches > 4px
  const cloneByKey = new Map();
  for (const c of clone) {
    if (!cloneByKey.has(c.key)) cloneByKey.set(c.key, []);
    cloneByKey.get(c.key).push(c);
  }
  let reported = 0;
  for (const l of live) {
    const cands = cloneByKey.get(l.key);
    if (!cands || !cands.length) {
      if (l.h > 20 && reported < 25) { console.log(`MISSING in clone: ${l.key} «${l.name}» h=${l.h} top=${l.top}`); reported++; }
      continue;
    }
    const c = cands.shift();
    if (Math.abs(c.h - l.h) > 4 && reported < 25) {
      console.log(`HEIGHT ${l.key} «${l.name}»: live ${l.h} vs clone ${c.h} (Δ${c.h - l.h}) at y=${l.top}`);
      reported++;
    }
  }
  console.log('done');
})();
