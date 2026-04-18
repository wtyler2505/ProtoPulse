/**
 * Supplier API Integration Layer — barrel.
 *
 * Client-side abstraction for real-time component pricing, stock, and lead times
 * from major electronic component distributors. Provides a unified interface with
 * caching, rate limiting, currency conversion, stock alerts, and mock/demo data.
 *
 * Actual API calls would go through a server proxy (not implemented here).
 * This layer defines the interface and provides realistic demo data for development.
 *
 * Usage:
 *   const api = SupplierApiManager.getInstance();
 *   const results = api.searchPart('ATmega328P');
 *   const quote = api.quoteBom([{ mpn: 'ATmega328P', quantity: 10 }]);
 *
 * React hook:
 *   const { searchPart, quoteBom, distributors } = useSupplierApi();
 */

export type {
  BomPricingResult,
  BomQuote,
  CachedSearch,
  Currency,
  DistributorId,
  DistributorOffer,
  PartSearchResult,
  PricingTier,
  SearchOptions,
  StockStatus,
  SupplierConfig,
} from './types';

export { SupplierApiManager } from './manager';
export { useSupplierApi } from './use-supplier-api';
