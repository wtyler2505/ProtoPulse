import type { Request, Response, NextFunction } from 'express';

/**
 * Cache profile configuration.
 * maxAge: max-age in seconds
 * isPrivate: if true, sets 'private' instead of 'public' (default: true for API responses)
 * staleWhileRevalidate: optional stale-while-revalidate in seconds
 * noStore: if true, sets 'no-store, no-cache, must-revalidate' (overrides all other options)
 */
export interface CacheProfile {
  maxAge: number;
  isPrivate?: boolean;
  staleWhileRevalidate?: number;
  noStore?: boolean;
}

/**
 * Pre-defined cache profiles for different endpoint categories.
 *
 * - static: Long-lived assets that rarely change (e.g. standard library seed data). 1 day, public.
 * - component_library: Public component library entries. 1 hour, public, 5 min stale-while-revalidate.
 * - project_data: Per-user project data that must always be fresh. No caching.
 * - api_list: Paginated list endpoints that benefit from short caching. 5 minutes, private.
 */
export const CACHE_PROFILES = {
  /** 1 day, public — for seed data, static assets served through API */
  static: {
    maxAge: 86400,
    isPrivate: false,
  } satisfies CacheProfile,

  /** 1 hour, public, 5 min stale-while-revalidate — for component library */
  component_library: {
    maxAge: 3600,
    isPrivate: false,
    staleWhileRevalidate: 300,
  } satisfies CacheProfile,

  /** No caching — for user-specific project data */
  project_data: {
    maxAge: 0,
    noStore: true,
  } satisfies CacheProfile,

  /** 5 minutes, private — for paginated list endpoints */
  api_list: {
    maxAge: 300,
    isPrivate: true,
  } satisfies CacheProfile,
} as const;

/**
 * Build a Cache-Control header value from a CacheProfile.
 */
export function buildCacheControlValue(profile: CacheProfile): string {
  if (profile.noStore) {
    return 'no-store, no-cache, must-revalidate';
  }

  const directives: string[] = [];

  directives.push(profile.isPrivate === false ? 'public' : 'private');
  directives.push(`max-age=${profile.maxAge}`);

  if (profile.staleWhileRevalidate !== undefined && profile.staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${profile.staleWhileRevalidate}`);
  }

  return directives.join(', ');
}

/**
 * Express middleware that sets Cache-Control headers based on a cache profile.
 *
 * @param profile - A CacheProfile object or a key from CACHE_PROFILES.
 * @returns Express middleware function.
 *
 * @example
 * // Using a named profile
 * app.get('/api/component-library', setCacheHeaders('component_library'), handler);
 *
 * @example
 * // Using a custom profile
 * app.get('/api/data', setCacheHeaders({ maxAge: 600, isPrivate: true }), handler);
 */
export function setCacheHeaders(
  profile: CacheProfile | keyof typeof CACHE_PROFILES,
): (req: Request, res: Response, next: NextFunction) => void {
  const resolved = typeof profile === 'string' ? CACHE_PROFILES[profile] : profile;
  const value = buildCacheControlValue(resolved);

  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', value);
    next();
  };
}

/**
 * Express middleware that sets no-cache headers for mutation endpoints.
 * Ensures responses from POST/PATCH/PUT/DELETE are never cached.
 */
export function noCacheHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  };
}
