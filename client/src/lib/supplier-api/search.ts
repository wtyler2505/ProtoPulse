/**
 * Supplier API — part search and result shaping.
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts.
 */

import { getEnabledDistributorIds } from './distributor-config';
import { getMinLeadTime, getMinPrice } from './helpers';
import type { SupplierApiManager } from './manager';
import { recordRequest } from './rate-limit';
import type { PartSearchResult, SearchOptions } from './types';

/** Apply filter/sort/limit post-processing to a result set. Pure. */
export function applySearchOptions(
  results: PartSearchResult[],
  options?: SearchOptions,
): PartSearchResult[] {
  let filtered = [...results];

  if (options?.distributors && options.distributors.length > 0) {
    const allowedDists = options.distributors;
    filtered = filtered.map((part) => ({
      ...part,
      offers: part.offers.filter((o) => allowedDists.includes(o.distributorId)),
    }));
    filtered = filtered.filter((p) => p.offers.length > 0);
  }

  if (options?.inStockOnly) {
    filtered = filtered.map((part) => ({
      ...part,
      offers: part.offers.filter((o) => o.stockStatus !== 'out-of-stock'),
    }));
    filtered = filtered.filter((p) => p.offers.length > 0);
  }

  if (options?.sortBy) {
    switch (options.sortBy) {
      case 'price':
        filtered.sort((a, b) => getMinPrice(a.offers) - getMinPrice(b.offers));
        break;
      case 'stock':
        filtered.sort((a, b) => {
          const aStock = a.offers.reduce((sum, o) => sum + o.stock, 0);
          const bStock = b.offers.reduce((sum, o) => sum + o.stock, 0);
          return bStock - aStock;
        });
        break;
      case 'leadTime':
        filtered.sort((a, b) => getMinLeadTime(a.offers) - getMinLeadTime(b.offers));
        break;
      case 'relevance':
      default:
        break;
    }
  }

  if (options?.maxResults !== undefined && options.maxResults > 0) {
    filtered = filtered.slice(0, options.maxResults);
  }

  return filtered;
}

/** Search for a part by manufacturer part number (MPN). */
export function searchPart(
  mgr: SupplierApiManager,
  mpn: string,
  options?: SearchOptions,
): PartSearchResult[] {
  if (!mpn.trim()) {
    return [];
  }

  const cacheKey = `mpn:${mpn.toLowerCase()}`;
  const cached = mgr.getCachedSearch(cacheKey);
  if (cached) {
    return applySearchOptions(cached.results, options);
  }

  const enabledDists = getEnabledDistributorIds(mgr, options?.distributors);
  enabledDists.forEach((distId) => {
    recordRequest(mgr, distId);
  });

  const mpnLower = mpn.toLowerCase();
  let results = mgr._mockParts.filter((p) => p.mpn.toLowerCase().includes(mpnLower));
  results = applySearchOptions(results, options);

  const now = Date.now();
  mgr._cache.set(cacheKey, {
    query: cacheKey,
    results,
    timestamp: now,
    expiresAt: now + mgr._cacheExpiryMs,
  });

  return results;
}

/** Search for parts by keyword (matches MPN, manufacturer, description, category). */
export function searchByKeyword(
  mgr: SupplierApiManager,
  keyword: string,
  options?: SearchOptions,
): PartSearchResult[] {
  if (!keyword.trim()) {
    return [];
  }

  const cacheKey = `kw:${keyword.toLowerCase()}`;
  const cached = mgr.getCachedSearch(cacheKey);
  if (cached) {
    return applySearchOptions(cached.results, options);
  }

  const enabledDists = getEnabledDistributorIds(mgr, options?.distributors);
  enabledDists.forEach((distId) => {
    recordRequest(mgr, distId);
  });

  const kwLower = keyword.toLowerCase();
  let results = mgr._mockParts.filter(
    (p) =>
      p.mpn.toLowerCase().includes(kwLower) ||
      p.manufacturer.toLowerCase().includes(kwLower) ||
      p.description.toLowerCase().includes(kwLower) ||
      p.category.toLowerCase().includes(kwLower),
  );
  results = applySearchOptions(results, options);

  const now = Date.now();
  mgr._cache.set(cacheKey, {
    query: cacheKey,
    results,
    timestamp: now,
    expiresAt: now + mgr._cacheExpiryMs,
  });

  return results;
}
