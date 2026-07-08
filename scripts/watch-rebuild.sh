#!/bin/bash
# Serves the production build on :3200 and rebuilds + restarts whenever
# app/ or components/ change. Dev mode OOMs on the giant generated pages,
# so agent iteration runs against prod builds instead.
#
# Builds go to .next-staging, then swap to .next-live via rename, so the
# serving directory is never a half-written build.
cd "$(dirname "$0")/.."

fingerprint() {
  find components app -name "*.tsx" -o -name "*.css" | xargs stat -f "%N %m" 2>/dev/null | sort | md5
}

build() {
  rm -rf .next-staging
  NEXT_DIST_DIR=.next-staging npx next build > /tmp/siena-clone-build.log 2>&1
}

deploy_and_restart() {
  local holder
  holder=$(lsof -ti :3200 2>/dev/null)
  [ -n "$holder" ] && kill -9 $holder 2>/dev/null
  rm -rf .next-old
  [ -d .next-live ] && mv .next-live .next-old
  mv .next-staging .next-live
  rm -rf .next-old &
  NEXT_DIST_DIR=.next-live nohup npx next start -p 3200 > /tmp/siena-clone-3200.log 2>&1 &
  echo "$(date +%T) deployed + server restarted"
}

echo "$(date +%T) watcher starting"
LAST=$(fingerprint)
if build; then
  echo "$(date +%T) initial build ok"
  deploy_and_restart
else
  echo "$(date +%T) INITIAL BUILD FAILED"
fi

while true; do
  sleep 8
  NOW=$(fingerprint)
  if [ "$NOW" != "$LAST" ]; then
    LAST="$NOW"
    echo "$(date +%T) change detected → rebuilding"
    if build; then
      echo "$(date +%T) build ok"
      deploy_and_restart
    else
      echo "$(date +%T) BUILD FAILED (old build still serving); errors:"
      grep -E "Type error|Error:" /tmp/siena-clone-build.log | head -5
    fi
  fi
done
