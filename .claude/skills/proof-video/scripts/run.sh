#!/bin/bash
# Inside the container: narration, app (if needed), recording, then mux, captions and checks.
#   run.sh <storyboard file name, inside /story>
set -euo pipefail
STORY="/story/$1"
WORK=/out/.work
rm -rf "$WORK" && mkdir -p "$WORK"
cp "$STORY" /out/storyboard.json

python3 /opt/pv/tts.py "$STORY" "$WORK"

if python3 -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1]))["needs_app"] else 1)' "$WORK/plan.json"; then
  mkdir -p /work && tar -xzf /job/tree.tgz -C /work
  found=$(cd /work && find . -maxdepth 3 -name '.env*' ! -name '.env.example' -print)
  if [ -n "$found" ]; then echo "refusing to run: env files in the copied tree: $found" >&2; exit 1; fi
  LOGS="$WORK" bash /opt/pv/serve-app.sh
fi

python3 -m http.server 4310 --bind 127.0.0.1 --directory /story >/dev/null 2>&1 &
sleep 0.5
node /opt/pv/record.mjs "$WORK/plan.json" "$WORK"
python3 /opt/pv/finish.py "$WORK" /out
