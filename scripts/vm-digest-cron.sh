#!/usr/bin/env bash
# Runs the daily Substack digest from an Oracle Cloud Seoul VM.
# Requires a clone of the repo with .env.local (SUBSTACK_COOKIE,
# NEXT_PUBLIC_SUBSTACK_URL) and git push credentials configured.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(node -v 2>/dev/null)/bin:$PATH"

set -a
[ -f .env.local ] && source .env.local
set +a

git pull --rebase --autostash origin main

npx --yes tsx scripts/send-digest.ts

if ! git diff --quiet public/data/digest-sent.json; then
  git add public/data/digest-sent.json
  git -c user.name="digest-cron" -c user.email="digest-cron@terryum.ai" \
    commit -m "data: update digest sent history"
  git push origin main
fi
