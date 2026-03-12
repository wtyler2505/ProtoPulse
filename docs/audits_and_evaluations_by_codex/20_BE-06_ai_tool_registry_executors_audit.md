# BE-06 Audit: AI Tool Registry + Executors

Date: 2026-03-06  
Auditor: Codex  
Section: BE-06 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Registry core and composition:
  - `server/ai-tools.ts`
  - `server/ai-tools/index.ts`
  - `server/ai-tools/types.ts`
  - `server/ai-tools/registry.ts`
- Tool modules:
  - `server/ai-tools/navigation.ts`
  - `server/ai-tools/architecture.ts`
  - `server/ai-tools/bom.ts`
  - `server/ai-tools/validation.ts`
  - `server/ai-tools/project.ts`
  - `server/ai-tools/circuit.ts`
  - `server/ai-tools/component.ts`
  - `server/ai-tools/export.ts`
  - `server/ai-tools/vision.ts`
- Execution call-sites:
  - `server/ai.ts`
  - `server/routes/agent.ts`
- Contract/supporting layers:
  - `server/storage/interfaces.ts`
  - `server/storage/circuit.ts`
  - `shared/schema.ts`
  - `client/src/components/panels/chat/hooks/useActionExecutor.ts`
  - `client/src/components/panels/chat/hooks/action-handlers/*.ts`
- Test surface reviewed:
  - `server/__tests__/ai-tools-architecture.test.ts`
  - `server/__tests__/ai-tools-bom.test.ts`
  - `server/__tests__/ai-tools-navigation.test.ts`
  - `server/__tests__/ai-tools-validation.test.ts`

## Registry Surface Snapshot (Current)
- Total registered tools: `84`.
- Client-dispatched tools (`clientAction(...)`): `52`.
- Server-side executors: `32`.
- Destructive tools (`requiresConfirmation: true`): `9`.
- Key observation: all tools are exposed to both Anthropic and Gemini tool declarations without endpoint-level filtering (`server/ai.ts:842`, `server/ai.ts:915`, `server/ai.ts:1246`, `server/routes/agent.ts:174`).

## Severity Key
- `P0`: immediate security/data exposure/integrity risk
- `P1`: high-impact reliability/security/contract risk
- `P2`: medium reliability/contract/test-confidence risk
- `P3`: lower-risk debt/cleanup

## Findings

### 1) `P0` Cross-project circuit mutation/read risk from ID-only tool executors
Evidence:
- Circuit tool executors trust caller/model-provided IDs directly:
  - `server/ai-tools/circuit.ts:112-128` (`place_component`)
  - `server/ai-tools/circuit.ts:150-156` (`remove_component_instance`)
  - `server/ai-tools/circuit.ts:183-190` (`draw_net`)
  - `server/ai-tools/circuit.ts:212-218` (`remove_net`)
  - `server/ai-tools/circuit.ts:350-359` (`place_breadboard_wire`)
  - `server/ai-tools/circuit.ts:381-387` (`remove_wire`)
  - `server/ai-tools/circuit.ts:413-422` (`draw_pcb_trace`)
- Storage contract and implementation are mostly ID-scoped (not project-scoped) for critical operations:
  - `server/storage/interfaces.ts:111-128`
  - `server/storage/circuit.ts:127-135`
  - `server/storage/circuit.ts:181-189`
  - `server/storage/circuit.ts:235-243`
- Schema does not enforce project alignment for instance and wire relationships:
  - `shared/schema.ts:307-310` (`circuit_instances.circuit_id` and `part_id` are independent refs)
  - `shared/schema.ts:353-357` (`circuit_wires.circuit_id` and `net_id` are independent refs)

What is happening:
- Tool executors can mutate/read circuit entities by raw IDs without verifying they belong to `toolContext.projectId`.

Why this matters:
- Enables cross-project data integrity corruption and potential data exposure if IDs are known/guessed.

Fix recommendation:
- Introduce project-scoped storage methods (e.g. `deleteCircuitNetForProject(projectId, netId)`).
- Add executor-side ownership checks before every ID-based circuit mutation/read.
- Add DB-level consistency constraints where possible (e.g. composite relationships for circuit/net pairing).

---

### 2) `P0` Export executors allow explicit `circuitId` override without project ownership check
Evidence:
- Export resolver accepts explicit `circuitId` and returns it directly:
  - `server/ai-tools/export.ts:347-356`
- Export tools then read circuit data by that resolved ID:
  - `server/ai-tools/export.ts:612-620` (`export_gerber`)
  - `server/ai-tools/export.ts:656-663` (`export_kicad_netlist`)
  - `server/ai-tools/export.ts:691-698` (`export_csv_netlist`)
  - `server/ai-tools/export.ts:727-736` (`export_pick_and_place`)
  - `server/ai-tools/export.ts:792-799` (`export_fritzing_project`)
- Underlying storage methods for circuit reads are ID/circuit scoped, not project-owner scoped:
  - `server/storage/interfaces.ts:110-128`
  - `server/storage/circuit.ts:86-90`
  - `server/storage/circuit.ts:140-144`
  - `server/storage/circuit.ts:194-198`

