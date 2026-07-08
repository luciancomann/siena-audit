#!/bin/bash
URL=$(curl -s --max-time 30 http://localhost:3200/ | grep -o 'src="/_next/static/chunks/[^"]*"' | sed 's/src="//;s/"$//' | while read u; do
  if curl -s --max-time 30 "http://localhost:3200$u" | grep -q 1iacnpu; then echo "$u"; break; fi
done)
echo "slide chunk: $URL"
curl -s --max-time 30 "http://localhost:3200$URL" -o /tmp/served-chunk2.js
node -e "
const s = require('fs').readFileSync('/tmp/served-chunk2.js','utf8');
console.log('self-close:', (s.match(/\/>/g)||[]).length, '| 1iacnpu:', (s.match(/1iacnpu/g)||[]).length);
"
