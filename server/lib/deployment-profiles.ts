/**
 * Deployment Profiles with Config Validation (BL-0264)
 *
 * Defines dev/staging/prod deployment profiles with typed configuration
 * and runtime validation. Each profile encapsulates environment-specific
 * defaults for server behavior: logging, security, rate limiting, CORS,
 * database pooling, caching, and feature flags.
 *
 * Usage:
 *   const profile = getActiveProfile();
 *   // profile.rateLimiting.windowMs, profile.security.trustProxy, etc.
 *
 *   // Validate env overrides against profile constraints:
 *   const errors = validateProfile(profile);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Log level identifiers matching server/logger.ts */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Recognized deployment environment names. */
export type DeploymentEnvironment = 'development' | 'staging' | 'production';

/** Security-related configuration. */
export interface SecurityConfig {
  /** Number of trusted reverse proxy hops (Express trust proxy). */
  trustProxy: number;
  /** Whether to enforce Content-Security-Policy (vs reportOnly). */
  enforceCSP: boolean;
  /** Whether auth bypass via UNSAFE_DEV_BYPASS_AUTH is permitted. */
  allowAuthBypass: boolean;
  /** Whether to require API_KEY_ENCRYPTION_KEY (vs ephemeral fallback). */
  requireEncryptionKey: boolean;
  /** Whether debug/metrics endpoints are exposed. */
  exposeDebugEndpoints: boolean;
}

/** Rate limiting configuration. */
export interface RateLimitConfig {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum requests per window. */
  maxRequests: number;
  /** Whether to apply stricter limits on admin endpoints. */
  strictAdminLimits: boolean;
}

/** Database pool configuration. */
export interface DatabaseConfig {
  /** Maximum number of connections in the pool. */
  poolMax: number;
  /** Idle timeout in milliseconds before a connection is released. */
  idleTimeoutMs: number;
  /** Connection timeout in milliseconds. */
  connectionTimeoutMs: number;
  /** Whether to enable SSL for the database connection. */
  ssl: boolean;
}

/** CORS configuration. */
export interface CorsConfig {
  /** Default allowed origins (in addition to env-provided CORS_ALLOWED_ORIGINS). */
  defaultOrigins: readonly string[];
  /** Whether to include common localhost origins automatically. */
  includeLocalhostOrigins: boolean;
}

/** Cache configuration. */
export interface CacheConfig {
  /** LRU cache maximum entries. */
  maxEntries: number;
  /** Default TTL in seconds for cached responses. */
  defaultTtlSeconds: number;
}

/** Feature flags that differ between environments. */
export interface FeatureFlags {
  /** Whether collaboration (WebSocket) is enabled by default. */
  collaborationEnabled: boolean;
  /** Whether the seed endpoint is accessible. */
  seedEndpointEnabled: boolean;
  /** Whether service workers should be registered. */
  serviceWorkerEnabled: boolean;
}

/** Complete deployment profile configuration. */
export interface ProfileConfig {
  /** The deployment environment this profile targets. */
  environment: DeploymentEnvironment;
  /** Human-readable profile name. */
  name: string;
  /** Description of this deployment target. */
  description: string;
  /** Default log level for the environment. */
  logLevel: LogLevel;
  /** Default server port. */
  port: number;
  /** Security settings. */
  security: SecurityConfig;
  /** Rate limiting settings. */
  rateLimiting: RateLimitConfig;
  /** Database pool settings. */
  database: DatabaseConfig;
  /** CORS settings. */
  cors: CorsConfig;
  /** Cache settings. */
  cache: CacheConfig;
  /** Feature flags. */
  features: FeatureFlags;
}

/** A single validation error describing a misconfiguration. */
export interface ProfileValidationError {
  /** The config field path (e.g. "security.trustProxy"). */
  field: string;
  /** Human-readable error message. */
  message: string;
  /** Severity: error blocks startup, warning is advisory. */
  severity: 'error' | 'warning';
}

