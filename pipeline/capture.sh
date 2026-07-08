#!/bin/bash
# Capture SSR HTML for all target siena.cx pages
set -e
cd "$(dirname "$0")"
mkdir -p pages
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

PATHS=(
  ""
  "compare/siena-ai-vs-gorgias-ai"
  "compare/siena-ai-vs-kustomer-ai"
  "ai-native-customer-service-vs-help-desk-ai-add-ons"
  "memory"
  "video"
  "order-tracking"
  "shopping-agent"
  "ai-review-management"
  "ask-siena"
  "qa-agent"
  "products/docs"
  "topics-explorer"
  "insights/sentiment-analysis-online"
  "insights/voice-of-customer-software"
  "insights/customer-feedback-analytics-software"
  "book-a-demo"
  "community"
  "pricing"
  "roi-calculator"
  "refer-a-friend"
  "siena-ai-certification-in-customer-experience"
  "partner-with-siena"
  "integrations"
  "about-us"
  "customers"
  "blog"
  "product-updates"
  "webinars"
  "events"
  "terms-of-service"
  "privacy-policy"
  "insights"
  "ai-lab"
  "blog/seed"
  "blog/testing-ai-agents-playground"
  "customer-stories/hexclad-customer-service-automation"
  "customer-stories/simple-modern"
  "integrations/shopify"
  "integrations/klaviyo"
  "product-updates/siena-memory"
  "webinar/help-desk-vs-dedicated-ai"
  "this-page-does-not-exist-404-probe"
)

for p in "${PATHS[@]}"; do
  if [ -z "$p" ]; then slug="home"; else slug="${p//\//__}"; fi
  out="pages/${slug}.html"
  if [ -s "$out" ]; then echo "SKIP $slug"; continue; fi
  code=$(curl -sL -A "$UA" -w "%{http_code}" -o "$out" "https://www.siena.cx/$p")
  size=$(wc -c < "$out" | tr -d ' ')
  echo "$code  $slug  ${size}b"
  sleep 0.4
done
echo "DONE: $(ls pages | wc -l) pages captured"
