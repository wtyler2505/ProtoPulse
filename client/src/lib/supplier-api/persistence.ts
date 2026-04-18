/**
 * Supplier API — persistence (localStorage + JSON import/export).
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts.
 */

import { EXCHANGE_RATES, STORAGE_KEY } from './config';
import type { SupplierApiManager } from './manager';
import type { Currency, DistributorId, PersistedState, StockAlert } from './types';

/** Snapshot current manager state to localStorage. Silent on failure. */
export function save(mgr: SupplierApiManager): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    const state: PersistedState = {
      enabledDistributors: mgr._distributors.filter((d) => d.enabled).map((d) => d.distributorId),
      currency: mgr._currentCurrency,
      cacheExpiryMs: mgr._cacheExpiryMs,
      stockAlerts: mgr._stockAlerts.map((a) => ({ ...a })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or quota exceeded
  }
}

/** Restore manager state from localStorage. Silent on corrupt/missing data. */
export function load(mgr: SupplierApiManager): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }

    const data = parsed as Record<string, unknown>;

    if (Array.isArray(data.enabledDistributors)) {
      const enabledSet = new Set(data.enabledDistributors as string[]);
      mgr._distributors.forEach((d) => {
        d.enabled = enabledSet.has(d.distributorId);
      });
    }

    if (typeof data.currency === 'string' && data.currency in EXCHANGE_RATES) {
      mgr._currentCurrency = data.currency as Currency;
    }

    if (typeof data.cacheExpiryMs === 'number' && data.cacheExpiryMs > 0) {
      mgr._cacheExpiryMs = data.cacheExpiryMs;
    }

    if (Array.isArray(data.stockAlerts)) {
      mgr._stockAlerts = (data.stockAlerts as unknown[]).filter(
        (a): a is StockAlert =>
          typeof a === 'object' &&
          a !== null &&
          typeof (a as StockAlert).mpn === 'string' &&
          typeof (a as StockAlert).threshold === 'number',
      );
    }
  } catch {
    // Corrupt data — keep defaults
  }
}

/** Export configuration as a JSON string. */
export function exportConfig(mgr: SupplierApiManager): string {
  const state: PersistedState = {
    enabledDistributors: mgr._distributors.filter((d) => d.enabled).map((d) => d.distributorId),
    currency: mgr._currentCurrency,
    cacheExpiryMs: mgr._cacheExpiryMs,
    stockAlerts: mgr._stockAlerts.map((a) => ({ ...a })),
  };
  return JSON.stringify(state);
}

/** Import configuration from a JSON string. Persists and notifies. */
export function importConfig(
  mgr: SupplierApiManager,
  json: string,
): { imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { imported: 0, errors: ['Invalid JSON'] };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { imported: 0, errors: ['Config must be an object'] };
  }

  const data = parsed as Record<string, unknown>;

  if (Array.isArray(data.enabledDistributors)) {
    const validIds = mgr._distributors.map((d) => d.distributorId);
    mgr._distributors.forEach((d) => {
      d.enabled = false;
    });
    (data.enabledDistributors as unknown[]).forEach((id) => {
      if (typeof id === 'string' && validIds.includes(id as DistributorId)) {
        const dist = mgr._distributors.find((d) => d.distributorId === id);
        if (dist) {
          dist.enabled = true;
          imported++;
        }
      } else {
        errors.push(`Unknown distributor: ${String(id)}`);
      }
    });
  }

  if (typeof data.currency === 'string' && data.currency in EXCHANGE_RATES) {
    mgr._currentCurrency = data.currency as Currency;
    imported++;
  } else if (data.currency !== undefined) {
    errors.push(`Invalid currency: ${String(data.currency)}`);
  }

  if (typeof data.cacheExpiryMs === 'number' && data.cacheExpiryMs > 0) {
    mgr._cacheExpiryMs = data.cacheExpiryMs;
    imported++;
  } else if (data.cacheExpiryMs !== undefined) {
    errors.push(`Invalid cacheExpiryMs: ${String(data.cacheExpiryMs)}`);
  }

  if (Array.isArray(data.stockAlerts)) {
    const validAlerts: StockAlert[] = [];
    (data.stockAlerts as unknown[]).forEach((alert) => {
      if (
        typeof alert === 'object' &&
        alert !== null &&
        typeof (alert as StockAlert).mpn === 'string' &&
        typeof (alert as StockAlert).threshold === 'number'
      ) {
        validAlerts.push({
          mpn: (alert as StockAlert).mpn,
          threshold: (alert as StockAlert).threshold,
        });
        imported++;
      } else {
        errors.push(`Invalid stock alert: ${JSON.stringify(alert)}`);
      }
    });
    mgr._stockAlerts = validAlerts;
  }

  save(mgr);
  mgr._notify();
  return { imported, errors };
}
