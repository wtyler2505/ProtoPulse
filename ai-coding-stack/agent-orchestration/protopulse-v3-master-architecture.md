# ProtoPulse v3 Master Architecture (Workspace Mirror)

Date: 2026-05-17
Status: In-progress implementation with verified pillar slices and explicit partials.

## Unified Trust & Intelligence Shape

- **Canvas lane**: `tscircuit` is default; optional `tldraw` and `three` overlays are exposed as interactive bridge lanes in the adapter/bridge.
- **Trust lane**: `TrustBoundary<T>` (`Verified<T>` / `Unverified<T>`) is first-class in client models and pin-verification output.
- **Orchestration lane**: pin-verification run emits local swarm metadata (`drafter`, `auditor`, `judge`) plus engine details (`genkit`, `mcp`, openai-agents compatibility + runtime package detection), and can run a guarded direct `@openai/agents` Judge rationale path when key/package are available.
- **Relational lane**: schema viewer endpoint + panel + relation mini-map provide chart-style schema introspection.

## Pillar Mapping

1. Adversarial Verifier: implemented (`/api/circuits/:id/pin-verification/run`, history endpoint, UI badges, swarm trace).
2. Live-BOM Confidence Degradation: implemented (`isMock`, ESTIMATED badges, trust envelopes).
3. Design Decay Consequence Speed: implemented in triage ranking path (next-action surfacing).
4. JIT Component Skills: implemented route + command handling + acceptance/failure flow.
5. Tension Triage: implemented panel + ranked consequence-speed queue.
6. ChartDB Schema Viewer: implemented route + panel + relation mini-map.

## Known Partials (still tracked)

- `tldraw` and `three` are currently interactive bridge overlays, not full production library integrations.
- OpenAI Agents SDK execution is gated (`OPENAI_API_KEY` + package present); fallback orchestration remains deterministic when unavailable.

## Accepted Boundary (Current Checkpoint)

- The verifier swarm is **implemented as a local Genkit+MCP orchestration contract** with explicit staged roles and trust envelopes.
- `@openai/agents` is treated as a **compatibility target** for future execution-lane swaps, not a mandatory runtime dependency for this checkpoint.
- This boundary is acceptable for the current milestone because:
  1. Role separation (`drafter/auditor/judge`) is machine-readable and tested.
  2. Trust degradation is explicit (`Unverified<T>`, `isMock`, warning badges).
  3. UI exposes orchestration trace evidence, not hidden backend-only claims.
- Exit criteria to remove this boundary:
  1. Replace compatibility metadata with direct `@openai/agents` flow orchestration in verifier lane.
  2. Preserve existing response schema and trust envelope semantics during migration.

## Primary Evidence Files

- `server/circuit-routes/instances.ts`
- `server/routes/jit-skills.ts`
- `server/routes/schema-viewer.ts`
- `client/src/components/circuit-editor/TSCircuitCanvasAdapter.tsx`
- `client/src/components/circuit-editor/TensionTriagePanel.tsx`
- `client/src/components/views/SchemaViewerPanel.tsx`
- `client/src/lib/tscircuit-render-bridge.ts`
- `client/src/types/TrustBoundaries.ts`
