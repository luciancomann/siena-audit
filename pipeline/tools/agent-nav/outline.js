// Outline a DOM tree to limited depth, showing classes / names / hrefs / text
const fs = require('fs');
const cheerio = require('cheerio');

const file = process.argv[2];
const maxDepth = parseInt(process.argv[3] || '6', 10);
const selector = process.argv[4] || null;

const html = fs.readFileSync(file, 'utf8');
const $ = cheerio.load(html);

function outline(el, depth, indent) {
  if (depth > maxDepth) return;
  const $el = $(el);
  if (el.type !== 'tag') return;
  const name = $el.attr('data-framer-name');
  const cls = ($el.attr('class') || '').split(/\s+/).slice(0, 4).join('.');
  const href = $el.attr('href');
  const style = $el.attr('style') || '';
  const interesting = [];
  if (name) interesting.push(`name="${name}"`);
  if (href) interesting.push(`href="${href}"`);
  for (const kw of ['opacity', 'display', 'visibility', 'transform:', 'height']) {
    const m = style.match(new RegExp(kw.replace(':', '') + '\\s*:\\s*([^;]+)'));
    if (m && ['opacity', 'display', 'visibility'].includes(kw)) interesting.push(`${kw}=${m[1].trim()}`);
  }
  let text = '';
  const direct = $el.contents().filter((i, n) => n.type === 'text').text().trim();
  if (direct) text = ` "${direct.slice(0, 40)}"`;
  console.log(`${indent}<${el.tagName} .${cls}${interesting.length ? ' ' + interesting.join(' ') : ''}>${text}`);
  $el.children().each((i, c) => outline(c, depth + 1, indent + '  '));
}

const roots = selector ? $(selector) : $.root().children();
roots.each((i, el) => outline(el, 0, ''));
