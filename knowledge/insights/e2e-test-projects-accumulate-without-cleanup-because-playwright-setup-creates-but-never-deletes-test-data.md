---
summary: Playwright E2E tests create a new "E2E Test Project" on each run but never delete them, causing the project picker to accumulate dozens of identical entries that degrade the development UX and could mask real UI bugs
type: pattern
---

# E2E test projects accumulate without cleanup because Playwright setup creates but never deletes test data

The Playwright report snapshots (stored as YAML-formatted accessibility trees in `playwright-report/data/*.md`) reveal that the project picker page contains **11 identical "E2E Test Project" entries** alongside 2 real projects ("DevelopmentTest" and "Smart_Agro_Node_v1"). Each "E2E Test Project" button shows "5h ago" and "v1", indicating they were all created in the same test session.

This happens because:

1. **Playwright setup projects** create test data via API calls (as documented in the E2E insight about `localStorage` injection for auth state)
2. **No teardown/cleanup** step deletes the created projects after test completion
3. **Soft deletes** mean even if deletion were attempted, projects would still exist in the database with `deletedAt` set — but the project picker correctly filters these, so the issue is specifically about hard-created, never-deleted test entries
4. **Each test run** adds more entries, compounding over time

**Consequences:**

- The project picker becomes unusable during active development — real projects are buried under test entries
- **Pagination or search testing becomes unreliable** — the list length depends on how many times E2E tests have been run
- **Screenshot-based visual regression tests** will always show different numbers of projects, making snapshot comparisons meaningless
- The soft-delete infrastructure (which exists for projects) is unused by the test harness

**The fix pattern:** Either add a Playwright `globalTeardown` that deletes `E2E Test Project` entries, use a unique project name per test run (with timestamp), or use database transactions that roll back after each spec. The current approach of `e2e-tests-use-playwright-setup-projects-to-share-auth-state` handles authentication correctly but neglects data lifecycle.

---

Related:
- [[e2e-tests-use-playwright-setup-projects-to-share-auth-state-across-specs-via-localstorage-injection-rather-than-cookie-based-session-persistence]] — auth setup works correctly but data setup lacks corresponding teardown
- [[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — soft delete infrastructure exists but test cleanup doesn't use it
