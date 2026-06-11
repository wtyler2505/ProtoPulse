# Phase 4: Technical Debt & Architecture -- rest-express

> Generated: 2026-05-17

## Complexity Hotspots

| Function | File | CCN | NLOC | Params |
|----------|------|-----|------|--------|
| ingressPart | server/parts-ingress.ts | 109 | 135 | 2 |
| getStandardLayers | server/export/odb-plus-plus-generator.ts | 75 | 269 | 22 |
| mapPin | server/lib/semantic-pin-mapper.ts | 57 | 130 | 3 |
| (anonymous) > | server/component-ai.ts | 56 | 138 | 1 |
| extractPads | server/export/etchable-pcb-generator.ts | 44 | 110 | 4 |
| isArchView | server/ai.ts | 43 | 239 | 8 |
| indent | server/export/ipc2581-generator.ts | 38 | 201 | 10 |

## Code Smell Summary

| Smell | Count | Severity |
|-------|-------|----------|
| `any` type usage | High | Medium |
| Console statements | Med | Low |
| TODO/FIXME markers | 1481 | High |

## Test Health

| Metric | Value |
|--------|-------|
| Test:Source ratio | Needs Improvement |
| Coverage | Unknown |

## Architecture Gaps

**Performance:**
- Large backend functions parsing massive logic (e.g., `ingressPart` with CCN 109).

**Scalability:**
- `ProjectProvider` monolith identified in earlier phases blocks collaborative scaling.

## Ticking Time Bombs
- **Parts Ingress Pipeline:** The extreme complexity (CCN 109) of `ingressPart` makes importing real-world parts brittle and nearly impossible to test thoroughly.
- **Export Generators:** ODB++ and IPC2581 generators have high complexity and excessive parameters, risking silent manufacturing export failures.

## Raw Tool Outputs
```text
/home/wtyler/Projects/ProtoPulse/server/parts-ingress.ts:254: warning: ingressPart has 135 NLOC, 109 CCN, 964 token, 2 PARAM, 151 length, 0 ND
/home/wtyler/Projects/ProtoPulse/server/export/odb-plus-plus-generator.ts:98: warning: getStandardLayers has 269 NLOC, 75 CCN, 2600 token, 22 PARAM, 362 length, 0 ND
/home/wtyler/Projects/ProtoPulse/server/lib/semantic-pin-mapper.ts:121: warning: mapPin has 130 NLOC, 57 CCN, 945 token, 3 PARAM, 181 length, 0 ND
```