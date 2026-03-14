---
summary: Test strategies, mock patterns, and coverage approaches for ProtoPulse's 8800+ test suite
type: moc
---

# Testing Patterns

Patterns and gotchas learned from building and maintaining ProtoPulse's test infrastructure across Vitest, happy-dom, and Testing Library.

## Insights

### Mock Patterns
- [[proxy-based-mock-chains-intercept-then-causing-await-to-hang-so-drizzle-query-mocks-need-explicit-select-chain-stubs]] — Proxy .then interception hangs Drizzle mocks
- [[vitest-4-changed-vi-fn-generic-signature-from-two-type-params-to-one-function-type-param-breaking-typed-mock-factories]] — Vitest 4 broke vi.fn() generics
- [[web-serial-api-mocking-requires-double-cast-through-unknown-because-file-scoped-classes-cannot-be-imported-for-test-type-narrowing]] — Web Serial mocks need double-cast

### E2E Testing
- [[e2e-tests-use-playwright-setup-projects-to-share-auth-state-across-specs-via-localstorage-injection-rather-than-cookie-based-session-persistence]] — localStorage injection mirrors X-Session-Id auth pattern in Playwright E2E

### Shared Test Architecture
- [[shared-test-suites-use-domain-specific-factory-helpers-that-reconstruct-full-object-graphs-rather-than-partial-mocks-enforcing-integration-fidelity]] — shared tests use complete factory helpers instead of Partial<T> mocks, catching structural regressions
- [[design-variables-test-suite-validates-a-complete-expression-language-with-si-prefix-parsing-and-dependency-graph-resolution]] — 107 tests reveal VariableStore is a full expression language, not just a key-value store
- [[e2e-test-projects-accumulate-without-cleanup-because-playwright-setup-creates-but-never-deletes-test-data]] — E2E tests create persistent data without teardown, causing project picker pollution

### CI Pipeline
- [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check]] — CI dependency graph: lint/typecheck/test parallel, build gated behind typecheck
