/**
 * Downloads every asset in asset-manifest.json into the clone's public/ dir.
 * Parallel (12 at a time), skips existing files, reports failures.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const MANIFEST = require('./asset-manifest.json');
const PUBLIC = '/Users/lucistation/Desktop/siena-clone/public';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const entries = Object.entries(MANIFEST);
let done = 0, skipped = 0, failed = [];

function dl(url, local) {
  return new Promise((resolve) => {
    const dest = path.join(PUBLIC, local);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped++; return resolve(); }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    execFile('curl', ['-sL', '--fail', '-A', UA, '-o', dest, url], { timeout: 120000 }, (err) => {
      if (err) { failed.push(url); try { fs.unlinkSync(dest); } catch {} }
      else done++;
      if ((done + skipped + failed.length) % 100 === 0) console.log(`progress: ${done + skipped + failed.length}/${entries.length}`);
      resolve();
    });
  });
}

(async () => {
  const CONC = 12;
  let i = 0;
  async function worker() {
    while (i < entries.length) {
      const [url, local] = entries[i++];
      await dl(url, local);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`\ndownloaded: ${done}, skipped: ${skipped}, failed: ${failed.length}`);
  if (failed.length) {
    fs.writeFileSync(path.join(__dirname, 'failed-downloads.json'), JSON.stringify(failed, null, 1));
    console.log('failures written to failed-downloads.json');
    failed.slice(0, 10).forEach(u => console.log('  FAIL', u));
  }
})();
