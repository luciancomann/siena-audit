/**
 * Deterministic Framer-SSR-HTML → Next.js App Router converter.
 *
 * For each captured page:
 *   - extracts head metadata → Next `metadata` export
 *   - extracts per-page CSS (<style data-framer-breakpoint-css>, <style data-framer-css-ssr-minified>,
 *     plus any <style> tags inside #main, in document order) → page.css
 *   - extracts font CSS + html/body base CSS → shared fonts.css / base.css (union across pages)
 *   - converts the #main DOM subtree to exact JSX (text nodes as {"..."} strings for fidelity)
 *   - wraps elements bearing data-framer-appear-id in an <Appear> client component with the
 *     animation spec from <script type="framer/appear">
 *   - rewrites all framerusercontent / gstatic / bcdn asset URLs to local /assets paths and
 *     collects them into asset-manifest.json
 *   - rewrites internal links (./x, https://www.siena.cx/x) → /x
 */
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'pages');
const OUT_APP = process.env.OUT_APP || '/Users/lucistation/Desktop/siena-clone/app';
const OUT_ROOT = path.dirname(OUT_APP);
const MANIFEST_PATH = path.join(__dirname, 'asset-manifest.json');

// slug (file name, __ = /) → route dir under app/ ('' = root). 404 probe → not-found.
const ROUTES = {};
for (const f of fs.readdirSync(PAGES_DIR)) {
  if (!f.endsWith('.html')) continue;
  const slug = f.replace(/\.html$/, '');
  if (slug === 'home') ROUTES[slug] = '';
  else if (slug === 'this-page-does-not-exist-404-probe') ROUTES[slug] = '__404__';
  else ROUTES[slug] = slug.replace(/__/g, '/');
}

