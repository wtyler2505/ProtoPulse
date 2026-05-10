# ADR: Tauri Runtime Topology For Desktop Migration

**Status:** Proposed for Tyler ratification  
**Date:** 2026-05-10  
**Deciders:** Tyler, Claude Code, Codex  
**Related:** `docs/adr/0009-tauri-over-electron.md`, `docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md`

## Decision

Choose **Path C: hybrid runtime**. Keep the existing Express/TypeScript stack as the web/cloud compatibility surface and, only where still needed, as a non-privileged compatibility service. Move desktop-privileged authority to typed Rust/Tauri commands and official Tauri plugins: project file access, process execution, serial/HID, updater, lifecycle, window/menu events, and release-sensitive behavior route through `getDesktopAPI()` when `isTauri` is true.

This is not a rubber stamp of "ship the current sidecar." The current production shell is broken and must not be hardened by inertia: `src-tauri/src/lib.rs:224-237` tries to launch global `node` against `resource_dir/dist/index.cjs`, while the live repo currently has `dist/public/*` and no `dist/index.cjs`. If any desktop-only Express compatibility process survives Phase 3, it must be treated as a scoped sidecar with target triples, health checks, loopback auth, bounded logging, explicit shutdown, and signing/notarization tests.

## Justification

Path B, a full Rust-native backend rewrite, is architecturally clean but mis-sized for this migration: the Phase 1 storage/runtime audit counted a large Express surface, and this round re-counted `server/` at 336 TypeScript files, 78 route-ish modules, and 362 route/middleware registrations. That is a multi-month backend program before desktop users see basic value. Path A, Express-as-sidecar-first, is faster but bakes in a Node runtime, target-triple sidecar packaging, sidecar permission scopes, and embedded-binary signing complexity before the native authority contract exists. Tauri's sidecar docs require `bundle.externalBin` entries and target-triple suffixed binaries for each supported architecture, plus explicit shell permissions when launched from JavaScript ([Tauri sidecar docs](https://v2.tauri.app/develop/sidecar/); Round 2 source ID `00366b6b-d1cd-498e-ab9d-36d76373bc8c`).

Path C also matches the local scaffold drift. The React bridge file exists but is unwired (`rg "getDesktopAPI|isTauri|tauri-api" client/src` only finds `client/src/lib/tauri-api.ts`), so the first migration task is not "bundle more things"; it is to wire a real desktop API boundary and prove command parity. Tauri capabilities reinforce this order because registered app commands are allowed by default unless constrained via `AppManifest::commands` in `build.rs` ([Tauri capabilities docs](https://v2.tauri.app/security/capabilities/); Round 2 source IDs `1dbdd93a-85a5-466d-8210-f5e781e52b9a`, `31cd67b1-5ffe-403b-9c8a-6b1d630dd470`).

## Implications Per Phase

| Phase | Implication |
|---|---|
| Phase 3: Topology + storage | Treat Express as web/cloud compatibility by default. Classify each `/api/*` dependency as web-only, desktop-Rust replacement, or temporary local compatibility. Implement the 8-bucket storage migration around native FS/Store/Stronghold rather than server-first persistence. |
| Phase 4: Lifecycle | Project-open, file association, deep-link, single-instance, and window-state flows land in Rust/Tauri lifecycle code, not Express middleware. |
| Phase 5: CI + supply chain | CI must prove the selected runtime boots in packaged artifacts. If any sidecar remains, CI checks target-triple binaries, resource paths, health checks, and launch logs. |
| Phase 7: Signing + notarization | Embedded binaries are signing inputs. macOS notarization and Windows signing include sidecar artifacts only if Phase 3 proves they remain necessary. |
| Phase 8: Updater | Updater waits until the chosen runtime topology has reproducible artifacts, artifact names, signatures, and key custody. |
| Phase 9: Hardware | Serial/HID/Arduino CLI authority uses typed Rust commands and scoped sidecars; generic `spawn_process(command,args)` is not carried forward. |

## Reversibility

The reversible boundary is the `DesktopAPI` contract. Phase 1 should wire callers through `getDesktopAPI()` and add parity tests without deleting browser/web behavior. If Path C proves wrong, the team can pivot by replacing individual `DesktopAPI` methods:

- Toward Path A: implement a local Express sidecar behind the same `DesktopAPI` and `/api/*` adapter boundary, then add target-triple packaging and loopback auth.
- Toward Path B: replace compatibility calls with Rust commands/module ports while keeping frontend call sites stable.
- Toward web/cloud-only: disable local compatibility service and let web mode keep Express unchanged.

## Open Questions For Tyler Ratification

- Should desktop eventually support an **Express-less offline mode** for embedded/field devices, or is a hybrid local/web split acceptable long term?
- Is a temporary local Express compatibility sidecar acceptable for business logic that is expensive to port, if it has no privileged hardware/file/process authority?
- What project container should become the durable source of truth: single `.protopulse` file, project folder bundle, SQLite database, or a mixed project-folder layout?
- Which hardware paths are mandatory for the first desktop preview: serial monitor, Arduino CLI compile/upload, HID, or read-only project file workflows?