/** Result of profile validation. */
export interface ProfileValidationResult {
  valid: boolean;
  environment: DeploymentEnvironment;
  errors: ProfileValidationError[];
  warnings: ProfileValidationError[];
}

// ---------------------------------------------------------------------------
// Profile Defaults
// ---------------------------------------------------------------------------

const DEVELOPMENT_PROFILE: ProfileConfig = {
  environment: 'development',
  name: 'Development',
  description: 'Local development with relaxed security, verbose logging, and dev tools enabled.',
  logLevel: 'debug',
  port: 5000,
  security: {
    trustProxy: 0,
    enforceCSP: false,
    allowAuthBypass: true,
    requireEncryptionKey: false,
    exposeDebugEndpoints: true,
  },
  rateLimiting: {
    windowMs: 60_000,
    maxRequests: 1000,
    strictAdminLimits: false,
  },
  database: {
    poolMax: 10,
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 10_000,
    ssl: false,
  },
  cors: {
    defaultOrigins: [
      'http://localhost:5000',
      'http://localhost:3000',
      'http://127.0.0.1:5000',
    ],
    includeLocalhostOrigins: true,
  },
  cache: {
    maxEntries: 500,
    defaultTtlSeconds: 60,
  },
  features: {
    collaborationEnabled: true,
    seedEndpointEnabled: true,
    serviceWorkerEnabled: false,
  },
};

const STAGING_PROFILE: ProfileConfig = {
  environment: 'staging',
  name: 'Staging',
  description: 'Pre-production environment with production-like security but with debug endpoints and verbose logging.',
  logLevel: 'info',
  port: 5000,
  security: {
    trustProxy: 1,
    enforceCSP: true,
    allowAuthBypass: false,
    requireEncryptionKey: true,
    exposeDebugEndpoints: true,
  },
  rateLimiting: {
    windowMs: 60_000,
    maxRequests: 300,
    strictAdminLimits: true,
  },
  database: {
    poolMax: 20,
    idleTimeoutMs: 20_000,
    connectionTimeoutMs: 5_000,
    ssl: true,
  },
  cors: {
    defaultOrigins: [],
    includeLocalhostOrigins: false,
  },
  cache: {
    maxEntries: 2000,
    defaultTtlSeconds: 300,
  },
  features: {
    collaborationEnabled: true,
    seedEndpointEnabled: true,
    serviceWorkerEnabled: true,
  },
};

const PRODUCTION_PROFILE: ProfileConfig = {
  environment: 'production',
  name: 'Production',
  description: 'Hardened production environment with strict security, minimal logging, and no dev tools.',
  logLevel: 'warn',
  port: 8080,
  security: {
    trustProxy: 1,
    enforceCSP: true,
    allowAuthBypass: false,
    requireEncryptionKey: true,
    exposeDebugEndpoints: false,
  },
  rateLimiting: {
    windowMs: 60_000,
    maxRequests: 100,
    strictAdminLimits: true,
  },
  database: {
    poolMax: 50,
    idleTimeoutMs: 10_000,
    connectionTimeoutMs: 5_000,
    ssl: true,
  },
  cors: {
    defaultOrigins: [],
    includeLocalhostOrigins: false,
  },
  cache: {
    maxEntries: 5000,
    defaultTtlSeconds: 600,
  },
  features: {
    collaborationEnabled: true,
    seedEndpointEnabled: false,
    serviceWorkerEnabled: true,
  },
};

/** All built-in profiles keyed by environment name. */
export const PROFILE_DEFAULTS: Readonly<Record<DeploymentEnvironment, ProfileConfig>> = {
  development: DEVELOPMENT_PROFILE,
  staging: STAGING_PROFILE,
  production: PRODUCTION_PROFILE,
} as const;

// ---------------------------------------------------------------------------
// Profile Resolution
// ---------------------------------------------------------------------------