// ---------------------------------------------------------------- asset map
const assetManifest = {}; // url → local public path (starts with /assets/)
function mapAssetUrl(raw) {
  if (!raw) return raw;
  let url = raw.trim();
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
        // any other query combo → short hash of the query string
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
    if (u.hostname === 'fonts.gstatic.com') {
      const flat = u.pathname.replace(/^\/s\//, '').replace(/\//g, '_');
      const local = `/assets/fonts/${flat}`;
      assetManifest[u.href] = local;
      return local;
    }
    if (u.hostname.endsWith('b-cdn.net')) {
      const flat = u.pathname.replace(/^\//, '').replace(/\//g, '_');
      const local = `/assets/video/${flat}`;
      assetManifest[u.href] = local;
      return local;
    }
  } catch (e) { /* not a URL */ }
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
  if (url.startsWith('https://framerusercontent.com') || url.startsWith('https://fonts.gstatic.com')) {
    return mapAssetUrl(url);
  }
  return raw;
}

function rewriteSrcset(v) {
  if (!v) return v;
  // srcset: comma-separated but URLs may contain commas? framer URLs don't. Split on ", " boundaries with descriptor.
  return v.split(',').map(part => {
    const bits = part.trim().split(/\s+/);
    bits[0] = mapAssetUrl(bits[0]);
    return bits.join(' ');
  }).join(', ');
}

function rewriteCssUrls(css) {
  return css.replace(/url\((['"]?)(https:\/\/[^)'"]+)\1\)/g, (m, quote, u) => {
    return `url(${quote}${mapAssetUrl(u)}${quote})`;
  });
}

// ------------------------------------------------------- attribute renaming
const ATTR_MAP = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', srcset: 'srcSet',
  autocomplete: 'autoComplete', autoplay: 'autoPlay', playsinline: 'playsInline',
  crossorigin: 'crossOrigin', frameborder: 'frameBorder', allowfullscreen: 'allowFullScreen',
  readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength',
  novalidate: 'noValidate', enctype: 'encType', formaction: 'formAction',
  colspan: 'colSpan', rowspan: 'rowSpan', cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing', usemap: 'useMap', accesskey: 'accessKey',
  contenteditable: 'contentEditable', spellcheck: 'spellCheck', datetime: 'dateTime',
  referrerpolicy: 'referrerPolicy', fetchpriority: 'fetchPriority',
  allowtransparency: 'allowTransparency', autofocus: 'autoFocus',
  'xlink:href': 'xlinkHref', 'xlink:title': 'xlinkTitle', 'xml:space': 'xmlSpace',
  'xmlns:xlink': 'xmlnsXlink', 'xml:lang': 'xmlLang',
};
// hyphenated SVG presentation attributes → camelCase (React requirement)
const SVG_HYPHEN = [
  'fill-rule','clip-rule','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray',
  'stroke-dashoffset','stroke-miterlimit','stroke-opacity','fill-opacity','stop-color','stop-opacity',
  'clip-path','color-interpolation','color-interpolation-filters','flood-color','flood-opacity',
  'dominant-baseline','text-anchor','alignment-baseline','baseline-shift','letter-spacing',
  'word-spacing','font-family','font-size','font-size-adjust','font-stretch','font-style',
  'font-variant','font-weight','vector-effect','shape-rendering','image-rendering','marker-start',
  'marker-mid','marker-end','paint-order','pointer-events','text-decoration','text-rendering',
  'transform-origin','unicode-bidi','word-break','writing-mode','overline-position','overline-thickness',
  'underline-position','underline-thickness','strikethrough-position','strikethrough-thickness',
  'lighting-color','enable-background','color-profile','color-rendering','glyph-orientation-horizontal',
  'glyph-orientation-vertical','horiz-adv-x','horiz-origin-x','stroke-color','mask-type',
];
for (const a of SVG_HYPHEN) {
  ATTR_MAP[a] = a.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
const BOOLEAN_ATTRS = new Set(['autoplay','muted','loop','controls','playsinline','allowfullscreen',
  'async','defer','checked','disabled','hidden','multiple','open','readonly','required','selected',
  'novalidate','itemscope','autofocus']);
const NUMERIC_ATTRS = new Set(['tabIndex','colSpan','rowSpan','maxLength','minLength','size','span','start','rows','cols',
  'aria-posinset','aria-setsize','aria-level','aria-valuemin','aria-valuemax','aria-valuenow',
  'aria-colcount','aria-colindex','aria-colspan','aria-rowcount','aria-rowindex','aria-rowspan']);
const STRIP_ATTRS = new Set(['data-framer-hydrate-v2','data-framer-ssr-released-at',
  'data-framer-page-optimized-at','data-framer-appear-id']);

// ------------------------------------------------------------ style parsing
function splitDecls(styleStr) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of styleStr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function cssPropToJs(prop) {
  prop = prop.trim();
  if (prop.startsWith('--')) return JSON.stringify(prop);
  let js = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (prop.startsWith('-webkit-')) js = 'Webkit' + prop.slice(8).replace(/^./, c => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  else if (prop.startsWith('-moz-')) js = 'Moz' + prop.slice(5).replace(/^./, c => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  else if (prop.startsWith('-ms-')) js = 'ms' + prop.slice(4).replace(/^./, c => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  else if (prop.startsWith('-o-')) js = 'O' + prop.slice(3).replace(/^./, c => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(js) ? js : JSON.stringify(js);
}
function styleToJsx(styleStr, { rewriteUrls = true } = {}) {
  const decls = splitDecls(styleStr);
  const pairs = [];
  for (const d of decls) {
    const idx = d.indexOf(':');
    if (idx < 0) continue;
    const prop = d.slice(0, idx).trim();
    let val = d.slice(idx + 1).trim();
    if (!prop) continue;
    if (rewriteUrls) val = rewriteCssUrls(val);
    pairs.push(`${cssPropToJs(prop)}: ${JSON.stringify(val)}`);
  }
  return `{{${pairs.join(', ')}}}`;
}

// --------------------------------------------------------------- JSX output
function jsxAttrName(name, isSvg) {
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  const lower = name.toLowerCase();
  if (ATTR_MAP[lower]) return ATTR_MAP[lower];
  if (ATTR_MAP[name]) return ATTR_MAP[name];
  return name; // parse5 already adjusted SVG camelCase attrs (viewBox etc.)
}

function esc(str) {
  return JSON.stringify(str);
}

// JSX attribute value: plain quoted string when safe, {"..."} expression
// container when the value needs JS escaping (quotes, backslashes, newlines)
function attrEsc(str) {
  const json = JSON.stringify(str);
  return json.slice(1, -1) === str ? json : `{${json}}`;
}

function toJsx($, el, ctx, depth) {
  if (el.type === 'text') {
    const t = el.data;
    if (!t) return '';
    if (/^[\n\r\s]*$/.test(t) && t.includes('\n')) return '\n'; // pure formatting whitespace
    return `{${esc(t)}}`;
  }
  if (el.type === 'comment') return '';
  if (el.type !== 'tag' && el.type !== 'script' && el.type !== 'style') return '';

  const tag = el.tagName;
  if (tag === 'noscript') return '';
  if (tag === 'script') return ''; // no runtime scripts in the clone
  if (tag === 'style') {
    // inline style blocks inside #main → collected into page.css (document order)
    const css = $(el).text();
    ctx.extraCss.push(css);
    return '';
  }

  const isSvg = tag === 'svg' || ctx.svgDepth > 0;
  if (tag === 'svg') ctx.svgDepth++;

  const attrs = [];
  let appearId = null;
  for (const [name, value] of Object.entries(el.attribs || {})) {
    if (STRIP_ATTRS.has(name)) {
      if (name === 'data-framer-appear-id') appearId = value;
      continue;
    }
    if (/^on[a-z]/.test(name)) continue;
    const jsxName = jsxAttrName(name, isSvg);
    if (name === 'style') {
      attrs.push(`style=${styleToJsx(value)}`);
    } else if (name === 'srcset' || name === 'imagesrcset') {
      attrs.push(`${jsxName}=${attrEsc(rewriteSrcset(value))}`);
    } else if (name === 'src' || name === 'poster' || name === 'data-poster') {
      attrs.push(`${jsxName}=${attrEsc(mapAssetUrl(value))}`);
    } else if (name === 'href') {
      attrs.push(`${jsxName}=${attrEsc(rewriteHref(value))}`);
    } else if (BOOLEAN_ATTRS.has(name)) {
      attrs.push(jsxName);
    } else if (NUMERIC_ATTRS.has(jsxName) && /^-?\d+$/.test(value)) {
      attrs.push(`${jsxName}={${value}}`);
    } else if (name === 'draggable' || name === 'contenteditable' || name === 'spellcheck') {
      attrs.push(`${jsxName}=${attrEsc(value)}`);
    } else {
      attrs.push(`${jsxName}=${attrEsc(value)}`);
    }
  }
  // re-attach appear id as a plain data attribute for traceability
  if (appearId) attrs.push(`data-appear-id=${attrEsc(appearId)}`);

  const children = ($(el).contents().toArray() || [])
    .map(c => toJsx($, c, ctx, depth + 1))
    .join('');

  if (tag === 'svg') ctx.svgDepth--;

  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
  let out;
  if (!children.trim()) {
    out = `<${tag}${attrStr}/>`;
  } else {
    out = `<${tag}${attrStr}>${children}</${tag}>`;
  }

  if (appearId && ctx.appearData && ctx.appearData[appearId]) ctx.usedAppear = true;
  return out;
}

// -------------------------------------------------------------- page emit
const sharedCss = { fonts: new Set(), base: new Set() };
let pagesDone = 0;

function metaOf($, sel, attr = 'content') {
  const v = $(sel).attr(attr);
  return v || undefined;
}

function processPage(slug, route) {
  const html = fs.readFileSync(path.join(PAGES_DIR, `${slug}.html`), 'utf8');
  const $ = cheerio.load(html);

  // ---- shared css
  $('style[data-framer-font-css]').each((_, el) => sharedCss.fonts.add($(el).text()));
  $('style[data-framer-html-style]').each((_, el) => sharedCss.base.add($(el).text()));

  // ---- per page css
  let pageCss = '';
  $('style[data-framer-breakpoint-css]').each((_, el) => { pageCss += $(el).text() + '\n'; });
  $('style[data-framer-css-ssr-minified]').each((_, el) => { pageCss += $(el).text() + '\n'; });

  // ---- appear animations + breakpoints
  let appearData = null, breakpoints = null;
  const appearRaw = $('script#__framer__appearAnimationsContent').html();
  if (appearRaw) {
    try {
      appearData = JSON.parse(appearRaw);
      // drop null breakpoint variants / fully-null appear entries
      for (const [id, variants] of Object.entries(appearData)) {
        for (const [k, v] of Object.entries(variants || {})) {
          if (v == null) delete variants[k];
        }
        if (!variants || !Object.keys(variants).length) delete appearData[id];
      }
    } catch {}
  }
  const bpRaw = $('script#__framer__breakpoints').html();
  if (bpRaw) { try { breakpoints = JSON.parse(bpRaw); } catch {} }

  // ---- metadata
  const title = $('title').first().text();
  const description = metaOf($, 'meta[name="description"]');
  const ogImage = metaOf($, 'meta[property="og:image"]');

  // ---- convert #main
  const main = $('#main')[0];
  if (!main) { console.error(`!! no #main in ${slug}`); return; }
  const ctx = { extraCss: [], appearData, usedAppear: false, svgDepth: 0 };
  const jsx = toJsx($, main, ctx, 0);
  pageCss += ctx.extraCss.map(rewriteCssUrls).join('\n');
  pageCss = rewriteCssUrls(pageCss);

  // ---- output route dir
  let outDir, pageFile;
  if (route === '__404__') {
    outDir = OUT_APP;
    pageFile = 'not-found.tsx';
  } else if (route === '') {
    outDir = OUT_APP;
    pageFile = 'page.tsx';
  } else {
    outDir = path.join(OUT_APP, route);
    pageFile = 'page.tsx';
  }
  fs.mkdirSync(outDir, { recursive: true });
  const cssName = route === '__404__' ? 'not-found.css' : 'page.css';
  fs.writeFileSync(path.join(outDir, cssName), pageCss);

  const imports = [`import "./${cssName}";`];
  const hasAppear = ctx.usedAppear && appearData && Object.keys(appearData).length > 0;
  if (hasAppear) imports.push(`import { AppearRunner, type AppearSpec } from "@/components/Appear";`);

  const bpConst = hasAppear
    ? `const BREAKPOINTS = ${JSON.stringify((breakpoints || []).map(b => ({ hash: b.hash, mediaQuery: b.mediaQuery })))};\nconst APPEAR: AppearSpec = ${JSON.stringify(appearData)};\n\n`
    : '';
  const body = hasAppear
    ? `<>\n    ${jsx}\n    <AppearRunner spec={APPEAR} breakpoints={BREAKPOINTS} />\n    </>`
    : jsx;

  let src;
  if (route === '__404__') {
    src = `${imports.join('\n')}\n\n${bpConst}export default function NotFound() {\n  return (\n    ${body}\n  );\n}\n`;
  } else {
    const meta = {
      title,
      description,
      openGraph: ogImage ? { images: [{ url: mapAssetUrl(ogImage) }] } : undefined,
    };
    src = `import type { Metadata } from "next";\n${imports.join('\n')}\n\nexport const metadata: Metadata = ${JSON.stringify(meta, null, 2)};\n\n${bpConst}export default function Page() {\n  return (\n    ${body}\n  );\n}\n`;
  }
  fs.writeFileSync(path.join(outDir, pageFile), src);
  pagesDone++;
  console.log(`ok ${slug} → app/${route === '' ? '' : route + '/'}${pageFile} (jsx ${(jsx.length / 1024).toFixed(0)}kb, css ${(pageCss.length / 1024).toFixed(0)}kb)`);
}

// ------------------------------------------------------------------- main
const only = process.argv[2];
for (const [slug, route] of Object.entries(ROUTES)) {
  if (only && slug !== only) continue;
  processPage(slug, route);
}

// shared css files
const stylesDir = path.join(OUT_APP, 'styles');
fs.mkdirSync(stylesDir, { recursive: true });
fs.writeFileSync(path.join(stylesDir, 'fonts.css'), rewriteCssUrls([...sharedCss.fonts].join('\n')));
fs.writeFileSync(path.join(stylesDir, 'base.css'), rewriteCssUrls([...sharedCss.base].join('\n')));

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(assetManifest, null, 1));
console.log(`\n${pagesDone} pages converted; ${Object.keys(assetManifest).length} unique assets in manifest`);
