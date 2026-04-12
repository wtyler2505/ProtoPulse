import { describe, it, expect } from 'vitest';
import { partsQueryKeys, partsMutationKeys } from '../query-keys';

describe('partsQueryKeys', () => {
  it('catalog key encodes text filter as search param', () => {
    const key = partsQueryKeys.catalog({ text: 'resistor' });
    expect(key[0]).toContain('text=resistor');
    expect(key[0]).toMatch(/^\/api\/parts\?/);
  });

  it('catalog key encodes projectId and hasStock', () => {
    const key = partsQueryKeys.catalog({ projectId: 5, hasStock: true });
    expect(key[0]).toContain('projectId=5');
    expect(key[0]).toContain('hasStock=true');
  });

  it('catalog key encodes origin filter', () => {
    const key = partsQueryKeys.catalog({ origin: 'library' });
    expect(key[0]).toContain('origin=library');
  });

  it('catalog key encodes isPublic filter', () => {
    const key = partsQueryKeys.catalog({ isPublic: true });
    expect(key[0]).toContain('isPublic=true');
  });

  it('catalog key encodes tags as comma-separated', () => {
    const key = partsQueryKeys.catalog({ tags: ['power', 'analog'] });
    expect(key[0]).toContain('tags=power%2Canalog');
  });

  it('catalog key omits undefined filters', () => {
    const key = partsQueryKeys.catalog({});
    expect(key[0]).toBe('/api/parts?');
  });

  it('catalog key includes namespace segments', () => {
    const key = partsQueryKeys.catalog({ text: 'cap' });
    expect(key[1]).toBe('parts');
    expect(key[2]).toBe('catalog');
  });

  it('detail key uses part ID', () => {
    const key = partsQueryKeys.detail('abc-123');
    expect(key[0]).toBe('/api/parts/abc-123');
    expect(key[3]).toBe('abc-123');
  });

  it('alternates key uses part ID', () => {
    const key = partsQueryKeys.alternates('xyz');
    expect(key[0]).toBe('/api/parts/xyz/alternates');
  });

  it('stock key includes project ID', () => {
    const key = partsQueryKeys.stock(42);
    expect(key[0]).toBe('/api/projects/42/stock');
    expect(key[3]).toBe(42);
  });

  it('lifecycle key uses part ID', () => {
    const key = partsQueryKeys.lifecycle('p1');
    expect(key[0]).toBe('/api/parts/p1/lifecycle');
  });

  it('spice key uses part ID', () => {
    const key = partsQueryKeys.spice('p2');
    expect(key[0]).toBe('/api/parts/p2/spice');
  });

  it('all key is the root prefix', () => {
    expect(partsQueryKeys.all).toEqual(['parts']);
  });
});

describe('partsMutationKeys', () => {
  it('ingress key is fixed', () => {
    expect(partsMutationKeys.ingress).toEqual(['parts-mutation', 'ingress']);
  });

  it('stock key includes project ID', () => {
    const key = partsMutationKeys.stock(7);
    expect(key).toEqual(['parts-mutation', 'stock', 7]);
  });
});
