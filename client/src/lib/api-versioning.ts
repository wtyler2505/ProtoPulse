/**
 * ApiVersionManager — API versioning with path prefixing, deprecation headers,
 * migration guides, and OpenAPI version metadata.
 *
 * Supports RFC 8594 Sunset header for deprecation signaling. All API paths are
 * prefixed with /api/v{n}/ based on configured version. Provides version
 * negotiation, migration guide lookup, and OpenAPI info generation.
 *
 * Singleton + subscribe pattern for global state.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VersionStatus = 'current' | 'deprecated' | 'sunset' | 'beta' | 'alpha';

export interface ApiVersion {
  major: number;
  minor: number;
  patch: number;
  status: VersionStatus;
  releasedAt: string; // ISO 8601
  sunsetAt?: string; // ISO 8601, RFC 8594
  deprecatedAt?: string; // ISO 8601
  changelog?: string;
}

export interface VersionedPath {
  original: string;
  versioned: string;
  version: ApiVersion;
}

export interface DeprecationHeader {
  'Deprecation': string; // RFC 8594 date
  'Sunset'?: string; // RFC 8594 sunset date
  'Link'?: string; // migration guide URL
}

export interface MigrationStep {
  from: string; // e.g. "v1"
  to: string; // e.g. "v2"
  endpoint: string;
  description: string;
  breaking: boolean;
  before: string;
  after: string;
}

export interface MigrationGuide {
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
  publishedAt: string;
}

export interface OpenApiVersionInfo {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
  };
  servers: Array<{ url: string; description?: string }>;
}

export interface VersionNegotiationResult {
  requested: string;
  resolved: ApiVersion | null;
  fallback: boolean;
  error?: string;
}

export interface VersionCompatibility {
  compatible: boolean;
  currentVersion: string;
  requestedVersion: string;
  reason?: string;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION_HEADER = 'X-Api-Version';
const ACCEPT_VERSION_HEADER = 'Accept-Version';
const DEPRECATION_LINK_REL = 'deprecation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseVersionString(version: string): ApiVersion | null {
  const cleaned = version.replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(alpha|beta))?$/);
  if (!match) {
    return null;
  }
  const major = parseInt(match[1], 10);
  const minor = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  const patch = match[3] !== undefined ? parseInt(match[3], 10) : 0;
  const preRelease = match[4] as 'alpha' | 'beta' | undefined;

  let status: VersionStatus = 'current';
  if (preRelease === 'alpha') {
    status = 'alpha';
  } else if (preRelease === 'beta') {
    status = 'beta';
  }

  return {
    major,
    minor,
    patch,
    status,
    releasedAt: new Date().toISOString(),
  };
}

export function formatVersion(version: ApiVersion): string {
  return `v${version.major}.${version.minor}.${version.patch}`;
}

export function formatMajorVersion(version: ApiVersion): string {
  return `v${version.major}`;
}

export function compareVersions(a: ApiVersion, b: ApiVersion): number {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
}

export function isVersionCompatible(requested: ApiVersion, available: ApiVersion): boolean {
  // Same major version is compatible (semver)
  return requested.major === available.major && compareVersions(requested, available) <= 0;
}

export function buildVersionPrefix(version: ApiVersion): string {
  return `/api/v${version.major}`;
}

export function prefixPath(path: string, version: ApiVersion): string {
  const prefix = buildVersionPrefix(version);
  // Strip existing /api prefix if present
  const stripped = path.replace(/^\/api/, '');
  return `${prefix}${stripped}`;
}

export function stripVersionPrefix(path: string): { path: string; version: number | null } {
  const match = path.match(/^\/api\/v(\d+)(\/.*)?$/);
  if (!match) {
    return { path, version: null };
  }
  const version = parseInt(match[1], 10);
  const remaining = match[2] ?? '';
  return { path: `/api${remaining}`, version };
}

export function buildDeprecationHeaders(version: ApiVersion, migrationUrl?: string): DeprecationHeader | null {
  if (version.status !== 'deprecated' && version.status !== 'sunset') {
    return null;
  }

  const headers: DeprecationHeader = {
    Deprecation: version.deprecatedAt
      ? formatRfc8594Date(version.deprecatedAt)
      : formatRfc8594Date(new Date().toISOString()),
  };

  if (version.sunsetAt) {
    headers.Sunset = formatRfc8594Date(version.sunsetAt);
  }

  if (migrationUrl) {
    headers.Link = `<${migrationUrl}>; rel="${DEPRECATION_LINK_REL}"`;
  }

  return headers;
}

export function formatRfc8594Date(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) {
    return isoDate;
  }
  // RFC 7231 date format: Thu, 01 Dec 2025 00:00:00 GMT
  return d.toUTCString();
}

export function buildOpenApiInfo(version: ApiVersion, baseUrl: string): OpenApiVersionInfo {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ProtoPulse API',
      version: formatVersion(version),
      description: `ProtoPulse EDA Platform API ${formatMajorVersion(version)} — Status: ${version.status}`,
      contact: {
        name: 'ProtoPulse Team',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `${baseUrl}${buildVersionPrefix(version)}`,
        description: `${formatMajorVersion(version)} (${version.status})`,
      },
    ],
  };
}

export function validateVersionString(version: string): boolean {
  const cleaned = version.replace(/^v/i, '');
  return /^\d+(?:\.\d+)?(?:\.\d+)?(?:-(alpha|beta))?$/.test(cleaned);
}

// ---------------------------------------------------------------------------
// ApiVersionManager
// ---------------------------------------------------------------------------

export class ApiVersionManager {
  private static instance: ApiVersionManager | null = null;

  private versions: Map<string, ApiVersion> = new Map();
  private migrationGuides: Map<string, MigrationGuide> = new Map();
  private currentVersion: ApiVersion;
  private baseUrl: string;
  private listeners: Set<Listener> = new Set();

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.currentVersion = {
      major: 1,
      minor: 0,
      patch: 0,
      status: 'current',
      releasedAt: '2026-01-01T00:00:00.000Z',
    };
    this.versions.set('v1', this.currentVersion);
  }

  static getInstance(): ApiVersionManager {
    if (!ApiVersionManager.instance) {
      ApiVersionManager.instance = new ApiVersionManager();
    }
    return ApiVersionManager.instance;
  }

  static resetInstance(): void {
    ApiVersionManager.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((fn) => fn());
  }

  // -------------------------------------------------------------------------
  // Version registration
  // -------------------------------------------------------------------------

  registerVersion(version: ApiVersion): void {
    const key = formatMajorVersion(version);
    this.versions.set(key, version);

    // Auto-update current if this is the latest non-deprecated version
    if (version.status === 'current' && compareVersions(version, this.currentVersion) > 0) {
      this.currentVersion = version;
    }

    this.notify();
  }

  unregisterVersion(majorVersion: number): boolean {
    const key = `v${majorVersion}`;
    if (key === formatMajorVersion(this.currentVersion)) {
      return false; // Cannot unregister current version
    }
    const removed = this.versions.delete(key);
    if (removed) {
      this.notify();
    }
    return removed;
  }

  getVersion(versionStr: string): ApiVersion | null {
    const cleaned = versionStr.startsWith('v') ? versionStr : `v${versionStr}`;
    // Try exact match first
    const exact = this.versions.get(cleaned);
    if (exact) {
      return exact;
    }

    // Try parsing and matching by major
    const parsed = parseVersionString(versionStr);
    if (parsed) {
      return this.versions.get(`v${parsed.major}`) ?? null;
    }

    return null;
  }

  getCurrentVersion(): ApiVersion {
    return { ...this.currentVersion };
  }

  getAllVersions(): ApiVersion[] {
    return Array.from(this.versions.values()).sort(compareVersions);
  }

  getActiveVersions(): ApiVersion[] {
    return this.getAllVersions().filter((v) => v.status === 'current' || v.status === 'beta');
  }

  getDeprecatedVersions(): ApiVersion[] {
    return this.getAllVersions().filter((v) => v.status === 'deprecated' || v.status === 'sunset');
  }

  // -------------------------------------------------------------------------
  // Path operations
  // -------------------------------------------------------------------------

  prefixPath(path: string, version?: ApiVersion): VersionedPath {
    const v = version ?? this.currentVersion;
    return {
      original: path,
      versioned: prefixPath(path, v),
      version: v,
    };
  }

  prefixPaths(paths: string[], version?: ApiVersion): VersionedPath[] {
    return paths.map((p) => this.prefixPath(p, version));
  }

  stripPrefix(path: string): { path: string; version: number | null } {
    return stripVersionPrefix(path);
  }

  // -------------------------------------------------------------------------
  // Deprecation
  // -------------------------------------------------------------------------

  deprecateVersion(majorVersion: number, sunsetDate?: string): boolean {
    const key = `v${majorVersion}`;
    const version = this.versions.get(key);
    if (!version) {
      return false;
    }

    version.status = 'deprecated';
    version.deprecatedAt = new Date().toISOString();
    if (sunsetDate) {
      version.sunsetAt = sunsetDate;
    }

    this.notify();
    return true;
  }

  sunsetVersion(majorVersion: number): boolean {
    const key = `v${majorVersion}`;
    const version = this.versions.get(key);
    if (!version) {
      return false;
    }

    version.status = 'sunset';
    if (!version.sunsetAt) {
      version.sunsetAt = new Date().toISOString();
    }

    this.notify();
    return true;
  }

  getDeprecationHeaders(version: ApiVersion): DeprecationHeader | null {
    const guide = this.findMigrationGuide(formatMajorVersion(version));
    const migrationUrl = guide ? `${this.baseUrl}/docs/migration/${guide.fromVersion}-to-${guide.toVersion}` : undefined;
    return buildDeprecationHeaders(version, migrationUrl);
  }

  isVersionSunset(versionStr: string): boolean {
    const version = this.getVersion(versionStr);
    return version?.status === 'sunset';
  }

  isVersionDeprecated(versionStr: string): boolean {
    const version = this.getVersion(versionStr);
    return version?.status === 'deprecated' || version?.status === 'sunset';
  }

  // -------------------------------------------------------------------------
  // Version negotiation
  // -------------------------------------------------------------------------

  negotiate(requestedVersion: string): VersionNegotiationResult {
    if (!validateVersionString(requestedVersion)) {
      return {
        requested: requestedVersion,
        resolved: null,
        fallback: false,
        error: `Invalid version format: ${requestedVersion}`,
      };
    }

    const version = this.getVersion(requestedVersion);

    if (version) {
      if (version.status === 'sunset') {
        return {
          requested: requestedVersion,
          resolved: this.currentVersion,
          fallback: true,
          error: `Version ${requestedVersion} has been sunset. Falling back to ${formatVersion(this.currentVersion)}.`,
        };
      }
      return {
        requested: requestedVersion,
        resolved: version,
        fallback: false,
      };
    }

    // Version not found — fall back to current
    return {
      requested: requestedVersion,
      resolved: this.currentVersion,
      fallback: true,
      error: `Version ${requestedVersion} not found. Falling back to ${formatVersion(this.currentVersion)}.`,
    };
  }

  negotiateFromHeaders(headers: Record<string, string>): VersionNegotiationResult {
    const acceptVersion = headers[ACCEPT_VERSION_HEADER] ?? headers[ACCEPT_VERSION_HEADER.toLowerCase()];
    const apiVersion = headers[VERSION_HEADER] ?? headers[VERSION_HEADER.toLowerCase()];

    const requestedVersion = acceptVersion ?? apiVersion;

    if (!requestedVersion) {
      return {
        requested: '',
        resolved: this.currentVersion,
        fallback: true,
      };
    }

    return this.negotiate(requestedVersion);
  }

  checkCompatibility(requestedVersion: string, targetVersion: string): VersionCompatibility {
    const requested = this.getVersion(requestedVersion);
    const target = this.getVersion(targetVersion);

    if (!requested || !target) {
      return {
        compatible: false,
        currentVersion: targetVersion,
        requestedVersion,
        reason: `Unknown version: ${!requested ? requestedVersion : targetVersion}`,
      };
    }

    const compatible = isVersionCompatible(requested, target);
    return {
      compatible,
      currentVersion: formatVersion(target),
      requestedVersion: formatVersion(requested),
      reason: compatible ? undefined : `Major version mismatch: ${requested.major} vs ${target.major}`,
    };
  }

  // -------------------------------------------------------------------------
  // Migration guides
  // -------------------------------------------------------------------------

  registerMigrationGuide(guide: MigrationGuide): void {
    const key = `${guide.fromVersion}->${guide.toVersion}`;
    this.migrationGuides.set(key, guide);
    this.notify();
  }

  getMigrationGuide(fromVersion: string, toVersion: string): MigrationGuide | null {
    const key = `${fromVersion}->${toVersion}`;
    return this.migrationGuides.get(key) ?? null;
  }

  findMigrationGuide(fromVersion: string): MigrationGuide | null {
    const from = fromVersion.startsWith('v') ? fromVersion : `v${fromVersion}`;
    for (const [key, guide] of Array.from(this.migrationGuides.entries())) {
      if (key.startsWith(`${from}->`)) {
        return guide;
      }
    }
    return null;
  }

  getMigrationPath(fromVersion: string, toVersion: string): MigrationGuide[] {
    const path: MigrationGuide[] = [];
    let current = fromVersion;
    const visited = new Set<string>();

    while (current !== toVersion && !visited.has(current)) {
      visited.add(current);
      const guide = this.findMigrationGuide(current);
      if (!guide) {
        break;
      }
      path.push(guide);
      current = guide.toVersion;
    }

    return path;
  }

  getBreakingChanges(fromVersion: string, toVersion: string): MigrationStep[] {
    const guides = this.getMigrationPath(fromVersion, toVersion);
    return guides.flatMap((g) => g.steps.filter((s) => s.breaking));
  }

  // -------------------------------------------------------------------------
  // OpenAPI
  // -------------------------------------------------------------------------

  getOpenApiInfo(version?: ApiVersion): OpenApiVersionInfo {
    return buildOpenApiInfo(version ?? this.currentVersion, this.baseUrl);
  }

  getAllOpenApiInfos(): OpenApiVersionInfo[] {
    return this.getAllVersions().map((v) => buildOpenApiInfo(v, this.baseUrl));
  }

  // -------------------------------------------------------------------------
  // Response headers
  // -------------------------------------------------------------------------

  buildResponseHeaders(version?: ApiVersion): Record<string, string> {
    const v = version ?? this.currentVersion;
    const headers: Record<string, string> = {
      [VERSION_HEADER]: formatVersion(v),
    };

    const deprecation = this.getDeprecationHeaders(v);
    if (deprecation) {
      headers.Deprecation = deprecation.Deprecation;
      if (deprecation.Sunset) {
        headers.Sunset = deprecation.Sunset;
      }
      if (deprecation.Link) {
        headers.Link = deprecation.Link;
      }
    }

    return headers;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  toJSON(): { versions: ApiVersion[]; currentVersion: string; migrationGuides: MigrationGuide[] } {
    return {
      versions: this.getAllVersions(),
      currentVersion: formatVersion(this.currentVersion),
      migrationGuides: Array.from(this.migrationGuides.values()),
    };
  }

  static fromJSON(data: {
    versions: ApiVersion[];
    currentVersion: string;
    migrationGuides?: MigrationGuide[];
    baseUrl?: string;
  }): ApiVersionManager {
    const manager = new ApiVersionManager(data.baseUrl);
    manager.versions.clear();

    for (const version of data.versions) {
      manager.versions.set(formatMajorVersion(version), version);
    }

    const currentParsed = parseVersionString(data.currentVersion);
    if (currentParsed) {
      const found = manager.versions.get(formatMajorVersion(currentParsed));
      if (found) {
        manager.currentVersion = found;
      }
    }

    if (data.migrationGuides) {
      for (const guide of data.migrationGuides) {
        manager.registerMigrationGuide(guide);
      }
    }

    return manager;
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.notify();
  }

  getVersionCount(): number {
    return this.versions.size;
  }

  hasVersion(versionStr: string): boolean {
    return this.getVersion(versionStr) !== null;
  }

  reset(): void {
    this.versions.clear();
    this.migrationGuides.clear();
    this.currentVersion = {
      major: 1,
      minor: 0,
      patch: 0,
      status: 'current',
      releasedAt: '2026-01-01T00:00:00.000Z',
    };
    this.versions.set('v1', this.currentVersion);
    this.notify();
  }
}
