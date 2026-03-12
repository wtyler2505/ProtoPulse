# FE-10 Audit: Simulation + Analysis Logic

Date: 2026-03-06  
Auditor: Codex  
Section: FE-10 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Simulation engines:
  - `client/src/lib/simulation/circuit-solver.ts`
  - `client/src/lib/simulation/dc-analysis.ts`
  - `client/src/lib/simulation/ac-analysis.ts`
  - `client/src/lib/simulation/transient-analysis.ts`
  - `client/src/lib/simulation/frequency-analysis.ts`
  - `client/src/lib/simulation/monte-carlo.ts`
  - `client/src/lib/simulation/pdn-analysis.ts`
  - `client/src/lib/simulation/thermal-analysis.ts`
  - `client/src/lib/simulation/spice-netlist-parser.ts`
  - `client/src/lib/simulation/spice-generator.ts`
  - `client/src/lib/simulation/useSpiceModels.ts`
- Integration surfaces checked:
  - `client/src/components/circuit-editor/DCAnalysisPanel.tsx`
  - `client/src/components/simulation/SimulationPanel.tsx`
- Test surface reviewed:
  - `client/src/lib/simulation/__tests__/ac-analysis.test.ts`
  - `client/src/lib/simulation/__tests__/circuit-solver.test.ts`
  - `client/src/lib/simulation/__tests__/dc-analysis.test.ts`
  - `client/src/lib/simulation/__tests__/device-models.test.ts`
  - `client/src/lib/simulation/__tests__/monte-carlo.test.ts`
  - `client/src/lib/simulation/__tests__/spice-generator.test.ts`
  - `client/src/lib/simulation/__tests__/spice-netlist-parser.test.ts`
  - `client/src/lib/simulation/__tests__/transient-analysis.test.ts`
  - `client/src/lib/__tests__/pdn-analysis.test.ts`
  - `client/src/lib/__tests__/thermal-analysis.test.ts`

## Severity Key
- `P0`: can freeze app / major trust break now
- `P1`: high user-impact wrong behavior
- `P2`: medium reliability/perf risk
- `P3`: lower risk contract/debt issue

## Findings

### 1) `P0` `runTransientAnalysis` can stall for non-positive `tStep`
Evidence:
- `client/src/lib/simulation/transient-analysis.ts:549`
- `client/src/lib/simulation/transient-analysis.ts:617`
- `client/src/lib/simulation/transient-analysis.ts:696`
- `client/src/lib/simulation/transient-analysis.ts:701`

Local reproduction:
- Command: `timeout 8s npx -y tsx -e "... runTransientAnalysis(... tStep: 0) ..."; echo EXIT:$?`
- Output: `EXIT:124`

What is happening:
- There is no guard for `tStep <= 0`.
- Loop timing values (`hMin`, `hMax`, `h`) can become zero/negative and the main loop may not progress in time.

Why this matters:
- A bad input can hang the simulation path and freeze work.

Fix recommendation:
- Validate early: require `tStep > 0`, `tStop > tStart`, and finite numbers.
- Throw clear errors before entering the solve loop.

---

### 2) `P1` Basic DC solver silently skips inductors and VCVS stamps
Evidence:
- `client/src/lib/simulation/circuit-solver.ts:234`
- `client/src/lib/simulation/circuit-solver.ts:245`
- `client/src/lib/simulation/circuit-solver.ts:264`
- `client/src/lib/simulation/circuit-solver.ts:288`
- `client/src/lib/simulation/__tests__/circuit-solver.test.ts:229`
- `client/src/lib/simulation/__tests__/circuit-solver.test.ts:353`

Local reproduction:
- Command path: `solveDCOperatingPoint()` with `V1 -> L1 -> R1`.
- Output: `{"converged":true,"node1":5,"node2":0,"iL":null,"iR":0}`

What is happening:
- The DC solver only puts type `V` into `vsIndexMap`.
- `L` and `VCVS` lookup that map and get skipped if not found.

Why this matters:
- Results can look “converged” while being physically wrong.

Fix recommendation:
- Include `L` and `VCVS` in extra-row count/indexing for this solver, or route all DC work to `dc-analysis.ts` and deprecate this path.

---

