#!/usr/bin/env bash
# Zip the plugin for Customize → Plugins → Add → Upload plugin.
# Ships only the files git would publish from plugin/ (tracked, or new and not
# ignored), so generated types, tsconfig.json and stray files stay out. Tests
# are left out too.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/soft-landing" dist
git ls-files --cached --others --exclude-standard -- plugin | grep -v '\.test\.tsx\?$' | while read -r f; do
  [ -f "$f" ] || continue
  mkdir -p "$STAGE/soft-landing/$(dirname "${f#plugin/}")"
  cp "$f" "$STAGE/soft-landing/${f#plugin/}"
done
rm -f dist/soft-landing.zip
(cd "$STAGE" && zip -r -X -q "$ROOT/dist/soft-landing.zip" soft-landing)
echo "Wrote dist/soft-landing.zip"
