/**
 * Supplier API — SupplierApiManager singleton.
 * Coordinates the concern-split modules (search, pricing, bom-quote, rate-limit,
 * stock-alerts, distributor-config, persistence) over 7 shared state fields.
 *
 * Each concern lives in its own file and takes this instance as its first
 * argument, reading / mutating state through the `_`-prefixed @internal fields.
 * The class itself is a thin delegator that preserves the external API shape
 * callers and tests depend on.
 */

import {
  DEFAULT_CACHE_EXPIRY_MS,
  DEFAULT_DISTRIBUTORS,
} from './config';
import {
  disableDistributor as disableDistributorFn,
  enableDistributor as enableDistributorFn,
  getDistributor as getDistributorFn,
  getDistributors as getDistributorsFn,
  isEnabled as isEnabledFn,
} from './distributor-config';
import { convertCurrency as convertCurrencyFn } from './helpers';
import { buildMockParts } from './mock-data';
import {
  exportConfig as exportConfigFn,
  importConfig as importConfigFn,
  load as loadFn,
  save as saveFn,
} from './persistence';
import { getBestPrice as getBestPriceFn, getPricingTiers as getPricingTiersFn } from './pricing';
import {
  getRemainingRequests as getRemainingRequestsFn,
  isRateLimited as isRateLimitedFn,
} from './rate-limit';
import { quoteBom as quoteBomFn } from './bom-quote';
import {
  searchByKeyword as searchByKeywordFn,
  searchPart as searchPartFn,
} from './search';
import {
  checkAlerts as checkAlertsFn,
  getStockAlerts as getStockAlertsFn,
  removeStockAlert as removeStockAlertFn,
  setStockAlert as setStockAlertFn,
} from './stock-alerts';
import type {
  BomQuote,
  CachedSearch,
  Currency,
  DistributorId,
  Listener,
  PartSearchResult,
  PricingTier,
  RateLimitState,
  SearchOptions,
  StockAlert,
  SupplierConfig,
} from './types';

/**
 * Manages supplier API interactions with caching, rate limiting, stock alerts,
 * and currency conversion. Singleton per application.
 * Notifies subscribers on state changes. Persists configuration to localStorage.
 */
export class SupplierApiManager {
  private static instance: SupplierApiManager | null = null;

  /** @internal Accessed by concern-split modules (rate-limit, search, pricing, etc.). Do not use externally. */
  _distributors: SupplierConfig[];
  /** @internal */ _mockParts: PartSearchResult[];
  /** @internal */ _cache: Map<string, CachedSearch>;
  /** @internal */ _cacheExpiryMs: number;
  /** @internal */ _rateLimits: Map<DistributorId, RateLimitState>;
  /** @internal */ _stockAlerts: StockAlert[];
  /** @internal */ _currentCurrency: Currency;
  private listeners = new Set<Listener>();

  constructor() {
    this._distributors = DEFAULT_DISTRIBUTORS.map((d) => ({ ...d }));
    this._mockParts = buildMockParts();
    this._cache = new Map();
    this._cacheExpiryMs = DEFAULT_CACHE_EXPIRY_MS;
    this._rateLimits = new Map();
    this._stockAlerts = [];
    this._currentCurrency = 'USD';
    this._load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): SupplierApiManager {
    if (!SupplierApiManager.instance) {
      SupplierApiManager.instance = new SupplierApiManager();
    }
    return SupplierApiManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    SupplierApiManager.instance = null;
  }

  // Subscription -----------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** @internal Fire all listeners. Called by concern-split helpers after mutations. */
  _notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // Distributor management -------------------------------------------------

  getDistributors(): SupplierConfig[] {
    return getDistributorsFn(this);
  }
  getDistributor(id: DistributorId): SupplierConfig | undefined {
    return getDistributorFn(this, id);
  }
  enableDistributor(id: DistributorId): void {
    enableDistributorFn(this, id);
  }
  disableDistributor(id: DistributorId): void {
    disableDistributorFn(this, id);
  }
  isEnabled(id: DistributorId): boolean {
    return isEnabledFn(this, id);
  }

