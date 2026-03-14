---
summary: Every shared/__tests__/ file builds complete domain objects via per-test factory helpers (makeRect, makeTrace, makePartState, etc.) rather than using partial mocks, which catches structural regressions that Partial<T> mocks would silently hide
type: pattern
---

# Shared test suites use domain-specific factory helpers that reconstruct full object graphs

The 7 test files in `shared/__tests__/` reveal a consistent testing architecture that differs from the server test approach documented in the memory (where `Partial<T>` spread + `as T` assertion is the standard mock pattern):

**Pattern:** Each test file defines local factory functions that construct **complete, valid domain objects** with all required fields populated. No `Partial<T>`, no `as unknown as T` double-casts, no spreading over incomplete base objects.

Examples from the codebase:

- `drc-engine.test.ts`: `makeRect()`, `makePath()`, `makeCircle()`, `makeConnector()`, `makePartState()` — each constructs a fully valid instance with proper nested structure (e.g., `makePartState` builds a complete `PartState` with 3 views, meta, connectors array, and buses array)
- `pcb-drc.test.ts`: `makeTrace()`, `makeVia()`, `makePad()` — plus inline constant objects `BASIC_RULES` and `BOARD_OUTLINE` that represent complete rule sets
- `collaboration-crdt.test.ts`: Inline `CRDTOperation` object literals with all fields specified (op, path, key, value, timestamp, clientId)
- `design-variables.test.ts`: Direct API calls with real values — no mocking at all, just `evaluateExpression('10k * 2')` and `new VariableStore()`
- `schema.test.ts`: `safeParse()` calls with complete input objects, verifying both acceptance and rejection paths

**Why this matters:** The shared modules are consumed by both server and client, so their tests cannot assume any particular runtime mock infrastructure (no `vi.mock()` of storage, no request/response mocking). The factory helpers ensure that **type changes in the domain models immediately break the tests** — if `PartState` gains a required field, `makePartState()` must be updated or compilation fails. This is the opposite of the `Partial<T>` spread pattern where new required fields silently become `undefined`.

**The only exception is `nanoid`**: Both `drc-engine.test.ts` and `pcb-drc.test.ts` mock `nanoid` with a counter-based factory (`vi.mock('nanoid', () => ({ nanoid: (() => { let counter = 0; return () => 'test-id-' + counter++; })() }))`). This is because DRC violation IDs must be deterministic for assertion stability, but the violation output shape is what matters, not the ID values.

**The schema.test.ts inversion:** This file uniquely tests the **boundaries** rather than the happy paths — it systematically verifies that insert schemas strip server-generated fields (id, createdAt, timestamps) while rejecting missing required fields. Each `describe` block follows the pattern: valid accept, optional fields accept, invalid reject, strip server fields. This creates an executable contract that catches schema drift between Drizzle table definitions and Zod insert schemas.

---

Related:
- [[proxy-based-mock-chains-intercept-then-causing-await-to-hang-so-drizzle-query-mocks-need-explicit-select-chain-stubs]] — server tests use `Partial<T>` mocks, creating the pattern that shared tests avoid
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — schema.test.ts validates this contract at runtime
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — makePartState() must construct all 3 views, demonstrating the per-test cost of the triple-view architecture
