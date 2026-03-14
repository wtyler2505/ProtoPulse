---
summary: The GitHub Actions CI runs lint, typecheck, and test as independent parallel jobs but gates build behind typecheck via needs dependency — fast feedback on cheap checks while ensuring build only runs on type-safe code
category: architecture
areas:
  - conventions
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

5. **Single browser, no E2E** — CI only runs unit/integration tests (`npm test`), not Playwright E2E. The Playwright config exists locally but is not wired into CI. This is a deliberate scope choice: E2E requires a running server and database, which adds CI complexity.

**Missing from CI:** No coverage threshold enforcement, no bundle size check, no Playwright E2E, no database migration verification. Each is a potential future addition but the current pipeline is intentionally minimal and fast.

Areas: [[conventions]]
