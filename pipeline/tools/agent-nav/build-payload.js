/**
 * Builds public/runtime/nav-states.json for the clone's NavRuntime from the
 * live captures in live/. Rewrites asset URLs to local paths and hrefs to
 * internal /path form.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const LIVE = path.join(__dirname, 'live');
const manifest = require('../asset-manifest.json');
const OUT = '/Users/lucistation/Desktop/siena-clone/public/runtime/nav-states.json';

function rewrite(html) {
  // asset urls (raw + entity-encoded)
  html = html.replace(/https:\/\/(?:framerusercontent\.com|4positiveimpact\.b-cdn\.net)[^"'\s)]+/g, (u) => {
    const decoded = u.replace(/&amp;/g, '&');
    const local = manifest[decoded];
    if (local) return local;
    console.warn('UNMAPPED ASSET:', decoded.slice(0, 110));
    return u;
  });
  // hrefs ./x -> /x  (also src="./..." shouldn't exist, only hrefs use ./)
  html = html.replace(/href="\.\/"/g, 'href="/"');
  html = html.replace(/href="\.\//g, 'href="/');
  return html;
}

const read = (f) => fs.readFileSync(path.join(LIVE, f), 'utf8');

// ---------------- desktop ----------------
const dp = cheerio.load(read('open-product.html'));
const dr = cheerio.load(read('open-resources.html'));
const dpart = cheerio.load(read('open-partners.html'));
const dcomp = cheerio.load(read('open-company.html'));

const openCardStyle = dp('.framer-abxou').attr('style');
const openCardStyle2 = dpart('.framer-abxou').attr('style');
if (openCardStyle !== openCardStyle2) console.warn('card open styles differ between product/partners captures');

// panels: keep outerHTML verbatim (visible state styles from their own capture)
const productsPanel = dp('.framer-160figo').first();
const resourcesPanel = dr('.framer-6do8do').first();
// hidden inline styles observed in the other capture (for initial injection)
const productsHiddenStyle = dr('.framer-160figo').first().attr('style');
const resourcesHiddenStyle = dp('.framer-6do8do').first().attr('style');

// footer for product state
const productFooter = dp('.framer-1vjakz0').first();

// footer for partners/company: partners row from partners capture (visible),
// company row from company capture (visible, real hrefs)
const partnersFooter = dpart('.framer-1vjakz0').first();
const companyRowFresh = dcomp('.framer-x14izb').first();
partnersFooter.find('.framer-x14izb').replaceWith(companyRowFresh.clone());

// link-state inline styles (18of653 var containers) per capture
const linkVars = {};
dp('.framer-1ms5aq1 a .framer-18of653').each((i, el) => {
  const a = dp(el).closest('a');
  const state = a.attr('data-framer-name'); // Open | Closed
  if (state === 'Open' && !linkVars.open) linkVars.open = dp(el).attr('style');
  if (state === 'Closed' && !linkVars.closedDim) linkVars.closedDim = dp(el).attr('style');
});
// normal (menu fully closed) style from clone SSR-equivalent (home.html)
const ssr = cheerio.load(fs.readFileSync(path.join(__dirname, '..', '..', 'pages', 'home.html'), 'utf8'));
linkVars.closedNormal = ssr('nav').eq(1).find('.framer-1ms5aq1 a .framer-18of653').first().attr('style');

const desktop = {
  variants: {
    closed: 'framer-v-1w08b0o',
    hover: 'framer-v-116z0bk',
    product: 'framer-v-wctfne',
    resources: 'framer-v-1pxg195',
    partners: 'framer-v-1fz5xqi',
    company: 'framer-v-1m4j5up',
  },
  names: {
    closed: 'Desktop',
    hover: 'Desktop / Hover',
    product: 'Desktop / Products',
    resources: 'Desktop / Resources',
    partners: 'Desktop / Partnerships',
    company: 'Desktop / Company',
  },
  openCardStyle: rewrite(openCardStyle),
  panels: {
    products: rewrite(dp.html(productsPanel)),
    resources: rewrite(dr.html(resourcesPanel)),
    productsHiddenStyle,
    resourcesHiddenStyle,
  },
  footers: {
    product: rewrite(dp.html(productFooter)),
    partnersCompany: rewrite(dpart.html(partnersFooter)),
  },
  linkVars,
};

// ---------------- mobile ----------------
const mo = cheerio.load(read('mobile-open-nav.html'));
const states = {
  opened: { file: 'mobile-open-nav.html', bodyClass: 'framer-1ozj9u4' },
  product: { file: 'mobile-sub-product.html', bodyClass: 'framer-bkm6nh' },
  resources: { file: 'mobile-sub-resources.html', bodyClass: 'framer-1rhglet' },
  partners: { file: 'mobile-sub-partners.html', bodyClass: 'framer-htbe2x' },
  company: { file: 'mobile-sub-company.html', bodyClass: 'framer-1xdhoq6' },
};

const mobile = { states: {}, variants: { closed: 'framer-v-ed5ucz' }, names: { closed: 'Main' } };
for (const [key, s] of Object.entries(states)) {
  const $ = cheerio.load(read(s.file));
  const nav = $('nav');
  const body = nav.children('.' + s.bodyClass).first();
  if (!body.length) throw new Error('body not found for ' + key);
  // patch Book a demo href (unresolved in live capture)
  body.find('a').each((i, a) => {
    const e = $(a);
    if (!e.attr('href') && (e.text() || '').includes('Book a demo')) e.attr('href', './book-a-demo');
  });
  mobile.states[key] = { body: rewrite($.html(body)) };
  mobile.variants[key] = nav.attr('class').split(' ').filter((c) => c.startsWith('framer-v-'))[0];
  mobile.names[key] = nav.attr('data-framer-name');
}
// banner second row (open states)
mobile.banner142 = rewrite(mo.html(mo('.framer-142tedp').first()));
// burger open icon content
mobile.burgerOpenInner = rewrite(mo.html(mo('.framer-x592o9 .framer-a3zmiv').first()));
// in submenu states the logo link (framer-r22od7) swaps its content for a
// "Back" row and loses its href (identical across all four submenu captures)
const sub = cheerio.load(read('mobile-sub-product.html'));
mobile.logoBackInner = rewrite(sub('.framer-r22od7').first().html());

// ---------------- sprites ----------------
const extra = JSON.parse(read('sprite-defs-extra.json'));
const sprites = [extra.d1, extra.d2].filter(Boolean).join('\n');

// CSS rules for components that never appear in the SSR page (Tab pills in the
// integrations footer) — harvested from live while the product menu was open.
const css = [...new Set(JSON.parse(read('tab-pill-css.json')))].join('\n');

const payload = { desktop, mobile, sprites, css };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(1) + 'KB');
console.log('mobile variants:', JSON.stringify(mobile.variants));
console.log('mobile names:', JSON.stringify(mobile.names));
console.log('linkVars keys:', Object.keys(linkVars).map(k => k + '=' + String(linkVars[k]).slice(0, 60)));
// sanity: no remote urls left
for (const [k, v] of Object.entries({ payload: JSON.stringify(payload) })) {
  const leftovers = (v.match(/https:\/\/(?:framerusercontent|4positiveimpact)[^"']*/g) || []);
  console.log('remote leftovers:', leftovers.length, leftovers.slice(0, 3));
}
