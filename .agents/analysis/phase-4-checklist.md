# Phase 4 Checklist -- Technical Debt (TD-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

- [ ] TD-01: Refactor `ingressPart` in `server/parts-ingress.ts` to reduce CCN from 109. Extract validation and normalization logic. | Effort: M | Priority: P0
- [ ] TD-02: Refactor export generators (`odb-plus-plus-generator.ts`, `ipc2581-generator.ts`) to use configuration objects instead of massive parameter lists (22 params). | Effort: M | Priority: P1
- [ ] TD-03: Address the 1481 TODO/FIXME markers across the codebase. | Effort: L | Priority: P2
- [ ] EN-01: Establish a strict complexity ceiling (e.g., CCN < 15) in CI using `lizard`. | Effort: S | Priority: P2