// Print an annotated DOM outline of a captured page's #main tree
const cheerio = require('cheerio');
const fs = require('fs');

const file = process.argv[2] || '../pages/home.html';
const maxDepth = parseInt(process.argv[3] || '5', 10);
const $ = cheerio.load(fs.readFileSync(file, 'utf8'));

function walk(el, depth) {
  if (depth > maxDepth) return;
  const $el = $(el);
  const name = $el.attr('data-framer-name');
  const cls = ($el.attr('class') || '').split(' ').slice(0, 2).join(' ');
  const id = $el.attr('id');
  let label = el.tagName;
  if (id) label += `#${id}`;
  if (name) label += ` «${name}»`;
  if (cls) label += ` .${cls}`;
  const href = $el.attr('href');
  if (href) label += ` →${href.slice(0, 60)}`;
  console.log('  '.repeat(depth) + label);
  $el.children().each((_, c) => walk(c, depth + 1));
}

walk($('#main')[0], 0);
