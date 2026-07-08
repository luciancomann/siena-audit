/** Loads every clone route, logs failed requests (404s) and console errors. */
const { chromium } = require('playwright');

const ROUTES = ['/', '/pricing', '/memory', '/video', '/order-tracking', '/shopping-agent',
  '/ai-review-management', '/ask-siena', '/qa-agent', '/products/docs', '/topics-explorer',
  '/insights', '/insights/sentiment-analysis-online', '/insights/voice-of-customer-software',
  '/insights/customer-feedback-analytics-software', '/book-a-demo', '/community', '/roi-calculator',
  '/refer-a-friend', '/siena-ai-certification-in-customer-experience', '/partner-with-siena',
  '/integrations', '/about-us', '/customers', '/blog', '/product-updates', '/webinars', '/events',
  '/terms-of-service', '/privacy-policy', '/ai-lab', '/ai-native-customer-service-vs-help-desk-ai-add-ons',
  '/compare/siena-ai-vs-gorgias-ai', '/compare/siena-ai-vs-kustomer-ai',
  '/blog/seed', '/blog/testing-ai-agents-playground',
  '/customer-stories/hexclad-customer-service-automation', '/customer-stories/simple-modern',
  '/integrations/shopify', '/integrations/klaviyo', '/product-updates/siena-memory',
  '/webinar/help-desk-vs-dedicated-ai'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fails = new Map();
  const errors = new Map();
  page.on('response', r => {
    if (r.status() >= 400) {
      const u = r.url().replace('http://localhost:3100', '');
      if (!fails.has(u)) fails.set(u, []);
      fails.get(u).push(page.url().replace('http://localhost:3100', ''));
    }
  });
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text().slice(0, 160);
      if (!errors.has(t)) errors.set(t, 0);
      errors.set(t, errors.get(t) + 1);
    }
  });
  for (const r of ROUTES) {
    await page.goto('http://localhost:3100' + r, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log('NAV FAIL', r));
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 1200) { window.scrollTo(0, y); await new Promise(res => setTimeout(res, 30)); }
    });
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  await browser.close();
  console.log('=== FAILED REQUESTS (' + fails.size + ') ===');
  for (const [u, pages] of [...fails].slice(0, 60)) console.log(u, ' ← ', [...new Set(pages)].slice(0, 3).join(','));
  console.log('=== CONSOLE ERRORS ===');
  for (const [t, n] of errors) console.log(`(${n}×)`, t);
})();
