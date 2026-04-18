/**
 * Supplier API — stock alerts.
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts.
 */

import type { SupplierApiManager } from './manager';
import type { StockAlert } from './types';

/** Set a stock alert — notify when stock drops below threshold. */
export function setStockAlert(mgr: SupplierApiManager, mpn: string, threshold: number): void {
  const existing = mgr._stockAlerts.find((a) => a.mpn === mpn);
  if (existing) {
    existing.threshold = threshold;
  } else {
    mgr._stockAlerts.push({ mpn, threshold });
  }
  mgr._save();
  mgr._notify();
}

/** Get all stock alerts (defensive copy). */
export function getStockAlerts(mgr: SupplierApiManager): Array<{ mpn: string; threshold: number }> {
  return mgr._stockAlerts.map((a) => ({ ...a }));
}

/** Remove a stock alert by MPN. */
export function removeStockAlert(mgr: SupplierApiManager, mpn: string): void {
  const initialLength = mgr._stockAlerts.length;
  mgr._stockAlerts = mgr._stockAlerts.filter((a: StockAlert) => a.mpn !== mpn);
  if (mgr._stockAlerts.length !== initialLength) {
    mgr._save();
    mgr._notify();
  }
}

/** Check all stock alerts against current mock data. Returns triggered alerts. */
export function checkAlerts(
  mgr: SupplierApiManager,
): Array<{ mpn: string; currentStock: number; threshold: number; triggered: boolean }> {
  return mgr._stockAlerts.map((alert) => {
    const results = mgr.searchPart(alert.mpn);
    let totalStock = 0;
    if (results.length > 0) {
      results[0].offers.forEach((offer) => {
        totalStock += offer.stock;
      });
    }

    return {
      mpn: alert.mpn,
      currentStock: totalStock,
      threshold: alert.threshold,
      triggered: totalStock < alert.threshold,
    };
  });
}
