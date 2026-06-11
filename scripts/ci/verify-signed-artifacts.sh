#!/usr/bin/env bash
#
# Phase 7.2 — verify signed artifacts.
#
# Dry-run mode (default until Tyler provides credentials per Q5+Q6 ratification):
# inspects the artifacts directory and reports which artifacts WOULD be verified
# under each platform's signing toolchain. No real signing checks run because
# the dev-preview workflow produces unsigned artifacts.
#
# Once Phase 7.1 secrets land, drop --dry-run from the workflow invocation
# and this script enforces signed-artifact expectations.
#
# Usage:
#     bash scripts/ci/verify-signed-artifacts.sh [--dry-run]
#
# Exit codes:
#     0  PASS (dry-run always exits 0)
#     1  signed mode and at least one artifact failed verification

set -uo pipefail

DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --dry-run|DRY_RUN=1) DRY_RUN=1 ;;
        --help|-h)
            sed -n '3,16p' "$0"
            exit 0
            ;;
    esac
done

cd "$(git rev-parse --show-toplevel)"
ARTIFACT_DIR="${ARTIFACT_DIR:-src-tauri/target}"
echo "[verify-signed-artifacts] mode: $([ $DRY_RUN -eq 1 ] && echo dry-run || echo enforcement)"
echo "[verify-signed-artifacts] scanning $ARTIFACT_DIR"

# Discover artifacts.
mapfile -t MSI < <(find "$ARTIFACT_DIR" -type f -name "*.msi" 2>/dev/null)
mapfile -t EXE < <(find "$ARTIFACT_DIR" -type f -name "*.exe" 2>/dev/null | grep -v "/build-script-" || true)
mapfile -t DMG < <(find "$ARTIFACT_DIR" -type f -name "*.dmg" 2>/dev/null)
mapfile -t APP < <(find "$ARTIFACT_DIR" -type d -name "*.app" 2>/dev/null)

echo "[verify-signed-artifacts] discovered:"
echo "  Windows MSI: ${#MSI[@]}"
echo "  Windows EXE: ${#EXE[@]}"
echo "  macOS DMG:   ${#DMG[@]}"
echo "  macOS .app:  ${#APP[@]}"

FAIL=0

# Windows Authenticode (signtool / Get-AuthenticodeSignature)
for f in "${MSI[@]}" "${EXE[@]}"; do
    echo
    echo "[verify-signed-artifacts] Windows: $f"
    if [ $DRY_RUN -eq 1 ]; then
        echo "  DRY-RUN: would call signtool verify /pa /v on \"$f\" (skipped — no signing secrets configured)"
    else
        if ! command -v signtool >/dev/null 2>&1; then
            echo "  FAIL: signtool not available on this runner" >&2
            FAIL=1
            continue
        fi
        if signtool verify /pa /v "$f"; then
            echo "  OK: Authenticode signature valid"
        else
            echo "  FAIL: signature invalid or absent" >&2
            FAIL=1
        fi
    fi
done

# macOS codesign + notarytool
for f in "${DMG[@]}" "${APP[@]}"; do
    echo
    echo "[verify-signed-artifacts] macOS: $f"
    if [ $DRY_RUN -eq 1 ]; then
        echo "  DRY-RUN: would call codesign --verify --deep --strict on \"$f\""
        echo "  DRY-RUN: would call xcrun notarytool history to confirm notarization"
        echo "  (skipped — Developer ID + notary credentials not configured)"
    else
        if ! command -v codesign >/dev/null 2>&1; then
            echo "  FAIL: codesign not available on this runner" >&2
            FAIL=1
            continue
        fi
        if codesign --verify --deep --strict "$f"; then
            echo "  OK: codesign passes"
        else
            echo "  FAIL: codesign rejected the artifact" >&2
            FAIL=1
        fi
        if command -v xcrun >/dev/null 2>&1; then
            if xcrun stapler validate "$f" 2>/dev/null; then
                echo "  OK: notarization staple valid"
            else
                echo "  WARN: no valid notarization staple (may be expected for ad-hoc/dev preview)"
            fi
        fi
    fi
done

echo
if [ $DRY_RUN -eq 1 ]; then
    echo "[verify-signed-artifacts] DRY-RUN COMPLETE. No real signing checks executed."
    echo "Per docs/release/tauri-signing-runbook.md, drop --dry-run after Q5/Q6 credentials land."
    exit 0
fi

if [ $FAIL -eq 0 ]; then
    echo "[verify-signed-artifacts] PASS"
    exit 0
else
    echo "[verify-signed-artifacts] FAIL" >&2
    exit 1
fi