### 3) `P1` Split-brain DC behavior between two UI paths
Evidence:
- `client/src/components/circuit-editor/DCAnalysisPanel.tsx:12`
- `client/src/components/circuit-editor/DCAnalysisPanel.tsx:58`
- `client/src/components/simulation/SimulationPanel.tsx:8`
- `client/src/components/simulation/SimulationPanel.tsx:487`
- `client/src/lib/simulation/spice-netlist-parser.ts:22`
- `client/src/lib/simulation/spice-netlist-parser.ts:1005`

Local reproduction (same circuit):
- Output: `{"dcAnalysisNode2":5,"spicePathNode2":0,"spiceConverged":true}`

What is happening:
- DC Analysis panel uses `dc-analysis.ts`.
- SPICE import path uses `circuit-solver.ts` DC op.
- Same input can produce different answers.

Why this matters:
- Users can get conflicting “truth” from the same app.

Fix recommendation:
- Pick one DC solver core for both flows.
- Add a parity test that runs both paths on the same circuits.

---

### 4) `P1` PDN sweep accepts bad settings and emits `NaN` frequencies
Evidence:
- `client/src/lib/simulation/pdn-analysis.ts:360`
- `client/src/lib/simulation/pdn-analysis.ts:473`
- `client/src/lib/simulation/pdn-analysis.ts:478`
- `client/src/lib/simulation/pdn-analysis.ts:481`
- `client/src/lib/simulation/pdn-analysis.ts:925`

Local reproductions:
- `analyze(1e6, 1e6, 100)` -> `{"len":1,"firstFreq":null,"critical":null,"risk":"critical"}`
- `analyze(1e3, 1e6, 0)` -> `{"len":1,"firstFreq":null,"lastFreq":null,"critical":null}`

What is happening:
- No validation for `start < end` and `pointsPerDecade > 0`.
- `totalPoints` can be `0`, then `i / totalPoints` yields `NaN`.

Why this matters:
- Summary output can contain bad numbers and false risk data.

Fix recommendation:
- Validate sweep inputs before generation.
- Return explicit error for invalid sweep config.

---

### 5) `P2` Basic transient solver accepts invalid timestep values
Evidence:
- `client/src/lib/simulation/circuit-solver.ts:364`
- `client/src/lib/simulation/circuit-solver.ts:374`
- `client/src/lib/simulation/circuit-solver.ts:378`

Local reproduction:
- Output: `{"zeroStep":{"points":10001,"first":0,"last":0.001,"converged":true},"negStep":{"points":0,"converged":true}}`

What is happening:
- `timeStep = 0` silently inflates to max-point behavior.
- Negative timestep returns empty output but still says converged.

Why this matters:
- Invalid user input is treated as success, which hides real setup errors.

Fix recommendation:
- Reject non-positive timestep and invalid time ranges with hard errors.

---

### 6) `P2` DC sweep with `stepValue = 0` silently expands to 10k points
Evidence:
- `client/src/lib/simulation/circuit-solver.ts:541`
- `client/src/lib/simulation/circuit-solver.ts:549`
- `client/src/lib/simulation/circuit-solver.ts:553`

Local reproduction:
- Output: `{"points":10000,"first":0,"last":10}`

What is happening:
- Division by `Math.abs(stepValue)` with zero results in Infinity behavior and then max-point clamp.

Why this matters:
- Unexpected heavy work and fake-success results for bad input.

Fix recommendation:
- Require `stepValue !== 0`.
- Also validate sign direction matches `start` -> `stop`.

---

### 7) `P2` SPICE value parsing is inconsistent across modules
Evidence:
- `client/src/lib/simulation/spice-generator.ts:127`
- `client/src/lib/simulation/spice-generator.ts:136`
- `client/src/lib/simulation/spice-generator.ts:149`
- `client/src/lib/simulation/spice-netlist-parser.ts:137`
- `client/src/lib/simulation/spice-netlist-parser.ts:153`
- `client/src/lib/simulation/spice-netlist-parser.ts:176`

Local reproductions:
- `{"input":"abc","generator":0,"parser":"NaN"}`
- `{"input":"10mil","generator":0.01,"parser":0.000254}`

What is happening:
- Generator parser falls back to `0` on invalid token.
- Netlist parser returns `NaN` and supports `MIL` correctly.
- Same text can map to different numeric values.

Why this matters:
- Import/export and UI paths can silently drift in numeric values.