What is happening:
- A model/tool call can request exports for a circuit ID not guaranteed to belong to the active project.

Why this matters:
- High-risk cross-project read surface through export artifacts.

Fix recommendation:
- Resolve circuits by `(projectId, circuitId)` only.
- Reject explicit circuit IDs not belonging to active project context.

---

### 3) `P0` `requiresConfirmation` is metadata only; registry execution does not enforce it
Evidence:
- Registry execute path validates params and runs executor directly:
  - `server/ai-tools/registry.ts:133-140`
- Stream/agent orchestration executes tools directly through registry:
  - `server/ai.ts:1327`
  - `server/ai.ts:1445`
  - `server/ai.ts:1495`
  - `server/routes/agent.ts:239`
- `DESTRUCTIVE_TOOLS` is imported but unused in AI core:
  - `server/ai.ts:5`
- Multiple tools are explicitly marked confirmation-required:
  - `server/ai-tools/architecture.ts:125`
  - `server/ai-tools/architecture.ts:188`
  - `server/ai-tools/architecture.ts:197`
  - `server/ai-tools/bom.ts:107`
  - `server/ai-tools/validation.ts:80`
  - `server/ai-tools/component.ts:170`
  - `server/ai-tools/circuit.ts:149`
  - `server/ai-tools/circuit.ts:211`
  - `server/ai-tools/circuit.ts:380`

What is happening:
- The server executes tools regardless of confirmation flag; confirmation policy is not enforced at execution boundary.

Why this matters:
- Destructive paths can run without guaranteed user acknowledgment.

Fix recommendation:
- Add server-side confirmation gate in registry/AI loop.
- Require explicit confirmation token/state before executing `requiresConfirmation: true` tools.

---

### 4) `P1` Backend→frontend action contract mismatch causes silent no-op actions
Evidence:
- Backend emits client actions for tool results (`extractClientActions`):
  - `server/ai.ts:1137-1146`
  - `server/ai.ts:1540-1546`
- Frontend silently ignores unknown action types:
  - `client/src/components/panels/chat/hooks/useActionExecutor.ts:69-73`
- Handler registries are finite and explicit:
  - `client/src/components/panels/chat/hooks/action-handlers/architecture.ts:445-459`
  - `client/src/components/panels/chat/hooks/action-handlers/navigation.ts:78-88`
  - `client/src/components/panels/chat/hooks/action-handlers/bom.ts:202-212`
  - `client/src/components/panels/chat/hooks/action-handlers/validation.ts:242-251`
  - `client/src/components/panels/chat/hooks/action-handlers/export.ts:154-160`
  - `client/src/components/panels/chat/hooks/action-handlers/misc.ts:125-130`
- In this pass, backend `clientAction` names missing frontend handlers were:
  - `add_net_label`
  - `auto_route`
  - `copy_architecture_json`
  - `copy_architecture_summary`
  - `expand_architecture_to_circuit`
  - `focus_node_in_view`
  - `fork_library_component`
  - `place_no_connect`
  - `place_power_symbol`
  - `run_erc`
  - `search_datasheet`
  - `select_node`
  - `switch_schematic_sheet`
  - `validate_component`

What is happening:
- Some tool results are advertised as successful client actions but are never executed client-side.

Why this matters:
- UX trust issue and state drift: AI/user can believe actions completed when they were no-ops.

Fix recommendation:
- Add strict parity checks between backend client actions and frontend handlers.
- Fail loudly (toast/log/error state) when an action type is unhandled.
- Add CI test that diffs backend clientAction keys vs frontend handler keys.

---

### 5) `P1` Tool-result payload amplification risk (large exports sent back into model loops)
Evidence:
- Export tools package full file content in tool result:
  - `server/ai-tools/export.ts:64-79`
- Tool loops serialize full result JSON back as tool_result content:
  - `server/ai.ts:1332-1336`
  - `server/routes/agent.ts:249-253`

What is happening:
- Potentially large export payloads are fed back into the model/tool loop and SSE events.

Why this matters:
- Increased token/cost pressure, higher failure risk, potential latency spikes.

Fix recommendation:
- For large export outputs, return opaque file handles/IDs instead of inline full content in tool_result-to-model paths.
- Cap/truncate tool_result payloads sent back to model context.

---

### 6) `P1` Tool executor exceptions are not isolated per call
Evidence:
- Registry execute has no try/catch around executor:
  - `server/ai-tools/registry.ts:133-140`
- Call sites do not wrap each execution in local recovery:
  - `server/ai.ts:1323-1338`
  - `server/ai.ts:1441-1451`
  - `server/ai.ts:1491-1501`
  - `server/routes/agent.ts:229-254`
- Storage methods can throw typed errors:
  - `server/storage/circuit.ts:110-112`
  - `server/storage/circuit.ts:165-166`
  - `server/storage/circuit.ts:219-220`

What is happening:
- A thrown executor error can abort loop progress instead of producing a structured per-tool failure result.

