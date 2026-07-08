const fs = require('fs');
const cheerio = require('cheerio');
for (const cls of ['framer-1kknw4s-container', 'framer-66vi1x-container']) {
  const html = fs.readFileSync('ssr-' + cls + '.html', 'utf8');
  const $ = cheerio.load(html);
  console.log('===== ' + cls);
  const root = $('.' + cls).first();
  const walk = (node, depth) => {
    if (depth > 12) return;
    node.children('*').each((i, c) => {
      const $c = $(c);
      const cls2 = ($c.attr('class')||'').split(' ').filter(x=>x.startsWith('framer-')||x.startsWith('ssr')||x.startsWith('hidden')).slice(0,4).join(' ');
      const name = $c.attr('data-framer-name') || '';
      const style = ($c.attr('style')||'').slice(0,100);
      console.log('  '.repeat(depth) + c.tagName + ' | ' + cls2 + (name ? ' ["'+name+'"]' : '') + (style? ' {'+style+'}':''));
      walk($c, depth+1);
    });
  };
  // only first variant to keep short
  walk(root.children().first(), 1);
}
