/**
 * Supplier API — distributor configuration queries and toggles.
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts.
 */

import type { SupplierApiManager } from './manager';
import type { DistributorId, SupplierConfig } from './types';

/** Get all distributor configurations (defensive copy). */
export function getDistributors(mgr: SupplierApiManager): SupplierConfig[] {
  return mgr._distributors.map((d) => ({ ...d }));
}

/** Get a single distributor configuration (defensive copy). */
export function getDistributor(mgr: SupplierApiManager, id: DistributorId): SupplierConfig | undefined {
  const d = mgr._distributors.find((dist) => dist.distributorId === id);
  return d ? { ...d } : undefined;
}

/** Enable a distributor. Persists and notifies on change. */
export function enableDistributor(mgr: SupplierApiManager, id: DistributorId): void {
  const d = mgr._distributors.find((dist) => dist.distributorId === id);
  if (d && !d.enabled) {
    d.enabled = true;
    mgr._save();
    mgr._notify();
  }
}

/** Disable a distributor. Persists and notifies on change. */
export function disableDistributor(mgr: SupplierApiManager, id: DistributorId): void {
  const d = mgr._distributors.find((dist) => dist.distributorId === id);
  if (d && d.enabled) {
    d.enabled = false;
    mgr._save();
    mgr._notify();
  }
}

/** Check if a distributor is enabled. */
export function isEnabled(mgr: SupplierApiManager, id: DistributorId): boolean {
  const d = mgr._distributors.find((dist) => dist.distributorId === id);
  return d?.enabled ?? false;
}

/** Resolve the set of enabled distributor IDs, optionally filtered by caller. */
export function getEnabledDistributorIds(mgr: SupplierApiManager, filter?: DistributorId[]): DistributorId[] {
  let dists = mgr._distributors.filter((d) => d.enabled);
  if (filter && filter.length > 0) {
    dists = dists.filter((d) => filter.includes(d.distributorId));
  }
  return dists.map((d) => d.distributorId);
}
