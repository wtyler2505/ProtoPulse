#!/usr/bin/env bash
#
# Supply-chain check + SBOM generation (Phase 5.2 / R4 retro Wave 7).
#
# Per Codex R6 land-plan-ratified (C8+C21): supply-chain failures are HARD
# blockers. cargo audit + npm audit + lockfile presence + CycloneDX SBOM
# generation must all succeed.
#
# Outputs:
#     artifacts/sbom/protopulse-rust.cdx.json  (cargo-cyclonedx)
#     artifacts/sbom/protopulse-npm.cdx.json   (cyclonedx-npm)
#
# Exit codes:
#     0  All gates passed.
#     1  Lockfile drift, audit advisory at high+ severity, or SBOM missing.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "==[supply-chain] Phase 5.2 + R4 retro Wave 7 =="
echo

# ── Lockfile discipline ──────────────────────────────────────────────────────
echo "[supply-chain] checking lockfile presence"
for lock in package-lock.json src-tauri/Cargo.lock; do
    if [[ -f "$lock" ]]; then
        echo "  ✓ $lock present"
    else
        echo "  ✗ $lock MISSING — lockfile discipline broken" >&2
        exit 1
    fi
done

# ── cargo audit (REQUIRED) ───────────────────────────────────────────────────
echo
echo "[supply-chain] cargo audit (RustSec advisory DB)"
if ! command -v cargo-audit >/dev/null 2>&1; then
    echo "ERROR: cargo-audit not installed. Run: cargo install --locked cargo-audit" >&2
    exit 1
fi
if cargo audit --file src-tauri/Cargo.lock; then
    echo "  ✓ cargo audit clean"
else
    echo "  ✗ cargo audit reported advisories — BLOCKING per R4 retro Wave 7" >&2
    exit 1
fi

# ── npm audit (REQUIRED, shipped surface only) ───────────────────────────────
echo
echo "[supply-chain] npm audit (--omit=dev --audit-level=high)"
if ! npm audit --omit=dev --audit-level=high 2>&1 | tee /tmp/npm-audit.log; then
    echo "  ✗ npm audit reported high/critical advisories — BLOCKING per R4 retro Wave 7" >&2
    exit 1
fi
echo "  ✓ npm audit clean (high+critical only)"

# ── CycloneDX SBOM generation (REQUIRED — R4 retro Wave 7) ───────────────────
echo
echo "[supply-chain] CycloneDX SBOM generation"
mkdir -p artifacts/sbom

# Rust SBOM via cargo-cyclonedx
if ! command -v cargo-cyclonedx >/dev/null 2>&1; then
    echo "ERROR: cargo-cyclonedx not installed. Run: cargo install --locked cargo-cyclonedx" >&2
    exit 1
fi
(cd src-tauri && cargo cyclonedx --format json) >/dev/null 2>&1 || {
    echo "ERROR: cargo-cyclonedx generation failed" >&2
    exit 1
}
# cargo-cyclonedx writes bom.json adjacent to Cargo.toml; copy to artifacts dir
if [[ -f src-tauri/bom.json ]]; then
    cp src-tauri/bom.json artifacts/sbom/protopulse-rust.cdx.json
    echo "  ✓ Rust SBOM: artifacts/sbom/protopulse-rust.cdx.json"
else
    echo "ERROR: cargo-cyclonedx did not produce bom.json" >&2
    exit 1
fi

# npm SBOM via @cyclonedx/cyclonedx-npm (uses npx; no install step needed)
if ! npx --yes @cyclonedx/cyclonedx-npm --output-file artifacts/sbom/protopulse-npm.cdx.json 2>/dev/null; then
    echo "ERROR: @cyclonedx/cyclonedx-npm generation failed" >&2
    exit 1
fi
echo "  ✓ npm SBOM: artifacts/sbom/protopulse-npm.cdx.json"

# ── Provenance / SLSA gates (R5 deferral) ────────────────────────────────────
echo
echo "[supply-chain] SLSA / provenance gates (R5 deferral)"
cat <<'GATE'
  R5 deferrals (separate wave with own ADR):
    - SLSA Level 2+ via GitHub artifact attestations
      (actions/attest-build-provenance)
    - npm provenance for first-party published packages
    - Signed artifact verification (Phase 7 — gated on Tyler-owned cert)
GATE

echo
echo "[supply-chain] ✓ ALL GATES PASSED"
exit 0
