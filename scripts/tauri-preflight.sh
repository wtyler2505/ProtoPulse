#!/usr/bin/env bash

set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

RUST_TOOLCHAIN_FILE="src-tauri/rust-toolchain.toml"
RUST_TOOLCHAIN="${CARGO_TOOLCHAIN:-}"
if [[ -z "$RUST_TOOLCHAIN" && -f "$RUST_TOOLCHAIN_FILE" ]]; then
  RUST_TOOLCHAIN="$(awk -F'"' '/^channel[[:space:]]*=[[:space:]]*"/ {print $2; exit}' "$RUST_TOOLCHAIN_FILE")"
fi

if [[ -n "$RUST_TOOLCHAIN" && ! "$(command -v rustup)" ]]; then
  fail_gate "toolchain" "Rust toolchain override '$RUST_TOOLCHAIN' requires rustup, but rustup was not found." "Install rustup or unset CARGO_TOOLCHAIN."
fi

rustc_exec() {
  if [[ -n "$RUST_TOOLCHAIN" ]]; then
    rustup run "$RUST_TOOLCHAIN" rustc "$@"
  else
    rustc "$@"
  fi
}

cargo_exec() {
  if [[ -n "$RUST_TOOLCHAIN" ]]; then
    rustup run "$RUST_TOOLCHAIN" cargo "$@"
  else
    cargo "$@"
  fi
}

PASSED=()
WARNINGS=()
ARTIFACTS=()

add_pass() {
  PASSED+=("$1: $2")
}

add_warn() {
  WARNINGS+=("$1: $2")
}

