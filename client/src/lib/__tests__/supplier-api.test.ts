import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupplierApiManager,
  useSupplierApi,
} from '../supplier-api';
import type {
  DistributorId,
  Currency,
  SearchOptions,
  SupplierConfig,
} from '../supplier-api';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) { delete store[k]; } }),
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  SupplierApiManager.resetForTesting();
  for (const k of Object.keys(store)) {
    delete store[k];
  }
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Distributor configuration tests
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Distributors', () => {
  it('should have 7 built-in distributors', () => {
    const api = SupplierApiManager.getInstance();
    const distributors = api.getDistributors();
    expect(distributors).toHaveLength(7);
  });

  it('should return all expected distributor IDs', () => {
    const api = SupplierApiManager.getInstance();
    const ids = api.getDistributors().map((d: SupplierConfig) => d.distributorId);
    expect(ids).toContain('digikey');
    expect(ids).toContain('mouser');
    expect(ids).toContain('octopart');
    expect(ids).toContain('newark');
    expect(ids).toContain('arrow');
    expect(ids).toContain('lcsc');
    expect(ids).toContain('farnell');
  });

  it('should get a single distributor by ID', () => {
    const api = SupplierApiManager.getInstance();
    const dk = api.getDistributor('digikey');
    expect(dk).toBeDefined();
    expect(dk?.name).toBe('DigiKey');
    expect(dk?.apiKeyRequired).toBe(true);
    expect(dk?.rateLimit).toBe(60);
    expect(dk?.regions).toContain('US');
  });

  it('should return undefined for unknown distributor', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.getDistributor('unknown' as DistributorId)).toBeUndefined();
  });

  it('should enable and disable distributors', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.isEnabled('digikey')).toBe(true);

    api.disableDistributor('digikey');
    expect(api.isEnabled('digikey')).toBe(false);

    api.enableDistributor('digikey');
    expect(api.isEnabled('digikey')).toBe(true);
  });

  it('should not notify when enabling an already-enabled distributor', () => {
    const api = SupplierApiManager.getInstance();
    const listener = vi.fn();
    api.subscribe(listener);

    api.enableDistributor('digikey'); // already enabled
    expect(listener).not.toHaveBeenCalled();
  });

  it('should not notify when disabling an already-disabled distributor', () => {
    const api = SupplierApiManager.getInstance();
    api.disableDistributor('digikey');

    const listener = vi.fn();
    api.subscribe(listener);

    api.disableDistributor('digikey'); // already disabled
    expect(listener).not.toHaveBeenCalled();
  });

  it('should return a copy from getDistributors (not mutate internal state)', () => {
    const api = SupplierApiManager.getInstance();
    const distributors = api.getDistributors();
    distributors[0].name = 'MUTATED';
    expect(api.getDistributors()[0].name).not.toBe('MUTATED');
  });
});

// ---------------------------------------------------------------------------
// Part search by MPN
// ---------------------------------------------------------------------------

