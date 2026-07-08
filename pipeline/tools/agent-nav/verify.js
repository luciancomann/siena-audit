/** Verify clone nav behavior at http://localhost:3200 against live measurements. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'verify-out');
fs.mkdirSync(OUT, { recursive: true });

const SAMPLER = `
window.__samples = [];
window.__sampling = false;
window.__watch = (specs) => {
  window.__samples = [];
  window.__sampling = true;
  const t0 = performance.now();
  const step = () => {
    if (!window.__sampling) return;
    const rec = { t: Math.round(performance.now() - t0) };
    for (const [key, sel, props] of specs) {
      const el = document.querySelector(sel);
      if (!el) { rec[key] = null; continue; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const o = { h: +r.height.toFixed(1) };
      for (const p of props) o[p] = cs[p];
      o.cls = el.className.split(' ').filter(c => c.startsWith('framer-v-')).join(',');
      rec[key] = o;
    }
    window.__samples.push(rec);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
window.__stop = () => { window.__sampling = false; return window.__samples; };
`;

(async () => {
  const browser = await chromium.launch();
  const results = { errors: [], checks: [] };
  const check = (name, ok, detail) => {
    results.checks.push({ name, ok: !!ok, detail });
    console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
  };

  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') results.errors.push(msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => results.errors.push('pageerror: ' + String(err).slice(0, 300)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(SAMPLER);

  const geom = (sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  }, sel);
  const variant = () => page.evaluate(() => document.querySelector('div.framer-abxou').className.split(' ').filter(c => c.startsWith('framer-v-')).join(','));
  const hoverLabel = async (label) => {
    await page.locator(`div.framer-1ms5aq1 a:has(p:text-is("${label}"))`).first().hover({ timeout: 5000 });
  };

  // initial closed state
  check('closed variant', (await variant()) === 'framer-v-1w08b0o', await variant());
  const closedCard = await geom('div.framer-abxou');
  check('closed card h=64', Math.abs(closedCard.h - 64) < 1.5, JSON.stringify(closedCard));

  // ---- open product with timing sample ----
  await page.evaluate((s) => window.__watch(s), [
    ['card', 'div.framer-abxou', ['backgroundColor']],
    ['prod', 'div.framer-160figo', ['opacity']],
  ]);
  await hoverLabel('Product');
  await page.waitForTimeout(1000);
  const openTl = await page.evaluate(() => window.__stop());
  const moving = openTl.filter(s => s.card && s.card.h > 65 && s.card.h < 510);
  const settled = openTl.find(s => s.card && s.card.h >= 510);
  check('product opens with height animation', moving.length >= 2 && !!settled,
    `frames mid-flight=${moving.length}, settleT=${settled && settled.t}`);

  check('product variant', (await variant()) === 'framer-v-wctfne', await variant());
  const g = { abxou: await geom('div.framer-abxou'), menuArea: await geom('div.framer-k27yhv'), footer: await geom('div.framer-1vjakz0') };
  // live: abxou {16,51.2,1408,516.7} menuArea h355.7 footer h97
  check('product card geom ~= live', Math.abs(g.abxou.h - 516.7) < 3 && Math.abs(g.abxou.y - 51.2) < 2 && Math.abs(g.abxou.w - 1408) < 2, JSON.stringify(g.abxou));
  check('product menuArea h ~= 355.7', g.menuArea && Math.abs(g.menuArea.h - 355.7) < 3, JSON.stringify(g.menuArea));
  check('product footer h ~= 97', g.footer && Math.abs(g.footer.h - 97) < 3, JSON.stringify(g.footer));
  await page.screenshot({ path: path.join(OUT, 'clone-product.png') });

  const productLinks = await page.evaluate(() =>
    [...document.querySelectorAll('div.framer-160figo a, div.framer-1vjakz0 a')].map(a => ({ t: (a.textContent || '').trim().slice(0, 30), h: a.getAttribute('href') }))
  );
  const findHref = (arr, label) => (arr.find(l => l.t.includes(label)) || {}).h;
  check('Reviews Agent -> /ai-review-management', findHref(productLinks, 'Reviews Agent') === '/ai-review-management', findHref(productLinks, 'Reviews Agent'));
  check('Docs -> /products/docs', findHref(productLinks, 'Docs') === '/products/docs', findHref(productLinks, 'Docs'));
  check('Topics Explorer -> /topics-explorer', findHref(productLinks, 'Topics Explorer') === '/topics-explorer', findHref(productLinks, 'Topics Explorer'));
  check('Quality Assurance -> /qa-agent', findHref(productLinks, 'Quality Assurance') === '/qa-agent', findHref(productLinks, 'Quality Assurance'));
  check('View Integrations -> /integrations', findHref(productLinks, 'View Integrations') === '/integrations', findHref(productLinks, 'View Integrations'));
  check('no /memory placeholders in product menu', !productLinks.some(l => l.h === '/memory' && !/Memory/.test(l.t)), JSON.stringify(productLinks.filter(l => l.h === '/memory')));

  // link dim states
  const colors = await page.evaluate(() => ({
    active: getComputedStyle(document.querySelector('div.framer-1kgdahl-container a p')).color,
    dim: getComputedStyle(document.querySelector('div.framer-4bxy1r-container a p')).color,
    custOp: getComputedStyle(document.querySelector('div.framer-1uwyr6h-container')).opacity,
  }));
  check('active link color', colors.active === 'rgb(18, 32, 35)', colors.active);
  check('inactive link dim color', colors.dim === 'rgb(160, 166, 167)', colors.dim);
  check('customers opacity 0.4', colors.custOp === '0.4', colors.custOp);
  const chev = await page.evaluate(() => document.querySelector('div.framer-1kgdahl-container .framer-odbusp').style.transform);
  check('chevron rotated', /rotate\(18?\d/.test(chev) || chev === 'rotate(180deg)', chev);

  // ---- switch to resources ----
  await hoverLabel('Resources');
  await page.waitForTimeout(800);
  check('resources variant', (await variant()) === 'framer-v-1pxg195', await variant());
  const gr = { abxou: await geom('div.framer-abxou'), menuArea: await geom('div.framer-k27yhv'), res: await geom('div.framer-6do8do') };
  // live: abxou h505, menuArea h441, resources h393
  check('resources card h ~= 505', Math.abs(gr.abxou.h - 505) < 3, JSON.stringify(gr.abxou));
  check('resources panel h ~= 393', gr.res && Math.abs(gr.res.h - 393) < 3, JSON.stringify(gr.res));
  const resLinks = await page.evaluate(() =>
    [...document.querySelectorAll('div.framer-6do8do a')].map(a => ({ t: (a.textContent || '').trim().slice(0, 20), h: a.getAttribute('href') }))
  );
  check('Blog -> /blog', findHref(resLinks, 'Blog') === '/blog', findHref(resLinks, 'Blog'));
  check('ROI Calculator -> /roi-calculator', findHref(resLinks, 'ROI Calculator') === '/roi-calculator', findHref(resLinks, 'ROI Calculator'));
  check('Certification href', findHref(resLinks, 'Certification') === '/siena-ai-certification-in-customer-experience', findHref(resLinks, 'Certification'));
  await page.screenshot({ path: path.join(OUT, 'clone-resources.png') });

  // ---- partners ----
  await hoverLabel('Partners');
  await page.waitForTimeout(800);
  check('partners variant', (await variant()) === 'framer-v-1fz5xqi', await variant());
  const gp = { abxou: await geom('div.framer-abxou'), footer: await geom('div.framer-1vjakz0') };
  check('partners card h ~= 209', Math.abs(gp.abxou.h - 209) < 3, JSON.stringify(gp.abxou));
  check('partners footer h ~= 145', gp.footer && Math.abs(gp.footer.h - 145) < 3, JSON.stringify(gp.footer));
  const pLinks = await page.evaluate(() =>
    [...document.querySelectorAll('div.framer-1vjakz0 a')].map(a => ({ t: (a.textContent || '').trim().slice(0, 30), h: a.getAttribute('href'), vis: +getComputedStyle(a.closest('div[data-framer-name]') || a).opacity }))
  );
  check('Partner with Siena -> /partner-with-siena', findHref(pLinks, 'Partner with Siena') === '/partner-with-siena', JSON.stringify(pLinks.slice(0, 3)));
  check('Refer a friend -> /refer-a-friend', findHref(pLinks, 'Refer a friend') === '/refer-a-friend', findHref(pLinks, 'Refer a friend'));
  await page.screenshot({ path: path.join(OUT, 'clone-partners.png') });

  // ---- company ----
  await hoverLabel('Company');
  await page.waitForTimeout(800);
  check('company variant', (await variant()) === 'framer-v-1m4j5up', await variant());
  const gc = await geom('div.framer-abxou');
  check('company card h ~= 209.2', Math.abs(gc.h - 209.2) < 3, JSON.stringify(gc));
  const cLinks = await page.evaluate(() =>
    [...document.querySelectorAll('div.framer-x14izb a')].map(a => ({ t: (a.textContent || '').trim().slice(0, 30), h: a.getAttribute('href') }))
  );
  check('Security -> trust.site', findHref(cLinks, 'Security') === 'https://sienaai.trust.site/', findHref(cLinks, 'Security'));
  check('Careers -> ashby', findHref(cLinks, 'Careers') === 'https://jobs.ashbyhq.com/siena', findHref(cLinks, 'Careers'));
  check('About Us -> /about-us', findHref(cLinks, 'About Us') === '/about-us', findHref(cLinks, 'About Us'));
  const companyRowVisible = await page.evaluate(() => ({
    company: getComputedStyle(document.querySelector('div.framer-x14izb')).opacity,
    partners: getComputedStyle(document.querySelector('div.framer-1957rwz')).opacity,
  }));
  check('company row visible, partners hidden', companyRowVisible.company === '1' && companyRowVisible.partners === '0', JSON.stringify(companyRowVisible));
  await page.screenshot({ path: path.join(OUT, 'clone-company.png') });

  // sprite resolution for About Us icon
  check('sprite svg438111121_1382 present', await page.evaluate(() => !!document.getElementById('svg438111121_1382')));

  // ---- close on mouse out (keeps solid) ----
  await page.evaluate((s) => window.__watch(s), [['card', 'div.framer-abxou', ['backgroundColor']]]);
  await page.mouse.move(720, 700, { steps: 4 });
  await page.waitForTimeout(900);
  const closeTl = await page.evaluate(() => window.__stop());
  const closeMoving = closeTl.filter(s => s.card && s.card.h > 66 && s.card.h < 205);
  check('close animates height', closeMoving.length >= 2, 'frames=' + closeMoving.length);
  check('closed-after-hover stays solid (v-116z0bk)', (await variant()) === 'framer-v-116z0bk', await variant());
  const solidBg = await page.evaluate(() => getComputedStyle(document.querySelector('div.framer-abxou')).backgroundColor);
  check('solid bg after close', solidBg === 'rgb(250, 247, 241)', solidBg);

  // ---- scroll behavior ----
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  check('scrolled: solid', (await variant()) === 'framer-v-116z0bk', await variant());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  check('back to top: transparent', (await variant()) === 'framer-v-1w08b0o', await variant());
  const topBg = await page.evaluate(() => getComputedStyle(document.querySelector('div.framer-abxou')).backgroundColor);
  check('transparent bg at top', topBg === 'rgba(250, 247, 241, 0)', topBg);

  // open + scroll closes
  await hoverLabel('Product');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(600);
  check('scroll closes open menu', (await variant()) === 'framer-v-116z0bk', await variant());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  await page.close();

  /* ---------------- mobile ---------------- */
  const mctx = await browser.newContext({ deviceScaleFactor: 1, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('console', (msg) => { if (msg.type() === 'error') results.errors.push('mobile: ' + msg.text().slice(0, 300)); });
  mp.on('pageerror', (err) => results.errors.push('mobile pageerror: ' + String(err).slice(0, 300)));
  await mp.setViewportSize({ width: 390, height: 844 });
  await mp.goto('http://localhost:3200/', { waitUntil: 'networkidle', timeout: 60000 });
  await mp.waitForTimeout(1500);

  const mnavName = () => mp.evaluate(() => {
    const nav = [...document.querySelectorAll('nav')].find(n => n.getBoundingClientRect().height > 0);
    return nav && nav.getAttribute('data-framer-name');
  });
  const mnavH = () => mp.evaluate(() => {
    const nav = [...document.querySelectorAll('nav')].find(n => n.getBoundingClientRect().height > 0);
    return nav && +nav.getBoundingClientRect().height.toFixed(1);
  });
  const burgerClick = async () => {
    const b = await mp.evaluate(() => {
      const r = document.querySelector('.framer-x592o9').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await mp.mouse.click(b.x, b.y);
  };

  check('mobile initial closed', (await mnavName()) === 'Main', await mnavName());
  const hClosed = await mnavH();
  await burgerClick();
  await mp.waitForTimeout(600);
  check('mobile opens (Opened)', (await mnavName()) === 'Opened', await mnavName());
  const hOpen = await mnavH();
  check('mobile open height ~= 602.8 (live)', Math.abs(hOpen - 602.8) < 6, `closed=${hClosed} open=${hOpen}`);
  const burgerGlyph = await mp.evaluate(() => document.querySelector('.framer-x592o9 p').textContent);
  check('burger glyph switches to minus', burgerGlyph === '-', JSON.stringify(burgerGlyph));
  const bannerRows = await mp.evaluate(() => document.querySelector('.framer-b2uh9w').children.length);
  check('banner second row appears', bannerRows === 2, 'rows=' + bannerRows);
  await mp.screenshot({ path: path.join(OUT, 'clone-mobile-open.png') });

  const visNavLinks = `(() => {
    const nav = [...document.querySelectorAll('nav')].find(n => n.getBoundingClientRect().height > 0);
    return [...nav.querySelectorAll('a')].map(a => ({ t: (a.textContent || '').replace(/[^\\x20-\\x7E]/g, '').trim().replace(/\\s+/g, ' ').slice(0, 30), h: a.getAttribute('href') }));
  })()`;
  const mLinks = await mp.evaluate(visNavLinks);
  check('mobile Customers -> /customers', (mLinks.find(l => l.t === 'Customers') || {}).h === '/customers', JSON.stringify(mLinks.find(l => l.t === 'Customers')));
  check('mobile Book a demo -> /book-a-demo', (mLinks.find(l => l.t === 'Book a demo') || {}).h === '/book-a-demo', JSON.stringify(mLinks.find(l => l.t === 'Book a demo')));

  // open Product submenu
  const tapRow = async (label) => {
    const box = await mp.evaluate((label) => {
      const rows = [...document.querySelectorAll('nav div[data-framer-name="Phone"]')];
      const row = rows.find(r => (r.textContent || '').trim().startsWith(label));
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    if (box) await mp.mouse.click(box.x, box.y);
    return box;
  };
  await tapRow('Product');
  await mp.waitForTimeout(600);
  check('mobile Products submenu', (await mnavName()) === 'Products', await mnavName());
  const subH = await mnavH();
  check('mobile products submenu height ~= 819.6 (live)', Math.abs(subH - 819.6) < 8, 'h=' + subH);
  await mp.screenshot({ path: path.join(OUT, 'clone-mobile-sub-product.png') });
  const subLinks = await mp.evaluate(visNavLinks);
  
  check('mobile sub: Shopping Agent -> /shopping-agent', (subLinks.find(l => l.t.startsWith('Shopping Agent')) || {}).h === '/shopping-agent', JSON.stringify(subLinks.find(l => l.t.startsWith('Shopping Agent'))));
  check('mobile sub: Order Tracking -> /order-tracking', (subLinks.find(l => l.t.startsWith('Order Tracking')) || {}).h === '/order-tracking', JSON.stringify(subLinks.find(l => l.t.startsWith('Order Tracking'))));

  // back
  const back = await mp.evaluate(() => {
    const el = document.querySelector('nav .framer-y2su2r');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check('back row exists', !!back);
  if (back) {
    await mp.mouse.click(back.x, back.y);
    await mp.waitForTimeout(500);
    check('back returns to Opened', (await mnavName()) === 'Opened', await mnavName());
  }

  // other submenus quickly
  for (const [label, expectName] of [['Resources', 'Resources'], ['Partners', 'Partners'], ['Company', 'Company']]) {
    await tapRow(label);
    await mp.waitForTimeout(500);
    check(`mobile ${label} submenu`, (await mnavName()) === expectName, await mnavName());
    await mp.screenshot({ path: path.join(OUT, `clone-mobile-sub-${label.toLowerCase()}.png`) });
    const b2 = await mp.evaluate(() => {
      const el = document.querySelector('nav .framer-y2su2r');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (b2) { await mp.mouse.click(b2.x, b2.y); await mp.waitForTimeout(400); }
  }
  // company submenu links
  await tapRow('Company');
  await mp.waitForTimeout(500);
  const compLinks = await mp.evaluate(visNavLinks);
  
  check('mobile company: About us -> /about-us', (compLinks.find(l => l.t.startsWith('About us')) || {}).h === '/about-us', JSON.stringify(compLinks.find(l => l.t.startsWith('About us'))));
  check('mobile company: Careers -> ashby', (compLinks.find(l => l.t.startsWith('Careers')) || {}).h === 'https://jobs.ashbyhq.com/siena', JSON.stringify(compLinks.find(l => l.t.startsWith('Careers'))));
  // back then close
  const b3 = await mp.evaluate(() => {
    const el = document.querySelector('nav .framer-y2su2r');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (b3) { await mp.mouse.click(b3.x, b3.y); await mp.waitForTimeout(400); }
  await burgerClick();
  await mp.waitForTimeout(500);
  check('mobile closes back to Main', (await mnavName()) === 'Main', await mnavName());
  check('mobile closed height restored', Math.abs((await mnavH()) - hClosed) < 2, 'h=' + (await mnavH()));
  const glyphClosed = await mp.evaluate(() => document.querySelector('.framer-x592o9 p').textContent.codePointAt(0));
  check('burger glyph restored (U+E0AE)', glyphClosed === 57518, String(glyphClosed));
  await mp.screenshot({ path: path.join(OUT, 'clone-mobile-closed.png') });

  await browser.close();

  console.log('\nconsole errors:', results.errors.length);
  results.errors.forEach(e => console.log('  ERR:', e));
  const fails = results.checks.filter(c => !c.ok).length;
  console.log(`\n${results.checks.length - fails}/${results.checks.length} checks passed`);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
})();
