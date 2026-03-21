import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApiVersionManager,
  parseVersionString,
  formatVersion,
  formatMajorVersion,
  compareVersions,
  isVersionCompatible,
  buildVersionPrefix,
  prefixPath,
  stripVersionPrefix,
  buildDeprecationHeaders,
  formatRfc8594Date,
  buildOpenApiInfo,
  validateVersionString,
} from '../api-versioning';
import type {
  ApiVersion,
  MigrationGuide,
  MigrationStep,
  VersionStatus,
} from '../api-versioning';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVersion(overrides: Partial<ApiVersion> = {}): ApiVersion {
  return {
    major: 1,
    minor: 0,
    patch: 0,
    status: 'current',
    releasedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStep(overrides: Partial<MigrationStep> = {}): MigrationStep {
  return {
    from: 'v1',
    to: 'v2',
    endpoint: '/api/projects',
    description: 'Changed response shape',
    breaking: true,
    before: 'GET /api/v1/projects',
    after: 'GET /api/v2/projects',
    ...overrides,
  };
}

function makeGuide(overrides: Partial<MigrationGuide> = {}): MigrationGuide {
  return {
    fromVersion: 'v1',
    toVersion: 'v2',
    steps: [makeStep()],
    publishedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseVersionString
// ---------------------------------------------------------------------------

describe('parseVersionString', () => {
  it('parses simple major version', () => {
    const v = parseVersionString('1');
    expect(v).not.toBeNull();
    expect(v!.major).toBe(1);
    expect(v!.minor).toBe(0);
    expect(v!.patch).toBe(0);
    expect(v!.status).toBe('current');
  });

  it('parses major.minor', () => {
    const v = parseVersionString('2.3');
    expect(v).not.toBeNull();
    expect(v!.major).toBe(2);
    expect(v!.minor).toBe(3);
    expect(v!.patch).toBe(0);
  });

  it('parses full semver', () => {
    const v = parseVersionString('3.2.1');
    expect(v).not.toBeNull();
    expect(v!.major).toBe(3);
    expect(v!.minor).toBe(2);
    expect(v!.patch).toBe(1);
  });

  it('parses with v prefix', () => {
    const v = parseVersionString('v2.1.0');
    expect(v).not.toBeNull();
    expect(v!.major).toBe(2);
  });

  it('parses alpha pre-release', () => {
    const v = parseVersionString('1.0.0-alpha');
    expect(v).not.toBeNull();
    expect(v!.status).toBe('alpha');
  });

  it('parses beta pre-release', () => {
    const v = parseVersionString('2.0.0-beta');
    expect(v).not.toBeNull();
    expect(v!.status).toBe('beta');
  });

  it('returns null for empty string', () => {
    expect(parseVersionString('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseVersionString('not-a-version')).toBeNull();
  });

  it('returns null for invalid pre-release', () => {
    expect(parseVersionString('1.0.0-rc1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatVersion / formatMajorVersion
// ---------------------------------------------------------------------------

describe('formatVersion', () => {
  it('formats full version string', () => {
    expect(formatVersion(makeVersion())).toBe('v1.0.0');
  });

  it('formats with non-zero minor and patch', () => {
    expect(formatVersion(makeVersion({ major: 3, minor: 2, patch: 1 }))).toBe('v3.2.1');
  });
});

describe('formatMajorVersion', () => {
  it('formats major-only string', () => {
    expect(formatMajorVersion(makeVersion({ major: 2 }))).toBe('v2');
  });
});

// ---------------------------------------------------------------------------
// compareVersions
// ---------------------------------------------------------------------------

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    const a = makeVersion();
    const b = makeVersion();
    expect(compareVersions(a, b)).toBe(0);
  });

  it('sorts by major first', () => {
    expect(compareVersions(makeVersion({ major: 1 }), makeVersion({ major: 2 }))).toBeLessThan(0);
  });

  it('sorts by minor when major equal', () => {
    expect(compareVersions(makeVersion({ minor: 1 }), makeVersion({ minor: 2 }))).toBeLessThan(0);
  });

  it('sorts by patch when major and minor equal', () => {
    expect(compareVersions(makeVersion({ patch: 1 }), makeVersion({ patch: 3 }))).toBeLessThan(0);
  });

  it('returns positive when first is greater', () => {
    expect(compareVersions(makeVersion({ major: 3 }), makeVersion({ major: 1 }))).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// isVersionCompatible
// ---------------------------------------------------------------------------

describe('isVersionCompatible', () => {
  it('returns true for same major version', () => {
    expect(isVersionCompatible(makeVersion({ major: 1 }), makeVersion({ major: 1 }))).toBe(true);
  });

  it('returns true when requested is lower minor', () => {
    expect(
      isVersionCompatible(makeVersion({ major: 1, minor: 0 }), makeVersion({ major: 1, minor: 2 })),
    ).toBe(true);
  });

  it('returns false for different major versions', () => {
    expect(isVersionCompatible(makeVersion({ major: 1 }), makeVersion({ major: 2 }))).toBe(false);
  });

  it('returns false when requested is higher than available', () => {
    expect(
      isVersionCompatible(makeVersion({ major: 1, minor: 3 }), makeVersion({ major: 1, minor: 1 })),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildVersionPrefix / prefixPath / stripVersionPrefix
// ---------------------------------------------------------------------------

describe('buildVersionPrefix', () => {
  it('builds /api/v{n} prefix', () => {
    expect(buildVersionPrefix(makeVersion({ major: 2 }))).toBe('/api/v2');
  });
});

describe('prefixPath', () => {
  it('prefixes a bare /api path', () => {
    expect(prefixPath('/api/projects', makeVersion({ major: 1 }))).toBe('/api/v1/projects');
  });

  it('prefixes a path without /api prefix', () => {
    expect(prefixPath('/projects', makeVersion({ major: 1 }))).toBe('/api/v1/projects');
  });

  it('handles root /api path', () => {
    expect(prefixPath('/api', makeVersion({ major: 2 }))).toBe('/api/v2');
  });
});

describe('stripVersionPrefix', () => {
  it('strips version prefix and returns version number', () => {
    const result = stripVersionPrefix('/api/v1/projects');
    expect(result.path).toBe('/api/projects');
    expect(result.version).toBe(1);
  });

  it('returns original path if no version prefix', () => {
    const result = stripVersionPrefix('/api/projects');
    expect(result.path).toBe('/api/projects');
    expect(result.version).toBeNull();
  });

  it('handles /api/v{n} without trailing path', () => {
    const result = stripVersionPrefix('/api/v3');
    expect(result.path).toBe('/api');
    expect(result.version).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// buildDeprecationHeaders
// ---------------------------------------------------------------------------

describe('buildDeprecationHeaders', () => {
  it('returns null for current version', () => {
    expect(buildDeprecationHeaders(makeVersion())).toBeNull();
  });

  it('returns null for beta version', () => {
    expect(buildDeprecationHeaders(makeVersion({ status: 'beta' }))).toBeNull();
  });

  it('returns deprecation header for deprecated version', () => {
    const v = makeVersion({ status: 'deprecated', deprecatedAt: '2026-06-01T00:00:00.000Z' });
    const headers = buildDeprecationHeaders(v);
    expect(headers).not.toBeNull();
    expect(headers!.Deprecation).toContain('2026');
  });

  it('includes Sunset header when sunsetAt is set', () => {
    const v = makeVersion({
      status: 'deprecated',
      deprecatedAt: '2026-06-01T00:00:00.000Z',
      sunsetAt: '2026-12-01T00:00:00.000Z',
    });
    const headers = buildDeprecationHeaders(v);
    expect(headers!.Sunset).toBeDefined();
    expect(headers!.Sunset).toContain('2026');
  });

  it('includes Link header when migration URL provided', () => {
    const v = makeVersion({ status: 'deprecated', deprecatedAt: '2026-06-01T00:00:00.000Z' });
    const headers = buildDeprecationHeaders(v, 'https://docs.example.com/migration');
    expect(headers!.Link).toContain('https://docs.example.com/migration');
    expect(headers!.Link).toContain('rel="deprecation"');
  });

  it('returns headers for sunset version', () => {
    const v = makeVersion({ status: 'sunset', sunsetAt: '2026-12-01T00:00:00.000Z' });
    const headers = buildDeprecationHeaders(v);
    expect(headers).not.toBeNull();
    expect(headers!.Sunset).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// formatRfc8594Date
// ---------------------------------------------------------------------------

describe('formatRfc8594Date', () => {
  it('formats ISO date to RFC 7231 format', () => {
    const result = formatRfc8594Date('2026-01-15T00:00:00.000Z');
    expect(result).toContain('Jan');
    expect(result).toContain('2026');
    expect(result).toContain('GMT');
  });

  it('returns original for invalid date', () => {
    expect(formatRfc8594Date('not-a-date')).toBe('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// buildOpenApiInfo
// ---------------------------------------------------------------------------

describe('buildOpenApiInfo', () => {
  it('builds valid OpenAPI info', () => {
    const info = buildOpenApiInfo(makeVersion(), 'https://api.example.com');
    expect(info.openapi).toBe('3.1.0');
    expect(info.info.title).toBe('ProtoPulse API');
    expect(info.info.version).toBe('v1.0.0');
    expect(info.servers).toHaveLength(1);
    expect(info.servers[0].url).toBe('https://api.example.com/api/v1');
  });

  it('includes version status in description', () => {
    const info = buildOpenApiInfo(makeVersion({ status: 'deprecated' }), '');
    expect(info.info.description).toContain('deprecated');
  });
});

// ---------------------------------------------------------------------------
// validateVersionString
// ---------------------------------------------------------------------------

describe('validateVersionString', () => {
  it('accepts valid version strings', () => {
    expect(validateVersionString('1')).toBe(true);
    expect(validateVersionString('1.0')).toBe(true);
    expect(validateVersionString('1.0.0')).toBe(true);
    expect(validateVersionString('v2.1.3')).toBe(true);
    expect(validateVersionString('1.0.0-alpha')).toBe(true);
    expect(validateVersionString('2.0.0-beta')).toBe(true);
  });

  it('rejects invalid version strings', () => {
    expect(validateVersionString('')).toBe(false);
    expect(validateVersionString('abc')).toBe(false);
    expect(validateVersionString('1.0.0-rc1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ApiVersionManager — constructor & singleton
// ---------------------------------------------------------------------------

describe('ApiVersionManager', () => {
  let manager: ApiVersionManager;

  beforeEach(() => {
    ApiVersionManager.resetInstance();
    manager = new ApiVersionManager('https://api.example.com');
  });

  describe('constructor', () => {
    it('initializes with v1 as current', () => {
      const current = manager.getCurrentVersion();
      expect(current.major).toBe(1);
      expect(current.status).toBe('current');
    });

    it('has one version registered', () => {
      expect(manager.getVersionCount()).toBe(1);
    });
  });

  describe('singleton', () => {
    it('returns same instance', () => {
      const a = ApiVersionManager.getInstance();
      const b = ApiVersionManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets instance', () => {
      const a = ApiVersionManager.getInstance();
      ApiVersionManager.resetInstance();
      const b = ApiVersionManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls listener on changes', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.registerVersion(makeVersion({ major: 2 }));
      expect(listener).toHaveBeenCalledOnce();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.registerVersion(makeVersion({ major: 2 }));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Version registration
  // -------------------------------------------------------------------------

  describe('registerVersion', () => {
    it('adds a new version', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      expect(manager.getVersionCount()).toBe(2);
      expect(manager.hasVersion('v2')).toBe(true);
    });

    it('auto-updates current if newer and current status', () => {
      manager.registerVersion(makeVersion({ major: 2, status: 'current' }));
      expect(manager.getCurrentVersion().major).toBe(2);
    });

    it('does not auto-update current for deprecated version', () => {
      manager.registerVersion(makeVersion({ major: 2, status: 'deprecated' }));
      expect(manager.getCurrentVersion().major).toBe(1);
    });
  });

  describe('unregisterVersion', () => {
    it('removes a non-current version', () => {
      manager.registerVersion(makeVersion({ major: 2, status: 'deprecated' }));
      expect(manager.unregisterVersion(2)).toBe(true);
      expect(manager.hasVersion('v2')).toBe(false);
    });

    it('refuses to remove current version', () => {
      expect(manager.unregisterVersion(1)).toBe(false);
      expect(manager.hasVersion('v1')).toBe(true);
    });
  });

  describe('getVersion', () => {
    it('gets version by key string', () => {
      const v = manager.getVersion('v1');
      expect(v).not.toBeNull();
      expect(v!.major).toBe(1);
    });

    it('gets version without v prefix', () => {
      const v = manager.getVersion('1');
      expect(v).not.toBeNull();
    });

    it('returns null for unknown version', () => {
      expect(manager.getVersion('v99')).toBeNull();
    });
  });

  describe('getAllVersions', () => {
    it('returns sorted versions', () => {
      manager.registerVersion(makeVersion({ major: 3 }));
      manager.registerVersion(makeVersion({ major: 2 }));
      const all = manager.getAllVersions();
      expect(all).toHaveLength(3);
      expect(all[0].major).toBe(1);
      expect(all[1].major).toBe(2);
      expect(all[2].major).toBe(3);
    });
  });

  describe('getActiveVersions', () => {
    it('returns only current and beta versions', () => {
      manager.registerVersion(makeVersion({ major: 2, status: 'beta' }));
      manager.registerVersion(makeVersion({ major: 3, status: 'deprecated' }));
      const active = manager.getActiveVersions();
      expect(active).toHaveLength(2);
      expect(active.every((v) => v.status === 'current' || v.status === 'beta')).toBe(true);
    });
  });

  describe('getDeprecatedVersions', () => {
    it('returns only deprecated and sunset versions', () => {
      manager.registerVersion(makeVersion({ major: 2, status: 'deprecated' }));
      manager.registerVersion(makeVersion({ major: 3, status: 'sunset' }));
      const deprecated = manager.getDeprecatedVersions();
      expect(deprecated).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Path operations
  // -------------------------------------------------------------------------

  describe('prefixPath', () => {
    it('prefixes with current version by default', () => {
      const result = manager.prefixPath('/api/projects');
      expect(result.versioned).toBe('/api/v1/projects');
      expect(result.original).toBe('/api/projects');
      expect(result.version.major).toBe(1);
    });

    it('prefixes with specified version', () => {
      const v2 = makeVersion({ major: 2 });
      const result = manager.prefixPath('/api/bom', v2);
      expect(result.versioned).toBe('/api/v2/bom');
    });
  });

  describe('prefixPaths', () => {
    it('prefixes multiple paths', () => {
      const results = manager.prefixPaths(['/api/projects', '/api/bom']);
      expect(results).toHaveLength(2);
      expect(results[0].versioned).toBe('/api/v1/projects');
      expect(results[1].versioned).toBe('/api/v1/bom');
    });
  });

  describe('stripPrefix', () => {
    it('delegates to stripVersionPrefix', () => {
      const result = manager.stripPrefix('/api/v1/projects');
      expect(result.path).toBe('/api/projects');
      expect(result.version).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Deprecation
  // -------------------------------------------------------------------------

  describe('deprecateVersion', () => {
    it('marks version as deprecated', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      expect(manager.deprecateVersion(2)).toBe(true);
      expect(manager.isVersionDeprecated('v2')).toBe(true);
    });

    it('returns false for unknown version', () => {
      expect(manager.deprecateVersion(99)).toBe(false);
    });

    it('sets sunsetAt when provided', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      manager.deprecateVersion(2, '2027-01-01T00:00:00.000Z');
      const v = manager.getVersion('v2');
      expect(v!.sunsetAt).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  describe('sunsetVersion', () => {
    it('marks version as sunset', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      expect(manager.sunsetVersion(2)).toBe(true);
      expect(manager.isVersionSunset('v2')).toBe(true);
    });

    it('returns false for unknown version', () => {
      expect(manager.sunsetVersion(99)).toBe(false);
    });
  });

  describe('getDeprecationHeaders', () => {
    it('returns null for current version', () => {
      expect(manager.getDeprecationHeaders(makeVersion())).toBeNull();
    });

    it('returns headers for deprecated version', () => {
      const v = makeVersion({ status: 'deprecated', deprecatedAt: '2026-06-01T00:00:00.000Z' });
      const headers = manager.getDeprecationHeaders(v);
      expect(headers).not.toBeNull();
    });

    it('includes migration link when guide exists', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      manager.registerMigrationGuide(makeGuide());
      const v = makeVersion({ status: 'deprecated', deprecatedAt: '2026-06-01T00:00:00.000Z' });
      const headers = manager.getDeprecationHeaders(v);
      expect(headers!.Link).toContain('/docs/migration/');
    });
  });

  // -------------------------------------------------------------------------
  // Version negotiation
  // -------------------------------------------------------------------------

  describe('negotiate', () => {
    it('resolves known version', () => {
      const result = manager.negotiate('v1');
      expect(result.resolved).not.toBeNull();
      expect(result.resolved!.major).toBe(1);
      expect(result.fallback).toBe(false);
    });

    it('falls back for unknown version', () => {
      const result = manager.negotiate('v99');
      expect(result.resolved!.major).toBe(1);
      expect(result.fallback).toBe(true);
      expect(result.error).toContain('not found');
    });

    it('falls back for sunset version', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      manager.sunsetVersion(2);
      const result = manager.negotiate('v2');
      expect(result.fallback).toBe(true);
      expect(result.error).toContain('sunset');
    });

    it('returns error for invalid format', () => {
      const result = manager.negotiate('invalid');
      expect(result.resolved).toBeNull();
      expect(result.error).toContain('Invalid version format');
    });
  });

  describe('negotiateFromHeaders', () => {
    it('uses Accept-Version header', () => {
      const result = manager.negotiateFromHeaders({ 'Accept-Version': 'v1' });
      expect(result.resolved!.major).toBe(1);
    });

    it('uses X-Api-Version as fallback', () => {
      const result = manager.negotiateFromHeaders({ 'X-Api-Version': 'v1' });
      expect(result.resolved!.major).toBe(1);
    });

    it('falls back to current when no version header', () => {
      const result = manager.negotiateFromHeaders({});
      expect(result.resolved!.major).toBe(1);
      expect(result.fallback).toBe(true);
    });

    it('prefers Accept-Version over X-Api-Version', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      const result = manager.negotiateFromHeaders({
        'Accept-Version': 'v2',
        'X-Api-Version': 'v1',
      });
      expect(result.resolved!.major).toBe(2);
    });
  });

  describe('checkCompatibility', () => {
    it('returns compatible for same major', () => {
      const result = manager.checkCompatibility('v1', 'v1');
      expect(result.compatible).toBe(true);
    });

    it('returns incompatible for unknown version', () => {
      const result = manager.checkCompatibility('v99', 'v1');
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Unknown version');
    });
  });

  // -------------------------------------------------------------------------
  // Migration guides
  // -------------------------------------------------------------------------

  describe('migration guides', () => {
    it('registers and retrieves a guide', () => {
      const guide = makeGuide();
      manager.registerMigrationGuide(guide);
      const retrieved = manager.getMigrationGuide('v1', 'v2');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.steps).toHaveLength(1);
    });

    it('returns null for unknown guide', () => {
      expect(manager.getMigrationGuide('v1', 'v5')).toBeNull();
    });

    it('finds migration guide from version', () => {
      manager.registerMigrationGuide(makeGuide());
      const guide = manager.findMigrationGuide('v1');
      expect(guide).not.toBeNull();
      expect(guide!.toVersion).toBe('v2');
    });

    it('returns null for findMigrationGuide with unknown version', () => {
      expect(manager.findMigrationGuide('v99')).toBeNull();
    });

    it('builds migration path across versions', () => {
      manager.registerMigrationGuide(makeGuide({ fromVersion: 'v1', toVersion: 'v2' }));
      manager.registerMigrationGuide(makeGuide({ fromVersion: 'v2', toVersion: 'v3' }));
      const path = manager.getMigrationPath('v1', 'v3');
      expect(path).toHaveLength(2);
    });

    it('returns empty path when no guides exist', () => {
      const path = manager.getMigrationPath('v1', 'v5');
      expect(path).toHaveLength(0);
    });

    it('avoids infinite loops in migration path', () => {
      manager.registerMigrationGuide(makeGuide({ fromVersion: 'v1', toVersion: 'v2' }));
      // No guide from v2 -> v3, path stops
      const path = manager.getMigrationPath('v1', 'v3');
      expect(path).toHaveLength(1);
    });

    it('gets breaking changes across versions', () => {
      manager.registerMigrationGuide(
        makeGuide({
          fromVersion: 'v1',
          toVersion: 'v2',
          steps: [makeStep({ breaking: true }), makeStep({ breaking: false, endpoint: '/api/bom' })],
        }),
      );
      const breaking = manager.getBreakingChanges('v1', 'v2');
      expect(breaking).toHaveLength(1);
      expect(breaking[0].breaking).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // OpenAPI
  // -------------------------------------------------------------------------

  describe('OpenAPI', () => {
    it('generates OpenAPI info for current version', () => {
      const info = manager.getOpenApiInfo();
      expect(info.info.version).toBe('v1.0.0');
      expect(info.servers[0].url).toContain('/api/v1');
    });

    it('generates OpenAPI info for specified version', () => {
      const v2 = makeVersion({ major: 2 });
      const info = manager.getOpenApiInfo(v2);
      expect(info.info.version).toBe('v2.0.0');
    });

    it('generates all OpenAPI infos', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      const infos = manager.getAllOpenApiInfos();
      expect(infos).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Response headers
  // -------------------------------------------------------------------------

  describe('buildResponseHeaders', () => {
    it('includes version header', () => {
      const headers = manager.buildResponseHeaders();
      expect(headers['X-Api-Version']).toBe('v1.0.0');
    });

    it('includes deprecation headers for deprecated version', () => {
      const v = makeVersion({
        major: 2,
        status: 'deprecated',
        deprecatedAt: '2026-06-01T00:00:00.000Z',
        sunsetAt: '2027-01-01T00:00:00.000Z',
      });
      manager.registerVersion(v);
      const headers = manager.buildResponseHeaders(v);
      expect(headers.Deprecation).toBeDefined();
      expect(headers.Sunset).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  describe('serialization', () => {
    it('round-trips through JSON', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      manager.registerMigrationGuide(makeGuide());
      const json = manager.toJSON();
      const restored = ApiVersionManager.fromJSON({ ...json, baseUrl: 'https://api.example.com' });
      expect(restored.getVersionCount()).toBe(2);
      expect(restored.getCurrentVersion().major).toBe(2);
      expect(restored.getMigrationGuide('v1', 'v2')).not.toBeNull();
    });

    it('fromJSON handles missing migration guides', () => {
      const restored = ApiVersionManager.fromJSON({
        versions: [makeVersion()],
        currentVersion: 'v1.0.0',
      });
      expect(restored.getVersionCount()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  describe('utility methods', () => {
    it('getBaseUrl returns configured base URL', () => {
      expect(manager.getBaseUrl()).toBe('https://api.example.com');
    });

    it('setBaseUrl updates and notifies', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setBaseUrl('https://new.example.com');
      expect(manager.getBaseUrl()).toBe('https://new.example.com');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('hasVersion checks existence', () => {
      expect(manager.hasVersion('v1')).toBe(true);
      expect(manager.hasVersion('v99')).toBe(false);
    });

    it('reset restores default state', () => {
      manager.registerVersion(makeVersion({ major: 2 }));
      manager.registerMigrationGuide(makeGuide());
      manager.reset();
      expect(manager.getVersionCount()).toBe(1);
      expect(manager.getCurrentVersion().major).toBe(1);
    });
  });
});
