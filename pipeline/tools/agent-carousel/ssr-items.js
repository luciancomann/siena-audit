const fs = require('fs');
const cheerio = require('cheerio');
for (const [cls, itemCls] of [['framer-1kknw4s-container','framer-1tbaed4'],['framer-66vi1x-container','framer-i2kkua']]) {
  const html = fs.readFileSync('ssr-' + cls + '.html', 'utf8');
  const $ = cheerio.load(html, null, false);
  console.log('==== ' + cls);
  $('.' + cls + ' > .ssr-variant').each((vi, v) => {
    const $v = $(v);
    const items = $v.find('.' + itemCls.replace('framer-','framer-')).filter((i,el)=>{
      const c = $(el).attr('class')||'';
      return c.split(' ').includes(itemCls);
    });
    console.log('variant', vi, $v.attr('class'), 'items:', items.length);
    items.each((i, el) => {
      const st = $(el).attr('style') || '';
      console.log('  item'+i, st.slice(0,160));
    });
  });
}
