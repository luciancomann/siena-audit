/**
 * Reads a -diff.png, finds vertical bands with high mismatch density, and
 * crops those bands from the orig/clone screenshots for side-by-side review.
 * Usage: node diff-regions.js home-1440
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
const OUT = path.join(__dirname, 'shots');
const d = PNG.sync.read(fs.readFileSync(path.join(OUT, `${slug}-diff.png`)));

// mismatch pixels are bright red in pixelmatch output
const rows = new Array(d.height).fill(0);
for (let y = 0; y < d.height; y++) {
  for (let x = 0; x < d.width; x++) {
    const i = (y * d.width + x) * 4;
    if (d.data[i] > 200 && d.data[i + 1] < 100 && d.data[i + 2] < 100) rows[y]++;
  }
}
// group into bands
const bands = [];
let cur = null;
for (let y = 0; y < rows.length; y++) {
  if (rows[y] > d.width * 0.02) {
    if (cur && y - cur.end < 120) cur.end = y;
    else { cur = { start: y, end: y, weight: 0 }; bands.push(cur); }
    cur.weight += rows[y];
  }
}
bands.sort((a, b) => b.weight - a.weight);
console.log(`${slug}: ${bands.length} diff bands (top 8):`);
const crops = [];
for (const b of bands.slice(0, 8)) {
  console.log(`  y ${b.start}-${b.end} (${b.end - b.start}px tall, weight ${b.weight})`);
  crops.push(b);
}

// crop top bands from orig and clone
for (const [i, b] of crops.slice(0, parseInt(process.argv[3] || '3')).entries()) {
  for (const kind of ['orig', 'clone']) {
    const img = PNG.sync.read(fs.readFileSync(path.join(OUT, `${slug}-${kind}.png`)));
    const y0 = Math.max(0, b.start - 60);
    const h = Math.min(img.height - y0, b.end - b.start + 160, 1200);
    const out = new PNG({ width: img.width, height: h });
    PNG.bitblt(img, out, 0, y0, img.width, h, 0, 0);
    fs.writeFileSync(path.join(OUT, `${slug}-band${i}-${kind}.png`), PNG.sync.write(out));
  }
  console.log(`  → band${i} crops written (y=${b.start})`);
}
