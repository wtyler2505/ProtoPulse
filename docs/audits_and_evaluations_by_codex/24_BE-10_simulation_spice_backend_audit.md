# BE-10 Audit: Simulation + SPICE Backend

Date: 2026-03-06  
Auditor: Codex  
Section: BE-10 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Simulation route/orchestration layer:
  - `server/circuit-routes/simulations.ts`
  - `server/circuit-routes/utils.ts`
  - `server/routes/utils.ts`
  - `server/index.ts`
- Simulation execution/parsing layer:
  - `server/simulation.ts`
  - `server/export/spice-exporter.ts`
- SPICE/IBIS model ingestion + API layer:
  - `server/spice-import.ts`
  - `server/routes/spice-models.ts`
- Storage + schema contracts:
  - `server/storage/circuit.ts`
  - `server/storage/misc.ts`
  - `server/storage/interfaces.ts`
  - `shared/schema.ts`
- Route registration context:
  - `server/circuit-routes/index.ts`
  - `server/routes.ts`
- Test surface reviewed:
  - `server/__tests__/spice-exporter.test.ts`
  - `server/__tests__/export-snapshot.test.ts`
  - `server/__tests__/metrics.test.ts`
  - `shared/__tests__/schema.test.ts`
  - plus BE-10-related test inventory in `server/__tests__/` + `shared/__tests__/`

## Simulation/SPICE Surface Snapshot (Current)
- Endpoints in `server/circuit-routes/simulations.ts`: `8`
- Endpoints in `server/routes/spice-models.ts`: `5`
- Exported functions in `server/simulation.ts`: `2`
- Exported functions in `server/spice-import.ts`: `5`
- Direct BE-10 module tests (simulation engine/routes/import parser): `0` found by reference search

## Severity Key
- `P0`: direct security or execution-boundary risk
- `P1`: high-impact reliability/safety/correctness gap
- `P2`: medium-risk correctness/perf/hardening gap
- `P3`: low-risk consistency cleanup

## Findings

### 1) `P1` Project/circuit/simulation scoping is inconsistent, enabling IDOR-style access paths
Evidence:
- `projectId` is parsed but unused in simulation route:
  - `server/circuit-routes/simulations.ts:32`
- Circuit lookup is by `circuitId` only:
  - `server/circuit-routes/simulations.ts:39`
- Simulation result read/delete are by `simId` only (no `circuitId`/`projectId` check):
  - `server/circuit-routes/simulations.ts:129-133`
  - `server/circuit-routes/simulations.ts:137-141`
- Storage methods are ID-only for these operations:
  - `server/storage/circuit.ts:259-267`
  - `server/storage/circuit.ts:281-289`
- Session auth exists globally, but BE-10 routes do not enforce owner checks:
  - auth attach point: `server/index.ts:191-215`
  - owner-check capability exists: `server/storage/projects.ts:53-61`

What is happening:
- Path structure suggests project-scoped isolation, but several BE-10 handlers trust raw IDs without confirming project ownership/belonging.

Why this matters:
- An authenticated user who can guess IDs may read/delete other circuits' simulation results or run analysis against non-owned circuits.

Fix recommendation:
- Add one shared guard: `assertCircuitAccess(projectId, circuitId, userId)` and call it in all BE-10 project-scoped handlers.
- Replace ID-only storage reads with scoped methods:
  - `getSimulationResultByCircuit(simId, circuitId)`
  - `deleteSimulationResultByCircuit(simId, circuitId)`
- Add route tests for cross-project rejection (403/404 behavior).

---

### 2) `P0` Netlist directive injection risk on ngspice execution path
Evidence:
- User-controlled values are interpolated directly into SPICE lines:
  - component values/spec fields: `server/export/spice-exporter.ts:201`, `:208`, `:215`, `:264`, `:268-269`, `:274`
  - DC sweep source name is interpolated raw into `.DC` card:
    - schema allows free string: `server/circuit-routes/simulations.ts:21`
    - netlist generation: `server/export/spice-exporter.ts:320`
- The generated netlist is executed by `ngspice` as a child process:
  - `server/simulation.ts:102`
  - entrypoint call flow: `server/circuit-routes/simulations.ts:62-67`

What is happening:
- BE-10 currently trusts SPICE tokens from request/config/component data without strict token sanitization or newline/control-card blocking.

Why this matters:
- This creates an execution-boundary risk: crafted project/request data can inject additional SPICE directives into the executed deck.
- Inference: depending on ngspice command availability/config, this can escalate to command execution or strong denial-of-service behavior.

Fix recommendation:
- Enforce strict allowlists for all SPICE identifiers/tokens (`^[A-Za-z0-9_:+.-]+$` style per field).
- Reject or escape newline/control characters in any field rendered into the netlist.
- Validate `dcSweep.sourceName` against existing voltage-source refs in the generated circuit model.
- Run ngspice in a hardened sandbox/container profile with filesystem/network restrictions.

