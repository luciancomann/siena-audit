const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('../../pages/home.html', 'utf8');
const $ = cheerio.load(html);
for (const cls of ['framer-1kknw4s-container', 'framer-66vi1x-container']) {
  const el = $('.' + cls);
  console.log('=== ' + cls + ' count=' + el.length);
  const out = $.html(el.first());
  fs.writeFileSync('ssr-' + cls + '.html', out);
  console.log('bytes:', out.length);
  // summarize children structure
  const walk = (node, depth) => {
    if (depth > 6) return;
    node.children('*').each((i, c) => {
      const $c = $(c);
      const cls2 = ($c.attr('class')||'').split(' ').slice(0,3).join(' ');
      const name = $c.attr('data-framer-name') || '';
      console.log('  '.repeat(depth) + c.tagName + ' .' + cls2 + (name ? ' ["'+name+'"]' : ''));
      walk($c, depth+1);
    });
  };
  walk(el.first(), 1);
}