Why this matters:
- Lower resilience and harder recovery in long multi-tool workflows.

Fix recommendation:
- Catch executor exceptions in `ToolRegistry.execute` and return standardized `{ success: false, message, code }`.
- Continue loop where safe after individual tool failures.

---

### 7) `P2` No endpoint/use-case tool allowlists (all 84 tools exposed broadly)
Evidence:
- Registry composes all modules into singleton:
  - `server/ai-tools/index.ts:31-47`
- Main AI and agent routes use full tool declarations:
  - `server/ai.ts:842`
  - `server/ai.ts:915`
  - `server/ai.ts:1246`
  - `server/routes/agent.ts:174`

What is happening:
- Every tool is available across major AI flows by default.

Why this matters:
- Wider blast radius, larger tool schema payloads, less predictable model behavior.

Fix recommendation:
- Introduce scoped tool bundles (e.g., chat-safe, agent-design, export-only) and use explicit allowlists per endpoint/task.

---

### 8) `P2` BE-06 test surface misses critical modules and parity checks
Evidence:
- Present AI tool tests cover only:
  - `server/__tests__/ai-tools-architecture.test.ts`
  - `server/__tests__/ai-tools-bom.test.ts`
  - `server/__tests__/ai-tools-navigation.test.ts`
  - `server/__tests__/ai-tools-validation.test.ts`
- No direct test files found for:
  - `server/ai-tools/circuit.ts`
  - `server/ai-tools/component.ts`
  - `server/ai-tools/project.ts`
  - `server/ai-tools/export.ts`
  - `server/ai-tools/vision.ts`
  - registry/index full-suite integration and backend↔frontend action parity

What is happening:
- Important high-risk tool executors (circuit/export/component) have no direct coverage in this surface.

Why this matters:
- Security/integrity regressions can pass unnoticed.

Fix recommendation:
- Add module-level tests for missing tool categories and parity tests for `clientAction` contract.

---

### 9) `P3` Metadata/comment drift in tool module documentation
Evidence:
- Architecture module header says “22 total” but current registrations are 20:
  - `server/ai-tools/architecture.ts:23`
- Export module header says “12 total” but current registrations are 11:
  - `server/ai-tools/export.ts:366`

What is happening:
- In-file registration counts are stale.

Why this matters:
- Low-risk, but it degrades trust in docs during audits/refactors.

Fix recommendation:
- Replace hardcoded counts with generated docs or enforce via lint/test assertion.

## What Is Already Good
- Tool registration enforces unique names at startup:
  - `server/ai-tools/registry.ts:43-47`
- Uniform Zod validation before execution:
  - `server/ai-tools/registry.ts:103-118`
- Provider format conversion for Anthropic/Gemini is centralized:
  - `server/ai-tools/registry.ts:157-201`
- Tool system is modular and clearly separated by domain:
  - `server/ai-tools/index.ts:33-42`

## Test Coverage Assessment (BE-06)
- Good:
  - Architecture/BOM/Navigation/Validation tool modules have direct validation/execution tests.
- Gaps:
  - No direct tests for circuit/component/project/export/vision executors.
  - No coverage for confirmation enforcement at execution boundary.
  - No automated backend↔frontend action-handler parity test.
  - No stress tests for large export tool_result payload behavior in stream loops.

## Improvements and Enhancements (Open-Minded)
1. Add a `ToolPolicy` layer:
   - per-route allowlist
   - per-tool permission requirements
   - confirmation handshake state machine
2. Add scoped storage APIs:
   - `getCircuitNetForProject(projectId, netId)`
   - `deleteCircuitWireForProject(projectId, wireId)`
   - `createCircuitWireChecked(projectId, circuitId, netId, ...)`
3. Introduce `clientAction` parity CI check:
   - fail build when backend action keys and frontend handlers diverge
4. Add payload strategy for export tools:
   - model sees only metadata/handle
   - client fetches file blob by handle
5. Add per-tool telemetry:
   - execution latency
   - payload size
   - failure taxonomy
   - confirmation pass/deny outcomes

## Decision Questions Before BE-07
1. Do we want to forbid model-supplied explicit `circuitId` in AI tools and always resolve from active project context?
2. Should destructive tools be blocked server-side until explicit user confirmation token is present?
3. Do we want to keep client-dispatched tool actions in the tool registry, or split into a separate client-action registry with strict parity tooling?
4. Should export tools return file handles instead of inline content in tool_result loops?

## Suggested Fix Order
1. Close `P0` first: project ownership/ID-scoping in circuit + export executors.
2. Enforce confirmation policy server-side for destructive tools.
3. Fix backend↔frontend client-action parity and fail loudly on unknown action types.
4. Add tool-result payload limits/handles to prevent token and latency blowups.
5. Expand tests for missing tool modules and parity checks.

## Bottom Line
BE-06 has a strong modular foundation, but the highest-risk gaps are around execution boundaries: ID scoping, confirmation enforcement, and backend↔frontend action contract integrity. Fixing those first will materially improve safety, reliability, and predictability of the AI tool system.
