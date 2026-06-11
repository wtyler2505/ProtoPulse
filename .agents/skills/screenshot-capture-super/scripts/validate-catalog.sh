#!/usr/bin/env bash
set -euo pipefail

ROOT="docs/audit-screenshots"
SCOPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      SCOPE="${2:-}"
      shift 2
      ;;
    --root)
      ROOT="${2:-docs/audit-screenshots}"
      shift 2
      ;;
    *)
      ROOT="$1"
      shift
      ;;
  esac
done

if [[ ! -d "$ROOT" ]]; then
  echo "[validate] missing screenshot root: $ROOT"
  exit 1
fi

if [[ -n "$SCOPE" ]]; then
  latest="$(find "$ROOT" -maxdepth 1 -type d \( -name "*-${SCOPE}-catalog" -o -name "latest-${SCOPE}-catalog" \) -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)"
else
  latest="$(find "$ROOT" -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)"
fi
if [[ -z "$latest" ]]; then
  echo "[validate] no capture directories found under $ROOT"
  exit 1
fi

echo "[validate] latest=$latest"

missing=0
required=(MANIFEST.md CHECKLIST.md SUMMARY.json)
if [[ -f "$latest/SUMMARY.json" ]]; then
  kind="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(p.scope||''));" "$latest/SUMMARY.json")"
  if [[ "$kind" == "full-app" ]]; then
    required+=(MANIFEST.json CROSSWALK.md FAILURES.md)
  fi
fi

for f in "${required[@]}"; do
  if [[ -f "$latest/$f" ]]; then
    echo "[ok] $f present"
  else
    echo "[fail] $f missing"
    missing=1
  fi
done

if [[ -f "$latest/SUMMARY.json" ]]; then
  status="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(p.status||''));" "$latest/SUMMARY.json")"
  echo "[validate] summary.status=$status"
  if [[ "$status" != "ok" ]]; then
    echo "[fail] summary status is not ok"
    missing=1
  fi

  node - "$latest/SUMMARY.json" <<'NODE' || missing=1
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (summary.scope !== 'full-app') process.exit(0);
const failures = [];
if (!summary.totals || Number(summary.totals.captured || 0) <= 0) {
  failures.push('no captured screenshots recorded');
}
const missingViews = summary.requiredCoverage?.missingRequiredViews || [];
if (missingViews.length > 0) {
  failures.push(`missing required views: ${missingViews.join(', ')}`);
}
if (failures.length > 0) {
  for (const failure of failures) console.error(`[fail] ${failure}`);
  process.exit(1);
}
console.log(`[ok] full-app captured=${summary.totals.captured} skipped=${summary.totals.skipped || 0} failed=${summary.totals.failed || 0}`);
NODE
fi

if [[ $missing -ne 0 ]]; then
  echo "[validate] failed"
  exit 1
fi

echo "[validate] passed"
