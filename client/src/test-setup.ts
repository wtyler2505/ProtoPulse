import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Shared client test setup — DELIBERATELY minimal. Just React-tree cleanup.
 *
 * DO NOT add a global `fetch` stub or `vi.unstubAllGlobals()` here. A bulk
 * auto-commit (4d8ba875, 2026-05-09 "Vitest 4 migration") added both and
 * caused a ~40-file / 385-test regression:
 *
 *   beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => 404)));
 *   afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
 *
 *   - `vi.unstubAllGlobals()` is indiscriminate: it destroyed the per-file
 *     module-level `vi.stubGlobal('localStorage', {...closure store...})`
 *     that ~33 test files install ONCE at import. From the 2nd test onward
 *     those files reverted to happy-dom's native (worker-persistent)
 *     localStorage, so manager/engine singletons leaked state between tests.
 *   - The per-test `globalThis.fetch = vi.fn(404)` reassignment clobbered the
 *     module-level `vi.stubGlobal('fetch', mockFetch)` that files like
 *     SimulationControlPanel and useVaultQuickFetch install — their
 *     `mockFetch` recorded 0 calls and assertions failed.
 *
 * The pre-4d8ba875 baseline (this file) was green on happy-dom — which has
 * been the client environment since the first test-infra commit (834420d1);
 * jsdom was never used. Tests that need `fetch` mock it themselves at module
 * level; there is no global default fetch to depend on.
 */
afterEach(() => {
  cleanup();
});
