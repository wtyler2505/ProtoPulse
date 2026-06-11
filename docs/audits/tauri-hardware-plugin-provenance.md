# Tauri Hardware Plugin Provenance Audit (Phase 9.1)

**Date:** 2026-05-10
**Scope:** All third-party hardware-related Tauri plugins ProtoPulse intends to depend on for the desktop migration, plus the bundled `arduino-cli` sidecar binary. Audit each entry for source, license, maintenance posture, platform support, permission model, and the fallback path if the dependency goes stale.

Per the runtime-topology ADR (Path C), hardware authority moves to native Rust commands + scoped sidecars in Phase 9. Before any new plugin lands in `Cargo.toml`, it MUST pass this audit. Failures here are a blocker, not a warning.

---

## tauri-plugin-serialplugin

| Field | Value |
|---|---|
| Source | https://github.com/s00d/tauri-plugin-serialplugin |
| Crate | https://crates.io/crates/tauri-plugin-serialplugin |
| Latest version (verified 2026-05-10) | 2.0.x (Tauri v2 line) |
| License | MIT |
| Author/maintainer | `s00d` — community plugin, NOT in the official `tauri-apps/plugins-workspace` workspace |
| Last commit | active (verify on each version bump — community plugin churn risk) |
| Platforms | macOS (IOKit), Windows (Windows API), Linux (libudev / /dev/tty*) |
| Native dep | Rust `serialport` crate (`https://crates.io/crates/serialport`) |
| Permission model | `serialplugin:default` capability with method-level allow rules (e.g., `serialplugin:allow-open`, `allow-write`, `allow-listen`) |
| Threat model | Direct hardware access. Per-command allowlist required. Browser fallback can use `navigator.serial` (Web Serial API). |
| Used by ProtoPulse | Arduino serial monitor, firmware upload progress streaming, future "live telemetry" features. |

**Risk:** third-party, single maintainer. If the project goes stale:
- **Short-term fallback:** stay on the last-good version, audit the source ourselves.
- **Medium-term fallback:** fork into `protopulse-fork/tauri-plugin-serialplugin` with our maintainer overhead.
- **Long-term replacement:** Tauri v2 has discussed an official serial plugin (`tauri-apps/plugins-workspace#serial`) — track that issue and migrate when an official version lands.

**Verification before adoption:**
- [ ] Audit current commit count / last commit date.
- [ ] Verify no known CVEs in `serialport` crate (`cargo audit`).
- [ ] Test no-device, mocked-device, real-device cases (Phase 9.2 follow-up acceptance ladder).
- [ ] Confirm Linux requires `libudev-dev` system dep — add to CI workflow.

---

## tauri-plugin-hid

| Field | Value |
|---|---|
| Source | https://crates.io/crates/tauri-plugin-hid |
| Repository | https://github.com/dzervas/tauri-plugin-hid (verify before adoption) |
| License | MIT (verify) |
| Author/maintainer | community plugin |
| Native dep | `hidapi-rs` (https://crates.io/crates/hidapi) |
| Platforms | macOS, Windows, Linux |
| Permission model | per-device VID/PID allowlist required |
| Used by ProtoPulse | future debug-probe support (CMSIS-DAP, J-Link if scoped); custom HID devices like Bus Pirate. |

**Risk:** smaller community than serialplugin; less mature.

**Audit status:** **NOT YET ADOPTED.** Defer until first concrete HID use case lands. When adopted:
- [ ] Re-audit current maintenance status.
- [ ] Verify `hidapi-rs` is on a current advisory-clean version.
- [ ] Test platform-specific UDEV rules (Linux requires udev rules for non-root HID access).

**Fallback:** WebUSB / WebHID on browser side (limited support). For desktop, if `tauri-plugin-hid` is unsuitable, write a small Rust command wrapping `hidapi-rs` directly — bypasses the plugin layer entirely.

---

## arduino-cli (sidecar binary, not a Tauri plugin)

| Field | Value |
|---|---|
| Source | https://github.com/arduino/arduino-cli |
| Releases | https://github.com/arduino/arduino-cli/releases |
| Latest version (verified 2026-05-10) | track latest stable on each release |
| License | Apache 2.0 (https://github.com/arduino/arduino-cli/blob/master/LICENSE.txt) |
| Maintainer | Arduino LLC — first-party, well-maintained |
| Platforms | macOS (Intel + ARM), Windows (x86_64), Linux (x86_64, arm64, armv7) |
| Native dep | none beyond stdlib + USB/serial access (gated by OS perms) |
| Distribution | downloaded as a static binary per platform; no system package manager needed |
| Used by ProtoPulse | sketch compilation, board management, firmware upload |

**Risk:** low — first-party Arduino tooling, stable release cadence, Apache 2.0 license. Acceptable for redistribution in a Tauri sidecar.

**Bundling strategy (Phase 9.2):**
- `scripts/tauri/prepare-arduino-sidecar.ts` downloads the appropriate binary per target triple at CI build time.
- Files land at `src-tauri/binaries/arduino-cli-<target-triple>(.exe)`.
- `tauri.conf.json` `bundle.externalBin = ["binaries/arduino-cli"]` (Tauri rewrites the path per target).
- From Rust: `app.shell().sidecar("arduino-cli").spawn()` with strict argument allowlist in `capabilities/default.json` (Phase 9.2 follow-up).

**Fallback:** If user has a system-installed `arduino-cli` on PATH, optionally prefer that (faster updates, user-chosen version). The bundled version is the default; system override is opt-in.

**Verification before each release:**
- [ ] arduino-cli version pinned in `prepare-arduino-sidecar.ts` matches the version tested.
- [ ] Bundled binary signed/notarized as part of the macOS notarization (Phase 7.2 — hardened-runtime entitlements for embedded executables).
- [ ] SHA256 of downloaded binary verified against the GitHub release's checksums file.

---

## Cross-cutting concerns

### macOS hardened-runtime entitlements

Embedded sidecars (arduino-cli, and any future binary sidecars) require `com.apple.security.cs.disable-library-validation` entitlement OR each embedded binary must itself be notarized. See `docs/release/tauri-signing-runbook.md` §2 macOS notarization gotchas.

### Linux udev rules

Both serial and HID access on Linux require udev rules for non-root use. ProtoPulse will ship a `99-protopulse-hardware.rules` file in the .deb postinst hook (Phase 9.2 follow-up).

### Phase 9.2 acceptance ladder (TODO in this audit)

Each hardware path must pass:
- [ ] No-device test (plug nothing in — graceful error)
- [ ] Mocked-device test (loopback / virtual serial)
- [ ] Real-device test (Arduino UNO at minimum)
- [ ] Unplug-during-operation test
- [ ] Busy-port test (another app holds the port)
- [ ] Large-output test (compile log > 10 KB)
- [ ] Cancellation test (abort mid-compile)
- [ ] Multiple-device test (two Arduinos at once)

This ladder is a Phase 9.2 deliverable, not Phase 9.1. Captured here so the audit doc references it.

---

## References

- Tauri sidecar bundling: https://v2.tauri.app/develop/sidecar/
- Tauri capability scope: https://v2.tauri.app/security/scope
- Plan-doc Phase 9: `docs/plans/2026-05-10-tauri-v2-desktop-migration.md`
- Topology ADR: `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`
