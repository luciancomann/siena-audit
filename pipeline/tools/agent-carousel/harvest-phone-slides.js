/**
 * Harvests the 11 hydrated phone slides (div.framer-1iacnpu) of the
 * "Wall of love" carousel from live at 390px, rewrites asset/href URLs to
 * local paths using the exact same rules as tools/convert.js, downloads any
 * missing assets, and writes phone-slides JSON for baking into the runtime.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PUBLIC = '/Users/lucistation/Desktop/siena-clone/public';
const assetManifest = {};

function mapAssetUrl(raw) {
  if (!raw) return raw;
  let url = raw.trim().replace(/&amp;/g, '&');
  if (url.startsWith('data:') || url.startsWith('#')) return raw;
  try {
    const u = new URL(url, 'https://www.siena.cx/');
    const q = u.searchParams;
    if (u.hostname === 'framerusercontent.com') {
      const base = path.basename(u.pathname);
      const ext = path.extname(base);
      const stem = base.slice(0, base.length - ext.length);
      let suffix = '';
      if (q.get('scale-down-to')) suffix = `-sd${q.get('scale-down-to')}`;
      else if ([...q.keys()].length) {
        let h = 0;
        for (const c of u.search) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        suffix = `-q${h.toString(36)}`;
      }
      let bucket = 'images';
      if (u.pathname.startsWith('/assets/')) bucket = 'media';
      else if (u.pathname.startsWith('/modules/')) bucket = 'modules';
      const local = `/assets/${bucket}/${stem}${suffix}${ext}`;
      assetManifest[u.href] = local;
      return local;
    }
  } catch (e) {}
  return raw;
}

function rewriteHref(raw) {
  if (!raw) return raw;
  let url = raw.trim();
  if (url.startsWith('./')) {
    url = '/' + url.slice(2);
    return url === '/.' ? '/' : url.replace(/\/$/, '') || '/';
  }
  if (url.startsWith('https://www.siena.cx')) {
    const u = new URL(url);
    return (u.pathname.replace(/\/$/, '') || '/') + u.search + u.hash;
  }
  if (url.startsWith('https://framerusercontent.com')) return mapAssetUrl(url);
  return raw;
}

function rewriteSrcset(v) {
  if (!v) return v;
  return v.split(',').map(part => {
    const bits = part.trim().split(/\s+/);
    bits[0] = mapAssetUrl(bits[0]);
    return bits.join(' ');
  }).join(', ');
}

function rewriteCssUrls(css) {
  return css.replace(/url\((['"]?)(https:\/\/[^)'"]+)\1\)/g, (m, quote, u) => `url(${quote}${mapAssetUrl(u)}${quote})`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  await ctx.route(/cookieyes|googletagmanager|events\.framer\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto('https://www.siena.cx/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.querySelector('.framer-1kknw4s-container').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500); // let appear animations finish

  const raw = await page.evaluate(() => {
    const c = document.querySelector('.framer-1kknw4s-container');
    const visVariant = [...c.children].find(e => getComputedStyle(e).display !== 'none');
    const track = visVariant.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
    return {
      trackCls: track.getAttribute('class'),
      slides: [...track.children].map(el => {
        const clone = el.cloneNode(true);
        clone.removeAttribute('style'); // runtime manages item-level style
        return clone.outerHTML;
      }),
      spriteUses: [...track.querySelectorAll('use')].map(u => u.getAttribute('href') || u.getAttribute('xlink:href')),
    };
  });
  await browser.close();

  console.log('track:', raw.trackCls, 'slides:', raw.slides.length);
  console.log('sprite refs:', JSON.stringify([...new Set(raw.spriteUses)]));

  // Rewrite URLs with plain string substitution so the browser's outerHTML
  // serialization is preserved byte-for-byte (cheerio re-serialization broke
  // empty divs into <div/>, which nests everything that follows).
  const slides = raw.slides.map(html => {
    let out = html.replace(/https:\/\/framerusercontent\.com\/[^"'\s)]+/g, (m) => mapAssetUrl(m));
    out = out.replace(/href="\.\/([^"]*)"/g, (m, p) => 'href="' + (('/' + p).replace(/\/$/, '') || '/') + '"');
    out = out.replace(/href="https:\/\/www\.siena\.cx([^"]*)"/g, (m, p) => 'href="' + ((p || '/').replace(/\/$/, '') || '/') + '"');
    return out;
  });

  fs.writeFileSync('phone-slides.json', JSON.stringify({ slides }, null, 1));
  fs.writeFileSync('phone-assets.json', JSON.stringify(assetManifest, null, 1));
  console.log('asset urls found:', Object.keys(assetManifest).length);

  // download missing assets
  let dl = 0, have = 0, fail = 0;
  for (const [url, local] of Object.entries(assetManifest)) {
    const dest = path.join(PUBLIC, local);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { have++; continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      execFileSync('curl', ['-sL', '--fail', '-A', 'Mozilla/5.0', '-o', dest, url], { timeout: 120000 });
      dl++;
    } catch (e) { fail++; console.log('DOWNLOAD FAIL', url); try { fs.unlinkSync(dest); } catch {} }
  }
  console.log(`assets: existing=${have} downloaded=${dl} failed=${fail}`);
  const total = slides.reduce((a, s) => a + s.length, 0);
  console.log('total slide HTML bytes:', total);
})();
