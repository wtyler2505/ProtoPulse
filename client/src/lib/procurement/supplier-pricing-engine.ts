/**
 * SupplierPricingEngine — Fan-out pricing queries across 6 electronic component distributors.
 *
 * Singleton + subscribe pattern. All provider calls are simulated locally (to be proxied
 * through the ProtoPulse server in a future iteration). Includes local caching, bulk BOM
 * quoting, and provider comparison.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingProvider {
  id: string;
  name: string;
  displayName: string;
  apiBaseUrl: string;
  rateLimit: number;
  cacheTtlMs: number;
  supportedRegions: string[];
  enabled: boolean;
}

export interface PricingRequest {
  partNumber: string;
  manufacturer?: string;
  quantity: number;
  provider?: string;
  region?: string;
}

export interface PricingQuote {
  provider: string;
  partNumber: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  moq: number;
  stock: number;
  leadTimeDays: number;
  datasheet?: string;
  timestamp: number;
  cached: boolean;
}

export interface PricingResult {
  quotes: PricingQuote[];
  bestPrice?: PricingQuote;
  bestStock?: PricingQuote;
  errors: Array<{ provider: string; error: string }>;
  requestedAt: number;
  duration: number;
}

export interface ProviderComparison {
  byPrice: PricingQuote[];
  byStock: PricingQuote[];
  byLeadTime: PricingQuote[];
  recommendation: string;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

interface CacheEntry {
  quotes: PricingQuote[];
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Default providers
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDERS: PricingProvider[] = [
  {
    id: 'digikey',
    name: 'digikey',
    displayName: 'Digi-Key',
    apiBaseUrl: 'https://api.digikey.com/v4',
    rateLimit: 10,
    cacheTtlMs: 300_000,
    supportedRegions: ['US', 'EU', 'APAC'],
    enabled: true,
  },
  {
    id: 'mouser',
    name: 'mouser',
    displayName: 'Mouser',
    apiBaseUrl: 'https://api.mouser.com/api/v2',
    rateLimit: 10,
    cacheTtlMs: 300_000,
    supportedRegions: ['US', 'EU', 'APAC'],
    enabled: true,
  },
  {
    id: 'lcsc',
    name: 'lcsc',
    displayName: 'LCSC',
    apiBaseUrl: 'https://wmsc.lcsc.com/ftps/wm',
    rateLimit: 5,
    cacheTtlMs: 600_000,
    supportedRegions: ['APAC', 'US'],
    enabled: true,
  },
  {
    id: 'newark',
    name: 'newark',
    displayName: 'Newark',
    apiBaseUrl: 'https://api.newark.com/v1',
    rateLimit: 8,
    cacheTtlMs: 300_000,
    supportedRegions: ['US', 'EU'],
    enabled: true,
  },
  {
    id: 'farnell',
    name: 'farnell',
    displayName: 'Farnell',
    apiBaseUrl: 'https://api.farnell.com/v1',
    rateLimit: 8,
    cacheTtlMs: 300_000,
    supportedRegions: ['EU', 'APAC'],
    enabled: true,
  },
  {
    id: 'arrow',
    name: 'arrow',
    displayName: 'Arrow',
    apiBaseUrl: 'https://api.arrow.com/v1',
    rateLimit: 10,
    cacheTtlMs: 300_000,
    supportedRegions: ['US', 'EU', 'APAC'],
    enabled: true,
  },
];

// ---------------------------------------------------------------------------
// SupplierPricingEngine
// ---------------------------------------------------------------------------

export class SupplierPricingEngine {
  // -- Singleton --
  private static instance: SupplierPricingEngine | null = null;

  static getInstance(): SupplierPricingEngine {
    if (!SupplierPricingEngine.instance) {
      SupplierPricingEngine.instance = new SupplierPricingEngine();
    }
    return SupplierPricingEngine.instance;
  }

  static resetInstance(): void {
    SupplierPricingEngine.instance = null;
  }

  // -- State --
  private providers: PricingProvider[];
  private cache: Map<string, CacheEntry> = new Map();
  private listeners: Set<Listener> = new Set();

  private constructor() {
    this.providers = DEFAULT_PROVIDERS.map((p) => ({ ...p }));
  }

  // -- Subscribe --
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // -- Provider management --

  getProviders(): PricingProvider[] {
    return this.providers.map((p) => ({ ...p }));
  }

  setProviderEnabled(providerId: string, enabled: boolean): void {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    provider.enabled = enabled;
    this.notify();
  }

  // -- Cache --

  private cacheKey(partNumber: string, provider: string): string {
    return `${partNumber.toLowerCase()}::${provider}`;
  }

  getCachedQuote(partNumber: string): PricingQuote[] | null {
    const now = Date.now();
    const results: PricingQuote[] = [];
    let found = false;

    for (const provider of this.providers) {
      const key = this.cacheKey(partNumber, provider.id);
      const entry = this.cache.get(key);
      if (entry && entry.expiresAt > now) {
        found = true;
        for (const q of entry.quotes) {
          results.push({ ...q, cached: true });
        }
      }
    }

    return found ? results : null;
  }

  invalidateCache(partNumber?: string): void {
    if (partNumber) {
      const prefix = partNumber.toLowerCase() + '::';
      const keysToDelete: string[] = [];
      this.cache.forEach((_v, k) => {
        if (k.startsWith(prefix)) {
          keysToDelete.push(k);
        }
      });
      keysToDelete.forEach((k) => this.cache.delete(k));
    } else {
      this.cache.clear();
    }
    this.notify();
  }

  // -- Simulate a provider quote --

  private simulateProviderQuote(provider: PricingProvider, req: PricingRequest): PricingQuote {
    // Deterministic pricing based on provider + part hash
    const hash = this.simpleHash(provider.id + req.partNumber);
    const basePrice = 0.01 + (hash % 10000) / 100;
    const stockBase = (hash % 50000) + 100;

    return {
      provider: provider.id,
      partNumber: req.partNumber,
      unitPrice: Math.round(basePrice * 100) / 100,
      currency: 'USD',
      quantity: req.quantity,
      moq: Math.max(1, (hash % 5) * 5 + 1),
      stock: stockBase,
      leadTimeDays: (hash % 30) + 1,
      datasheet: `https://${provider.name}.com/datasheets/${req.partNumber}.pdf`,
      timestamp: Date.now(),
      cached: false,
    };
  }

  private simpleHash(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // -- Core pricing --

  requestQuote(req: PricingRequest): PricingResult {
    const start = Date.now();
    const quotes: PricingQuote[] = [];
    const errors: Array<{ provider: string; error: string }> = [];

    if (!req.partNumber || req.partNumber.trim() === '') {
      return { quotes: [], errors: [{ provider: '*', error: 'Part number is required' }], requestedAt: start, duration: 0 };
    }

    if (req.quantity <= 0) {
      return {
        quotes: [],
        errors: [{ provider: '*', error: 'Quantity must be positive' }],
        requestedAt: start,
        duration: 0,
      };
    }

    const targetProviders = req.provider
      ? this.providers.filter((p) => p.id === req.provider)
      : this.providers.filter((p) => p.enabled);

    if (req.provider && targetProviders.length === 0) {
      return {
        quotes: [],
        errors: [{ provider: req.provider, error: `Provider '${req.provider}' not found` }],
        requestedAt: start,
        duration: Date.now() - start,
      };
    }

    for (const provider of targetProviders) {
      // Region filter
      if (req.region && !provider.supportedRegions.includes(req.region)) {
        errors.push({ provider: provider.id, error: `Region '${req.region}' not supported` });
        continue;
      }

      // Check cache
      const cKey = this.cacheKey(req.partNumber, provider.id);
      const cached = this.cache.get(cKey);
      if (cached && cached.expiresAt > Date.now()) {
        for (const q of cached.quotes) {
          quotes.push({ ...q, cached: true, quantity: req.quantity });
        }
        continue;
      }

      // Simulate the quote
      const quote = this.simulateProviderQuote(provider, req);
      quotes.push(quote);

      // Store in cache
      this.cache.set(cKey, {
        quotes: [quote],
        expiresAt: Date.now() + provider.cacheTtlMs,
      });
    }

    const bestPrice = quotes.length > 0 ? quotes.reduce((a, b) => (a.unitPrice < b.unitPrice ? a : b)) : undefined;
    const bestStock = quotes.length > 0 ? quotes.reduce((a, b) => (a.stock > b.stock ? a : b)) : undefined;

    const result: PricingResult = {
      quotes,
      bestPrice,
      bestStock,
      errors,
      requestedAt: start,
      duration: Date.now() - start,
    };

    this.notify();
    return result;
  }

  requestBulkQuotes(items: PricingRequest[]): Map<string, PricingResult> {
    const results = new Map<string, PricingResult>();
    for (const item of items) {
      results.set(item.partNumber, this.requestQuote(item));
    }
    return results;
  }

  // -- Comparison --

  compareProviders(partNumber: string, results: PricingResult): ProviderComparison {
    const quotes = [...results.quotes];

    const byPrice = [...quotes].sort((a, b) => a.unitPrice - b.unitPrice);
    const byStock = [...quotes].sort((a, b) => b.stock - a.stock);
    const byLeadTime = [...quotes].sort((a, b) => a.leadTimeDays - b.leadTimeDays);

    let recommendation = 'No quotes available';

    if (byPrice.length > 0) {
      const cheapest = byPrice[0];
      const fastest = byLeadTime[0];
      const mostStock = byStock[0];

      if (cheapest.provider === fastest.provider && cheapest.provider === mostStock.provider) {
        recommendation = `${cheapest.provider} is the best overall choice for ${partNumber}`;
      } else if (cheapest.provider === fastest.provider) {
        recommendation = `${cheapest.provider} offers the best price and lead time for ${partNumber}`;
      } else {
        recommendation =
          `Best price: ${cheapest.provider} ($${cheapest.unitPrice.toFixed(2)}), ` +
          `fastest delivery: ${fastest.provider} (${fastest.leadTimeDays}d), ` +
          `most stock: ${mostStock.provider} (${mostStock.stock} units)`;
      }
    }

    return { byPrice, byStock, byLeadTime, recommendation };
  }
}