---

### 3) `P1` Resource controls are incomplete for simulation compute/output volume
Evidence:
- `tran` parameters only require positivity, no upper bounds or relation checks:
  - `server/circuit-routes/simulations.ts:10-12`
- Route stores full trace payload in DB row with no hard max:
  - build/store payload: `server/circuit-routes/simulations.ts:70-88`
  - cleanup keeps count (`5`) but not bytes: `server/circuit-routes/simulations.ts:91`
  - cleanup implementation is count-only: `server/storage/circuit.ts:292-309`
- Simulation result schema stores unbounded `results` JSON:
  - `shared/schema.ts:382`
- Engine reads raw output fully into memory:
  - `server/simulation.ts:233`
- `stdout`/`stderr` are accumulated into unbounded strings:
  - `server/simulation.ts:98-119`
- Only netlist text length cap exists:
  - `server/simulation.ts:645`

What is happening:
- Input size, output trace size, parser memory, and persistence size are not governed by one coherent resource policy.

Why this matters:
- A single heavy simulation can consume memory/CPU/disk/DB space disproportionately, even if request payload is small.

Fix recommendation:
- Add simulation-level hard caps:
  - max effective points (`tran`, `ac`, `dc`)
  - max traces returned/stored
  - max raw parse bytes
  - max `stdout/stderr` captured bytes
- Enforce DB result size limit before insert (hard fail + user-facing message).
- Store large raw traces as bounded artifacts (or downsample) instead of full JSON blobs.

---

### 4) `P1` Fallback MNA solver can allocate unbounded dense matrices
Evidence:
- Fallback is used whenever ngspice is unavailable:
  - `server/simulation.ts:664-679`
- Matrix size is derived directly from parsed max node index:
  - `server/simulation.ts:549`
  - dense matrix allocation: `server/simulation.ts:551`
- Capability API advertises `maxNodes: 100` for fallback, but solver does not enforce this:
  - `server/simulation.ts:700-704`

What is happening:
- Runtime behavior does not enforce the declared fallback-node capability contract.

Why this matters:
- Matrix allocation scales roughly O(N^2) memory; large node counts can cause severe memory pressure/OOM.

Fix recommendation:
- Enforce hard node/source caps in `runMNASolver` before matrix allocation.
- Return structured `422`/`413` style error when exceeded.
- Consider sparse-matrix solving for fallback path if larger designs must be supported.

---

### 5) `P2` Validation contracts are loose/inconsistent across simulation endpoints
Evidence:
- `/export/spice` route uses casted body values without Zod schema:
  - `server/circuit-routes/simulations.ts:157`
  - `server/circuit-routes/simulations.ts:168-172`
- `simulateSchema` does not enforce analysis-specific required payload shape:
  - optional analysis blocks: `server/circuit-routes/simulations.ts:9-25`
- Exporter silently falls back to defaults when required config blocks are missing:
  - `server/export/spice-exporter.ts:303`, `:313`, `:319`

What is happening:
- Client request mistakes can pass through and become implicit defaults rather than explicit validation errors.

Why this matters:
- API behavior becomes harder to reason about, and user intent can diverge from actual executed simulation settings.

Fix recommendation:
- Use a discriminated union schema keyed by `analysisType`.
- Require and validate per-analysis parameters (including relation checks like start/stop/step consistency).
- Apply the same schema to `/simulate` and `/export/spice`.

---

### 6) `P2` SPICE model library write paths are broadly mutable and dedupe is weak
Evidence:
- Any authenticated caller can create/seed/import models:
  - create: `server/routes/spice-models.ts:45-55`
  - seed: `server/routes/spice-models.ts:59-64`
  - import: `server/routes/spice-models.ts:70-143`
- Table has indexes but no uniqueness guard on name/model identity:
  - `shared/schema.ts:475-477`
- Seed dedupe uses fuzzy search + `limit: 1` (not robust exact uniqueness):
  - `server/routes/spice-models.ts:401-403`

What is happening:
- Model library can be duplicated or polluted over time by repeated seed/import operations.

Why this matters:
- SPICE model selection quality degrades, and long-term data hygiene/operational trust drops.

Fix recommendation:
- Add role gate for seed/import (admin/owner policy).
- Add uniqueness strategy (for example `(name, modelType)` or hash fingerprint of directive).
- Make seed/import idempotent via upsert + transactional batching.

---

### 7) `P2` Payload-size policy is split across header checks and parser limits
Evidence:
- Route-level payload middleware checks `Content-Length` header only:
  - `server/routes/utils.ts:27-34`
- SPICE import advertises 5MB route limit:
  - `server/routes/spice-models.ts:72`
- Global body parser limits differ by content type:
  - raw 5MB: `server/index.ts:148`
  - text 2MB: `server/index.ts:149`
