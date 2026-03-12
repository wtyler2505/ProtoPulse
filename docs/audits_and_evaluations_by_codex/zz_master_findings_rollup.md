# ProtoPulse Master Findings Rollup (FE-01 through SH-02)

Date: 2026-03-06  
Auditor: Codex  
Status: Pass 1 complete (all section audits rolled up into one priority view)  
Method: Code + test-surface inspection only (no runtime execution)

## Coverage Summary
- Section audits included: `32`
  - Frontend: `14`
  - Backend: `16`
  - Shared core: `2`
- Total findings: `293`
  - `P0`: `25`
  - `P1`: `126`
  - `P2`: `117`
  - `P3`: `25`

### Severity by Domain
| Domain | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| FE | 5 | 56 | 56 | 16 | 133 |
| BE | 20 | 62 | 54 | 7 | 143 |
| SH | 0 | 8 | 7 | 2 | 17 |
| **All** | **25** | **126** | **117** | **25** | **293** |

## Executive Read
- Most `P0` risk is backend ownership/scope enforcement (IDOR/BOLA class) and collaboration/AI boundary gaps.
- Frontend `P0` risk is mostly auth/cache separation and unsafe local execution loops.
- Shared-core risk is mainly contract drift and standards/features that exist but are not actually wired into runtime paths.
- The app has a lot implemented, but many paths are still split between “real” and “simulated/placeholder” behavior. That creates trust risk.

## P0 Full List (Must-Fix Blockers)
1. React Query cache is not cleared on auth identity change (cross-account data exposure risk).  
Source: `07_FE-07_global_state_contexts_audit.md:52`
2. Auth/session cache boundary is still unsafe for account switching.  
Source: `08_FE-08_data_fetch_cache_audit.md:63`
3. `drc-scripting` sandbox can be escaped.  
Source: `09_FE-09_circuit_eda_logic_client_audit.md:54`
4. `drc-scripting` timeout is not enforceable against non-throwing infinite loops.  
Source: `09_FE-09_circuit_eda_logic_client_audit.md:80`
5. `runTransientAnalysis` can stall for non-positive `tStep`.  
Source: `10_FE-10_simulation_analysis_logic_audit.md:44`
6. Per-project authorization is not enforced across most `/api/projects/:id*` routes.  
Source: `17_BE-03_main_rest_route_surface_audit.md:40`
7. Multiple project-scoped child-resource routes ignore project scoping (IDOR class).  
Source: `17_BE-03_main_rest_route_surface_audit.md:71`
8. Circuit route surface has no project ownership enforcement.  
Source: `18_BE-04_circuit_route_surface_audit.md:54`
9. IDOR pattern across circuit/design child resources (path scope not enforced).  
Source: `18_BE-04_circuit_route_surface_audit.md:78`
10. AI endpoints trust caller-supplied project/circuit IDs without ownership enforcement.  
Source: `19_BE-05_ai_core_orchestration_audit.md:69`
11. Global request de-duplication can cross-collide across users/projects.  
Source: `19_BE-05_ai_core_orchestration_audit.md:105`
12. Prompt cache keying is coarse and not project/session scoped despite comments.  
Source: `19_BE-05_ai_core_orchestration_audit.md:125`
13. Cross-project circuit mutation/read risk from ID-only tool executors.  
Source: `20_BE-06_ai_tool_registry_executors_audit.md:54`
14. Export executors allow explicit `circuitId` override without project ownership check.  
Source: `20_BE-06_ai_tool_registry_executors_audit.md:86`
15. `requiresConfirmation` is metadata only; registry execution does not enforce it.  
Source: `20_BE-06_ai_tool_registry_executors_audit.md:114`
16. Project-scoped data is exposed through ID-only storage APIs (unsafe by default).  
Source: `21_BE-07_storage_layer_interface_integrity_audit.md:60`
17. Migration chain is materially out of sync with runtime schema contract.  
Source: `22_BE-08_database_shared_schema_contracts_audit.md:75`
18. KiCad/Eagle wire-to-net mapping can silently assign wrong nets.  
Source: `23_BE-09_export_pipeline_audit.md:85`
19. Netlist directive injection risk on ngspice execution path.  
Source: `24_BE-10_simulation_spice_backend_audit.md:81`
20. Queue routes are authenticated but not tenant-scoped (cross-user read/cancel/delete risk).  
Source: `25_BE-11_jobs_background_processing_audit.md:36`
21. WebSocket project authorization is missing (any valid session can join arbitrary project IDs).  
Source: `26_BE-12_collaboration_realtime_audit.md:50`
22. Locking is not project-scoped, causing cross-project lock collisions and lock-state leakage.  
Source: `26_BE-12_collaboration_realtime_audit.md:82`
23. Collaboration REST routes allow cross-project tampering and identity spoofing.  
Source: `26_BE-12_collaboration_realtime_audit.md:110`
24. Unhandled errors in WebSocket handshake path can trigger whole-process shutdown.  
Source: `26_BE-12_collaboration_realtime_audit.md:169`
25. Project-level ownership enforcement is not applied across most project-scoped routes (BOLA/IDOR risk).  
Source: `29_BE-15_security_hardening_audit.md:71`

