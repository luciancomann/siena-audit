/**
 * Turns interactive/mounted-components.json (harvested live DOM + runtime CSS)
 * into:
 *   - siena-clone/public/mounted-content.json  { css, containers: {cls: html} }
 *   - a merged asset manifest of newly referenced framerusercontent URLs
 * Asset URLs are rewritten to local /assets/... using the converter's rules.
 */
const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'interactive', 'mounted-components.json'), 'utf8'));
const PAGE_CSS = fs.readFileSync('/Users/lucistation/Desktop/siena-clone/app/page.css', 'utf8');
const MANIFEST_PATH = path.join(__dirname, 'asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// --- same mapping rules as convert.js ---
const newAssets = {};
function mapAssetUrl(raw) {
  if (!raw) return raw;
  const url = raw.trim().replace(/&amp;/g, '&');
  if (!/^https:\/\//.test(url)) return raw;
  try {
    const u = new URL(url);
    if (u.hostname === 'framerusercontent.com') {
      const base = path.basename(u.pathname);
      const ext = path.extname(base);
      const stem = base.slice(0, base.length - ext.length);
      const q = u.searchParams;
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
      if (!manifest[u.href]) newAssets[u.href] = local;
      manifest[u.href] = local;
      return local;
    }
    if (u.hostname === 'fonts.gstatic.com') {
      const flat = u.pathname.replace(/^\/s\//, '').replace(/\//g, '_');
      const local = `/assets/fonts/${flat}`;
      if (!manifest[u.href]) newAssets[u.href] = local;
      manifest[u.href] = local;
      return local;
    }
    if (u.hostname.endsWith('b-cdn.net')) {
      const flat = u.pathname.replace(/^\//, '').replace(/\//g, '_');
      const local = `/assets/video/${flat}`;
      if (!manifest[u.href]) newAssets[u.href] = local;
      manifest[u.href] = local;
      return local;
    }
  } catch {}
  return raw;
}

function rewriteHtml(html) {
  // src/srcset/poster/href/url() containing framer CDN urls
  return html
    .replace(/https:\/\/framerusercontent\.com\/[^"'\s),]+/g, (m) => mapAssetUrl(m))
    .replace(/https:\/\/fonts\.gstatic\.com\/[^"'\s),]+/g, (m) => mapAssetUrl(m))
    .replace(/https:\/\/[a-z0-9]+\.b-cdn\.net\/[^"'\s),]+/g, (m) => mapAssetUrl(m));
}

// --- containers: per-breakpoint captures (d=desktop, t=tablet, p=phone) ---
const containers = {};
const TARGETS = Object.keys(DATA['1440']);
for (const t of TARGETS) {
  const variants = {};
  for (const [key, width] of [['d', '1440'], ['t', '1024'], ['p', '390']]) {
    const cap = DATA[width] ? DATA[width][t] : null;
    variants[key] = cap && cap.childrenHtml.length ? rewriteHtml(cap.childrenHtml.join('\n')) : null;
  }
  if (!variants.d && !variants.t && !variants.p) { console.log('skip (never mounted):', t); continue; }
  containers[t] = variants;
}

// --- css: include only runtime style tags defining class families the page css lacks ---
const familyRe = /framer-[A-Za-z0-9]{5,6}\b/g;
const mountedFamilies = new Set();
for (const variants of Object.values(containers)) {
  for (const html of Object.values(variants)) {
    if (!html) continue;
    for (const m of html.match(familyRe) || []) {
      if (!PAGE_CSS.includes('.' + m)) mountedFamilies.add(m);
    }
  }
}
console.log('class families missing from page.css:', mountedFamilies.size);

let css = '';
let included = 0;
for (const styleText of DATA.styles) {
  if (!styleText) continue;
  let needed = false;
  for (const fam of mountedFamilies) {
    if (styleText.includes('.' + fam)) { needed = true; break; }
  }
  if (needed && !PAGE_CSS.includes(styleText.slice(0, 120))) {
    css += rewriteHtml(styleText) + '\n';
    included++;
  }
}
console.log(`included ${included} runtime style tags (${(css.length / 1024).toFixed(0)}kb)`);

const out = { css, containers };
fs.writeFileSync('/Users/lucistation/Desktop/siena-clone/public/mounted-content.json', JSON.stringify(out));
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1));
console.log('new assets to download:', Object.keys(newAssets).length);
console.log('containers packaged:', Object.keys(containers).length,
  '| total html:', (Object.values(containers).flatMap(v => Object.values(v)).join('').length / 1024).toFixed(0) + 'kb');
