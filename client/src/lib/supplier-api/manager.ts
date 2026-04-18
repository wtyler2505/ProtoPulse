/**
 * Supplier API — SupplierApiManager singleton.
 * Split from supplier-api.ts. Coordinates distributors, caching, rate limiting,
 * stock alerts, currency, and persistence.
 *
 * Cohesive state manager, intentionally not split further. All methods operate on
 * 8 shared private fields (distributors, mockParts, cache, cacheExpiryMs, rateLimits,
 * stockAlerts, currentCurrency, listeners). Further splitting would either leak
 * internal state across modules or lose `this`-typing on free functions — both
 * strictly worse than the single-file shape. No per-supplier adapter code exists
 * to extract (suppliers are data, not behavior, in this implementation).
 */

import {
  DEFAULT_CACHE_EXPIRY_MS,
  DEFAULT_DISTRIBUTORS,
  EXCHANGE_RATES,
  STORAGE_KEY,
} from './config';
import {
  convertCurrency as convertCurrencyFn,
  getMinLeadTime,
  getMinPrice,
  getPriceForQuantity,
} from './helpers';
import {
  disableDistributor as disableDistributorFn,
  enableDistributor as enableDistributorFn,
  getDistributor as getDistributorFn,
  getDistributors as getDistributorsFn,
  getEnabledDistributorIds as getEnabledDistributorIdsFn,
  isEnabled as isEnabledFn,
} from './distributor-config';
import { buildMockParts } from './mock-data';
import {
  getRemainingRequests as getRemainingRequestsFn,
  isRateLimited as isRateLimitedFn,
  recordRequest as recordRequestFn,
} from './rate-limit';
import {
  checkAlerts as checkAlertsFn,
  getStockAlerts as getStockAlertsFn,
  removeStockAlert as removeStockAlertFn,
  setStockAlert as setStockAlertFn,
} from './stock-alerts';
import type {
  BomPricingResult,
  BomQuote,
  CachedSearch,
  Currency,
  DistributorId,
  DistributorOffer,
  Listener,
  PartSearchResult,
  PersistedState,
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

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** @internal Exposed for concern-split helpers (stock-alerts, persistence, etc.). */
  _notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Distributor Management
  // -----------------------------------------------------------------------

  /** Get all distributor configurations. */
  getDistributors(): SupplierConfig[] {
    return getDistributorsFn(this);
  }

  /** Get a single distributor configuration. */
  getDistributor(id: DistributorId): SupplierConfig | undefined {
    return getDistributorFn(this, id);
  }

  /** Enable a distributor. */
  enableDistributor(id: DistributorId): void {
    enableDistributorFn(this, id);
  }

  /** Disable a distributor. */
  disableDistributor(id: DistributorId): void {
    disableDistributorFn(this, id);
  }

  /** Check if a distributor is enabled. */
  isEnabled(id: DistributorId): boolean {
    return isEnabledFn(this, id);
  }

  // -----------------------------------------------------------------------
  // Part Search
  // -----------------------------------------------------------------------

  /** Search for a part by manufacturer part number (MPN). */
  searchPart(mpn: string, options?: SearchOptions): PartSearchResult[] {
    if (!mpn.trim()) {
      return [];
    }

    // Check cache
    const cacheKey = `mpn:${mpn.toLowerCase()}`;
    const cached = this.getCachedSearch(cacheKey);
    if (cached) {
      return this.applySearchOptions(cached.results, options);
    }

    // Record rate limit hit for all enabled distributors
    const enabledDists = getEnabledDistributorIdsFn(this,options?.distributors);
    enabledDists.forEach((distId) => {
      recordRequestFn(this, distId);
    });

    const mpnLower = mpn.toLowerCase();
    let results = this._mockParts.filter((p) => p.mpn.toLowerCase().includes(mpnLower));
    results = this.applySearchOptions(results, options);

    // Cache the results
    const now = Date.now();
    this._cache.set(cacheKey, {
      query: cacheKey,
      results,
      timestamp: now,
      expiresAt: now + this._cacheExpiryMs,
    });

    return results;
  }

  /** Search for parts by keyword (matches MPN, manufacturer, description, category). */
  searchByKeyword(keyword: string, options?: SearchOptions): PartSearchResult[] {
    if (!keyword.trim()) {
      return [];
    }

    const cacheKey = `kw:${keyword.toLowerCase()}`;
    const cached = this.getCachedSearch(cacheKey);
    if (cached) {
      return this.applySearchOptions(cached.results, options);
    }

    const enabledDists = getEnabledDistributorIdsFn(this,options?.distributors);
    enabledDists.forEach((distId) => {
      recordRequestFn(this, distId);
    });

    const kwLower = keyword.toLowerCase();
    let results = this._mockParts.filter(
      (p) =>
        p.mpn.toLowerCase().includes(kwLower) ||
        p.manufacturer.toLowerCase().includes(kwLower) ||
        p.description.toLowerCase().includes(kwLower) ||
        p.category.toLowerCase().includes(kwLower),
    );
    results = this.applySearchOptions(results, options);

    const now = Date.now();
    this._cache.set(cacheKey, {
      query: cacheKey,
      results,
      timestamp: now,
      expiresAt: now + this._cacheExpiryMs,
    });

    return results;
  }

  // -----------------------------------------------------------------------
  // Pricing
  // -----------------------------------------------------------------------

  /** Get the best price for a part across enabled distributors. */
  getBestPrice(
    mpn: string,
    quantity: number,
    options?: SearchOptions,
  ): { distributor: DistributorId; unitPrice: number; totalPrice: number } | null {
    const results = this.searchPart(mpn, options);
    if (results.length === 0) {
      return null;
    }

    const part = results[0];
    let bestOffer: { distributor: DistributorId; unitPrice: number; totalPrice: number } | null = null;

    const enabledDists = getEnabledDistributorIdsFn(this,options?.distributors);

    part.offers.forEach((offer) => {
      if (!enabledDists.includes(offer.distributorId)) {
        return;
      }
      if (options?.inStockOnly && offer.stockStatus === 'out-of-stock') {
        return;
      }

      const tierPrice = getPriceForQuantity(offer.pricing, quantity);
      if (tierPrice === null) {
        return;
      }

      const convertedPrice = this.convertCurrency(tierPrice, 'USD', this._currentCurrency);
      const totalPrice = convertedPrice * quantity;

      if (!bestOffer || convertedPrice < bestOffer.unitPrice) {
        bestOffer = {
          distributor: offer.distributorId,
          unitPrice: convertedPrice,
          totalPrice,
        };
      }
    });

    return bestOffer;
  }

  /** Get pricing tiers for a part from a specific distributor. */
  getPricingTiers(mpn: string, distributorId: DistributorId): PricingTier[] {
    const results = this.searchPart(mpn);
    if (results.length === 0) {
      return [];
    }

    const part = results[0];
    const offer = part.offers.find((o) => o.distributorId === distributorId);
    if (!offer) {
      return [];
    }

    return offer.pricing.map((t) => ({ ...t }));
  }

  // -----------------------------------------------------------------------
  // BOM Quoting
  // -----------------------------------------------------------------------

  /** Quote an entire BOM — find best prices for each line item. */
  quoteBom(items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions): BomQuote {
    const currency = options?.currency ?? this._currentCurrency;
    const bomItems: BomPricingResult[] = items.map((item) => {
      const results = this.searchPart(item.mpn, options);
      const warnings: string[] = [];

      if (results.length === 0) {
        return {
          mpn: item.mpn,
          quantity: item.quantity,
          bestPrice: null,
          allOffers: [],
          inStock: false,
          warnings: [`Part "${item.mpn}" not found in any distributor`],
        };
      }

      const part = results[0];
      const enabledDists = getEnabledDistributorIdsFn(this,options?.distributors);
      const filteredOffers = part.offers.filter((o) => enabledDists.includes(o.distributorId));

      // Check stock
      const hasStock = filteredOffers.some((o) => o.stock >= item.quantity);
      if (!hasStock) {
        const anyStock = filteredOffers.some((o) => o.stock > 0);
        if (anyStock) {
          warnings.push(`Insufficient stock for quantity ${item.quantity}`);
        } else {
          warnings.push('Out of stock at all distributors');
        }
      }

      // Check lifecycle
      if (part.lifecycle === 'nrnd') {
        warnings.push('Part is Not Recommended for New Designs (NRND)');
      } else if (part.lifecycle === 'eol') {
        warnings.push('Part is End of Life (EOL)');
      } else if (part.lifecycle === 'obsolete') {
        warnings.push('Part is obsolete');
      }

      // Find best price
      let bestPrice: BomPricingResult['bestPrice'] = null;

      filteredOffers.forEach((offer) => {
        if (options?.inStockOnly && offer.stockStatus === 'out-of-stock') {
          return;
        }

        const tierPrice = getPriceForQuantity(offer.pricing, item.quantity);
        if (tierPrice === null) {
          return;
        }

        const convertedPrice = this.convertCurrency(tierPrice, 'USD', currency);
        const totalPrice = convertedPrice * item.quantity;

        if (!bestPrice || convertedPrice < bestPrice.unitPrice) {
          bestPrice = {
            distributor: offer.distributorId,
            unitPrice: convertedPrice,
            totalPrice,
            sku: offer.sku,
          };
        }
      });

      return {
        mpn: item.mpn,
        quantity: item.quantity,
        bestPrice,
        allOffers: filteredOffers,
        inStock: hasStock,
        warnings,
      };
    });

    const totalCost = bomItems.reduce((sum, item) => sum + (item.bestPrice?.totalPrice ?? 0), 0);
    const itemsFound = bomItems.filter((item) => item.bestPrice !== null).length;
    const itemsMissing = bomItems.length - itemsFound;

    return {
      items: bomItems,
      totalCost,
      currency,
      itemsFound,
      itemsMissing,
      timestamp: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Cache
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------

  /** Get the number of remaining requests within the rate limit window for a distributor. */
  getRemainingRequests(distributorId: DistributorId): number {
    return getRemainingRequestsFn(this, distributorId);
  }

  /** Check if a distributor is currently rate-limited. */
  isRateLimited(distributorId: DistributorId): boolean {
    return isRateLimitedFn(this, distributorId);
  }

  // -----------------------------------------------------------------------
  // Stock Alerts
  // -----------------------------------------------------------------------

  /** Set a stock alert — notify when stock drops below threshold. */
  setStockAlert(mpn: string, threshold: number): void {
    setStockAlertFn(this, mpn, threshold);
  }

  /** Get all stock alerts. */
  getStockAlerts(): Array<{ mpn: string; threshold: number }> {
    return getStockAlertsFn(this);
  }

  /** Remove a stock alert. */
  removeStockAlert(mpn: string): void {
    removeStockAlertFn(this, mpn);
  }

  /** Check all stock alerts against current mock data. Returns triggered alerts. */
  checkAlerts(): Array<{ mpn: string; currentStock: number; threshold: number; triggered: boolean }> {
    return checkAlertsFn(this);
  }

  // -----------------------------------------------------------------------
  // Currency
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export configuration as a JSON string. */
  exportConfig(): string {
    const state: PersistedState = {
      enabledDistributors: this._distributors.filter((d) => d.enabled).map((d) => d.distributorId),
      currency: this._currentCurrency,
      cacheExpiryMs: this._cacheExpiryMs,
      stockAlerts: this._stockAlerts.map((a) => ({ ...a })),
    };
    return JSON.stringify(state);
  }

  /** Import configuration from a JSON string. Returns import result. */
  importConfig(json: string): { imported: number; errors: string[] } {
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

    // Import enabled distributors
    if (Array.isArray(data.enabledDistributors)) {
      const validIds = this._distributors.map((d) => d.distributorId);
      this._distributors.forEach((d) => {
        d.enabled = false;
      });
      (data.enabledDistributors as unknown[]).forEach((id) => {
        if (typeof id === 'string' && validIds.includes(id as DistributorId)) {
          const dist = this._distributors.find((d) => d.distributorId === id);
          if (dist) {
            dist.enabled = true;
            imported++;
          }
        } else {
          errors.push(`Unknown distributor: ${String(id)}`);
        }
      });
    }

    // Import currency
    if (typeof data.currency === 'string' && data.currency in EXCHANGE_RATES) {
      this._currentCurrency = data.currency as Currency;
      imported++;
    } else if (data.currency !== undefined) {
      errors.push(`Invalid currency: ${String(data.currency)}`);
    }

    // Import cache expiry
    if (typeof data.cacheExpiryMs === 'number' && data.cacheExpiryMs > 0) {
      this._cacheExpiryMs = data.cacheExpiryMs;
      imported++;
    } else if (data.cacheExpiryMs !== undefined) {
      errors.push(`Invalid cacheExpiryMs: ${String(data.cacheExpiryMs)}`);
    }

    // Import stock alerts
    if (Array.isArray(data.stockAlerts)) {
      const validAlerts: StockAlert[] = [];
      (data.stockAlerts as unknown[]).forEach((alert) => {
        if (
          typeof alert === 'object' &&
          alert !== null &&
          typeof (alert as StockAlert).mpn === 'string' &&
          typeof (alert as StockAlert).threshold === 'number'
        ) {
          validAlerts.push({ mpn: (alert as StockAlert).mpn, threshold: (alert as StockAlert).threshold });
          imported++;
        } else {
          errors.push(`Invalid stock alert: ${JSON.stringify(alert)}`);
        }
      });
      this._stockAlerts = validAlerts;
    }

    this._save();
    this._notify();
    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear / Reset
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  private applySearchOptions(results: PartSearchResult[], options?: SearchOptions): PartSearchResult[] {
    let filtered = [...results];

    if (options?.distributors && options.distributors.length > 0) {
      const allowedDists = options.distributors;
      filtered = filtered.map((part) => ({
        ...part,
        offers: part.offers.filter((o) => allowedDists.includes(o.distributorId)),
      }));
      // Remove parts with no offers after filtering
      filtered = filtered.filter((p) => p.offers.length > 0);
    }

    if (options?.inStockOnly) {
      filtered = filtered.map((part) => ({
        ...part,
        offers: part.offers.filter((o) => o.stockStatus !== 'out-of-stock'),
      }));
      filtered = filtered.filter((p) => p.offers.length > 0);
    }

    // Sort
    if (options?.sortBy) {
      switch (options.sortBy) {
        case 'price':
          filtered.sort((a, b) => {
            const aMin = getMinPrice(a.offers);
            const bMin = getMinPrice(b.offers);
            return aMin - bMin;
          });
          break;
        case 'stock':
          filtered.sort((a, b) => {
            const aStock = a.offers.reduce((sum, o) => sum + o.stock, 0);
            const bStock = b.offers.reduce((sum, o) => sum + o.stock, 0);
            return bStock - aStock; // Higher stock first
          });
          break;
        case 'leadTime':
          filtered.sort((a, b) => {
            const aLead = getMinLeadTime(a.offers);
            const bLead = getMinLeadTime(b.offers);
            return aLead - bLead;
          });
          break;
        case 'relevance':
        default:
          // Keep original order (relevance is default)
          break;
      }
    }

    if (options?.maxResults !== undefined && options.maxResults > 0) {
      filtered = filtered.slice(0, options.maxResults);
    }

    return filtered;
  }


  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** @internal Exposed for concern-split helpers (stock-alerts, etc.) that mutate state requiring persistence. */
  _save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const state: PersistedState = {
        enabledDistributors: this._distributors.filter((d) => d.enabled).map((d) => d.distributorId),
        currency: this._currentCurrency,
        cacheExpiryMs: this._cacheExpiryMs,
        stockAlerts: this._stockAlerts.map((a) => ({ ...a })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** @internal */
  _load(): void {
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

      // Restore enabled distributors
      if (Array.isArray(data.enabledDistributors)) {
        const enabledSet = new Set(data.enabledDistributors as string[]);
        this._distributors.forEach((d) => {
          d.enabled = enabledSet.has(d.distributorId);
        });
      }

      // Restore currency
      if (typeof data.currency === 'string' && data.currency in EXCHANGE_RATES) {
        this._currentCurrency = data.currency as Currency;
      }

      // Restore cache expiry
      if (typeof data.cacheExpiryMs === 'number' && data.cacheExpiryMs > 0) {
        this._cacheExpiryMs = data.cacheExpiryMs;
      }

      // Restore stock alerts
      if (Array.isArray(data.stockAlerts)) {
        this._stockAlerts = (data.stockAlerts as unknown[]).filter(
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
}