## P1 Priority Queue (Cross-Section Workstreams)
This queue is ordered by risk reduction per unit effort, not by file order.

### WS-01: Lock down project/circuit ownership once, apply everywhere
- Add one shared ownership guard and apply it to main routes, circuit routes, AI routes, storage reads/writes, and job routes.
- Fixes clusters from: `17_BE-03`, `18_BE-04`, `19_BE-05`, `20_BE-06`, `21_BE-07`, `24_BE-10`, `25_BE-11`, `26_BE-12`, `29_BE-15`.

### WS-02: Fix auth/session/cache boundary contracts end-to-end
- Stop session clearing on transient network failure.
- Ensure all authenticated fetches use header flow consistently.
- Clear scoped query caches on identity switch.
- Fixes clusters from: `01_FE-01`, `06_FE-06`, `08_FE-08`, `14_FE-14`, `16_BE-02`.

### WS-03: Make collaboration either fully real or explicitly disabled
- Attach collaboration server to runtime or gate all collaboration UI/routes behind feature flags.
- Enforce owner/role checks and remove session token from URL query.
- Fixes clusters from: `12_FE-12`, `16_BE-02`, `26_BE-12`, `29_BE-15`.

### WS-04: Import/export contract hardening and parity
- Ensure import actually updates project state.
- Unify export payload contracts (`fzz`, Gerber, DRC gate, auth headers).
- Add archive bomb protection parity for FZZ and FZPZ.
- Fixes clusters from: `02_FE-02`, `11_FE-11`, `23_BE-09`, `18_BE-04`, `29_BE-15`.

### WS-05: AI tool execution safety controls
- Enforce `requiresConfirmation` server-side.
- Add per-endpoint tool allowlists.
- Scope dedupe/cache keys by user+project+session.
- Fixes clusters from: `06_FE-06`, `19_BE-05`, `20_BE-06`, `28_BE-14`.

### WS-06: Simulation and scripting runtime safety
- Bound simulation inputs/resources (`tStep`, matrix size, output limits).
- Block netlist directive injection.
- Replace unsafe local script execution model (or sandbox in worker with hard kill path).
- Fixes clusters from: `09_FE-09`, `10_FE-10`, `24_BE-10`.

### WS-07: Shared standards/data contract repair
- Make standard library fork payload always match full `PartViews`.
- Unify category taxonomy across shared data, UI filters, and storage queries.
- Convert seed logic to true DB upsert with uniqueness constraints.
- Fixes clusters from: `31_SH-01`, `32_SH-02`, `07_FE-07`, `22_BE-08`.

### WS-08: Middleware + error behavior correctness
- Correct API fallthrough/response status behavior.
- Ensure fatal handlers are attached early and exit codes are non-zero on fatal crash.
- Fix chat error HTTP behavior and route-level storage error mapping.
- Fixes clusters from: `15_BE-01`, `28_BE-14`.

### WS-09: Queue/runtime wiring and operational controls
- Wire job queue executors in production path.
- Add watchdog timeouts, admission control, and graceful shutdown hooks.
- Fixes clusters from: `25_BE-11`, `27_BE-13`.

### WS-10: Test reality hardening
- Route-level auth/ownership integration tests.
- Collaboration handshake/authorization tests.
- Export/import contract integration tests.
- Shared standards wiring tests.
- Fixes clusters from: `14_FE-14`, `30_BE-16`, `31_SH-01`, `32_SH-02`.

## Suggested Execution Waves
1. Wave 0 (`P0` security/correctness blockers): ownership guards, cache separation, scripting/simulation kill-path, collaboration auth/scope.
2. Wave 1 (`P1` contract stability): import/export parity, auth header consistency, seed upsert + schema alignment.
3. Wave 2 (runtime truthfulness): remove fake success paths, gate simulated flows, make status labels match real behavior.
4. Wave 3 (test enforcement): add route-level and integration tests for the exact risks found.
5. Wave 4 (quality/perf): tackle remaining `P2/P3` polish and architecture cleanup.

## Definition of Done for This Rollup Pass
- `zz_master_findings_rollup.md` created with complete `P0` list and prioritized cross-section `P1` queue.
- Counts reconciled from all 32 section audit files.
- Ready for next pass: convert WS-01 through WS-10 into concrete fix tickets.

## Next Pass Input (Recommended)
- Build `zz_master_fix_plan.md` with:
  - one task per blocker/workstream
  - explicit file list
  - acceptance criteria
  - test evidence required before close
