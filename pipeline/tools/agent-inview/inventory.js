/**
 * Inventory: find all clone homepage elements stuck at animation initial
 * states (inline opacity <= 0.01), excluding [data-appear-id] and anything
 * inside [data-mounted] containers. Per width 1440/1024/390.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.LOCAL_BASE || 'http://localhost:3200';
const widths = [1440, 1024, 390];

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // let MountedRuntime inject
    await page.waitForTimeout(2500);
    out[width] = await page.evaluate(() => {
      const results = [];
      const els = document.querySelectorAll('[style*="opacity"]');
      for (const el of els) {
        const inline = el.style.opacity;
        if (inline === '' || parseFloat(inline) > 0.01) continue;
        if (el.hasAttribute('data-appear-id')) continue;
        if (el.closest('[data-mounted]')) continue;
        // skip elements inside display:none ssr-variant slots (not visible at this bp)
        let hiddenAncestor = false;
        let p = el;
        while (p) {
          if (p instanceof HTMLElement && getComputedStyle(p).display === 'none') { hiddenAncestor = true; break; }
          p = p.parentElement;
        }
        if (hiddenAncestor) continue;
        const r = el.getBoundingClientRect();
        const rAbs = { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
        // find nearest named section ancestor for grouping
        let section = null;
        p = el.parentElement;
        while (p) {
          const name = p.getAttribute && p.getAttribute('data-framer-name');
          if (name && p.tagName === 'SECTION') { section = name; break; }
          if (!section && name) section = name; // remember nearest named
          p = p.parentElement;
        }
        // full ancestor chain of framer classes (for robust selectors)
        const chain = [];
        p = el;
        for (let i = 0; i < 6 && p; i++) {
          const fc = [...p.classList].find(c => /^framer-[a-z0-9]+$/.test(c));
          if (fc) chain.push(fc);
          p = p.parentElement;
        }
        results.push({
          cls: [...el.classList].join(' '),
          framerName: el.getAttribute('data-framer-name'),
          section,
          chain: chain.join(' < '),
          style: el.getAttribute('style').slice(0, 220),
          rect: rAbs,
          text: (el.textContent || '').trim().slice(0, 60),
        });
      }
      return results;
    });
    console.log(`\n=== width ${width}: ${out[width].length} hidden elements ===`);
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(__dirname + '/inventory.json', JSON.stringify(out, null, 1));
  // summary grouped by section
  for (const [w, items] of Object.entries(out)) {
    const bySection = {};
    for (const it of items) (bySection[it.section || '?'] ||= []).push(it);
    console.log(`\n#### width ${w}`);
    for (const [s, arr] of Object.entries(bySection)) {
      console.log(` [${s}] x${arr.length}`);
      for (const it of arr.slice(0, 12)) console.log(`   - ${it.chain.split(' < ')[0]} name=${it.framerName} y=${it.rect.y} h=${it.rect.h} text="${it.text.slice(0,40)}" style=${it.style.slice(0,110)}`);
      if (arr.length > 12) console.log(`   ... +${arr.length - 12} more`);
    }
  }
})();
