#!/bin/bash
# Inside the container. Builds and serves the app from the tree run.sh handed over, against DynamoDB
# Local, then runs the suite (or perf). Results go to /out.
#
#   inner.sh test   [playwright args...]   run the suite
#   inner.sh update [playwright args...]   record baselines for the chosen tests
#   inner.sh perf                          this tree against /job/ref.tgz
set -euo pipefail

MODE=$1
shift
OUT=/out
LOGS=$OUT/logs
mkdir -p "$LOGS"

# Only local settings, whatever the host has. No env file reaches /work (checked below).
export AWS_ENDPOINT_URL=http://127.0.0.1:8000 AWS_ENDPOINT_URL_DYNAMODB=http://127.0.0.1:8000 \
  AWS_REGION=ap-south-1 AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_SESSION_TOKEN= \
  AWS_PROFILE= AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  AWS_EC2_METADATA_DISABLED=true NEXT_PUBLIC_UMAMI_WEBSITE_ID= NEXT_PUBLIC_UMAMI_SCRIPT_URL= \
  NEXT_TELEMETRY_DISABLED=1

step() { echo "e2e: $*"; }

# Unpacks a tree and refuses to go on if it holds any env file.
unpack() {
  local archive=$1 dir=$2 found
  rm -rf "$dir" && mkdir -p "$dir"
  tar -xzf "$archive" -C "$dir" --no-same-owner --warning=no-unknown-keyword
  found=$(cd "$dir" && find . -name '.env*' ! -name '.env.example' -print)
  if [ -n "$found" ]; then
    echo "e2e: refusing to run, env files in the copied tree:" >&2
    echo "$found" >&2
    exit 3
  fi
}

# Installs, builds and starts one copy of the app. Logs go to $LOGS/<label>-*.log.
serve() {
  local dir=$1 table=$2 port=$3 label=$4
  cd "$dir"
  step "$label: installing"
  pnpm install --frozen-lockfile >"$LOGS/$label-install.log" 2>&1 \
    || { tail -30 "$LOGS/$label-install.log"; exit 1; }
  node /opt/e2e/create-table.mjs "$table"
  mkdir -p .next "/next-cache/$label" && ln -sfn "/next-cache/$label" .next/cache
  step "$label: building"
  DOCUMENTS_TABLE=$table pnpm build >"$LOGS/$label-build.log" 2>&1 \
    || { tail -40 "$LOGS/$label-build.log"; exit 1; }
  DOCUMENTS_TABLE=$table nohup pnpm start -H 127.0.0.1 -p "$port" >"$LOGS/$label-app.log" 2>&1 &
  for _ in $(seq 1 90); do
    if curl -fs -o /dev/null "http://127.0.0.1:$port/robots.txt"; then
      step "$label: ready on 127.0.0.1:$port"
      return 0
    fi
    sleep 1
  done
  tail -30 "$LOGS/$label-app.log"
  exit 1
}

pnpm config set store-dir /pnpm-store >/dev/null

unpack /job/tree.tgz /work
step "no env files in /work: $(cd /work && find . -name '.env*' ! -name '.env.example' | wc -l) found"

if [ "$MODE" = perf ]; then
  unpack /job/ref.tgz /ref
  serve /ref openleaf-local-perf-reference 4100 reference
  serve /work openleaf-local-perf-candidate 4200 candidate
  cd /work
  step "perf: reference $(cat /job/ref.name), candidate: this tree"
  node tests/e2e/perf.mjs http://127.0.0.1:4100 openleaf-local-perf-reference \
    http://127.0.0.1:4200 openleaf-local-perf-candidate
  exit $?
fi

serve /work openleaf-local-e2e 4200 app
cd /work
E2E=/work/tests/e2e
export E2E_TABLE=openleaf-local-e2e E2E_BASE_URL=http://127.0.0.1:4200
if [ "$MODE" = update ]; then
  export E2E_RECORD=1
  set -- --update-snapshots=all "$@"
fi

step "playwright test $*"
status=0
./node_modules/.bin/playwright test -c tests/e2e/playwright.config.ts "$@" || status=$?

if [ "$MODE" = update ] && [ -d "$E2E/.recording" ]; then
  node tests/e2e/merge-recording.mjs || status=1
fi

# Results always, and in update mode what was recorded.
for name in test-results playwright-report; do
  [ -d "$E2E/$name" ] && cp -R "$E2E/$name" "$OUT/"
done
if [ "$MODE" = update ]; then
  for name in expected screenshots .recording; do
    [ -d "$E2E/$name" ] && cp -R "$E2E/$name" "$OUT/"
  done
fi
step "playwright exit code $status"
exit $status
