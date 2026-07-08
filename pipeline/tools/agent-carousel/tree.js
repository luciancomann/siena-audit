const j = require('./live-structure.json');
const print = (n, d) => {
  if (!n) return;
  const cls = (n.cls||'').split(' ').slice(0,3).join(' ');
  console.log('  '.repeat(d) + n.tag + ' | ' + cls + (n.name?' ["'+n.name+'"]':'') + (n.role?' role='+n.role:'') + (n.aria?' aria="'+n.aria+'"':'') + ' rect='+JSON.stringify(n.rect) + (n.style?' {'+n.style.slice(0,150)+'}':''));
  n.children.forEach(c => print(c, d+1));
};
for (const k of Object.keys(j)) { console.log('======= ' + k); print(j[k].tree, 0); }
