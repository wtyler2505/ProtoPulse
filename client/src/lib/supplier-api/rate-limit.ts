/**
 * Supplier API — rate limiting.
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts to keep per-concern files focused.
 */

import type { SupplierApiManager } from './manager';
import type { DistributorId, RateLimitState } from './types';

const WINDOW_MS = 60_000;

/** Remaining requests within the 1-minute window for a distributor. */
export function getRemainingRequests(mgr: SupplierApiManager, distributorId: DistributorId): number {
  const config = mgr._distributors.find((d) => d.distributorId === distributorId);
  if (!config) {
    return 0;
  }

  const state = mgr._rateLimits.get(distributorId);
  if (!state) {
    return config.rateLimit;
  }

  const windowStart = Date.now() - WINDOW_MS;
  const recentRequests = state.requests.filter((t) => t > windowStart);
  return Math.max(0, config.rateLimit - recentRequests.length);
}

/** True when a distributor has exhausted its rate-limit budget. */
export function isRateLimited(mgr: SupplierApiManager, distributorId: DistributorId): boolean {
  return getRemainingRequests(mgr, distributorId) <= 0;
}

/** Record an outbound request against a distributor's rate-limit counter. */
export function recordRequest(mgr: SupplierApiManager, distributorId: DistributorId): void {
  let state: RateLimitState | undefined = mgr._rateLimits.get(distributorId);
  if (!state) {
    state = { requests: [] };
    mgr._rateLimits.set(distributorId, state);
  }

  const now = Date.now();
  state.requests = state.requests.filter((t) => t > now - WINDOW_MS);
  state.requests.push(now);
}
