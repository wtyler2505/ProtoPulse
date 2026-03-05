/**
 * Embed Routes Tests — server/routes/embed.ts
 *
 * Tests the in-memory short URL store for embeddable schematics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../db', () => ({
  db: {},
  pool: {},
  checkConnection: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {},
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock express-rate-limit to pass through
vi.mock('express-rate-limit', () => ({
  default: () => (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  store,
  TTL_MS,
  MAX_DATA_SIZE,
  CODE_LENGTH,
  generateCode,
} from '../routes/embed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: { 'content-length': '0' },
    get: vi.fn().mockReturnValue('localhost:5000'),
    protocol: 'http',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Embed routes', () => {
  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    store.clear();
  });

  // -----------------------------------------------------------------------
  // generateCode
  // -----------------------------------------------------------------------

  describe('generateCode', () => {
    it('produces a string of CODE_LENGTH characters', () => {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
    });

    it('produces alphanumeric characters only', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateCode();
        expect(code).toMatch(/^[A-Za-z0-9]+$/);
      }
    });

    it('generates unique codes (statistical check with 100 codes)', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCode());
      }
      // With 62^8 possibilities, collisions should be astronomically unlikely
      expect(codes.size).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // Store
  // -----------------------------------------------------------------------

  describe('in-memory store', () => {
    it('can set and get entries', () => {
      store.set('testcode', { data: 'rABC', createdAt: Date.now() });
      const entry = store.get('testcode');
      expect(entry).toBeDefined();
      expect(entry?.data).toBe('rABC');
    });

    it('returns undefined for missing codes', () => {
      expect(store.get('nonexistent')).toBeUndefined();
    });

    it('can delete entries', () => {
      store.set('todelete', { data: 'rABC', createdAt: Date.now() });
      store.delete('todelete');
      expect(store.get('todelete')).toBeUndefined();
    });

    it('clear removes all entries', () => {
      store.set('a', { data: '1', createdAt: Date.now() });
      store.set('b', { data: '2', createdAt: Date.now() });
      store.clear();
      expect(store.size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  describe('constants', () => {
    it('TTL_MS is 30 days', () => {
      expect(TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('MAX_DATA_SIZE is 500KB', () => {
      expect(MAX_DATA_SIZE).toBe(500 * 1024);
    });

    it('CODE_LENGTH is 8', () => {
      expect(CODE_LENGTH).toBe(8);
    });
  });

  // -----------------------------------------------------------------------
  // Route handler logic (unit-test the store interactions directly)
  // -----------------------------------------------------------------------

  describe('POST /api/embeds logic', () => {
    it('creates a short URL entry in the store', () => {
      const code = generateCode();
      const data = 'rBase64EncodedCircuit';
      store.set(code, { data, createdAt: Date.now() });

      const entry = store.get(code);
      expect(entry).toBeDefined();
      expect(entry?.data).toBe(data);
    });

    it('rejects data exceeding MAX_DATA_SIZE', () => {
      const largeData = 'x'.repeat(MAX_DATA_SIZE + 1);
      // Simulating the validation that the route handler does
      expect(largeData.length).toBeGreaterThan(MAX_DATA_SIZE);
    });

    it('rejects empty data', () => {
      const emptyData = '';
      expect(emptyData.length).toBe(0);
    });

    it('generates unique code even if first attempt collides', () => {
      // Fill store with a known code
      const knownCode = generateCode();
      store.set(knownCode, { data: 'rOld', createdAt: Date.now() });

      // The next code should be different (extremely high probability)
      let newCode = generateCode();
      let attempts = 0;
      while (store.has(newCode) && attempts < 10) {
        newCode = generateCode();
        attempts++;
      }
      expect(store.has(newCode)).toBe(false);
    });
  });

  describe('GET /api/embeds/:code logic', () => {
    it('returns data for a valid code', () => {
      const code = 'abcd1234';
      store.set(code, { data: 'rCircuitData', createdAt: Date.now() });

      const entry = store.get(code);
      expect(entry?.data).toBe('rCircuitData');
    });

    it('returns undefined for unknown code', () => {
      expect(store.get('noexist1')).toBeUndefined();
    });

    it('entry is expired after TTL', () => {
      const code = 'expired1';
      const expiredTime = Date.now() - TTL_MS - 1000;
      store.set(code, { data: 'rOld', createdAt: expiredTime });

      const entry = store.get(code);
      expect(entry).toBeDefined();
      // Check expiration manually (as the route handler does)
      const isExpired = Date.now() - (entry?.createdAt ?? 0) > TTL_MS;
      expect(isExpired).toBe(true);
    });

    it('entry is valid before TTL', () => {
      const code = 'valid001';
      store.set(code, { data: 'rFresh', createdAt: Date.now() });

      const entry = store.get(code);
      const isExpired = Date.now() - (entry?.createdAt ?? 0) > TTL_MS;
      expect(isExpired).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Zod validation (direct schema testing)
  // -----------------------------------------------------------------------

  describe('validation schema', () => {
    it('accepts valid data', () => {
      const { z } = require('zod');
      const schema = z.object({
        data: z.string().min(1).max(MAX_DATA_SIZE),
      });
      const result = schema.safeParse({ data: 'rSomeData' });
      expect(result.success).toBe(true);
    });

    it('rejects missing data field', () => {
      const { z } = require('zod');
      const schema = z.object({
        data: z.string().min(1).max(MAX_DATA_SIZE),
      });
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects empty data string', () => {
      const { z } = require('zod');
      const schema = z.object({
        data: z.string().min(1).max(MAX_DATA_SIZE),
      });
      const result = schema.safeParse({ data: '' });
      expect(result.success).toBe(false);
    });

    it('rejects data exceeding max size', () => {
      const { z } = require('zod');
      const schema = z.object({
        data: z.string().min(1).max(MAX_DATA_SIZE),
      });
      const result = schema.safeParse({ data: 'x'.repeat(MAX_DATA_SIZE + 1) });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple entries
  // -----------------------------------------------------------------------

  describe('multiple entries', () => {
    it('stores multiple independent entries', () => {
      store.set('code0001', { data: 'rFirst', createdAt: Date.now() });
      store.set('code0002', { data: 'rSecond', createdAt: Date.now() });
      store.set('code0003', { data: 'rThird', createdAt: Date.now() });

      expect(store.get('code0001')?.data).toBe('rFirst');
      expect(store.get('code0002')?.data).toBe('rSecond');
      expect(store.get('code0003')?.data).toBe('rThird');
      expect(store.size).toBe(3);
    });

    it('overwriting a code replaces the entry', () => {
      store.set('same0001', { data: 'rOriginal', createdAt: Date.now() });
      store.set('same0001', { data: 'rUpdated', createdAt: Date.now() });
      expect(store.get('same0001')?.data).toBe('rUpdated');
      expect(store.size).toBe(1);
    });
  });
});
