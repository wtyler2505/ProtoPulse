/**
 * createTestQueryClient — canonical React Query client factory for Vitest suites.
 *
 * Extracted 2026-04-22 after BL-0862 — 4 test files had grown 3 different inline
 * QueryClient configurations. Use this instead of inventing new shapes.
 *
 * Defaults:
 *   - `retry: false` — tests should never hide transient errors behind retry loops
 *   - `gcTime: 0` — inactive queries are garbage-collected immediately, preventing
 *     state bleed between tests
 *
 * Mutations get the same `retry: false` treatment.
 *
 * Usage:
 * ```ts
 * import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
 * import { QueryClientProvider } from '@tanstack/react-query';
 *
 * const qc = createTestQueryClient();
 * render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
 * ```
 *
 * If a specific test truly needs a different default (e.g. verifying retry
 * behavior), pass an override object. The returned `QueryClient` merges your
 * overrides onto the canonical base.
 */
import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

export function createTestQueryClient(overrides?: QueryClientConfig): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        ...overrides?.defaultOptions?.queries,
      },
      mutations: {
        retry: false,
        ...overrides?.defaultOptions?.mutations,
      },
    },
    ...(overrides?.queryCache ? { queryCache: overrides.queryCache } : {}),
    ...(overrides?.mutationCache ? { mutationCache: overrides.mutationCache } : {}),
  });
}