print_report() {
  local status="$1"
  local failed_gate="${2:-}"
  local detail="${3:-}"
  local fix="${4:-}"

  printf '\n== ProtoPulse Tauri Preflight Report ==\n'
  printf 'status: %s\n' "$status"

  if [[ -n "$failed_gate" ]]; then
    printf 'failed_gate: %s\n' "$failed_gate"
    printf 'failure: %s\n' "$detail"
    printf 'fix: %s\n' "$fix"
  fi

  if ((${#PASSED[@]})); then
    printf '\npassed:\n'
    printf '  - %s\n' "${PASSED[@]}"
  fi

  if ((${#WARNINGS[@]})); then
    printf '\nwarnings:\n'
    printf '  - %s\n' "${WARNINGS[@]}"
  fi

  if ((${#ARTIFACTS[@]})); then
    printf '\nartifacts:\n'
    printf '  - %s\n' "${ARTIFACTS[@]}"
  fi

  printf '\ncache_exports_if_needed:\n'
  printf '  export npm_config_cache=/tmp/npm-cache-protopulse\n'
  printf '  export CARGO_HOME=/tmp/cargo-home-protopulse\n'
}

fail_gate() {
  print_report "failed" "$1" "$2" "$3"
  exit 1
}

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail_gate "toolchain" "Missing required command: $command_name" "$install_hint"
  fi
}

semver_ge() {
  local actual="$1"
  local minimum="$2"
  [[ "$(printf '%s\n%s\n' "$minimum" "$actual" | sort -V | head -n1)" == "$minimum" ]]
}

run_required() {
  local gate="$1"
  shift
  printf '\n[%s] %s\n' "$gate" "$*"
  "$@"
  local rc=$?
  if ((rc != 0)); then
    fail_gate "$gate" "Command failed with exit code $rc: $*" "Read the command output above, fix that gate, then rerun scripts/tauri-preflight.sh."
  fi
  add_pass "$gate" "$*"
}

write_probe() {
  local gate="$1"
  local dir="$2"
  local hint="$3"

  if [[ -z "$dir" ]]; then
    fail_gate "$gate" "Resolved cache directory was empty." "$hint"
  fi

  if ! mkdir -p "$dir" 2>/tmp/protopulse-preflight-mkdir.err; then
    fail_gate "$gate" "Cannot create cache directory $dir: $(cat /tmp/protopulse-preflight-mkdir.err)" "$hint"
  fi

  local probe
  if ! probe="$(mktemp "$dir/protopulse-preflight.XXXXXX" 2>/tmp/protopulse-preflight-mktemp.err)"; then
    fail_gate "$gate" "Cannot write to cache directory $dir: $(cat /tmp/protopulse-preflight-mktemp.err)" "$hint"
  fi

  rm -f "$probe"
  add_pass "$gate" "Writable cache directory: $dir"
}

check_npm_exact() {
  local package_name="$1"
  local expected="$2"
  local output

  if ! output="$(npm view "${package_name}@${expected}" version 2>&1)"; then
    fail_gate "registry-npm" "Cannot resolve ${package_name}@${expected}: $output" "If the error is EROFS, export npm_config_cache=/tmp/npm-cache-protopulse and rerun."
  fi

  local actual
  actual="$(printf '%s\n' "$output" | tail -n1 | tr -d '[:space:]')"
  if [[ "$actual" != "$expected" ]]; then
    fail_gate "registry-npm" "Expected ${package_name}@${expected}, got '${actual}'." "Keep the plan-doc pin or update the plan before implementation."
  fi

  add_pass "registry-npm" "${package_name}@${expected}"
}

check_cargo_exact() {
  local crate_name="$1"
  local expected="$2"
  local output

  if ! output="$(cargo_exec search "$crate_name" --limit 20 2>&1)"; then
    fail_gate "registry-cargo" "Cannot search crates.io for $crate_name: $output" "If the error is cache/home writability, export CARGO_HOME=/tmp/cargo-home-protopulse and rerun."
  fi

  if ! grep -F "${crate_name} = \"${expected}\"" <<<"$output" >/dev/null; then
    fail_gate "registry-cargo" "Expected ${crate_name} = \"${expected}\" was not found in cargo search output." "Do not edit src-tauri until the exact plan-doc pin resolves or the plan is ratified with a new pin."
  fi

  add_pass "registry-cargo" "${crate_name}=${expected}"
}

check_cargo_resolvable() {
  local crate_name="$1"
  local output

  if ! output="$(cargo_exec search "$crate_name" --limit 20 2>&1)"; then
    fail_gate "registry-cargo" "Cannot search crates.io for $crate_name: $output" "If the error is cache/home writability, export CARGO_HOME=/tmp/cargo-home-protopulse and rerun."
  fi

  if ! grep -F "${crate_name} = " <<<"$output" >/dev/null; then
    fail_gate "registry-cargo" "Crate $crate_name was not found in cargo search output." "Verify the plugin name against canonical Tauri docs before implementation."
  fi

  add_pass "registry-cargo" "$crate_name is resolvable"
}

printf 'ProtoPulse Tauri preflight starting in %s\n' "$ROOT_DIR"

require_command node "Install Node.js before running Phase 1."
require_command npm "Install npm before running Phase 1."
require_command rustc "Install the Rust toolchain before running Phase 1."
require_command cargo "Install Cargo before running Phase 1."

node_version="$(node --version | sed 's/^v//')"
npm_version="$(npm --version)"
rustc_version="$(rustc_exec --version | awk '{print $2}')"
cargo_version="$(cargo_exec --version | awk '{print $2}')"

if ! semver_ge "$node_version" "20.0.0"; then
  fail_gate "toolchain" "Node.js $node_version is below the expected Node 20+ baseline for this Vite 7 / React 19 stack." "Install Node 20+ or ratify a different runtime baseline."
fi
add_pass "toolchain" "node $node_version"
add_pass "toolchain" "npm $npm_version"

if ! semver_ge "$rustc_version" "1.77.2"; then
  fail_gate "toolchain" "rustc $rustc_version is below Tauri plugin documentation's Rust 1.77.2 minimum." "Update Rust with rustup before running Phase 1."
fi
add_pass "toolchain" "rustc $rustc_version"
add_pass "toolchain" "cargo $cargo_version"
if [[ -n "$RUST_TOOLCHAIN" ]]; then
  add_pass "toolchain" "rustup toolchain override active: $RUST_TOOLCHAIN"
fi

if [[ -x "$ROOT_DIR/node_modules/.bin/tauri" ]]; then
  TAURI_BIN="$ROOT_DIR/node_modules/.bin/tauri"
elif command -v tauri >/dev/null 2>&1; then
  TAURI_BIN="$(command -v tauri)"
else
  fail_gate "toolchain" "Missing Tauri CLI." "Run npm install, or install @tauri-apps/cli for this workspace."
fi

tauri_version_output="$("$TAURI_BIN" --version 2>&1)"
tauri_version="$(grep -Eo '[0-9]+([.][0-9]+){1,2}' <<<"$tauri_version_output" | head -n1)"
if [[ -z "$tauri_version" || "${tauri_version%%.*}" != "2" ]]; then
  fail_gate "toolchain" "Tauri CLI is not v2: $tauri_version_output" "Install or select @tauri-apps/cli v2 before Phase 1."
fi
add_pass "toolchain" "tauri CLI $tauri_version via $TAURI_BIN"

npm_cache="$(npm config get cache 2>/tmp/protopulse-preflight-npm-cache.err || true)"
if [[ -z "$npm_cache" ]]; then
  fail_gate "npm-cache" "Could not resolve npm cache: $(cat /tmp/protopulse-preflight-npm-cache.err)" "export npm_config_cache=/tmp/npm-cache-protopulse"
fi
write_probe "npm-cache" "$npm_cache" "export npm_config_cache=/tmp/npm-cache-protopulse"

run_required "cargo-cache-probe" cargo_exec --list
cargo_home="${CARGO_HOME:-$HOME/.cargo}"
write_probe "cargo-cache" "$cargo_home" "export CARGO_HOME=/tmp/cargo-home-protopulse"

check_npm_exact "@tauri-apps/plugin-log" "2.8.0"
check_npm_exact "@tauri-apps/plugin-process" "2.3.1"
check_npm_exact "@tauri-apps/plugin-updater" "2.10.1"

check_cargo_exact "tauri-specta" "2.0.0-rc.25"
check_cargo_exact "specta" "2.0.0-rc.25"
check_cargo_exact "specta-typescript" "0.0.12"
check_cargo_exact "tauri-plugin-log" "2.8.0"
check_cargo_exact "tauri-plugin-process" "2.3.1"
check_cargo_exact "tauri-plugin-updater" "2.10.1"

for crate in \
  tauri-plugin-fs \
  tauri-plugin-dialog \
  tauri-plugin-shell \
  tauri-plugin-opener \
  tauri-plugin-stronghold \
  tauri-plugin-store \
  tauri-plugin-deep-link \
  tauri-plugin-single-instance \
  tauri-plugin-window-state; do
  check_cargo_resolvable "$crate"
done

run_required "typescript-check" npm run check
run_required "rust-check" cargo_exec check --manifest-path src-tauri/Cargo.toml
# Keep preflight bounded: smoke the Linux packaging path with a single bundle.
# Full matrix bundling belongs in CI/release workflows, not this local gate.
run_required "tauri-build-smoke" npm run tauri:build -- --debug --bundles deb

if [[ -x src-tauri/target/debug/protopulse ]]; then
  ARTIFACTS+=("src-tauri/target/debug/protopulse")
elif [[ -x src-tauri/target/debug/protopulse.exe ]]; then
  ARTIFACTS+=("src-tauri/target/debug/protopulse.exe")
else
  mapfile -t found_artifacts < <(find src-tauri/target/debug/bundle src-tauri/target/debug -maxdepth 4 -type f \( -name '*.AppImage' -o -name '*.deb' -o -name '*.dmg' -o -name '*.msi' -o -name '*.exe' \) 2>/dev/null | sort)
  if ((${#found_artifacts[@]})); then
    ARTIFACTS+=("${found_artifacts[0]}")
  else
    fail_gate "tauri-build-smoke" "Build completed but no executable artifact path was found under src-tauri/target/debug." "Inspect Tauri build output and update the artifact finder if the output path changed."
  fi
fi

if [[ -f dist/index.cjs ]]; then
  add_pass "desktop-artifact-report" "dist/index.cjs present"
else
  add_warn "desktop-artifact-report" "dist/index.cjs MISSING; this is the known Task 1.1 blocker."
fi

if node -e "const c=require('./src-tauri/tauri.conf.json'); process.exit(c.app && c.app.withGlobalTauri === false ? 0 : 1)"; then
  add_pass "tauri-config-report" "withGlobalTauri:false confirmed"
else
  fail_gate "tauri-config-report" "src-tauri/tauri.conf.json does not confirm app.withGlobalTauri:false." "Restore withGlobalTauri:false before Phase 1 continues."
fi

if node -e "const c=require('./src-tauri/tauri.conf.json'); process.exit(c.app && c.app.security && c.app.security.csp ? 0 : 1)"; then
  add_pass "tauri-config-report" "CSP present"
else
  fail_gate "tauri-config-report" "src-tauri/tauri.conf.json has no app.security.csp." "Add a CSP before Phase 1 continues."
fi

if grep -Eq "^[[:space:]]*base:[[:space:]]*['\"]\\./['\"]" vite.config.ts; then
  add_pass "vite-config-report" "vite.config.ts base:'./' present"
else
  add_warn "vite-config-report" "vite.config.ts base:'./' MISSING; this is the known packaged WebView asset-path risk."
fi

if ((${#WARNINGS[@]})); then
  print_report "warning"
  exit 2
fi

print_report "passed"
