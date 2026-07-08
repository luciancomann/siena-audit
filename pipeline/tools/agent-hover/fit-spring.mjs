// Fit framer-motion spring params to live-observed progress curves.
// Run from /Users/lucistation/Desktop/siena-clone (framer-motion resolvable).
import { spring } from 'framer-motion';

const CURVES = {
  buttonEnter: [[48, 0.06], [82, 0.267], [126, 0.875], [195, 0.97], [299, 1.0]],
  buttonExit: [[42, 0.44], [98, 0.843], [164, 1.0], [222, 1.0]],
  dot: [[42, 0.23], [82, 0.61], [122, 0.86], [181, 1.0], [241, 1.02], [322, 1.005], [421, 1.0]],
  mini: [[58, 0.01], [383, 1.0], [449, 1.0]],
};

function evalSpring(duration, bounce, delayMs, tMs) {
  const t = tMs - delayMs;
  if (t <= 0) return 0;
  const gen = spring({ keyframes: [0, 1], visualDuration: undefined, duration: duration * 1000, bounce });
  return gen.next(t).value;
}

for (const [name, pts] of Object.entries(CURVES)) {
  let best = null;
  for (let d = 0.1; d <= 0.8; d += 0.025) {
    for (let b = 0; b <= 0.45; b += 0.05) {
      for (let delay = 0; delay <= 100; delay += 10) {
        let err = 0;
        for (const [t, p] of pts) {
          const v = evalSpring(d, b, delay, t);
          err += (v - p) ** 2;
        }
        if (!best || err < best.err) best = { err, d: Math.round(d * 1000) / 1000, b: Math.round(b * 100) / 100, delay };
      }
    }
  }
  const preview = CURVES[name].map(([t, p]) => `${t}ms live=${p} fit=${evalSpring(best.d, best.b, best.delay, t).toFixed(3)}`).join('  ');
  console.log(`${name}: duration=${best.d} bounce=${best.b} delay=${best.delay}ms rmse=${Math.sqrt(best.err / pts.length).toFixed(4)}`);
  console.log('   ' + preview);
}
