import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  setCacheHeaders,
  noCacheHeaders,
  buildCacheControlValue,
  CACHE_PROFILES,
} from '../cache-headers';
import type { CacheProfile } from '../cache-headers';

function createMockRes(): Response {
  const headers = new Map<string, string>();
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    }),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    _headers: headers,
  } as unknown as Response;
}

function createMockReq(): Request {
  return {} as Request;
}

describe('buildCacheControlValue', () => {
  it('returns no-store directive for noStore profiles', () => {
    const value = buildCacheControlValue({ maxAge: 0, noStore: true });
    expect(value).toBe('no-store, no-cache, must-revalidate');
  });

  it('returns private by default', () => {
    const value = buildCacheControlValue({ maxAge: 300 });
    expect(value).toBe('private, max-age=300');
  });

  it('returns public when isPrivate is false', () => {
    const value = buildCacheControlValue({ maxAge: 3600, isPrivate: false });
    expect(value).toBe('public, max-age=3600');
  });

  it('includes stale-while-revalidate when specified', () => {
    const value = buildCacheControlValue({ maxAge: 3600, isPrivate: false, staleWhileRevalidate: 300 });
    expect(value).toBe('public, max-age=3600, stale-while-revalidate=300');
  });

  it('omits stale-while-revalidate when zero', () => {
    const value = buildCacheControlValue({ maxAge: 3600, staleWhileRevalidate: 0 });
    expect(value).toBe('private, max-age=3600');
  });

  it('noStore overrides all other options', () => {
    const value = buildCacheControlValue({
      maxAge: 86400,
      isPrivate: false,
      staleWhileRevalidate: 600,
      noStore: true,
    });
    expect(value).toBe('no-store, no-cache, must-revalidate');
  });

  it('handles maxAge of 0 without noStore', () => {
    const value = buildCacheControlValue({ maxAge: 0 });
    expect(value).toBe('private, max-age=0');
  });
});

describe('CACHE_PROFILES', () => {
  it('static profile has 1 day maxAge and is public', () => {
    expect(CACHE_PROFILES.static.maxAge).toBe(86400);
    expect(CACHE_PROFILES.static.isPrivate).toBe(false);
  });

  it('component_library profile has 1 hour maxAge with stale-while-revalidate', () => {
    expect(CACHE_PROFILES.component_library.maxAge).toBe(3600);
    expect(CACHE_PROFILES.component_library.isPrivate).toBe(false);
    expect(CACHE_PROFILES.component_library.staleWhileRevalidate).toBe(300);
  });

  it('project_data profile has noStore', () => {
    expect(CACHE_PROFILES.project_data.noStore).toBe(true);
  });

  it('api_list profile has 5 minute maxAge and is private', () => {
    expect(CACHE_PROFILES.api_list.maxAge).toBe(300);
    expect(CACHE_PROFILES.api_list.isPrivate).toBe(true);
  });

  it('all profiles produce valid Cache-Control values', () => {
    for (const key of Object.keys(CACHE_PROFILES) as Array<keyof typeof CACHE_PROFILES>) {
      const value = buildCacheControlValue(CACHE_PROFILES[key]);
      expect(value).toBeTruthy();
      expect(typeof value).toBe('string');
    }
  });
});

describe('setCacheHeaders', () => {
  it('sets Cache-Control header using a named profile string', () => {
    const middleware = setCacheHeaders('component_library');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=3600, stale-while-revalidate=300',
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets Cache-Control header using a CacheProfile object', () => {
    const profile: CacheProfile = { maxAge: 600, isPrivate: true };
    const middleware = setCacheHeaders(profile);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=600');
    expect(next).toHaveBeenCalledOnce();
  });

  it('handles static profile correctly', () => {
    const middleware = setCacheHeaders('static');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    expect(next).toHaveBeenCalledOnce();
  });

  it('handles project_data profile (no-store)', () => {
    const middleware = setCacheHeaders('project_data');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate');
    expect(next).toHaveBeenCalledOnce();
  });

  it('handles api_list profile correctly', () => {
    const middleware = setCacheHeaders('api_list');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next exactly once', () => {
    const middleware = setCacheHeaders('static');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts a custom profile with stale-while-revalidate', () => {
    const profile: CacheProfile = { maxAge: 120, isPrivate: false, staleWhileRevalidate: 60 };
    const middleware = setCacheHeaders(profile);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=120, stale-while-revalidate=60',
    );
  });

  it('accepts a custom noStore profile', () => {
    const profile: CacheProfile = { maxAge: 0, noStore: true };
    const middleware = setCacheHeaders(profile);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate');
  });
});

describe('noCacheHeaders', () => {
  it('sets no-store Cache-Control header', () => {
    const middleware = noCacheHeaders();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate');
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next without arguments', () => {
    const middleware = noCacheHeaders();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('middleware reusability', () => {
  it('same middleware instance works across multiple requests', () => {
    const middleware = setCacheHeaders('api_list');

    for (let i = 0; i < 5; i++) {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('different profile instances produce independent middleware', () => {
    const m1 = setCacheHeaders('static');
    const m2 = setCacheHeaders('project_data');
    const req = createMockReq();
    const res1 = createMockRes();
    const res2 = createMockRes();
    const next1 = vi.fn();
    const next2 = vi.fn();

    m1(req, res1, next1);
    m2(req, res2, next2);

    expect(res1.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    expect(res2.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate');
  });
});

describe('edge cases', () => {
  it('handles very large maxAge values', () => {
    const value = buildCacheControlValue({ maxAge: 31536000 }); // 1 year
    expect(value).toBe('private, max-age=31536000');
  });

  it('handles isPrivate explicitly set to true', () => {
    const value = buildCacheControlValue({ maxAge: 60, isPrivate: true });
    expect(value).toBe('private, max-age=60');
  });

  it('handles isPrivate undefined (defaults to private)', () => {
    const value = buildCacheControlValue({ maxAge: 60 });
    expect(value).toBe('private, max-age=60');
  });

  it('noCacheHeaders creates a new middleware each call', () => {
    const m1 = noCacheHeaders();
    const m2 = noCacheHeaders();
    expect(m1).not.toBe(m2);
  });
});
