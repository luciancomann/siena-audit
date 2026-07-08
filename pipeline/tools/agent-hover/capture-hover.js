/**
 * Captures hover + press micro-interaction states from live siena.cx homepage.
 * For each target: snapshot computed styles (self + descendants), hover, poll
 * over time to measure transition, capture settled state, press, release.
 * Usage: node agent-hover/capture-hover.js [url] [outfile]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'https://www.siena.cx/';
const OUTFILE = process.argv[3] || 'hover-live.json';

// Each target: name + a page function body returning the element.
const TARGETS = [
  {
    name: 'navBookDemo',
    find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => a.getBoundingClientRect().top < 120 && a.getBoundingClientRect().top > 0)`,
  },
  {
    name: 'heroCtaXlg',
    find: `return [...document.querySelectorAll('a.framer-usqbM[data-framer-name="xlg"]')][0]`,
  },
  {
    name: 'exploreIntegrations',
    find: `return [...document.querySelectorAll('a.framer-usqbM')].find(a => /Explore all integrations/.test(a.textContent))`,
  },
  {
    name: 'navItemProduct',
    find: `return [...document.querySelectorAll('a.framer-1cncyf0')].find(a => a.textContent.trim() === 'Product')`,
    noSettleHover: true, // opens dropdown; keep hover shorter
  },
  {
    name: 'navCustomersLink',
    find: `return [...document.querySelectorAll('a.framer-lh6wx')].find(a => a.textContent.trim() === 'Customers' && a.getBoundingClientRect().top < 120)`,
  },
  {
    name: 'footerLink',
    find: `return [...document.querySelectorAll('a.framer-XXLkB')].find(a => a.textContent.trim() === 'Shopping Agent')`,
  },
  {
    name: 'footerSocial',
    find: `return document.querySelector('a.framer-rCoMe')`,
  },
  {
    name: 'customerStoryCard',
    find: `return document.querySelector('a.framer-2kXtq')`,
  },
  {
    name: 'testimonialCard',
    find: `return [...document.querySelectorAll('[data-framer-name="Testimonial"]')].find(el => el.getBoundingClientRect().width > 100)`,
  },
  {
    name: 'integrationTile',
    find: `return [...document.querySelectorAll('.framer-80k0qc')][0]`,
  },
  {
    name: 'announcementLink',
    find: `return [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Find out more')`,
  },
];

const SNAP_FN = `
window.__snap = function (el, maxNodes = 80) {
  const nodes = [el, ...el.querySelectorAll('*')].slice(0, maxNodes);
  return nodes.map((n) => {
    const cs = getComputedStyle(n);
    return {
      tag: n.tagName,
      cls: (typeof n.className === 'string' ? n.className : (n.className.baseVal || '')).slice(0, 200),
      bg: cs.backgroundColor,
      bgImg: cs.backgroundImage === 'none' ? 'none' : cs.backgroundImage.slice(0, 100),
      color: cs.color,
      transform: cs.transform,
      shadow: cs.boxShadow,
      borderColor: cs.borderTopColor,
      borderWidth: cs.borderTopWidth,
      filter: cs.filter,
      opacity: cs.opacity,
      radius: cs.borderTopLeftRadius,
      textDeco: cs.textDecorationLine,
      transition: cs.transition !== 'all' && cs.transition.length < 200 ? cs.transition : cs.transition.slice(0,200),
    };
  });
};
window.__mark = function (el) {
  window.__target = el;
  return true;
};
`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, (r) => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.evaluate(SNAP_FN);

  const results = {};

  for (const t of TARGETS) {
    try {
      const found = await page.evaluate(`(() => { const el = (function(){ ${t.find} })(); if (!el) return null; window.__target = el; return true; })()`);
      if (!found) {
        results[t.name] = { error: 'not found' };
        console.log(`${t.name}: NOT FOUND`);
        continue;
      }
      // scroll into view (center), settle
      await page.evaluate(`window.__target.scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await page.waitForTimeout(1600); // let appear animations settle
      // park mouse away from target
      await page.mouse.move(10, 880);
      await page.waitForTimeout(700);

      const rect = await page.evaluate(`(() => { const r = window.__target.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
      const before = await page.evaluate(`window.__snap(window.__target)`);

      // hover center
      await page.mouse.move(rect.x + rect.w / 2, rect.y + rect.h / 2, { steps: 4 });
      const samples = [];
      const times = [40, 80, 120, 180, 240, 320, 420, 560, 750, 1000];
      let last = Date.now();
      const t0 = Date.now();
      for (const ms of times) {
        const wait = ms - (Date.now() - t0);
        if (wait > 0) await page.waitForTimeout(wait);
        samples.push({ ms: Date.now() - t0, snap: await page.evaluate(`window.__snap(window.__target)`) });
      }
      await page.waitForTimeout(400);
      const hoverSettled = await page.evaluate(`window.__snap(window.__target)`);

      // press
      await page.mouse.down();
      await page.waitForTimeout(60);
      const press60 = await page.evaluate(`window.__snap(window.__target)`);
      await page.waitForTimeout(240);
      const press300 = await page.evaluate(`window.__snap(window.__target)`);
      await page.mouse.up();
      await page.waitForTimeout(400);
      const released = await page.evaluate(`window.__snap(window.__target)`);

      // move away, sample exit transition
      await page.mouse.move(10, 880, { steps: 4 });
      const exitSamples = [];
      const tExit = Date.now();
      for (const ms of [80, 200, 400, 700, 1100]) {
        const wait = ms - (Date.now() - tExit);
        if (wait > 0) await page.waitForTimeout(wait);
        exitSamples.push({ ms: Date.now() - tExit, snap: await page.evaluate(`window.__snap(window.__target)`) });
      }

      results[t.name] = { rect, before, samples, hoverSettled, press60, press300, released, exitSamples };
      console.log(`${t.name}: captured (${before.length} nodes)`);
      await page.waitForTimeout(500);
    } catch (e) {
      results[t.name] = { error: String(e).slice(0, 300) };
      console.log(`${t.name}: ERROR ${String(e).slice(0, 150)}`);
    }
  }

  fs.writeFileSync(path.join(__dirname, OUTFILE), JSON.stringify(results));
  console.log('saved', OUTFILE);
  await browser.close();
})();