/**
 * Parse NODE_ENV into a recognized DeploymentEnvironment.
 * Falls back to 'development' if unset or unrecognized.
 */
export function resolveEnvironment(nodeEnv?: string): DeploymentEnvironment {
  const env = (nodeEnv ?? '').trim().toLowerCase();
  if (env === 'production') {
    return 'production';
  }
  if (env === 'staging') {
    return 'staging';
  }
  return 'development';
}

/**
 * Get the deployment profile for the current environment.
 *
 * Reads NODE_ENV from process.env (or accepts an override) and returns
 * a deep copy of the matching profile with any env-var overrides applied.
 *
 * Supported env-var overrides:
 *   PORT            → profile.port
 *   LOG_LEVEL       → profile.logLevel
 *   TRUST_PROXY     → profile.security.trustProxy
 *   DB_POOL_MAX     → profile.database.poolMax
 *   CACHE_MAX       → profile.cache.maxEntries
 *   RATE_LIMIT_MAX  → profile.rateLimiting.maxRequests
 */
export function getActiveProfile(envOverride?: string): ProfileConfig {
  const environment = resolveEnvironment(envOverride ?? process.env.NODE_ENV);
  const base = PROFILE_DEFAULTS[environment];

  // Deep copy so callers can't mutate PROFILE_DEFAULTS
  const profile: ProfileConfig = structuredClone(base);

  // Apply env-var overrides (only if set and parseable)
  const portStr = process.env.PORT;
  if (portStr !== undefined) {
    const parsed = Number(portStr);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 65535) {
      profile.port = parsed;
    }
  }

  const logLevelStr = process.env.LOG_LEVEL;
  if (logLevelStr !== undefined && isValidLogLevel(logLevelStr)) {
    profile.logLevel = logLevelStr;
  }

  const trustProxyStr = process.env.TRUST_PROXY;
  if (trustProxyStr !== undefined) {
    const parsed = Number(trustProxyStr);
    if (Number.isFinite(parsed) && parsed >= 0) {
      profile.security.trustProxy = parsed;
    }
  }

  const poolMaxStr = process.env.DB_POOL_MAX;
  if (poolMaxStr !== undefined) {
    const parsed = Number(poolMaxStr);
    if (Number.isFinite(parsed) && parsed >= 1) {
      profile.database.poolMax = parsed;
    }
  }

  const cacheMaxStr = process.env.CACHE_MAX;
  if (cacheMaxStr !== undefined) {
    const parsed = Number(cacheMaxStr);
    if (Number.isFinite(parsed) && parsed >= 0) {
      profile.cache.maxEntries = parsed;
    }
  }

  const rateLimitMaxStr = process.env.RATE_LIMIT_MAX;
  if (rateLimitMaxStr !== undefined) {
    const parsed = Number(rateLimitMaxStr);
    if (Number.isFinite(parsed) && parsed >= 1) {
      profile.rateLimiting.maxRequests = parsed;
    }
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a profile configuration for consistency and security.
 *
 * Returns structured errors (blocks startup) and warnings (advisory).
 * Validates environment-specific invariants — e.g., production must not
 * allow auth bypass, must require encryption keys, etc.
 */
export function validateProfile(profile: ProfileConfig): ProfileValidationResult {
  const errors: ProfileValidationError[] = [];
  const warnings: ProfileValidationError[] = [];

  // ── Universal validations ──────────────────────────────────────────────

  if (profile.port < 0 || profile.port > 65535) {
    errors.push({
      field: 'port',
      message: `Port must be between 0 and 65535, got ${profile.port}.`,
      severity: 'error',
    });
  }

  if (profile.rateLimiting.maxRequests < 1) {
    errors.push({
      field: 'rateLimiting.maxRequests',
      message: `maxRequests must be at least 1, got ${profile.rateLimiting.maxRequests}.`,
      severity: 'error',
    });
  }

  if (profile.rateLimiting.windowMs < 1000) {
    warnings.push({
      field: 'rateLimiting.windowMs',
      message: `Rate limit window < 1 second (${profile.rateLimiting.windowMs}ms) is unusually short.`,
      severity: 'warning',
    });
  }

  if (profile.database.poolMax < 1) {
    errors.push({
      field: 'database.poolMax',
      message: `Database pool max must be at least 1, got ${profile.database.poolMax}.`,
      severity: 'error',
    });
  }

  if (profile.database.connectionTimeoutMs < 1000) {
    warnings.push({
      field: 'database.connectionTimeoutMs',
      message: `Connection timeout < 1 second (${profile.database.connectionTimeoutMs}ms) may cause premature failures.`,
      severity: 'warning',
    });
  }

  if (profile.database.idleTimeoutMs < 1000) {
    warnings.push({
      field: 'database.idleTimeoutMs',
      message: `Idle timeout < 1 second (${profile.database.idleTimeoutMs}ms) may cause excessive connection churn.`,
      severity: 'warning',
    });
  }

  if (profile.cache.maxEntries < 0) {
    errors.push({
      field: 'cache.maxEntries',
      message: `Cache maxEntries must be non-negative, got ${profile.cache.maxEntries}.`,
      severity: 'error',
    });
  }

  if (profile.cache.defaultTtlSeconds < 0) {
    errors.push({
      field: 'cache.defaultTtlSeconds',
      message: `Cache defaultTtlSeconds must be non-negative, got ${profile.cache.defaultTtlSeconds}.`,
      severity: 'error',
    });
  }

  if (!isValidLogLevel(profile.logLevel)) {
    errors.push({
      field: 'logLevel',
      message: `Invalid log level "${profile.logLevel}". Must be one of: debug, info, warn, error.`,
      severity: 'error',
    });
  }

  if (profile.security.trustProxy < 0) {
    errors.push({
      field: 'security.trustProxy',
      message: `trustProxy must be non-negative, got ${profile.security.trustProxy}.`,
      severity: 'error',
    });
  }

  // ── Production-specific invariants ──────────────────────────────────────

  if (profile.environment === 'production') {
    if (profile.security.allowAuthBypass) {
      errors.push({
        field: 'security.allowAuthBypass',
        message: 'Auth bypass must not be enabled in production.',
        severity: 'error',
      });
    }

    if (!profile.security.requireEncryptionKey) {
      errors.push({
        field: 'security.requireEncryptionKey',
        message: 'Encryption key must be required in production.',
        severity: 'error',
      });
    }

    if (!profile.security.enforceCSP) {
      errors.push({
        field: 'security.enforceCSP',
        message: 'CSP must be enforced (not reportOnly) in production.',
        severity: 'error',
      });
    }

    if (profile.security.exposeDebugEndpoints) {
      errors.push({
        field: 'security.exposeDebugEndpoints',
        message: 'Debug endpoints must not be exposed in production.',
        severity: 'error',
      });
    }

    if (!profile.database.ssl) {
      errors.push({
        field: 'database.ssl',
        message: 'Database SSL must be enabled in production.',
        severity: 'error',
      });
    }

    if (profile.cors.includeLocalhostOrigins) {
      errors.push({
        field: 'cors.includeLocalhostOrigins',
        message: 'Localhost CORS origins must not be included in production.',
        severity: 'error',
      });
    }

    if (profile.features.seedEndpointEnabled) {
      warnings.push({
        field: 'features.seedEndpointEnabled',
        message: 'Seed endpoint is enabled in production — ensure it is rate-limited and guarded.',
        severity: 'warning',
      });
    }

    if (profile.logLevel === 'debug') {
      warnings.push({
        field: 'logLevel',
        message: 'Debug-level logging in production may cause excessive output and performance degradation.',
        severity: 'warning',
      });
    }

    if (profile.rateLimiting.maxRequests > 500) {
      warnings.push({
        field: 'rateLimiting.maxRequests',
        message: `Rate limit of ${profile.rateLimiting.maxRequests} req/min in production is unusually high.`,
        severity: 'warning',
      });
    }
  }

  // ── Staging-specific checks ────────────────────────────────────────────

  if (profile.environment === 'staging') {
    if (profile.security.allowAuthBypass) {
      errors.push({
        field: 'security.allowAuthBypass',
        message: 'Auth bypass must not be enabled in staging.',
        severity: 'error',
      });
    }

    if (!profile.security.requireEncryptionKey) {
      warnings.push({
        field: 'security.requireEncryptionKey',
        message: 'Encryption key should be required in staging for production parity.',
        severity: 'warning',
      });
    }

    if (profile.cors.includeLocalhostOrigins) {
      warnings.push({
        field: 'cors.includeLocalhostOrigins',
        message: 'Localhost CORS origins included in staging — consider removing for production parity.',
        severity: 'warning',
      });
    }
  }

  // ── Development-specific checks ────────────────────────────────────────

  if (profile.environment === 'development') {
    if (profile.security.trustProxy > 0) {
      warnings.push({
        field: 'security.trustProxy',
        message: `trustProxy is ${profile.security.trustProxy} in development — usually 0 unless behind a local reverse proxy.`,
        severity: 'warning',
      });
    }

    if (profile.database.ssl) {
      warnings.push({
        field: 'database.ssl',
        message: 'Database SSL is enabled in development — this may cause connection issues with local PostgreSQL.',
        severity: 'warning',
      });
    }
  }

  return {
    valid: errors.length === 0,
    environment: profile.environment,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(['debug', 'info', 'warn', 'error']);

/** Type guard for valid log level strings. */
export function isValidLogLevel(level: string): level is LogLevel {
  return VALID_LOG_LEVELS.has(level);
}

/** Get the list of all supported environment names. */
export function getSupportedEnvironments(): readonly DeploymentEnvironment[] {
  return ['development', 'staging', 'production'] as const;
}

/**
 * Get a profile by environment name (without env-var overrides).
 * Returns a deep copy of the defaults.
 */
export function getProfileDefaults(environment: DeploymentEnvironment): ProfileConfig {
  return structuredClone(PROFILE_DEFAULTS[environment]);
}

/**
 * Merge partial overrides into a base profile.
 * Useful for tests or programmatic profile customization.
 */
export function mergeProfileOverrides(
  base: ProfileConfig,
  overrides: DeepPartial<Omit<ProfileConfig, 'environment' | 'name'>>,
): ProfileConfig {
  const merged = structuredClone(base);

  if (overrides.description !== undefined) {
    merged.description = overrides.description;
  }
  if (overrides.logLevel !== undefined) {
    merged.logLevel = overrides.logLevel;
  }
  if (overrides.port !== undefined) {
    merged.port = overrides.port;
  }

  if (overrides.security) {
    Object.assign(merged.security, overrides.security);
  }
  if (overrides.rateLimiting) {
    Object.assign(merged.rateLimiting, overrides.rateLimiting);
  }
  if (overrides.database) {
    Object.assign(merged.database, overrides.database);
  }
  if (overrides.cors) {
    if (overrides.cors.defaultOrigins !== undefined) {
      merged.cors = {
        ...merged.cors,
        defaultOrigins: overrides.cors.defaultOrigins as readonly string[],
      };
    }
    if (overrides.cors.includeLocalhostOrigins !== undefined) {
      merged.cors = {
        ...merged.cors,
        includeLocalhostOrigins: overrides.cors.includeLocalhostOrigins,
      };
    }
  }
  if (overrides.cache) {
    Object.assign(merged.cache, overrides.cache);
  }
  if (overrides.features) {
    Object.assign(merged.features, overrides.features);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Internal type helpers
// ---------------------------------------------------------------------------

/** Recursive partial type for nested objects. */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
