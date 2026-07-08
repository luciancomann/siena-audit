/**
 * Captures interactive states from the live site that only exist post-hydration:
 *  - nav dropdown menus (hover states) at desktop width
 *  - mobile hamburger menu (open state)
 *  - runtime-injected <style> tags (Framer injects hover/variant CSS at hydration)
 *  - ticker/marquee runtime structure (to measure speed/direction)
 * Saves DOM snippets + screenshots into interactive/ for the rebuild phase.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'interactive');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // 1. runtime-injected styles (diff against SSR style set is done later)
  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('style')].map(s => ({
      attrs: [...s.attributes].map(a => `${a.name}="${a.value}"`).join(' '),
      len: s.textContent.length,
      text: s.textContent,
    }))
  );
  fs.writeFileSync(path.join(OUT, 'runtime-styles.json'), JSON.stringify(styles.map(s => ({ attrs: s.attrs, len: s.len })), null, 1));
  fs.writeFileSync(path.join(OUT, 'runtime-styles-full.txt'), styles.map(s => `/* ==== ${s.attrs} (${s.len}) */\n${s.text}`).join('\n\n'));

  // 2. hover each top nav item, capture appended/changed DOM
  const navLabels = ['Product', 'Resources', 'Partners', 'Company'];
  for (const label of navLabels) {
    try {
      const item = page.locator(`nav >> text="${label}"`).first();
      await item.hover({ timeout: 5000 });
      await page.waitForTimeout(1200);
      const html = await page.evaluate(() => {
        const overlay = document.querySelector('#overlay');
        const main = document.querySelector('#main');
        // dropdown may render inline in nav or in overlay
        return {
          overlay: overlay ? overlay.outerHTML : null,
          navOpen: document.querySelector('nav') ? document.querySelector('nav').outerHTML : null,
        };
      });
      fs.writeFileSync(path.join(OUT, `dropdown-${label.toLowerCase()}.json`), JSON.stringify(html));
      await page.screenshot({ path: path.join(OUT, `dropdown-${label.toLowerCase()}.png`) });
      await page.mouse.move(720, 700); // move away to close
      await page.waitForTimeout(600);
    } catch (e) {
      console.log(`hover ${label} failed:`, String(e).slice(0, 120));
    }
  }

  // 3. mobile hamburger
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'mobile-closed.png') });
  try {
    // Framer hamburger is usually a div with role/button inside the phone nav
    const burger = page.locator('nav [data-framer-name*="enu" i], nav [aria-label*="menu" i], nav svg').first();
    await burger.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const mobileOpen = await page.evaluate(() => ({
      overlay: document.querySelector('#overlay')?.outerHTML || null,
      nav: document.querySelector('nav')?.outerHTML || null,
      bodyClass: document.body.className,
    }));
    fs.writeFileSync(path.join(OUT, 'mobile-menu-open.json'), JSON.stringify(mobileOpen));
    await page.screenshot({ path: path.join(OUT, 'mobile-menu-open.png'), fullPage: true });
  } catch (e) {
    console.log('hamburger failed:', String(e).slice(0, 200));
  }

  // 4. ticker runtime info (desktop)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const ticker = await page.evaluate(async () => {
    const sections = [...document.querySelectorAll('section')].filter(s => {
      const ul = s.querySelector('ul');
      return ul && getComputedStyle(ul).willChange.includes('transform') || (ul && ul.style.transform);
    });
    const all = [...document.querySelectorAll('ul')].filter(u => u.parentElement && /flex/.test(getComputedStyle(u).display));
    const results = [];
    for (const ul of all.slice(0, 20)) {
      const t1 = getComputedStyle(ul).transform;
      await new Promise(r => setTimeout(r, 500));
      const t2 = getComputedStyle(ul).transform;
      if (t1 !== t2) {
        results.push({
          cls: ul.className, parentCls: ul.parentElement.className,
          section: ul.closest('section')?.className || null,
          t1, t2, childCount: ul.children.length,
          html: ul.outerHTML.slice(0, 3000),
        });
      }
    }
    return results;
  });
  fs.writeFileSync(path.join(OUT, 'tickers.json'), JSON.stringify(ticker, null, 1));
  console.log('tickers found:', ticker.length);

  await browser.close();
  console.log('interactive capture complete →', OUT);
})();
