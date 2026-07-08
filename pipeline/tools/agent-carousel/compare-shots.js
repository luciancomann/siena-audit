/** Pixel-compares clone vs live carousel region screenshots. */
const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

for (const width of [1440, 390]) {
  for (const short of ['c1', 'c2']) {
    const a = `shot-CLONE-${width}-${short}.png`;
    const b = `shot-LIVE-${width}-${short}.png`;
    if (!fs.existsSync(a) || !fs.existsSync(b)) { console.log(width, short, 'missing shots'); continue; }
    const pa = PNG.sync.read(fs.readFileSync(a));
    const pb = PNG.sync.read(fs.readFileSync(b));
    if (pa.width !== pb.width || pa.height !== pb.height) {
      console.log(`${width} ${short}: SIZE MISMATCH clone=${pa.width}x${pa.height} live=${pb.width}x${pb.height}`);
      continue;
    }
    const diff = new PNG({ width: pa.width, height: pa.height });
    const n = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0.15 });
    const pct = ((n / (pa.width * pa.height)) * 100).toFixed(2);
    fs.writeFileSync(`diff-${width}-${short}.png`, PNG.sync.write(diff));
    console.log(`${width} ${short}: ${pa.width}x${pa.height} diff pixels=${n} (${pct}%)`);
  }
}
