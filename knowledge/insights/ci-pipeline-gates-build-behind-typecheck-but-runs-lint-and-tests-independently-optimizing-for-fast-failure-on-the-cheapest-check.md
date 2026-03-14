---
summary: The GitHub Actions CI runs lint, typecheck, and test as independent parallel jobs but gates build behind typecheck via needs dependency — fast feedback on cheap checks while ensuring build only runs on type-safe code
category: architecture
areas:
  - conventions
  - testing-patterns
---

# CI pipeline gates build behind typecheck but runs lint and tests independently, optimizing for fast failure on the cheapest check

The `.github/workflows/ci.yml` defines four jobs with a specific dependency structure:

```
lint ────────────→ (independent)
typecheck ───────→ build (needs: typecheck)
test ────────────→ (independent)
```

**Key design decisions:**

1. **Lint, typecheck, and test run in parallel** — no dependencies between them. A lint failure does not block test execution. This maximizes feedback speed: all three checks start simultaneously on PR open.

2. **Build depends ONLY on typecheck** — `needs: typecheck` means the build job waits for type safety but not for lint or test completion. The reasoning: if types are wrong, the build will fail anyway (esbuild will catch type-level errors). But lint issues or test failures don't prevent a successful build.

3. **Concurrency with cancel-in-progress** — `cancel-in-progress: true` on `group: ${{ github.workflow }}-${{ github.ref }}` means pushing a new commit to a PR branch cancels the previous CI run. This prevents resource waste on superseded commits.

4. **Test job injects dummy credentials** — The test job provides `DATABASE_URL`, `API_KEY_ENCRYPTION_KEY` (all zeros), and `NODE_ENV=test` as environment variables. Tests run without a real database (vitest mocks), but the env vars are needed because server modules import and validate them at module load time.

5. **Single browser, no E2E** — CI only runs unit/integration tests (`npm test`), not Playwright E2E. The [[e2e-tests-use-playwright-setup-projects-to-share-auth-state-across-specs-via-localstorage-injection-rather-than-cookie-based-session-persistence|Playwright config]] exists locally but is not wired into CI. This is a deliberate scope choice: E2E requires a running server and database, which adds CI complexity.

**Missing from CI:** No coverage threshold enforcement, no bundle size check, no Playwright E2E, no database migration verification. Each is a potential future addition but the current pipeline is intentionally minimal and fast. The [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle|proposed CI ownership gate]] would add a fifth job to this graph, catching IDOR vulnerabilities at PR time.

The CI pipeline mirrors the local [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff|hook system's Stop layer]] — both run full typecheck as a quality gate, but at different scopes. The hook system gates agent handoff; CI gates merge. Locally, the [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations|tsc --watch session]] provides instant feedback, while CI runs cold tsc (no watch) because CI jobs are ephemeral.

---

Related:
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — the local analog: Stop layer's `blocking-typecheck.sh` is CI's typecheck job for agent sessions
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — the dev-time optimization that CI cannot use (ephemeral jobs)
- [[e2e-tests-use-playwright-setup-projects-to-share-auth-state-across-specs-via-localstorage-injection-rather-than-cookie-based-session-persistence]] — E2E tests exist locally but are deliberately excluded from CI
- [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — proposed addition to this CI pipeline for security enforcement
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — the local preflight that ensures hooks work; CI's `npm ci` serves the same function for the pipeline
- [[the-build-script-uses-an-allowlist-inversion-to-bundle-frequently-imported-deps-while-externalizing-everything-else-reducing-cold-start-syscalls]] — the build job that runs after typecheck passes

Areas: [[conventions]], [[testing-patterns]]