  // Part search ------------------------------------------------------------

  searchPart(mpn: string, options?: SearchOptions): PartSearchResult[] {
    return searchPartFn(this, mpn, options);
  }
  searchByKeyword(keyword: string, options?: SearchOptions): PartSearchResult[] {
    return searchByKeywordFn(this, keyword, options);
  }

  // Pricing ----------------------------------------------------------------

  getBestPrice(
    mpn: string,
    quantity: number,
    options?: SearchOptions,
  ): { distributor: DistributorId; unitPrice: number; totalPrice: number } | null {
    return getBestPriceFn(this, mpn, quantity, options);
  }
  getPricingTiers(mpn: string, distributorId: DistributorId): PricingTier[] {
    return getPricingTiersFn(this, mpn, distributorId);
  }

  // BOM quoting ------------------------------------------------------------

  quoteBom(items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions): BomQuote {
    return quoteBomFn(this, items, options);
  }

  // Cache ------------------------------------------------------------------

  /** Get a cached search result if it exists and hasn't expired. */
  getCachedSearch(query: string): CachedSearch | null {
    const entry = this._cache.get(query);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(query);
      return null;
    }
    return { ...entry };
  }

  /** Set the cache expiry duration in milliseconds. */
  setCacheExpiry(ms: number): void {
    this._cacheExpiryMs = ms;
    this._save();
  }

  /** Clear all cached search results. */
  clearCache(): void {
    this._cache.clear();
  }

  /** Get the number of cached entries. */
  getCacheSize(): number {
    return this._cache.size;
  }

  // Rate limiting ----------------------------------------------------------

  getRemainingRequests(distributorId: DistributorId): number {
    return getRemainingRequestsFn(this, distributorId);
  }
  isRateLimited(distributorId: DistributorId): boolean {
    return isRateLimitedFn(this, distributorId);
  }

  // Stock alerts -----------------------------------------------------------

  setStockAlert(mpn: string, threshold: number): void {
    setStockAlertFn(this, mpn, threshold);
  }
  getStockAlerts(): Array<{ mpn: string; threshold: number }> {
    return getStockAlertsFn(this);
  }
  removeStockAlert(mpn: string): void {
    removeStockAlertFn(this, mpn);
  }
  checkAlerts(): Array<{ mpn: string; currentStock: number; threshold: number; triggered: boolean }> {
    return checkAlertsFn(this);
  }

  // Currency ---------------------------------------------------------------

  /** Set the active currency. */
  setCurrency(currency: Currency): void {
    if (this._currentCurrency !== currency) {
      this._currentCurrency = currency;
      this._save();
      this._notify();
    }
  }

  /** Get the active currency. */
  getCurrency(): Currency {
    return this._currentCurrency;
  }

  /** Convert an amount between currencies using hardcoded exchange rates. */
  convertCurrency(amount: number, from: Currency, to: Currency): number {
    return convertCurrencyFn(amount, from, to);
  }

  // Import / Export --------------------------------------------------------

  exportConfig(): string {
    return exportConfigFn(this);
  }
  importConfig(json: string): { imported: number; errors: string[] } {
    return importConfigFn(this, json);
  }

  // Clear / Reset ----------------------------------------------------------

  /** Clear all state and reset to defaults. */
  clear(): void {
    this._distributors = DEFAULT_DISTRIBUTORS.map((d) => ({ ...d }));
    this._cache.clear();
    this._cacheExpiryMs = DEFAULT_CACHE_EXPIRY_MS;
    this._rateLimits.clear();
    this._stockAlerts = [];
    this._currentCurrency = 'USD';
    this._save();
    this._notify();
  }

  // Persistence thin delegators -------------------------------------------

  /** @internal Persist manager state to localStorage. Called by concern-split helpers. */
  _save(): void {
    saveFn(this);
  }

  /** @internal Restore manager state from localStorage. Called from constructor. */
  _load(): void {
    loadFn(this);
  }
}
