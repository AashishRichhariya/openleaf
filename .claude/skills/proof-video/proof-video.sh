#!/bin/bash
# Make a narrated proof video from a storyboard. Needs only Docker; everything else runs in a pinned image.
#
#   .claude/skills/proof-video/proof-video.sh <storyboard.json> [--pr N] [--out DIR]
#
# The output goes to "[META]/proof-videos/<date>_<pr-N or branch>_<name>/" in the main checkout, a local folder
# git ignores (also when run from a worktree).
# The app, if the storyboard uses it, is built from the working tree (tracked and new files, never ignored ones
# such as .env.local) and runs against an in-memory DynamoDB Local inside the container. See SKILL.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
die() { echo "proof-video: $*" >&2; exit 1; }

[ $# -ge 1 ] || die "usage: proof-video.sh <storyboard.json> [--pr N] [--out DIR]"
STORY_ARG=$1; shift
PR=""; OUT=""
while [ $# -gt 0 ]; do
  case $1 in
    --pr) PR=$2; shift 2 ;;
    --out) OUT=$2; shift 2 ;;
    *) die "unknown option $1" ;;
  esac
done

[ -f "$STORY_ARG" ] || die "no storyboard at $STORY_ARG"
STORY_DIR="$(cd "$(dirname "$STORY_ARG")" && pwd -P)"
STORY_FILE="$(basename "$STORY_ARG")"
ROOT="$(git -C "$STORY_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"
# Videos go to the main checkout's [META], also when this runs in a worktree.
MAIN_ROOT="$(cd "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)/.." && pwd -P)"

NAME=$(/usr/bin/python3 -c 'import json,sys,re; n=json.load(open(sys.argv[1])).get("name") or "proof"; print(re.sub(r"[^a-z0-9]+","-",n.lower()).strip("-") or "proof")' "$STORY_DIR/$STORY_FILE")
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)
SHA=$(git -C "$ROOT" rev-parse HEAD)
DIRTY=$([ -n "$(git -C "$ROOT" status --porcelain)" ] && echo 1 || echo 0)
if [ -z "$PR" ] && command -v gh >/dev/null 2>&1; then
  PR=$(cd "$ROOT" && gh pr view --json number -q .number 2>/dev/null || true)
fi
TAG=$([ -n "$PR" ] && echo "pr-$PR" || echo "$BRANCH" | tr '/' '-')
if [ -z "$OUT" ]; then
  BASE="$MAIN_ROOT/[META]/proof-videos/$(date +%Y-%m-%d)_${TAG}_${NAME}"
  OUT=$BASE; n=2
  while [ -e "$OUT" ]; do OUT="$BASE-$n"; n=$((n + 1)); done
fi
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd -P)"

if ! docker info >/dev/null 2>&1; then
  echo "proof-video: starting Docker Desktop"
  open -a Docker 2>/dev/null || die "Docker is not running and could not be started"
  for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || die "Docker did not start"
fi

TMP=$(mktemp -d)
COMPOSE=(docker compose -f "$HERE/docker/compose.yaml")
cleanup() { "${COMPOSE[@]}" down --remove-orphans >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

# The working tree, minus ignored files, deleted files and any env file.
/usr/bin/python3 - "$ROOT" "$TMP/tree.tgz" <<'PY'
import os, subprocess, sys, tarfile
root, target = sys.argv[1], sys.argv[2]
listed = subprocess.run(['git', '-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                        check=True, capture_output=True).stdout.split(b'\0')
with tarfile.open(target, 'w:gz') as tar:
    for raw in listed:
        name = raw.decode()
        base = os.path.basename(name)
        if not name or (base.startswith('.env') and base != '.env.example'):
            continue
        path = os.path.join(root, name)
        if os.path.isfile(path) and not os.path.islink(path):
            tar.add(path, arcname=name, recursive=False)
PY

echo "proof-video: building the image (the first time downloads about 2 GB and takes several minutes)"
"${COMPOSE[@]}" build --quiet video
echo "proof-video: recording into $OUT"
status=0
"${COMPOSE[@]}" run --rm -T \
  -v "$TMP/tree.tgz:/job/tree.tgz:ro" -v "$STORY_DIR:/story:ro" -v "$OUT:/out" \
  -e PV_GIT_SHA="$SHA" -e PV_GIT_BRANCH="$BRANCH" -e PV_GIT_DIRTY="$DIRTY" -e PV_PR="$PR" \
  -e PV_DATE="$(date +%Y-%m-%dT%H:%M:%S%z)" \
  video bash /opt/pv/run.sh "$STORY_FILE" || status=$?

if [ $status -eq 0 ]; then
  echo "proof-video: done"
  echo "  video:         $OUT/proof.mp4"
  echo "  contact sheet: $OUT/contact-sheet.png"
  echo "  checks:        $OUT/checks.txt"
else
  echo "proof-video: FAILED (exit $status). Work files kept in $OUT/.work" >&2
fi
exit $status
