import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  getActiveProfile,
  getProfileDefaults,
  getSupportedEnvironments,
  isValidLogLevel,
  mergeProfileOverrides,
  PROFILE_DEFAULTS,
  resolveEnvironment,
  validateProfile,
} from '../deployment-profiles';

import type {
  DeploymentEnvironment,
  ProfileConfig,
  ProfileValidationResult,
} from '../deployment-profiles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save and restore process.env around each test. */
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
  vi.restoreAllMocks();
});

/** Remove all override env vars so defaults are tested cleanly. */
function clearOverrideEnvVars(): void {
  delete process.env.PORT;
  delete process.env.LOG_LEVEL;
  delete process.env.TRUST_PROXY;
  delete process.env.DB_POOL_MAX;
  delete process.env.CACHE_MAX;
  delete process.env.RATE_LIMIT_MAX;
  delete process.env.NODE_ENV;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deployment-profiles', () => {
  // ── resolveEnvironment ────────────────────────────────────────────────

  describe('resolveEnvironment', () => {
    it('returns "development" for undefined input', () => {
      expect(resolveEnvironment(undefined)).toBe('development');
    });

    it('returns "development" for empty string', () => {
      expect(resolveEnvironment('')).toBe('development');
    });

    it('returns "development" for unrecognized values', () => {
      expect(resolveEnvironment('test')).toBe('development');
      expect(resolveEnvironment('qa')).toBe('development');
      expect(resolveEnvironment('local')).toBe('development');
    });

    it('returns "production" for "production"', () => {
      expect(resolveEnvironment('production')).toBe('production');
    });

    it('returns "production" case-insensitively', () => {
      expect(resolveEnvironment('PRODUCTION')).toBe('production');
      expect(resolveEnvironment('Production')).toBe('production');
    });

    it('returns "staging" for "staging"', () => {
      expect(resolveEnvironment('staging')).toBe('staging');
    });

    it('returns "staging" case-insensitively', () => {
      expect(resolveEnvironment('STAGING')).toBe('staging');
      expect(resolveEnvironment('Staging')).toBe('staging');
    });

    it('returns "development" for "development"', () => {
      expect(resolveEnvironment('development')).toBe('development');
    });

    it('trims whitespace', () => {
      expect(resolveEnvironment('  production  ')).toBe('production');
      expect(resolveEnvironment('  staging  ')).toBe('staging');
    });
  });

  // ── PROFILE_DEFAULTS ──────────────────────────────────────────────────

  describe('PROFILE_DEFAULTS', () => {
    it('contains all three environments', () => {
      expect(PROFILE_DEFAULTS).toHaveProperty('development');
      expect(PROFILE_DEFAULTS).toHaveProperty('staging');
      expect(PROFILE_DEFAULTS).toHaveProperty('production');
    });

    it('development profile has expected defaults', () => {
      const dev = PROFILE_DEFAULTS.development;
      expect(dev.environment).toBe('development');
      expect(dev.logLevel).toBe('debug');
      expect(dev.security.allowAuthBypass).toBe(true);
      expect(dev.security.enforceCSP).toBe(false);
      expect(dev.security.requireEncryptionKey).toBe(false);
      expect(dev.security.exposeDebugEndpoints).toBe(true);
      expect(dev.database.ssl).toBe(false);
      expect(dev.cors.includeLocalhostOrigins).toBe(true);
      expect(dev.features.seedEndpointEnabled).toBe(true);
      expect(dev.features.serviceWorkerEnabled).toBe(false);
    });

    it('staging profile has production-like security', () => {
      const staging = PROFILE_DEFAULTS.staging;
      expect(staging.environment).toBe('staging');
      expect(staging.logLevel).toBe('info');
      expect(staging.security.allowAuthBypass).toBe(false);
      expect(staging.security.enforceCSP).toBe(true);
      expect(staging.security.requireEncryptionKey).toBe(true);
      expect(staging.database.ssl).toBe(true);
      expect(staging.cors.includeLocalhostOrigins).toBe(false);
      expect(staging.security.exposeDebugEndpoints).toBe(true);
    });

    it('production profile has strictest security', () => {
      const prod = PROFILE_DEFAULTS.production;
      expect(prod.environment).toBe('production');
      expect(prod.logLevel).toBe('warn');
      expect(prod.security.allowAuthBypass).toBe(false);
      expect(prod.security.enforceCSP).toBe(true);
      expect(prod.security.requireEncryptionKey).toBe(true);
      expect(prod.security.exposeDebugEndpoints).toBe(false);
      expect(prod.database.ssl).toBe(true);
      expect(prod.cors.includeLocalhostOrigins).toBe(false);
      expect(prod.features.seedEndpointEnabled).toBe(false);
      expect(prod.features.serviceWorkerEnabled).toBe(true);
    });

    it('production rate limits are stricter than development', () => {
      expect(PROFILE_DEFAULTS.production.rateLimiting.maxRequests).toBeLessThan(
        PROFILE_DEFAULTS.development.rateLimiting.maxRequests,
      );
    });

    it('production database pool is larger than development', () => {
      expect(PROFILE_DEFAULTS.production.database.poolMax).toBeGreaterThan(
        PROFILE_DEFAULTS.development.database.poolMax,
      );
    });

    it('production cache is larger than development', () => {
      expect(PROFILE_DEFAULTS.production.cache.maxEntries).toBeGreaterThan(
        PROFILE_DEFAULTS.development.cache.maxEntries,
      );
    });

    it('all profiles have non-empty name and description', () => {
      for (const env of Object.keys(PROFILE_DEFAULTS) as DeploymentEnvironment[]) {
        const profile = PROFILE_DEFAULTS[env];
        expect(profile.name).toBeTruthy();
        expect(profile.description).toBeTruthy();
      }
    });
  });

  // ── getActiveProfile ───────────────────────────────────────────────────

  describe('getActiveProfile', () => {
    beforeEach(() => {
      clearOverrideEnvVars();
    });

    it('returns development profile when NODE_ENV is unset', () => {
      const profile = getActiveProfile();
      expect(profile.environment).toBe('development');
    });

    it('returns production profile when NODE_ENV is "production"', () => {
      process.env.NODE_ENV = 'production';
      const profile = getActiveProfile();
      expect(profile.environment).toBe('production');
    });

    it('returns staging profile when NODE_ENV is "staging"', () => {
      process.env.NODE_ENV = 'staging';
      const profile = getActiveProfile();
      expect(profile.environment).toBe('staging');
    });

    it('accepts explicit envOverride parameter', () => {
      process.env.NODE_ENV = 'production';
      const profile = getActiveProfile('development');
      expect(profile.environment).toBe('development');
    });

    it('applies PORT env override', () => {
      process.env.PORT = '3000';
      const profile = getActiveProfile('development');
      expect(profile.port).toBe(3000);
    });

    it('ignores invalid PORT values', () => {
      process.env.PORT = 'not-a-number';
      const profile = getActiveProfile('development');
      expect(profile.port).toBe(PROFILE_DEFAULTS.development.port);
    });

    it('ignores out-of-range PORT values', () => {
      process.env.PORT = '99999';
      const profile = getActiveProfile('development');
      expect(profile.port).toBe(PROFILE_DEFAULTS.development.port);
    });

    it('applies LOG_LEVEL env override', () => {
      process.env.LOG_LEVEL = 'error';
      const profile = getActiveProfile('development');
      expect(profile.logLevel).toBe('error');
    });

    it('ignores invalid LOG_LEVEL values', () => {
      process.env.LOG_LEVEL = 'verbose';
      const profile = getActiveProfile('development');
      expect(profile.logLevel).toBe(PROFILE_DEFAULTS.development.logLevel);
    });

    it('applies TRUST_PROXY env override', () => {
      process.env.TRUST_PROXY = '2';
      const profile = getActiveProfile('development');
      expect(profile.security.trustProxy).toBe(2);
    });

    it('applies DB_POOL_MAX env override', () => {
      process.env.DB_POOL_MAX = '25';
      const profile = getActiveProfile('development');
      expect(profile.database.poolMax).toBe(25);
    });

    it('ignores DB_POOL_MAX below 1', () => {
      process.env.DB_POOL_MAX = '0';
      const profile = getActiveProfile('development');
      expect(profile.database.poolMax).toBe(PROFILE_DEFAULTS.development.database.poolMax);
    });

    it('applies CACHE_MAX env override', () => {
      process.env.CACHE_MAX = '10000';
      const profile = getActiveProfile('development');
      expect(profile.cache.maxEntries).toBe(10000);
    });

    it('allows CACHE_MAX of 0', () => {
      process.env.CACHE_MAX = '0';
      const profile = getActiveProfile('development');
      expect(profile.cache.maxEntries).toBe(0);
    });

    it('applies RATE_LIMIT_MAX env override', () => {
      process.env.RATE_LIMIT_MAX = '50';
      const profile = getActiveProfile('production');
      expect(profile.rateLimiting.maxRequests).toBe(50);
    });

    it('ignores RATE_LIMIT_MAX below 1', () => {
      process.env.RATE_LIMIT_MAX = '0';
      const profile = getActiveProfile('production');
      expect(profile.rateLimiting.maxRequests).toBe(PROFILE_DEFAULTS.production.rateLimiting.maxRequests);
    });

    it('returns a deep copy — mutations do not affect defaults', () => {
      const profile = getActiveProfile('development');
      profile.port = 9999;
      profile.security.trustProxy = 99;
      expect(PROFILE_DEFAULTS.development.port).toBe(5000);
      expect(PROFILE_DEFAULTS.development.security.trustProxy).toBe(0);
    });
  });

  // ── validateProfile ────────────────────────────────────────────────────

  describe('validateProfile', () => {
    // ── Default profiles should be valid ──

    it('development defaults pass validation', () => {
      const result = validateProfile(PROFILE_DEFAULTS.development);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.environment).toBe('development');
    });

    it('staging defaults pass validation', () => {
      const result = validateProfile(PROFILE_DEFAULTS.staging);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.environment).toBe('staging');
    });

    it('production defaults pass validation', () => {
      const result = validateProfile(PROFILE_DEFAULTS.production);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.environment).toBe('production');
    });

    // ── Universal validation rules ──

    it('rejects invalid port', () => {
      const profile = getProfileDefaults('development');
      profile.port = -1;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'port')).toBe(true);
    });

    it('rejects port > 65535', () => {
      const profile = getProfileDefaults('development');
      profile.port = 70000;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'port')).toBe(true);
    });

    it('rejects maxRequests < 1', () => {
      const profile = getProfileDefaults('development');
      profile.rateLimiting.maxRequests = 0;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'rateLimiting.maxRequests')).toBe(true);
    });

    it('warns on very short rate limit window', () => {
      const profile = getProfileDefaults('development');
      profile.rateLimiting.windowMs = 500;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'rateLimiting.windowMs')).toBe(true);
    });

    it('rejects poolMax < 1', () => {
      const profile = getProfileDefaults('development');
      profile.database.poolMax = 0;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'database.poolMax')).toBe(true);
    });

    it('warns on very short connection timeout', () => {
      const profile = getProfileDefaults('development');
      profile.database.connectionTimeoutMs = 100;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'database.connectionTimeoutMs')).toBe(true);
    });

    it('warns on very short idle timeout', () => {
      const profile = getProfileDefaults('development');
      profile.database.idleTimeoutMs = 500;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'database.idleTimeoutMs')).toBe(true);
    });

    it('rejects negative cache maxEntries', () => {
      const profile = getProfileDefaults('development');
      profile.cache.maxEntries = -1;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'cache.maxEntries')).toBe(true);
    });

    it('rejects negative cache TTL', () => {
      const profile = getProfileDefaults('development');
      profile.cache.defaultTtlSeconds = -5;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'cache.defaultTtlSeconds')).toBe(true);
    });

    it('rejects negative trustProxy', () => {
      const profile = getProfileDefaults('development');
      profile.security.trustProxy = -1;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'security.trustProxy')).toBe(true);
    });

    it('rejects invalid log level', () => {
      const profile = getProfileDefaults('development');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      (profile as any).logLevel = 'verbose';
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'logLevel')).toBe(true);
    });

    // ── Production-specific invariants ──

    it('production rejects auth bypass', () => {
      const profile = getProfileDefaults('production');
      profile.security.allowAuthBypass = true;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'security.allowAuthBypass')).toBe(true);
    });

    it('production rejects missing encryption key requirement', () => {
      const profile = getProfileDefaults('production');
      profile.security.requireEncryptionKey = false;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'security.requireEncryptionKey')).toBe(true);
    });

    it('production rejects disabled CSP', () => {
      const profile = getProfileDefaults('production');
      profile.security.enforceCSP = false;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'security.enforceCSP')).toBe(true);
    });

    it('production rejects exposed debug endpoints', () => {
      const profile = getProfileDefaults('production');
      profile.security.exposeDebugEndpoints = true;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'security.exposeDebugEndpoints')).toBe(true);
    });

    it('production rejects disabled SSL', () => {
      const profile = getProfileDefaults('production');
      profile.database.ssl = false;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'database.ssl')).toBe(true);
    });

    it('production rejects localhost CORS origins', () => {
      const profile = getProfileDefaults('production');
      profile.cors.includeLocalhostOrigins = true;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'cors.includeLocalhostOrigins')).toBe(true);
    });

    it('production warns on seed endpoint enabled', () => {
      const profile = getProfileDefaults('production');
      profile.features.seedEndpointEnabled = true;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'features.seedEndpointEnabled')).toBe(true);
    });

    it('production warns on debug log level', () => {
      const profile = getProfileDefaults('production');
      profile.logLevel = 'debug';
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'logLevel')).toBe(true);
    });

    it('production warns on high rate limit', () => {
      const profile = getProfileDefaults('production');
      profile.rateLimiting.maxRequests = 1000;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'rateLimiting.maxRequests')).toBe(true);
    });

    // ── Staging-specific checks ──

    it('staging rejects auth bypass', () => {
      const profile = getProfileDefaults('staging');
      profile.security.allowAuthBypass = true;
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'security.allowAuthBypass')).toBe(true);
    });

    it('staging warns on missing encryption key requirement', () => {
      const profile = getProfileDefaults('staging');
      profile.security.requireEncryptionKey = false;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'security.requireEncryptionKey')).toBe(true);
    });

    it('staging warns on localhost CORS origins', () => {
      const profile = getProfileDefaults('staging');
      profile.cors.includeLocalhostOrigins = true;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'cors.includeLocalhostOrigins')).toBe(true);
    });

    // ── Development-specific checks ──

    it('development warns on non-zero trustProxy', () => {
      const profile = getProfileDefaults('development');
      profile.security.trustProxy = 2;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'security.trustProxy')).toBe(true);
    });

    it('development warns on SSL enabled', () => {
      const profile = getProfileDefaults('development');
      profile.database.ssl = true;
      const result = validateProfile(profile);
      expect(result.warnings.some((w) => w.field === 'database.ssl')).toBe(true);
    });

    // ── Result structure ──

    it('separates errors and warnings correctly', () => {
      const profile = getProfileDefaults('production');
      profile.security.allowAuthBypass = true; // error
      profile.logLevel = 'debug'; // warning
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      for (const e of result.errors) {
        expect(e.severity).toBe('error');
      }
      for (const w of result.warnings) {
        expect(w.severity).toBe('warning');
      }
    });

    it('includes environment in result', () => {
      const result = validateProfile(PROFILE_DEFAULTS.staging);
      expect(result.environment).toBe('staging');
    });

    it('accumulates multiple errors', () => {
      const profile = getProfileDefaults('production');
      profile.port = -1;
      profile.database.poolMax = 0;
      profile.security.allowAuthBypass = true;
      const result = validateProfile(profile);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── isValidLogLevel ────────────────────────────────────────────────────

  describe('isValidLogLevel', () => {
    it('accepts "debug"', () => {
      expect(isValidLogLevel('debug')).toBe(true);
    });

    it('accepts "info"', () => {
      expect(isValidLogLevel('info')).toBe(true);
    });

    it('accepts "warn"', () => {
      expect(isValidLogLevel('warn')).toBe(true);
    });

    it('accepts "error"', () => {
      expect(isValidLogLevel('error')).toBe(true);
    });

    it('rejects "verbose"', () => {
      expect(isValidLogLevel('verbose')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidLogLevel('')).toBe(false);
    });

    it('rejects uppercase', () => {
      expect(isValidLogLevel('DEBUG')).toBe(false);
    });
  });

  // ── getSupportedEnvironments ───────────────────────────────────────────

  describe('getSupportedEnvironments', () => {
    it('returns all three environments', () => {
      const envs = getSupportedEnvironments();
      expect(envs).toContain('development');
      expect(envs).toContain('staging');
      expect(envs).toContain('production');
      expect(envs).toHaveLength(3);
    });
  });

  // ── getProfileDefaults ─────────────────────────────────────────────────

  describe('getProfileDefaults', () => {
    it('returns a deep copy of the development profile', () => {
      const profile = getProfileDefaults('development');
      expect(profile.environment).toBe('development');
      profile.port = 9999;
      expect(PROFILE_DEFAULTS.development.port).toBe(5000);
    });

    it('returns a deep copy of the production profile', () => {
      const profile = getProfileDefaults('production');
      expect(profile.environment).toBe('production');
      profile.security.trustProxy = 99;
      expect(PROFILE_DEFAULTS.production.security.trustProxy).toBe(1);
    });

    it('returns a deep copy of the staging profile', () => {
      const profile = getProfileDefaults('staging');
      expect(profile.environment).toBe('staging');
    });
  });

  // ── mergeProfileOverrides ──────────────────────────────────────────────

  describe('mergeProfileOverrides', () => {
    it('overrides top-level scalar fields', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, { port: 3000, logLevel: 'error' });
      expect(merged.port).toBe(3000);
      expect(merged.logLevel).toBe('error');
    });

    it('preserves environment and name from base', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, { port: 3000 });
      expect(merged.environment).toBe('development');
      expect(merged.name).toBe('Development');
    });

    it('partially overrides nested security config', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, {
        security: { trustProxy: 3 },
      });
      expect(merged.security.trustProxy).toBe(3);
      // Other security fields should remain from base
      expect(merged.security.allowAuthBypass).toBe(true);
      expect(merged.security.enforceCSP).toBe(false);
    });

    it('partially overrides nested database config', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, {
        database: { poolMax: 100, ssl: true },
      });
      expect(merged.database.poolMax).toBe(100);
      expect(merged.database.ssl).toBe(true);
      // Preserved from base
      expect(merged.database.idleTimeoutMs).toBe(base.database.idleTimeoutMs);
    });

    it('overrides CORS defaultOrigins', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, {
        cors: { defaultOrigins: ['https://app.example.com'] },
      });
      expect(merged.cors.defaultOrigins).toEqual(['https://app.example.com']);
    });

    it('overrides feature flags', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, {
        features: { serviceWorkerEnabled: true },
      });
      expect(merged.features.serviceWorkerEnabled).toBe(true);
      expect(merged.features.collaborationEnabled).toBe(true);
    });

    it('overrides cache config', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, {
        cache: { maxEntries: 10000 },
      });
      expect(merged.cache.maxEntries).toBe(10000);
      expect(merged.cache.defaultTtlSeconds).toBe(base.cache.defaultTtlSeconds);
    });

    it('overrides rate limiting config', () => {
      const base = getProfileDefaults('development');
      const merged = mergeProfileOverrides(base, {
        rateLimiting: { maxRequests: 50, strictAdminLimits: true },
      });
      expect(merged.rateLimiting.maxRequests).toBe(50);
      expect(merged.rateLimiting.strictAdminLimits).toBe(true);
      expect(merged.rateLimiting.windowMs).toBe(base.rateLimiting.windowMs);
    });

    it('does not mutate the base profile', () => {
      const base = getProfileDefaults('development');
      const originalPort = base.port;
      mergeProfileOverrides(base, { port: 9999 });
      expect(base.port).toBe(originalPort);
    });

    it('handles empty overrides', () => {
      const base = getProfileDefaults('production');
      const merged = mergeProfileOverrides(base, {});
      expect(merged).toEqual(base);
    });
  });

  // ── Integration: getActiveProfile + validateProfile ────────────────────

  describe('integration', () => {
    beforeEach(() => {
      clearOverrideEnvVars();
    });

    it('active development profile passes validation', () => {
      const profile = getActiveProfile('development');
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('active staging profile passes validation', () => {
      const profile = getActiveProfile('staging');
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('active production profile passes validation', () => {
      const profile = getActiveProfile('production');
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('env overrides can create invalid production profile', () => {
      process.env.RATE_LIMIT_MAX = '2000';
      const profile = getActiveProfile('production');
      const result = validateProfile(profile);
      // Should warn about high rate limit
      expect(result.warnings.some((w) => w.field === 'rateLimiting.maxRequests')).toBe(true);
    });

    it('merged overrides can create invalid profile', () => {
      const base = getProfileDefaults('production');
      const broken = mergeProfileOverrides(base, {
        security: { allowAuthBypass: true },
      });
      const result = validateProfile(broken);
      expect(result.valid).toBe(false);
    });

    it('all default profiles validate without errors', () => {
      for (const env of getSupportedEnvironments()) {
        const result = validateProfile(PROFILE_DEFAULTS[env]);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });
});