- Route docs claim `text/plain` import support:
  - `server/routes/spice-models.ts:69`

What is happening:
- Effective max size depends on content type + parser layer behavior, not only route contract.

Why this matters:
- Clients can get inconsistent limit behavior and confusing failure modes.

Fix recommendation:
- Align parser and route limits intentionally by content type.
- Prefer streaming byte-count enforcement over header-only checks.
- Document one canonical limit policy in API contracts.

---

### 8) `P2` BE-10 test surface is very thin at route/engine/parser boundaries
Evidence:
- Strong tests exist for exporter output formatting:
  - `server/__tests__/spice-exporter.test.ts:1-7`
  - snapshot coverage examples: `server/__tests__/export-snapshot.test.ts:566-575`
- Simulation route path normalization exists, but not route behavior tests:
  - `server/__tests__/metrics.test.ts:57-59`
- Shared schema test validates insert shape only:
  - `shared/__tests__/schema.test.ts:708-736`
- Reference search found no direct tests for:
  - `server/simulation.ts`
  - `server/spice-import.ts`
  - `server/circuit-routes/simulations.ts`
  - `server/routes/spice-models.ts`

What is happening:
- Most BE-10 risk sits in untested orchestration/execution code paths.

Why this matters:
- Security/regression issues at execution boundaries can ship without automated detection.

Fix recommendation:
- Add BE-10 integration test matrix:
  - simulation route auth/scoping checks
  - ngspice unavailable fallback behavior
  - transient/ac/dc parameter guardrails
  - import parser success/failure coverage (.lib/.mod/.ibs)
  - seed/import dedupe behavior

## What Is Already Good
- The BE-10 stack is modular:
  - execution (`simulation.ts`)
  - netlist generation (`export/spice-exporter.ts`)
  - import parsing (`spice-import.ts`)
  - route/API layer (`simulations.ts`, `spice-models.ts`)
- Fallback behavior exists when ngspice is missing (service degrades instead of hard crash):
  - `server/simulation.ts:664-679`
- Simulation result retention already exists (keep latest 5 by circuit):
  - route trigger: `server/circuit-routes/simulations.ts:91`
  - storage implementation: `server/storage/circuit.ts:292-309`
- SPICE importer has clear extension and size checks before parsing:
  - `server/spice-import.ts:533-568`

## Test Coverage Assessment (BE-10)
- Good:
  - SPICE exporter formatting and snapshot surfaces are covered.
  - Shared schema validation exists for simulation result insert shape.
- Gaps:
  - No direct tests for simulation engine internals (`ngspice` parse/fallback/resource boundaries).
  - No route-level simulation tests for scoping, authorization, and response contracts.
  - No direct tests for SPICE/IBIS import parser behavior or import route hardening paths.

## Improvements and Enhancements (Open-Minded)
1. Add `SimulationPreflight` service:
   - centralize scoping, param validation, and compute budget checks.
2. Add a SPICE token sanitizer layer:
   - normalize/validate all netlist-inserted tokens before render.
3. Add simulation profiles:
   - `quick`, `balanced`, `deep` with bounded points/time/trace limits.
4. Add result downsampling and persistence tiers:
   - summary in DB, full trace artifact only when explicitly requested.
5. Add model-library governance:
   - admin-gated seed/import + dedupe/upsert strategy + audit metadata.
6. Add BE-10 route integration tests:
   - especially for cross-project access rejection and heavy-input rejection.

## Decision Questions Before BE-11
1. Should simulation endpoints be strict-project-scoped (hard 403) or soft-obscured (404) on ownership mismatch?
2. Do we want to hard-block unsafe SPICE tokens now, even if it breaks some legacy model strings?
3. Should full traces be persisted by default, or only when users explicitly request "save full waveform"?
4. Should SPICE model seed/import be admin-only or project-owner-only?
5. Should fallback MNA support remain "small-op-only" with strict caps, or be expanded with sparse solving?

## Suggested Fix Order
1. Fix `P0`: add SPICE token sanitization and directive-injection guards before ngspice execution.
2. Fix `P1`: enforce project/circuit/simulation scoping checks on all BE-10 project-scoped routes.
3. Fix `P1`: add hard resource budgets (points/bytes/traces/stdout) and fallback node caps.
4. Fix `P2`: tighten analysis schemas and unify `/simulate` + `/export/spice` validation behavior.
5. Fix `P2`: harden SPICE model governance (role gate + uniqueness + idempotent seed/import).
6. Add route/engine/parser tests for BE-10 boundary behavior.

## Bottom Line
BE-10 has strong functional building blocks, but execution-boundary hardening is not yet where it needs to be. The highest-risk issue is unsanitized SPICE token flow into an executed ngspice process. After that, route scoping/ID integrity and compute-output resource budgets are the biggest stability and safety wins. Locking those down will make simulation much safer before moving to jobs/background processing in BE-11.