Fix recommendation:
- Consolidate onto one shared parser.
- Make invalid parse fail loudly instead of coercing to `0`.

---

### 8) `P2` SPICE model query invalidation misses filtered query keys
Evidence:
- `client/src/lib/simulation/useSpiceModels.ts:44`
- `client/src/lib/simulation/useSpiceModels.ts:71`
- `client/src/lib/simulation/useSpiceModels.ts:88`

Local reproduction (`QueryClient`):
- Before invalidate: `["/api/spice-models?search=lm358"]` invalidated `false`
- After invalidate with `['/api/spice-models']`: filtered key still invalidated `false`

What is happening:
- Query key is full path including query string.
- Invalidation key does not match filtered keys.

Why this matters:
- User can create/seed model and still see stale filtered lists.

Fix recommendation:
- Use structured keys like `['spice-models', filters]`, then invalidate root `['spice-models']`.

---

### 9) `P3` `.TRAN tMax` is parsed but not used
Evidence:
- `client/src/lib/simulation/spice-netlist-parser.ts:594`
- `client/src/lib/simulation/spice-netlist-parser.ts:596`
- `client/src/lib/simulation/spice-netlist-parser.ts:1092`
- `client/src/lib/simulation/spice-netlist-parser.ts:1096`

What is happening:
- Parser stores `tMax`.
- Execution path ignores it and only passes `tStart/tStop/tStep`.

Why this matters:
- Netlist contract says one thing; runtime does another.

Fix recommendation:
- Either implement `tMax` handling or emit a clear warning that it is currently ignored.

## Test Coverage Assessment (this section)

What exists:
- FE-10 has broad unit test coverage across all major simulation engines.
- There are many correctness tests for DC/AC/transient/PDN/thermal.

Important gaps:
- No tests found for `runTransientAnalysis` with `tStep <= 0`.
- No tests found for `circuit-solver.solveTransient` with non-positive `timeStep`.
- No tests found for `solveDCSweep(... stepValue = 0)` behavior.
- No tests found for invalid PDN sweep params (`start >= end`, `pointsPerDecade <= 0`).
- No parity test between DC results from `dc-analysis.ts` vs `runParsedNetlist()` path.
- No tests for parser consistency between `spice-generator.ts` and `spice-netlist-parser.ts`.
- No tests for React Query invalidation coverage in `useSpiceModels.ts`.
- `.TRAN tMax` is parsed in tests, but no test asserts runtime usage.

Execution note:
- Per user direction, this pass is inspection-only and did not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) One simulation core contract
- Use one shared DC/transient contract layer for all panels/import paths.

### B) Centralized numeric parse package
- Put all SPICE/unit parsing in one module with strict mode + clear errors.

### C) Input validation wall at API boundaries
- Validate sweeps/timesteps once, then trust internals.

### D) Add “solver parity suite”
- Run identical fixtures through every user-facing simulation entry path and compare outputs.

### E) Structured query keys for model catalog
- Move to stable key tuples to make cache invalidation reliable.

## Decision Questions Before FE-11
1. Do we deprecate `circuit-solver.ts` DC path in favor of `dc-analysis.ts`, or fully repair both?
2. For invalid sim inputs, do we hard-fail with errors, or soft-fail with warnings + no result?
3. Should parser invalid values ever coerce to `0`, or always return explicit parse error?

## Suggested Fix Order (practical)
1. `P0`: add guardrails in `runTransientAnalysis` to prevent hang paths.
2. `P1`: fix/replace basic DC solver stamping for `L/VCVS`.
3. `P1`: unify DC engine used by SimulationPanel and DCAnalysisPanel.
4. `P1`: add PDN sweep input validation.
5. `P2`: enforce timestep/step validation in `circuit-solver` transient + DC sweep.
6. `P2`: unify SPICE value parsing and remove silent-zero fallback.
7. `P2`: move SPICE model queries to structured React Query keys.
8. `P3`: implement or explicitly warn on ignored `.TRAN tMax`.

## Bottom Line
FE-10 already has a lot of good simulation code and tests, but there are still hard edge-case failures where invalid inputs can hang or silently return wrong values. The biggest immediate risk is transient-step handling (`P0`) and solver inconsistency between user paths (`P1`). Fix those first, then clean up parser/cache contract drift for reliability.