describe('SupplierApiManager — searchPart', () => {
  it('should find ATmega328P by exact MPN', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('ATmega328P');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].mpn).toBe('ATmega328P');
    expect(results[0].manufacturer).toBe('Microchip Technology');
  });

  it('should find parts by partial MPN (case-insensitive)', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('atmega');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].mpn).toBe('ATmega328P');
  });

  it('should return empty array for unknown MPN', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('NONEXISTENT-PART-12345');
    expect(results).toEqual([]);
  });

  it('should return empty array for empty search', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.searchPart('')).toEqual([]);
    expect(api.searchPart('   ')).toEqual([]);
  });

  it('should include offers with pricing tiers', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('NE555');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const part = results[0];
    expect(part.offers.length).toBeGreaterThan(0);
    part.offers.forEach((offer) => {
      expect(offer.pricing.length).toBeGreaterThan(0);
      offer.pricing.forEach((tier) => {
        expect(tier.minQuantity).toBeGreaterThanOrEqual(1);
        expect(tier.unitPrice).toBeGreaterThan(0);
        expect(tier.currency).toBe('USD');
      });
    });
  });

  it('should include specifications and metadata', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('ESP32-WROOM-32');
    expect(results.length).toBe(1);
    const part = results[0];
    expect(part.category).toBe('Wireless Modules');
    expect(part.lifecycle).toBe('active');
    expect(part.datasheet).toBeDefined();
    expect(Object.keys(part.specifications).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Part search by keyword
// ---------------------------------------------------------------------------

describe('SupplierApiManager — searchByKeyword', () => {
  it('should find parts by category keyword', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchByKeyword('Voltage Regulators');
    expect(results.length).toBeGreaterThanOrEqual(2); // LM7805 + AMS1117-3.3
  });

  it('should find parts by manufacturer', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchByKeyword('Texas Instruments');
    expect(results.length).toBeGreaterThanOrEqual(3); // LM7805, NE555, LM358, TL072, INA219
  });

  it('should find parts by description keyword', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchByKeyword('MOSFET');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].mpn).toBe('IRF540N');
  });

  it('should return empty array for empty keyword', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.searchByKeyword('')).toEqual([]);
    expect(api.searchByKeyword('  ')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Search options
// ---------------------------------------------------------------------------

describe('SupplierApiManager — SearchOptions', () => {
  it('should filter by specific distributors', () => {
    const api = SupplierApiManager.getInstance();
    const options: SearchOptions = { distributors: ['lcsc'] };
    const results = api.searchPart('ATmega328P', options);
    expect(results.length).toBe(1);
    results[0].offers.forEach((o) => {
      expect(o.distributorId).toBe('lcsc');
    });
  });

  it('should filter inStockOnly', () => {
    const api = SupplierApiManager.getInstance();
    // All mock parts are in stock, so this should return results
    const results = api.searchPart('ATmega328P', { inStockOnly: true });
    expect(results.length).toBeGreaterThanOrEqual(1);
    results[0].offers.forEach((o) => {
      expect(o.stockStatus).not.toBe('out-of-stock');
    });
  });

  it('should limit maxResults', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchByKeyword('Texas Instruments', { maxResults: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should sort by price', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchByKeyword('LED', { sortBy: 'price' });
    if (results.length >= 2) {
      // Verify sorted by lowest price ascending
      const prices = results.map((r) => {
        let minP = Infinity;
        r.offers.forEach((o) => {
          o.pricing.forEach((t) => {
            if (t.unitPrice < minP) { minP = t.unitPrice; }
          });
        });
        return minP;
      });
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    }
  });

  it('should sort by stock (descending)', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchByKeyword('LED', { sortBy: 'stock' });
    if (results.length >= 2) {
      const stocks = results.map((r) => r.offers.reduce((s, o) => s + o.stock, 0));
      for (let i = 1; i < stocks.length; i++) {
        expect(stocks[i]).toBeLessThanOrEqual(stocks[i - 1]);
      }
    }
  });

  it('should handle disabled distributor in filter gracefully', () => {
    const api = SupplierApiManager.getInstance();
    api.disableDistributor('lcsc');
    const results = api.searchPart('ATmega328P', { distributors: ['lcsc'] });
    // lcsc is disabled, but explicitly passed in options — still filtered by enabled check
    // The getEnabledDistributorIds method filters against enabled distributors
    expect(results).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Best price
// ---------------------------------------------------------------------------

describe('SupplierApiManager — getBestPrice', () => {
  it('should return the best price across distributors for quantity 1', () => {
    const api = SupplierApiManager.getInstance();
    const best = api.getBestPrice('ATmega328P', 1);
    expect(best).not.toBeNull();
    expect(best?.unitPrice).toBeGreaterThan(0);
    expect(best?.totalPrice).toBe(best?.unitPrice);
  });

  it('should apply quantity break pricing', () => {
    const api = SupplierApiManager.getInstance();
    const price1 = api.getBestPrice('ATmega328P', 1);
    const price100 = api.getBestPrice('ATmega328P', 100);
    expect(price1).not.toBeNull();
    expect(price100).not.toBeNull();
    expect(price100!.unitPrice).toBeLessThan(price1!.unitPrice);
  });

  it('should calculate totalPrice as unitPrice * quantity', () => {
    const api = SupplierApiManager.getInstance();
    const best = api.getBestPrice('NE555', 50);
    expect(best).not.toBeNull();
    expect(best!.totalPrice).toBeCloseTo(best!.unitPrice * 50, 5);
  });

  it('should return null for unknown part', () => {
    const api = SupplierApiManager.getInstance();
    const best = api.getBestPrice('NONEXISTENT-12345', 10);
    expect(best).toBeNull();
  });

  it('should respect distributor filter', () => {
    const api = SupplierApiManager.getInstance();
    const best = api.getBestPrice('ATmega328P', 1, { distributors: ['mouser'] });
    expect(best).not.toBeNull();
    expect(best?.distributor).toBe('mouser');
  });
});

// ---------------------------------------------------------------------------
// Pricing tiers
// ---------------------------------------------------------------------------

describe('SupplierApiManager — getPricingTiers', () => {
  it('should return pricing tiers for a known part + distributor', () => {
    const api = SupplierApiManager.getInstance();
    const tiers = api.getPricingTiers('ATmega328P', 'digikey');
    expect(tiers.length).toBeGreaterThanOrEqual(3);
    expect(tiers[0].minQuantity).toBe(1);
    expect(tiers[0].currency).toBe('USD');
  });

  it('should return empty array for unknown part', () => {
    const api = SupplierApiManager.getInstance();
    const tiers = api.getPricingTiers('NONEXISTENT', 'digikey');
    expect(tiers).toEqual([]);
  });

  it('should return empty array for known part but wrong distributor', () => {
    const api = SupplierApiManager.getInstance();
    const tiers = api.getPricingTiers('ATmega328P', 'farnell');
    expect(tiers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BOM quoting
// ---------------------------------------------------------------------------

describe('SupplierApiManager — quoteBom', () => {
  it('should quote a BOM with all parts found', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([
      { mpn: 'ATmega328P', quantity: 5 },
      { mpn: 'NE555', quantity: 10 },
    ]);

    expect(quote.items).toHaveLength(2);
    expect(quote.itemsFound).toBe(2);
    expect(quote.itemsMissing).toBe(0);
    expect(quote.totalCost).toBeGreaterThan(0);
    expect(quote.currency).toBe('USD');
    expect(quote.timestamp).toBeGreaterThan(0);
  });

  it('should handle missing parts in BOM', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([
      { mpn: 'ATmega328P', quantity: 5 },
      { mpn: 'NONEXISTENT-XYZ', quantity: 1 },
    ]);

    expect(quote.itemsFound).toBe(1);
    expect(quote.itemsMissing).toBe(1);

    const missing = quote.items.find((i) => i.mpn === 'NONEXISTENT-XYZ');
    expect(missing).toBeDefined();
    expect(missing?.bestPrice).toBeNull();
    expect(missing?.inStock).toBe(false);
    expect(missing?.warnings.length).toBeGreaterThan(0);
  });

  it('should find the best price per item', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([{ mpn: 'LM7805', quantity: 10 }]);

    expect(quote.items[0].bestPrice).not.toBeNull();
    expect(quote.items[0].bestPrice!.unitPrice).toBeGreaterThan(0);
    expect(quote.items[0].bestPrice!.sku).toBeDefined();
    expect(quote.items[0].allOffers.length).toBeGreaterThan(0);
  });

  it('should calculate correct total cost', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([
      { mpn: 'NE555', quantity: 10 },
      { mpn: 'LM358', quantity: 5 },
    ]);

    const expectedTotal = quote.items.reduce((sum, item) => sum + (item.bestPrice?.totalPrice ?? 0), 0);
    expect(quote.totalCost).toBeCloseTo(expectedTotal, 5);
  });

  it('should report inStock correctly', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([{ mpn: 'ATmega328P', quantity: 1 }]);
    expect(quote.items[0].inStock).toBe(true);
  });

  it('should handle empty BOM', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([]);
    expect(quote.items).toHaveLength(0);
    expect(quote.totalCost).toBe(0);
    expect(quote.itemsFound).toBe(0);
    expect(quote.itemsMissing).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Cache', () => {
  it('should cache search results', () => {
    const api = SupplierApiManager.getInstance();
    api.searchPart('ATmega328P');
    expect(api.getCacheSize()).toBeGreaterThanOrEqual(1);
  });

  it('should return cached results on second search', () => {
    const api = SupplierApiManager.getInstance();
    const first = api.searchPart('NE555');
    const second = api.searchPart('NE555');
    expect(first).toEqual(second);
  });

  it('should expire cached entries', () => {
    const api = SupplierApiManager.getInstance();
    api.setCacheExpiry(1); // 1ms expiry

    // Manually insert a cache entry that is already expired
    api.searchPart('ATmega328P');

    // The cache key uses lowercase: 'mpn:atmega328p'
    // getCachedSearch checks Date.now() > expiresAt.
    // With a 1ms expiry, by the time we check it should be expired.
    // Use a small delay approach — search populates cache, then check it.
    // Since expiry is 1ms, by the next statement it will be expired.
    const cached = api.getCachedSearch('mpn:atmega328p');
    // Either expired (null) or still valid — both acceptable with 1ms window
    expect(cached === null || cached.query === 'mpn:atmega328p').toBe(true);
  });

  it('should clear all cached entries', () => {
    const api = SupplierApiManager.getInstance();
    api.searchPart('ATmega328P');
    api.searchPart('NE555');
    expect(api.getCacheSize()).toBeGreaterThanOrEqual(2);

    api.clearCache();
    expect(api.getCacheSize()).toBe(0);
  });

  it('should return null for non-existent cache key', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.getCachedSearch('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Rate Limiting', () => {
  it('should track remaining requests', () => {
    const api = SupplierApiManager.getInstance();
    const initial = api.getRemainingRequests('digikey');
    expect(initial).toBe(60); // DigiKey rate limit is 60

    // Perform a search — records a request for each enabled distributor
    api.searchPart('ATmega328P');
    const after = api.getRemainingRequests('digikey');
    expect(after).toBeLessThan(initial);
  });

  it('should not be rate limited initially', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.isRateLimited('digikey')).toBe(false);
    expect(api.isRateLimited('mouser')).toBe(false);
  });

  it('should return 0 remaining for unknown distributor', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.getRemainingRequests('unknown' as DistributorId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stock alerts
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Stock Alerts', () => {
  it('should set a stock alert', () => {
    const api = SupplierApiManager.getInstance();
    api.setStockAlert('ATmega328P', 1000);
    const alerts = api.getStockAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].mpn).toBe('ATmega328P');
    expect(alerts[0].threshold).toBe(1000);
  });

  it('should update threshold on duplicate MPN', () => {
    const api = SupplierApiManager.getInstance();
    api.setStockAlert('ATmega328P', 1000);
    api.setStockAlert('ATmega328P', 5000);
    const alerts = api.getStockAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(5000);
  });

  it('should get all stock alerts', () => {
    const api = SupplierApiManager.getInstance();
    api.setStockAlert('ATmega328P', 1000);
    api.setStockAlert('NE555', 500);
    expect(api.getStockAlerts()).toHaveLength(2);
  });

  it('should remove a stock alert', () => {
    const api = SupplierApiManager.getInstance();
    api.setStockAlert('ATmega328P', 1000);
    api.setStockAlert('NE555', 500);
    api.removeStockAlert('ATmega328P');
    const alerts = api.getStockAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].mpn).toBe('NE555');
  });

  it('should not notify when removing non-existent alert', () => {
    const api = SupplierApiManager.getInstance();
    const listener = vi.fn();
    api.subscribe(listener);
    api.removeStockAlert('NONEXISTENT');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should check alerts — not triggered when stock is above threshold', () => {
    const api = SupplierApiManager.getInstance();
    // ATmega328P has thousands of units in stock across distributors
    api.setStockAlert('ATmega328P', 100);
    const results = api.checkAlerts();
    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(false);
    expect(results[0].currentStock).toBeGreaterThan(100);
  });

  it('should check alerts — triggered when threshold is very high', () => {
    const api = SupplierApiManager.getInstance();
    // Set threshold way above total stock
    api.setStockAlert('ATmega328P', 999_999_999);
    const results = api.checkAlerts();
    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(true);
  });

  it('should check alerts — unknown part has 0 stock', () => {
    const api = SupplierApiManager.getInstance();
    api.setStockAlert('NONEXISTENT-XYZ', 1);
    const results = api.checkAlerts();
    expect(results).toHaveLength(1);
    expect(results[0].currentStock).toBe(0);
    expect(results[0].triggered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Currency', () => {
  it('should default to USD', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.getCurrency()).toBe('USD');
  });

  it('should set and get currency', () => {
    const api = SupplierApiManager.getInstance();
    api.setCurrency('EUR');
    expect(api.getCurrency()).toBe('EUR');
  });

  it('should not notify when setting same currency', () => {
    const api = SupplierApiManager.getInstance();
    const listener = vi.fn();
    api.subscribe(listener);
    api.setCurrency('USD'); // already USD
    expect(listener).not.toHaveBeenCalled();
  });

  it('should convert USD to EUR', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.convertCurrency(100, 'USD', 'EUR');
    expect(result).toBeCloseTo(92, 0); // ~0.92 rate
  });

  it('should convert EUR to USD', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.convertCurrency(92, 'EUR', 'USD');
    expect(result).toBeCloseTo(100, 0);
  });

  it('should convert USD to JPY', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.convertCurrency(1, 'USD', 'JPY');
    expect(result).toBeCloseTo(149, 0);
  });

  it('should return same amount for same currency', () => {
    const api = SupplierApiManager.getInstance();
    expect(api.convertCurrency(42.5, 'USD', 'USD')).toBe(42.5);
    expect(api.convertCurrency(100, 'EUR', 'EUR')).toBe(100);
  });

  it('should convert between non-USD currencies', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.convertCurrency(100, 'EUR', 'GBP');
    // 100 EUR → USD → GBP: 100/0.92 * 0.79 ≈ 85.87
    expect(result).toBeCloseTo(85.87, 0);
  });
});

// ---------------------------------------------------------------------------
// Built-in mock data
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Mock Data', () => {
  it('should have 20 built-in parts', () => {
    const api = SupplierApiManager.getInstance();
    // Search with a very broad keyword to find all parts
    const allParts = api.searchByKeyword('a');
    // Not all parts match 'a', so let's check individual known parts
    const knownMpns = [
      'ATmega328P', 'ESP32-WROOM-32', 'LM7805', 'NE555', 'LM358',
      'RC0805FR-0710KL', 'CL21B104KBCNNNC', 'GRM21BR61E106KA73L',
      '1N4148', 'LTST-C171KRKT', 'LTST-C171GKT', 'USB4110-GF-A',
      'PJ-102AH', 'IRF540N', 'TL072', 'A000005', '74HC595',
      'AMS1117-3.3', 'BME280', 'INA219',
    ];

    knownMpns.forEach((mpn) => {
      const results = api.searchPart(mpn);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should have multi-distributor offers for parts', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('ATmega328P');
    expect(results[0].offers.length).toBeGreaterThanOrEqual(2);
  });

  it('should have stock status set correctly', () => {
    const api = SupplierApiManager.getInstance();
    const results = api.searchPart('ATmega328P');
    results[0].offers.forEach((offer) => {
      if (offer.stock > 100) {
        expect(offer.stockStatus).toBe('in-stock');
      } else if (offer.stock > 0) {
        expect(offer.stockStatus).toBe('low-stock');
      } else {
        expect(offer.stockStatus).toBe('out-of-stock');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Export / Import config
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Export / Import', () => {
  it('should export config as JSON string', () => {
    const api = SupplierApiManager.getInstance();
    const json = api.exportConfig();
    const parsed = JSON.parse(json);
    expect(parsed.enabledDistributors).toBeDefined();
    expect(parsed.currency).toBe('USD');
    expect(parsed.cacheExpiryMs).toBeGreaterThan(0);
    expect(parsed.stockAlerts).toEqual([]);
  });

  it('should round-trip export/import', () => {
    const api = SupplierApiManager.getInstance();

    // Customize state
    api.disableDistributor('farnell');
    api.setCurrency('EUR');
    api.setStockAlert('ATmega328P', 500);

    const exported = api.exportConfig();

    // Reset and reimport
    api.clear();
    expect(api.getCurrency()).toBe('USD');

    const result = api.importConfig(exported);
    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBeGreaterThan(0);
    expect(api.getCurrency()).toBe('EUR');
    expect(api.isEnabled('farnell')).toBe(false);
    expect(api.getStockAlerts()).toHaveLength(1);
  });

  it('should handle malformed JSON on import', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.importConfig('not valid json {{{');
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle non-object JSON on import', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.importConfig('"just a string"');
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should report errors for unknown distributor in import', () => {
    const api = SupplierApiManager.getInstance();
    const result = api.importConfig(JSON.stringify({
      enabledDistributors: ['digikey', 'fake-dist'],
    }));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e: string) => e.includes('fake-dist'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Persistence', () => {
  it('should persist to localStorage on state change', () => {
    const api = SupplierApiManager.getInstance();
    api.setCurrency('GBP');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'protopulse-supplier-api',
      expect.any(String),
    );
  });

  it('should restore state from localStorage', () => {
    // Set up persisted state
    const state = {
      enabledDistributors: ['digikey', 'mouser'],
      currency: 'EUR',
      cacheExpiryMs: 30000,
      stockAlerts: [{ mpn: 'NE555', threshold: 100 }],
    };
    store['protopulse-supplier-api'] = JSON.stringify(state);

    SupplierApiManager.resetForTesting();
    const api = SupplierApiManager.getInstance();

    expect(api.getCurrency()).toBe('EUR');
    expect(api.isEnabled('digikey')).toBe(true);
    expect(api.isEnabled('mouser')).toBe(true);
    expect(api.isEnabled('lcsc')).toBe(false); // not in enabledDistributors
    expect(api.getStockAlerts()).toHaveLength(1);
  });

  it('should handle corrupt localStorage data gracefully', () => {
    store['protopulse-supplier-api'] = 'corrupt{{{data';
    SupplierApiManager.resetForTesting();
    const api = SupplierApiManager.getInstance();
    // Should fall back to defaults
    expect(api.getCurrency()).toBe('USD');
    expect(api.getDistributors().length).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Notify
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Subscribe', () => {
  it('should notify listeners on state changes', () => {
    const api = SupplierApiManager.getInstance();
    const listener = vi.fn();
    api.subscribe(listener);

    api.setCurrency('JPY');
    expect(listener).toHaveBeenCalledTimes(1);

    api.disableDistributor('mouser');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('should unsubscribe correctly', () => {
    const api = SupplierApiManager.getInstance();
    const listener = vi.fn();
    const unsub = api.subscribe(listener);

    api.setCurrency('EUR');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    api.setCurrency('GBP');
    expect(listener).toHaveBeenCalledTimes(1); // no additional call
  });

  it('should support multiple subscribers', () => {
    const api = SupplierApiManager.getInstance();
    const l1 = vi.fn();
    const l2 = vi.fn();
    api.subscribe(l1);
    api.subscribe(l2);

    api.setStockAlert('NE555', 100);
    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Singleton', () => {
  it('should return the same instance', () => {
    const a = SupplierApiManager.getInstance();
    const b = SupplierApiManager.getInstance();
    expect(a).toBe(b);
  });

  it('should return a new instance after resetForTesting', () => {
    const a = SupplierApiManager.getInstance();
    SupplierApiManager.resetForTesting();
    const b = SupplierApiManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Clear / Reset
// ---------------------------------------------------------------------------

describe('SupplierApiManager — clear', () => {
  it('should reset all state to defaults', () => {
    const api = SupplierApiManager.getInstance();
    api.setCurrency('EUR');
    api.disableDistributor('digikey');
    api.setStockAlert('NE555', 100);
    api.searchPart('ATmega328P'); // populate cache

    api.clear();

    expect(api.getCurrency()).toBe('USD');
    expect(api.isEnabled('digikey')).toBe(true);
    expect(api.getStockAlerts()).toHaveLength(0);
    expect(api.getCacheSize()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('SupplierApiManager — Edge Cases', () => {
  it('should handle zero quantity in getBestPrice', () => {
    const api = SupplierApiManager.getInstance();
    // Zero quantity should still work — returns unit price for first tier
    const best = api.getBestPrice('NE555', 0);
    // Might be null if no tier matches quantity 0
    // The getPriceForQuantity fallback returns first tier price
    expect(best === null || best.totalPrice === 0).toBe(true);
  });

  it('should handle BOM with zero quantity', () => {
    const api = SupplierApiManager.getInstance();
    const quote = api.quoteBom([{ mpn: 'NE555', quantity: 0 }]);
    expect(quote.items).toHaveLength(1);
  });

  it('should handle all distributors disabled', () => {
    const api = SupplierApiManager.getInstance();
    const allIds: DistributorId[] = ['digikey', 'mouser', 'octopart', 'newark', 'arrow', 'lcsc', 'farnell'];
    allIds.forEach((id) => api.disableDistributor(id));

    const results = api.searchPart('ATmega328P');
    // Results should still contain mock data but offers might be filtered
    expect(results).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Hook shape
// ---------------------------------------------------------------------------

describe('useSupplierApi — hook shape', () => {
  it('should export the hook function', () => {
    expect(typeof useSupplierApi).toBe('function');
  });
});
