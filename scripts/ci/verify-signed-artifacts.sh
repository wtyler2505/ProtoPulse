#!/usr/bin/env bash
set -euo pipefail

dry_run=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      dry_run=1
      ;;
    *)
      echo "usage: $0 [--dry-run]" >&2
      exit 2
      ;;
  esac
done

bundle_root="${PP_TAURI_BUNDLE_ROOT:-src-tauri/target}"
if [[ ! -d "$bundle_root" ]]; then
  echo "[verify-signed-artifacts] no Tauri target dir at $bundle_root" >&2
  exit 1
fi

mapfile -t artifacts < <(
  find "$bundle_root" \
    -path '*/release/bundle/*' \
    -type f \
    \( -name '*.dmg' -o -name '*.app.tar.gz' -o -name '*.msi' -o -name '*-setup.exe' \) \
    | sort
)

if [[ "${#artifacts[@]}" -eq 0 ]]; then
  echo "[verify-signed-artifacts] no signable desktop artifacts found under $bundle_root" >&2
  exit 1
fi

printf '[verify-signed-artifacts] found %s signable artifact(s)\n' "${#artifacts[@]}"
printf '  %s\n' "${artifacts[@]}"

if [[ "$dry_run" -eq 1 ]]; then
  echo "[verify-signed-artifacts] dry run: signing is not active yet, so presence checks are enough"
  exit 0
fi

case "${RUNNER_OS:-$(uname -s)}" in
  macOS|Darwin)
    if ! command -v codesign >/dev/null 2>&1; then
      echo "[verify-signed-artifacts] codesign is unavailable on this runner" >&2
      exit 1
    fi
    for artifact in "${artifacts[@]}"; do
      case "$artifact" in
        *.dmg)
          codesign --verify --verbose "$artifact"
          ;;
      esac
    done
    ;;
  Windows|MINGW*|MSYS*|CYGWIN*)
    if ! command -v powershell >/dev/null 2>&1 && ! command -v pwsh >/dev/null 2>&1; then
      echo "[verify-signed-artifacts] PowerShell is unavailable on this runner" >&2
      exit 1
    fi
    ps_bin="$(command -v pwsh || command -v powershell)"
    for artifact in "${artifacts[@]}"; do
      case "$artifact" in
        *.msi|*-setup.exe)
          "$ps_bin" -NoProfile -Command \
            '$sig = Get-AuthenticodeSignature -LiteralPath $args[0]; if ($sig.Status -ne "Valid") { Write-Error "invalid signature: $($sig.Status)"; exit 1 }' \
            "$artifact"
          ;;
      esac
    done
    ;;
  *)
    echo "[verify-signed-artifacts] signing verification is only defined for macOS/Windows artifacts" >&2
    exit 1
    ;;
esac

echo "[verify-signed-artifacts] signatures verified"
