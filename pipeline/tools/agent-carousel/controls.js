const fs = require('fs');
const cheerio = require('cheerio');
for (const cls of ['framer-1kknw4s-container', 'framer-66vi1x-container']) {
  const html = fs.readFileSync('live-' + cls + '.html', 'utf8');
  const $ = cheerio.load(html, null, false);
  console.log('======= ' + cls);
  // The controls row: div with margin-top: 24px
  $('div').each((i, el) => {
    const st = $(el).attr('style') || '';
    if (st.includes('margin-top: 24px')) {
      console.log($.html(el));
    }
  });
}
