/**
 * Supplier API — React hook.
 * Split from supplier-api.ts.
 */

import { useCallback, useEffect, useState } from 'react';

import { SupplierApiManager } from './manager';
import type {
  BomQuote,
  Currency,
  DistributorId,
  PartSearchResult,
  SearchOptions,
  SupplierConfig,
} from './types';

/**
 * Hook for accessing the supplier API in React components.
 * Subscribes to the SupplierApiManager singleton and triggers re-renders on state changes.
 */
export function useSupplierApi(): {
  distributors: SupplierConfig[];
  searchPart: (mpn: string, options?: SearchOptions) => PartSearchResult[];
  searchByKeyword: (keyword: string, options?: SearchOptions) => PartSearchResult[];
  getBestPrice: (
    mpn: string,
    quantity: number,
    options?: SearchOptions,
  ) => { distributor: DistributorId; unitPrice: number; totalPrice: number } | null;
  quoteBom: (items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions) => BomQuote;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  stockAlerts: Array<{ mpn: string; threshold: number }>;
  setStockAlert: (mpn: string, threshold: number) => void;
  removeStockAlert: (mpn: string) => void;
  checkAlerts: () => Array<{ mpn: string; currentStock: number; threshold: number; triggered: boolean }>;
  cache: { size: number; clear: () => void };
  clearCache: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const api = SupplierApiManager.getInstance();
    const unsubscribe = api.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const searchPart = useCallback((mpn: string, options?: SearchOptions) => {
    return SupplierApiManager.getInstance().searchPart(mpn, options);
  }, []);

  const searchByKeyword = useCallback((keyword: string, options?: SearchOptions) => {
    return SupplierApiManager.getInstance().searchByKeyword(keyword, options);
  }, []);

  const getBestPrice = useCallback(
    (mpn: string, quantity: number, options?: SearchOptions) => {
      return SupplierApiManager.getInstance().getBestPrice(mpn, quantity, options);
    },
    [],
  );

  const quoteBom = useCallback(
    (items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions) => {
      return SupplierApiManager.getInstance().quoteBom(items, options);
    },
    [],
  );

  const setCurrency = useCallback((currency: Currency) => {
    SupplierApiManager.getInstance().setCurrency(currency);
  }, []);

  const setStockAlert = useCallback((mpn: string, threshold: number) => {
    SupplierApiManager.getInstance().setStockAlert(mpn, threshold);
  }, []);

  const removeStockAlert = useCallback((mpn: string) => {
    SupplierApiManager.getInstance().removeStockAlert(mpn);
  }, []);

  const checkAlerts = useCallback(() => {
    return SupplierApiManager.getInstance().checkAlerts();
  }, []);

  const clearCache = useCallback(() => {
    SupplierApiManager.getInstance().clearCache();
  }, []);

  const exportConfig = useCallback(() => {
    return SupplierApiManager.getInstance().exportConfig();
  }, []);

  const importConfig = useCallback((json: string) => {
    return SupplierApiManager.getInstance().importConfig(json);
  }, []);

  const api = typeof window !== 'undefined' ? SupplierApiManager.getInstance() : null;

  return {
    distributors: api?.getDistributors() ?? [],
    searchPart,
    searchByKeyword,
    getBestPrice,
    quoteBom,
    currency: api?.getCurrency() ?? 'USD',
    setCurrency,
    stockAlerts: api?.getStockAlerts() ?? [],
    setStockAlert,
    removeStockAlert,
    checkAlerts,
    cache: {
      size: api?.getCacheSize() ?? 0,
      clear: clearCache,
    },
    clearCache,
    exportConfig,
    importConfig,
  };
}
