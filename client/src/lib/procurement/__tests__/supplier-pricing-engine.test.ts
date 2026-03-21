import { describe, it, expect, beforeEach } from 'vitest';
import { SupplierPricingEngine } from '../supplier-pricing-engine';
import type { PricingRequest } from '../supplier-pricing-engine';

describe('SupplierPricingEngine', () => {
  let engine: SupplierPricingEngine;

  beforeEach(() => {
    SupplierPricingEngine.resetInstance();
    engine = SupplierPricingEngine.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = SupplierPricingEngine.getInstance();
      const b = SupplierPricingEngine.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = SupplierPricingEngine.getInstance();
      SupplierPricingEngine.resetInstance();
      const b = SupplierPricingEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Providers
  // -----------------------------------------------------------------------

  describe('providers', () => {
    it('has 6 default providers', () => {
      expect(engine.getProviders()).toHaveLength(6);
    });

    it('has correct provider IDs', () => {
      const ids = engine.getProviders().map((p) => p.id);
      expect(ids).toContain('digikey');
      expect(ids).toContain('mouser');
      expect(ids).toContain('lcsc');
      expect(ids).toContain('newark');
      expect(ids).toContain('farnell');
      expect(ids).toContain('arrow');
    });

    it('all providers are enabled by default', () => {
      const providers = engine.getProviders();
      expect(providers.every((p) => p.enabled)).toBe(true);
    });

    it('can disable a provider', () => {
      engine.setProviderEnabled('lcsc', false);
      const lcsc = engine.getProviders().find((p) => p.id === 'lcsc');
      expect(lcsc?.enabled).toBe(false);
    });

    it('can re-enable a provider', () => {
      engine.setProviderEnabled('lcsc', false);
      engine.setProviderEnabled('lcsc', true);
      const lcsc = engine.getProviders().find((p) => p.id === 'lcsc');
      expect(lcsc?.enabled).toBe(true);
    });

    it('throws on unknown provider', () => {
      expect(() => engine.setProviderEnabled('unknown', false)).toThrow('Unknown provider');
    });

    it('returns copies from getProviders', () => {
      const a = engine.getProviders();
      const b = engine.getProviders();
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
    });

    it('each provider has supportedRegions', () => {
      const providers = engine.getProviders();
      for (const p of providers) {
        expect(p.supportedRegions.length).toBeGreaterThan(0);
      }
    });

    it('each provider has a display name', () => {
      const providers = engine.getProviders();
      for (const p of providers) {
        expect(p.displayName.length).toBeGreaterThan(0);
      }
    });

    it('each provider has a positive rateLimit', () => {
      const providers = engine.getProviders();
      for (const p of providers) {
        expect(p.rateLimit).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on quote', () => {
      let called = 0;
      engine.subscribe(() => { called += 1; });
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(called).toBeGreaterThan(0);
    });

    it('can unsubscribe', () => {
      let called = 0;
      const unsub = engine.subscribe(() => { called += 1; });
      unsub();
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(called).toBe(0);
    });

    it('notifies on provider toggle', () => {
      let called = 0;
      engine.subscribe(() => { called += 1; });
      engine.setProviderEnabled('lcsc', false);
      expect(called).toBe(1);
    });

    it('notifies on cache invalidation', () => {
      let called = 0;
      engine.subscribe(() => { called += 1; });
      engine.invalidateCache();
      expect(called).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // requestQuote
  // -----------------------------------------------------------------------

  describe('requestQuote', () => {
    it('returns quotes from all enabled providers', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result.quotes).toHaveLength(6);
    });

    it('returns fewer quotes when providers disabled', () => {
      engine.setProviderEnabled('lcsc', false);
      engine.setProviderEnabled('farnell', false);
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result.quotes).toHaveLength(4);
    });

    it('returns bestPrice', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result.bestPrice).toBeDefined();
      const minPrice = Math.min(...result.quotes.map((q) => q.unitPrice));
      expect(result.bestPrice!.unitPrice).toBe(minPrice);
    });

    it('returns bestStock', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result.bestStock).toBeDefined();
      const maxStock = Math.max(...result.quotes.map((q) => q.stock));
      expect(result.bestStock!.stock).toBe(maxStock);
    });

    it('filters by specific provider', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10, provider: 'digikey' });
      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].provider).toBe('digikey');
    });

    it('returns error for unknown specific provider', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10, provider: 'unknown' });
      expect(result.quotes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('not found');
    });

    it('returns error for empty part number', () => {
      const result = engine.requestQuote({ partNumber: '', quantity: 10 });
      expect(result.quotes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('returns error for whitespace-only part number', () => {
      const result = engine.requestQuote({ partNumber: '   ', quantity: 10 });
      expect(result.quotes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('returns error for zero quantity', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 0 });
      expect(result.quotes).toHaveLength(0);
      expect(result.errors[0].error).toContain('positive');
    });

    it('returns error for negative quantity', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: -5 });
      expect(result.quotes).toHaveLength(0);
    });

    it('filters by region', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10, region: 'EU' });
      // LCSC does not support EU in the default config but the others do — verify no LCSC
      // Actually LCSC supports APAC and US, not EU
      const providerIds = result.quotes.map((q) => q.provider);
      expect(providerIds).not.toContain('lcsc');
    });

    it('reports unsupported region as error', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10, region: 'EU' });
      const lcscError = result.errors.find((e) => e.provider === 'lcsc');
      expect(lcscError).toBeDefined();
    });

    it('has requestedAt timestamp', () => {
      const before = Date.now();
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result.requestedAt).toBeGreaterThanOrEqual(before);
    });

    it('has non-negative duration', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('produces deterministic pricing for same inputs', () => {
      const r1 = engine.requestQuote({ partNumber: 'LM7805', quantity: 100 });
      // Invalidate cache to force recalculation
      engine.invalidateCache();
      const r2 = engine.requestQuote({ partNumber: 'LM7805', quantity: 100 });
      expect(r1.quotes.map((q) => q.unitPrice)).toEqual(r2.quotes.map((q) => q.unitPrice));
    });

    it('quotes have valid fields', () => {
      const result = engine.requestQuote({ partNumber: 'NE555', quantity: 50 });
      for (const q of result.quotes) {
        expect(q.partNumber).toBe('NE555');
        expect(q.unitPrice).toBeGreaterThan(0);
        expect(q.currency).toBe('USD');
        expect(q.moq).toBeGreaterThan(0);
        expect(q.stock).toBeGreaterThan(0);
        expect(q.leadTimeDays).toBeGreaterThan(0);
        expect(q.timestamp).toBeGreaterThan(0);
      }
    });

    it('quotes include datasheet URLs', () => {
      const result = engine.requestQuote({ partNumber: 'NE555', quantity: 50 });
      for (const q of result.quotes) {
        expect(q.datasheet).toBeDefined();
        expect(q.datasheet).toContain('NE555');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Cache
  // -----------------------------------------------------------------------

  describe('cache', () => {
    it('returns cached results on second request', () => {
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      const result2 = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      expect(result2.quotes.every((q) => q.cached)).toBe(true);
    });

    it('getCachedQuote returns null for unknown part', () => {
      expect(engine.getCachedQuote('UNKNOWN_PART')).toBeNull();
    });

    it('getCachedQuote returns quotes after request', () => {
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      const cached = engine.getCachedQuote('ATmega328P');
      expect(cached).not.toBeNull();
      expect(cached!.length).toBeGreaterThan(0);
    });

    it('invalidateCache for specific part', () => {
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      engine.invalidateCache('ATmega328P');
      expect(engine.getCachedQuote('ATmega328P')).toBeNull();
    });

    it('invalidateCache for all parts', () => {
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      engine.requestQuote({ partNumber: 'NE555', quantity: 10 });
      engine.invalidateCache();
      expect(engine.getCachedQuote('ATmega328P')).toBeNull();
      expect(engine.getCachedQuote('NE555')).toBeNull();
    });

    it('cache is case-insensitive for part numbers', () => {
      engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      const cached = engine.getCachedQuote('atmega328p');
      expect(cached).not.toBeNull();
    });

    it('cached quotes are marked as cached', () => {
      engine.requestQuote({ partNumber: 'NE555', quantity: 1 });
      const cached = engine.getCachedQuote('NE555');
      expect(cached).not.toBeNull();
      for (const q of cached!) {
        expect(q.cached).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // requestBulkQuotes
  // -----------------------------------------------------------------------

  describe('requestBulkQuotes', () => {
    it('returns results for all items', () => {
      const items: PricingRequest[] = [
        { partNumber: 'ATmega328P', quantity: 10 },
        { partNumber: 'NE555', quantity: 100 },
        { partNumber: 'LM7805', quantity: 50 },
      ];
      const results = engine.requestBulkQuotes(items);
      expect(results.size).toBe(3);
      expect(results.has('ATmega328P')).toBe(true);
      expect(results.has('NE555')).toBe(true);
      expect(results.has('LM7805')).toBe(true);
    });

    it('each result has quotes', () => {
      const items: PricingRequest[] = [
        { partNumber: 'R1K', quantity: 200 },
        { partNumber: 'C100nF', quantity: 200 },
      ];
      const results = engine.requestBulkQuotes(items);
      results.forEach((result) => {
        expect(result.quotes.length).toBeGreaterThan(0);
      });
    });

    it('handles empty list', () => {
      const results = engine.requestBulkQuotes([]);
      expect(results.size).toBe(0);
    });

    it('handles single item', () => {
      const results = engine.requestBulkQuotes([{ partNumber: 'ATmega328P', quantity: 1 }]);
      expect(results.size).toBe(1);
    });

    it('caches results from bulk request', () => {
      engine.requestBulkQuotes([
        { partNumber: 'BULK1', quantity: 10 },
        { partNumber: 'BULK2', quantity: 20 },
      ]);
      expect(engine.getCachedQuote('BULK1')).not.toBeNull();
      expect(engine.getCachedQuote('BULK2')).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // compareProviders
  // -----------------------------------------------------------------------

  describe('compareProviders', () => {
    it('returns sorted arrays', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      const comparison = engine.compareProviders('ATmega328P', result);

      // byPrice sorted ascending
      for (let i = 1; i < comparison.byPrice.length; i++) {
        expect(comparison.byPrice[i].unitPrice).toBeGreaterThanOrEqual(comparison.byPrice[i - 1].unitPrice);
      }

      // byStock sorted descending
      for (let i = 1; i < comparison.byStock.length; i++) {
        expect(comparison.byStock[i].stock).toBeLessThanOrEqual(comparison.byStock[i - 1].stock);
      }

      // byLeadTime sorted ascending
      for (let i = 1; i < comparison.byLeadTime.length; i++) {
        expect(comparison.byLeadTime[i].leadTimeDays).toBeGreaterThanOrEqual(comparison.byLeadTime[i - 1].leadTimeDays);
      }
    });

    it('returns recommendation string', () => {
      const result = engine.requestQuote({ partNumber: 'ATmega328P', quantity: 10 });
      const comparison = engine.compareProviders('ATmega328P', result);
      expect(comparison.recommendation.length).toBeGreaterThan(0);
    });

    it('handles empty quotes', () => {
      const emptyResult = { quotes: [], errors: [], requestedAt: Date.now(), duration: 0 };
      const comparison = engine.compareProviders('NONE', emptyResult);
      expect(comparison.recommendation).toBe('No quotes available');
      expect(comparison.byPrice).toHaveLength(0);
    });

    it('recommendation mentions provider names', () => {
      const result = engine.requestQuote({ partNumber: 'LM7805', quantity: 50 });
      const comparison = engine.compareProviders('LM7805', result);
      const providerIds = engine.getProviders().map((p) => p.id);
      const mentionsProvider = providerIds.some((id) => comparison.recommendation.includes(id));
      expect(mentionsProvider).toBe(true);
    });
  });
});
