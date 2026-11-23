#!/bin/bash
# WebKit on macOS 14. Playwright 1.62+ cannot drive the frozen WebKit build it installs there,
# so this runs the same tests with the newest client that can (1.61.1). Elsewhere, use the
# normal `--project webkit`. Pass any `playwright test` arguments.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd -P)"
RUNNER="${E2E_WEBKIT_RUNNER:-${TMPDIR:-/tmp}/openleaf-webkit-runner}"
VERSION=1.61.1

if [ ! -d "$RUNNER/node_modules/@playwright/test" ]; then
  mkdir -p "$RUNNER"
  npm install --prefix "$RUNNER" --no-audit --no-fund --loglevel=error "@playwright/test@$VERSION"
  "$RUNNER/node_modules/.bin/playwright" install webkit
fi

mkdir -p "$RUNNER/e2e"
rsync -a --delete --exclude .recording --exclude test-results "$HERE/" "$RUNNER/e2e/"
export E2E_APP_DIR="${E2E_APP_DIR:-$(cd "$HERE/../.." && pwd -P)}"

status=0
(cd "$RUNNER" && ./node_modules/.bin/playwright test -c e2e/playwright.config.ts --project=webkit "$@") || status=$?

# Bring back recordings and screenshots made on the baseline.
if [ -d "$RUNNER/e2e/.recording/webkit" ]; then
  mkdir -p "$HERE/.recording"
  rsync -a "$RUNNER/e2e/.recording/webkit" "$HERE/.recording/"
fi
# Accepted differences recorded with E2E_RECORD_ACCEPTED (see support/accepted.ts)
if [ -d "$RUNNER/e2e/expected/accepted/webkit" ]; then
  mkdir -p "$HERE/expected/accepted"
  rsync -a "$RUNNER/e2e/expected/accepted/webkit" "$HERE/expected/accepted/"
fi
if [ -d "$RUNNER/e2e/screenshots/webkit" ]; then
  mkdir -p "$HERE/screenshots"
  rsync -a "$RUNNER/e2e/screenshots/webkit" "$HERE/screenshots/"
fi
exit "$status"
