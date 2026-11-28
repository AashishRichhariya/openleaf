#!/bin/bash
# Runs the e2e suite in Docker: builds the app from the working tree, starts DynamoDB Local and the
# app, and runs Playwright. Needs only Docker and bash (3.2 works). Exits with Playwright's code.
#
#   run.sh [playwright args...]             all browsers, or e.g. --project=chromium --grep "table"
#   run.sh --update [--all] [args...]       record baselines for the chosen tests (a --grep or file
#                                           filter is required, unless --all is given)
#   run.sh --perf [ref]                     perf.mjs: this tree against ref (default origin/main)
#
# The working tree goes into the container as an archive of tracked and new files, never ignored
# ones (.env.local, node_modules, .next, [META]) and never an env file. Nothing is mounted from the
# repo. Reports land in tests/e2e/playwright-report/ and tests/e2e/test-results/.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
E2E="$(cd "$HERE/.." && pwd -P)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
die() { echo "e2e: $*" >&2; exit 2; }

MODE=test
REF=origin/main
REPLACE=
# `pnpm test:e2e -- --project=chromium` passes the "--" along.
if [ "${1:-}" = "--" ]; then shift; fi
if [ "${1:-}" = "--update" ]; then
  MODE=update
  shift
elif [ "${1:-}" = "--perf" ]; then
  MODE=perf
  shift
  if [ "${1:-}" = "--" ]; then shift; fi
  if [ $# -gt 0 ]; then REF=$1; shift; fi
  [ $# -eq 0 ] || die "usage: run.sh --perf [ref]"
fi
if [ "${1:-}" = "--" ]; then shift; fi

# Update mode records over the baselines, so it must be told which tests.
ARGS=()
if [ "$MODE" = update ]; then
  all=0 filtered=0 previous=""
  for arg in "$@"; do
    case $arg in
      --all) all=1; continue ;;
      -g|--grep|-g*|--grep=*) filtered=1 ;;
      -*) ;;
      *)
        # A file filter looks like a path; other bare words are values of options.
        case $previous in
          --project|-j|--workers|--reporter|--repeat-each|--retries|--timeout|-c|--config|\
          --max-failures|-x|--output|--shard|--grep-invert|--tsconfig|--update-snapshots|\
          --trace|--global-timeout|--test-list|--test-list-invert) ;;
          *) case $arg in */*|*.spec*|*.ts) filtered=1 ;; esac ;;
        esac
        ;;
    esac
    ARGS+=("$arg")
    previous=$arg
  done
  if [ $all = 0 ] && [ $filtered = 0 ]; then
    die 'update records over baselines: name the tests with --grep "<name>" or a file, or pass --all'
  fi
  set -- ${ARGS[@]+"${ARGS[@]}"}
  # Everything recorded: baselines of tests that no longer exist go too.
  if [ $all = 1 ] && [ $filtered = 0 ]; then REPLACE=1; fi
fi

docker info >/dev/null 2>&1 || die "Docker is not running"

TMP="$(mktemp -d)"
PROJECT="openleaf-e2e-$MODE-$$"
COMPOSE=(docker compose -f "$HERE/compose.yaml" -p "$PROJECT")
cleanup() {
  "${COMPOSE[@]}" down --remove-orphans --timeout 5 >/dev/null 2>&1 || true
  rm -rf "$TMP" 2>/dev/null || echo "e2e: could not remove $TMP" >&2
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# The working tree: tracked and untracked files git does not ignore, minus deleted ones and env files.
(
  cd "$ROOT"
  git ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' file; do
    [ -f "$file" ] || continue
    case "${file##*/}" in
      .env.example) ;;
      .env*|.npmrc|*credentials*|*.pem|*.key) continue ;;
    esac
    printf '%s\0' "$file"
  done | COPYFILE_DISABLE=1 tar -czf "$TMP/tree.tgz" --no-xattrs --null -T -
)
MOUNTS=(-v "$TMP/tree.tgz:/job/tree.tgz:ro")

if [ "$MODE" = perf ]; then
  git -C "$ROOT" rev-parse --verify --quiet "$REF^{commit}" >/dev/null || die "unknown ref $REF"
  git -C "$ROOT" archive --format=tar.gz -o "$TMP/ref.tgz" "$REF"
  echo "$REF ($(git -C "$ROOT" rev-parse --short "$REF"))" > "$TMP/ref.name"
  MOUNTS+=(-v "$TMP/ref.tgz:/job/ref.tgz:ro" -v "$TMP/ref.name:/job/ref.name:ro")
fi

mkdir -p "$TMP/out"
docker volume create openleaf-e2e-pnpm-store >/dev/null
docker volume create openleaf-e2e-next-cache >/dev/null
echo "e2e: building the runner image"
"${COMPOSE[@]}" build --quiet e2e
echo "e2e: running ($MODE)"
status=0
# Next's build cache is kept per checkout, so that two worktrees never share one.
CACHE_KEY=$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1)
"${COMPOSE[@]}" run --rm -T "${MOUNTS[@]}" -v "$TMP/out:/out" -e E2E_REPLACE="$REPLACE" \
  -e E2E_CACHE_KEY="$CACHE_KEY" -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" e2e \
  bash /opt/e2e/inner.sh "$MODE" "$@" || status=$?

# Bring the results back, replacing those of the previous run. A failure here must not change the
# exit code, which is Playwright's.
set +e
for name in test-results playwright-report; do
  if [ -d "$TMP/out/$name" ]; then
    rm -rf "${E2E:?}/$name"
    cp -R "$TMP/out/$name" "$E2E/$name"
  fi
done
if [ -d "$TMP/out/logs" ]; then
  mkdir -p "$E2E/test-results"
  rm -rf "$E2E/test-results/logs"
  cp -R "$TMP/out/logs" "$E2E/test-results/logs"
fi
if [ "$MODE" = update ]; then
  [ -d "$TMP/out/expected" ] && cp "$TMP/out/expected/"*.json "$E2E/expected/"
  if [ -d "$TMP/out/screenshots" ]; then
    # A full recording that passed also drops the screenshots of tests that no longer exist.
    if [ -n "$REPLACE" ] && [ $status = 0 ]; then
      for dir in "$TMP/out/screenshots/"*/; do rm -rf "$E2E/screenshots/$(basename "$dir")"; done
    fi
    cp -R "$TMP/out/screenshots/." "$E2E/screenshots/"
  fi
  if [ -d "$TMP/out/.recording" ]; then
    rm -rf "$E2E/.recording"
    cp -R "$TMP/out/.recording" "$E2E/.recording"
  fi
  echo "e2e: recorded into tests/e2e/expected/ and tests/e2e/screenshots/. Review the diff before committing."
fi
if [ "$MODE" != perf ]; then
  echo "e2e: report in tests/e2e/playwright-report/index.html, logs in tests/e2e/test-results/logs/"
fi
exit $status
