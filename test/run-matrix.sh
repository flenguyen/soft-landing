#!/usr/bin/env bash
# Run Soft Landing against several Claude Code versions with a scripted
# stand-in model, the way the desktop app and the phone app drive it.
# Needs: node/npm, python3. Uses no real model and no account.
#
# usage: test/run-matrix.sh [version ...]
#   default versions: 2.1.220 2.1.280 2.1.286 latest
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="${PLUGIN:-$ROOT/plugin}"
CACHE="${SOFT_LANDING_CC_CACHE:-$HOME/.cache/soft-landing-cc}"
OUT="${OUT:-$ROOT/test/runs/$(date +%Y%m%d-%H%M%S)}"
VERSIONS=("$@"); [ ${#VERSIONS[@]} -eq 0 ] && VERSIONS=(2.1.220 2.1.280 2.1.286 latest)
PORT=${PORT:-9400}
mkdir -p "$CACHE" "$OUT"

bin_for() {  # install a Claude Code version once, print its binary
  local v="$1" dir="$CACHE/$1"
  if [ ! -x "$dir/node_modules/.bin/claude" ]; then
    mkdir -p "$dir"
    (cd "$dir" && npm install --no-audit --no-fund --loglevel=error "@anthropic-ai/claude-code@$v" >/dev/null)
  fi
  echo "$dir/node_modules/.bin/claude"
}

run() {  # version scenario surface [extra args...]
  local v="$1" s="$2" surf="$3"; shift 3
  PORT=$((PORT + 1))
  python3 -I "$ROOT/test/harness/drive.py" "$s" --claude "$(bin_for "$v")" --plugin "$PLUGIN" \
    --out "$OUT/$v/$s-$surf" --port "$PORT" --surface "$surf" --seconds 15 "$@" \
    | tail -1 | python3 -I -c "import json,sys; d=json.load(sys.stdin); d['version']='$v'; print(json.dumps(d))"
}

for v in "${VERSIONS[@]}"; do
  echo "== $v ($("$(bin_for "$v")" --version 2>/dev/null | head -1))" >&2
  run "$v" idle none
  run "$v" idle desktop
  run "$v" midturn desktop
  run "$v" band desktop
  run "$v" band mobile
  run "$v" breath desktop --command /land
done | tee "$OUT/summary.jsonl" | python3 -I "$ROOT/test/summarize.py"
echo "Full logs: $OUT" >&2
