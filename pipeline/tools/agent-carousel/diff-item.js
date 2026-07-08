const fs = require('fs');
const cheerio = require('cheerio');

function walk($, el, path, map) {
  const $el = $(el);
  const key = path;
  map.set(key, {
    tag: el.tagName,
    cls: $el.attr('class') || '',
    style: $el.attr('style') || '',
  });
  $el.children('*').each((i, c) => walk($, c, path + '/' + i, map));
}

function compare(liveFile, ssrFile, liveSel, ssrPickFn, label) {
  const $l = cheerio.load(fs.readFileSync(liveFile, 'utf8'), null, false);
  const $s = cheerio.load(fs.readFileSync(ssrFile, 'utf8'), null, false);
  const liveItem = $l(liveSel).first();
  const ssrItem = ssrPickFn($s);
  const lm = new Map(), sm = new Map();
  walk($l, liveItem.get(0), '', lm);
  walk($s, ssrItem.get(0), '', sm);
  console.log('==== ' + label + ' live nodes:' + lm.size + ' ssr nodes:' + sm.size);
  let diffs = 0;
  for (const [k, lv] of lm) {
    const sv = sm.get(k);
    if (!sv) { console.log('MISSING in ssr:', k, lv.tag, lv.cls.slice(0,40)); diffs++; if (diffs>10) break; continue; }
    // normalize: ignore whitespace after colon variations
    const norm = s => s.replace(/\s+/g, ' ').replace(/; ?$/,'').trim();
    if (norm(lv.style) !== norm(sv.style)) {
      console.log('STYLE DIFF at', k, lv.tag, (lv.cls||sv.cls).slice(0,45));
      console.log('  live:', lv.style.slice(0,200));
      console.log('  ssr :', sv.style.slice(0,200));
      diffs++; if (diffs > 12) break;
    }
    if (lv.cls !== sv.cls) { console.log('CLASS DIFF at', k, 'live:', lv.cls.slice(0,80), '| ssr:', sv.cls.slice(0,80)); diffs++; if (diffs>12) break; }
  }
  for (const k of sm.keys()) if (!lm.has(k)) { console.log('EXTRA in ssr:', k, sm.get(k).tag, sm.get(k).cls.slice(0,40)); diffs++; if (diffs>15) break; }
  if (!diffs) console.log('  (no diffs)');
}

// c1 item0: live first .framer-1tbaed4 vs ssr variant0 first .framer-1tbaed4
compare('live-framer-1kknw4s-container.html', 'ssr-framer-1kknw4s-container.html',
  '.framer-1tbaed4',
  ($s) => $s('.ssr-variant').first().find('.framer-1tbaed4').first(),
  'c1 item0');

// c2 item0
compare('live-framer-66vi1x-container.html', 'ssr-framer-66vi1x-container.html',
  '.framer-i2kkua',
  ($s) => $s('.ssr-variant').first().find('.framer-i2kkua').first(),
  'c2 item0');
