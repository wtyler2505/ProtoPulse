/**
 * Deployment Profile Manager
 *
 * Manages environment-specific deployment configurations for ProtoPulse.
 * Supports development, staging, and production environments with built-in
 * defaults, validation, and localStorage persistence.
 *
 * Usage:
 *   const manager = DeploymentProfileManager.getInstance();
 *   manager.setActiveEnv('staging');
 *   const profile = manager.getActiveProfile();
 *
 * React hook:
 *   const { activeProfile, setActiveEnv, updateProfile, validate } = useDeploymentProfile();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeploymentEnv = 'development' | 'staging' | 'production';

export interface DeploymentProfile {
  env: DeploymentEnv;
  apiUrl: string;
  dbUrl: string;
  enableDebug: boolean;
  enableAnalytics: boolean;
  featureFlags: Record<string, boolean>;
  rateLimit: number;
  corsOrigins: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-deployment-profiles';

const URL_PATTERN = /^https?:\/\/.+/;

const POSTGRES_PATTERN = /^postgres(ql)?:\/\/.+/;

export const BUILT_IN_PROFILES: Record<DeploymentEnv, DeploymentProfile> = {
  development: {
    env: 'development',
    apiUrl: 'http://localhost:5000',
    dbUrl: 'postgresql://localhost:5432/protopulse_dev',
    enableDebug: true,
    enableAnalytics: false,
    featureFlags: {
      experimentalAI: true,
      betaExport: true,
      debugOverlay: true,
    },
    rateLimit: 1000,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173'],
  },
  staging: {
    env: 'staging',
    apiUrl: 'https://staging-api.protopulse.dev',
    dbUrl: 'postgresql://staging-db.protopulse.dev:5432/protopulse_staging',
    enableDebug: false,
    enableAnalytics: true,
    featureFlags: {
      experimentalAI: true,
      betaExport: true,
      debugOverlay: false,
    },
    rateLimit: 200,
    corsOrigins: ['https://staging.protopulse.dev'],
  },
  production: {
    env: 'production',
    apiUrl: 'https://api.protopulse.dev',
    dbUrl: 'postgresql://prod-db.protopulse.dev:5432/protopulse',
    enableDebug: false,
    enableAnalytics: true,
    featureFlags: {
      experimentalAI: false,
      betaExport: false,
      debugOverlay: false,
    },
    rateLimit: 100,
    corsOrigins: ['https://protopulse.dev', 'https://www.protopulse.dev'],
  },
};

const ALL_ENVS: DeploymentEnv[] = ['development', 'staging', 'production'];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a deployment profile. Returns errors (blocking) and warnings (advisory).
 *
 * Errors:
 *   - Missing or empty apiUrl / dbUrl
 *   - Invalid apiUrl format (must be http:// or https://)
 *   - Invalid dbUrl format (must be postgres:// or postgresql://)
 *   - env must be a valid DeploymentEnv
 *   - rateLimit must be a positive integer
 *   - corsOrigins must be an array of valid URLs
 *
 * Warnings:
 *   - enableDebug is true in production
 *   - enableAnalytics is false in production
 *   - corsOrigins is empty
 *   - rateLimit is very high (> 500) in production
 *   - apiUrl uses http:// in production or staging
 */
export function validateProfile(profile: DeploymentProfile): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // env
  if (!ALL_ENVS.includes(profile.env)) {
    errors.push({ field: 'env', message: `Invalid environment: "${String(profile.env)}". Must be one of: ${ALL_ENVS.join(', ')}` });
  }

  // apiUrl
  if (!profile.apiUrl || profile.apiUrl.trim().length === 0) {
    errors.push({ field: 'apiUrl', message: 'API URL is required' });
  } else if (!URL_PATTERN.test(profile.apiUrl)) {
    errors.push({ field: 'apiUrl', message: 'API URL must start with http:// or https://' });
  } else if (
    (profile.env === 'production' || profile.env === 'staging') &&
    profile.apiUrl.startsWith('http://')
  ) {
    warnings.push({ field: 'apiUrl', message: `API URL uses http:// in ${profile.env} — consider using https://` });
  }

  // dbUrl
  if (!profile.dbUrl || profile.dbUrl.trim().length === 0) {
    errors.push({ field: 'dbUrl', message: 'Database URL is required' });
  } else if (!POSTGRES_PATTERN.test(profile.dbUrl)) {
    errors.push({ field: 'dbUrl', message: 'Database URL must start with postgres:// or postgresql://' });
  }

  // rateLimit
  if (typeof profile.rateLimit !== 'number' || !Number.isFinite(profile.rateLimit)) {
    errors.push({ field: 'rateLimit', message: 'Rate limit must be a finite number' });
  } else if (profile.rateLimit <= 0) {
    errors.push({ field: 'rateLimit', message: 'Rate limit must be a positive number' });
  } else if (!Number.isInteger(profile.rateLimit)) {
    errors.push({ field: 'rateLimit', message: 'Rate limit must be an integer' });
  } else if (profile.env === 'production' && profile.rateLimit > 500) {
    warnings.push({ field: 'rateLimit', message: 'Rate limit is very high for production (> 500)' });
  }

  // corsOrigins
  if (!Array.isArray(profile.corsOrigins)) {
    errors.push({ field: 'corsOrigins', message: 'CORS origins must be an array' });
  } else {
    if (profile.corsOrigins.length === 0) {
      warnings.push({ field: 'corsOrigins', message: 'CORS origins is empty — no cross-origin requests will be allowed' });
    }
    for (let i = 0; i < profile.corsOrigins.length; i++) {
      const origin = profile.corsOrigins[i];
      if (typeof origin !== 'string' || !URL_PATTERN.test(origin)) {
        errors.push({ field: 'corsOrigins', message: `CORS origin at index ${i} is not a valid URL: "${String(origin)}"` });
      }
    }
  }

  // featureFlags
  if (typeof profile.featureFlags !== 'object' || profile.featureFlags === null || Array.isArray(profile.featureFlags)) {
    errors.push({ field: 'featureFlags', message: 'Feature flags must be a plain object' });
  } else {
    for (const [key, value] of Object.entries(profile.featureFlags)) {
      if (typeof value !== 'boolean') {
        errors.push({ field: 'featureFlags', message: `Feature flag "${key}" must be a boolean, got ${typeof value}` });
      }
    }
  }

  // Production-specific warnings
  if (profile.env === 'production') {
    if (profile.enableDebug) {
      warnings.push({ field: 'enableDebug', message: 'Debug mode is enabled in production' });
    }
    if (!profile.enableAnalytics) {
      warnings.push({ field: 'enableAnalytics', message: 'Analytics is disabled in production' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// DeploymentProfileManager
// ---------------------------------------------------------------------------

/**
 * Manages deployment profiles with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 *
 * Stores custom overrides per environment. Built-in defaults are always
 * available and cannot be deleted. Custom overrides are merged on top.
 */
export class DeploymentProfileManager {
  private static instance: DeploymentProfileManager | null = null;

  private activeEnv: DeploymentEnv;
  private overrides: Partial<Record<DeploymentEnv, Partial<DeploymentProfile>>>;
  private listeners = new Set<Listener>();

  constructor() {
    this.activeEnv = 'development';
    this.overrides = {};
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DeploymentProfileManager {
    if (!DeploymentProfileManager.instance) {
      DeploymentProfileManager.instance = new DeploymentProfileManager();
    }
    return DeploymentProfileManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    DeploymentProfileManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any profile or environment change.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  /** Get the currently active deployment environment. */
  getActiveEnv(): DeploymentEnv {
    return this.activeEnv;
  }

  /** Get the resolved profile for the active environment (built-in merged with overrides). */
  getActiveProfile(): DeploymentProfile {
    return this.getProfile(this.activeEnv);
  }

  /** Get the resolved profile for a specific environment. */
  getProfile(env: DeploymentEnv): DeploymentProfile {
    const base = BUILT_IN_PROFILES[env];
    const override = this.overrides[env];
    if (!override) {
      return { ...base, featureFlags: { ...base.featureFlags }, corsOrigins: [...base.corsOrigins] };
    }
    return {
      ...base,
      ...override,
      env, // env is always locked to the key
      featureFlags: { ...base.featureFlags, ...(override.featureFlags ?? {}) },
      corsOrigins: override.corsOrigins ? [...override.corsOrigins] : [...base.corsOrigins],
    };
  }

  /** Get all available environments. */
  getAvailableEnvs(): DeploymentEnv[] {
    return [...ALL_ENVS];
  }

  /** Check whether an environment has custom overrides. */
  hasOverrides(env: DeploymentEnv): boolean {
    return this.overrides[env] !== undefined;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /** Switch the active environment. */
  setActiveEnv(env: DeploymentEnv): void {
    if (!ALL_ENVS.includes(env)) {
      throw new Error(`Invalid environment: "${String(env)}". Must be one of: ${ALL_ENVS.join(', ')}`);
    }
    if (this.activeEnv === env) {
      return;
    }
    this.activeEnv = env;
    this.save();
    this.notify();
  }

  /**
   * Update the profile for a specific environment with partial overrides.
   * Merges with existing overrides. The `env` field cannot be changed.
   * Returns the resolved profile after the update.
   */
  updateProfile(env: DeploymentEnv, updates: Partial<Omit<DeploymentProfile, 'env'>>): DeploymentProfile {
    if (!ALL_ENVS.includes(env)) {
      throw new Error(`Invalid environment: "${String(env)}". Must be one of: ${ALL_ENVS.join(', ')}`);
    }

    const existing = this.overrides[env] ?? {};
    const merged: Partial<DeploymentProfile> = { ...existing, ...updates };

    // Merge featureFlags if both exist
    if (updates.featureFlags && existing.featureFlags) {
      merged.featureFlags = { ...existing.featureFlags, ...updates.featureFlags };
    }

    // Remove env from overrides to prevent env mismatch
    delete merged.env;

    this.overrides[env] = merged;
    this.save();
    this.notify();

    return this.getProfile(env);
  }

  /** Reset a specific environment back to built-in defaults (remove all overrides). */
  resetProfile(env: DeploymentEnv): void {
    if (!ALL_ENVS.includes(env)) {
      throw new Error(`Invalid environment: "${String(env)}". Must be one of: ${ALL_ENVS.join(', ')}`);
    }
    if (this.overrides[env] === undefined) {
      return;
    }
    delete this.overrides[env];
    this.save();
    this.notify();
  }

  /** Reset all environments to built-in defaults. */
  resetAll(): void {
    const hadOverrides = Object.keys(this.overrides).length > 0 || this.activeEnv !== 'development';
    this.overrides = {};
    this.activeEnv = 'development';
    if (hadOverrides) {
      this.save();
      this.notify();
    }
  }

  /** Set a single feature flag on the active environment. */
  setFeatureFlag(flag: string, enabled: boolean): void {
    const existing = this.overrides[this.activeEnv] ?? {};
    const existingFlags = existing.featureFlags ?? {};
    this.overrides[this.activeEnv] = {
      ...existing,
      featureFlags: { ...existingFlags, [flag]: enabled },
    };
    this.save();
    this.notify();
  }

  /** Validate the active profile. */
  validateActive(): ValidationResult {
    return validateProfile(this.getActiveProfile());
  }

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  /** Export all overrides and the active environment. */
  exportData(): { activeEnv: DeploymentEnv; overrides: Partial<Record<DeploymentEnv, Partial<DeploymentProfile>>> } {
    return {
      activeEnv: this.activeEnv,
      overrides: JSON.parse(JSON.stringify(this.overrides)) as Partial<Record<DeploymentEnv, Partial<DeploymentProfile>>>,
    };
  }

  /** Import overrides and active environment from exported data. */
  importData(data: { activeEnv: DeploymentEnv; overrides: Partial<Record<DeploymentEnv, Partial<DeploymentProfile>>> }): void {
    if (!ALL_ENVS.includes(data.activeEnv)) {
      throw new Error(`Invalid activeEnv in import: "${String(data.activeEnv)}"`);
    }

    // Validate override keys
    if (typeof data.overrides !== 'object' || data.overrides === null) {
      throw new Error('Import data overrides must be an object');
    }
    for (const key of Object.keys(data.overrides)) {
      if (!ALL_ENVS.includes(key as DeploymentEnv)) {
        throw new Error(`Invalid environment key in overrides: "${key}"`);
      }
    }

    this.activeEnv = data.activeEnv;
    this.overrides = JSON.parse(JSON.stringify(data.overrides)) as Partial<Record<DeploymentEnv, Partial<DeploymentProfile>>>;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data = { activeEnv: this.activeEnv, overrides: this.overrides };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load state from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Load activeEnv
      if (typeof data.activeEnv === 'string' && ALL_ENVS.includes(data.activeEnv as DeploymentEnv)) {
        this.activeEnv = data.activeEnv as DeploymentEnv;
      }

      // Load overrides
      if (typeof data.overrides === 'object' && data.overrides !== null && !Array.isArray(data.overrides)) {
        const rawOverrides = data.overrides as Record<string, unknown>;
        const validOverrides: Partial<Record<DeploymentEnv, Partial<DeploymentProfile>>> = {};

        for (const key of Object.keys(rawOverrides)) {
          if (ALL_ENVS.includes(key as DeploymentEnv) && typeof rawOverrides[key] === 'object' && rawOverrides[key] !== null) {
            validOverrides[key as DeploymentEnv] = rawOverrides[key] as Partial<DeploymentProfile>;
          }
        }

        this.overrides = validOverrides;
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing deployment profiles in React components.
 * Subscribes to the DeploymentProfileManager singleton and triggers re-renders on state changes.
 */
export function useDeploymentProfile(): {
  activeEnv: DeploymentEnv;
  activeProfile: DeploymentProfile;
  availableEnvs: DeploymentEnv[];
  setActiveEnv: (env: DeploymentEnv) => void;
  updateProfile: (env: DeploymentEnv, updates: Partial<Omit<DeploymentProfile, 'env'>>) => DeploymentProfile;
  resetProfile: (env: DeploymentEnv) => void;
  resetAll: () => void;
  getProfile: (env: DeploymentEnv) => DeploymentProfile;
  setFeatureFlag: (flag: string, enabled: boolean) => void;
  validate: () => ValidationResult;
  validateEnv: (env: DeploymentEnv) => ValidationResult;
  hasOverrides: (env: DeploymentEnv) => boolean;
  exportData: () => ReturnType<DeploymentProfileManager['exportData']>;
  importData: (data: Parameters<DeploymentProfileManager['importData']>[0]) => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = DeploymentProfileManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const setActiveEnv = useCallback((env: DeploymentEnv) => {
    DeploymentProfileManager.getInstance().setActiveEnv(env);
  }, []);

  const updateProfile = useCallback((env: DeploymentEnv, updates: Partial<Omit<DeploymentProfile, 'env'>>) => {
    return DeploymentProfileManager.getInstance().updateProfile(env, updates);
  }, []);

  const resetProfile = useCallback((env: DeploymentEnv) => {
    DeploymentProfileManager.getInstance().resetProfile(env);
  }, []);

  const resetAll = useCallback(() => {
    DeploymentProfileManager.getInstance().resetAll();
  }, []);

  const getProfile = useCallback((env: DeploymentEnv) => {
    return DeploymentProfileManager.getInstance().getProfile(env);
  }, []);

  const setFeatureFlag = useCallback((flag: string, enabled: boolean) => {
    DeploymentProfileManager.getInstance().setFeatureFlag(flag, enabled);
  }, []);

  const validate = useCallback(() => {
    return DeploymentProfileManager.getInstance().validateActive();
  }, []);

  const validateEnv = useCallback((env: DeploymentEnv) => {
    return validateProfile(DeploymentProfileManager.getInstance().getProfile(env));
  }, []);

  const hasOverrides = useCallback((env: DeploymentEnv) => {
    return DeploymentProfileManager.getInstance().hasOverrides(env);
  }, []);

  const exportData = useCallback(() => {
    return DeploymentProfileManager.getInstance().exportData();
  }, []);

  const importData = useCallback((data: Parameters<DeploymentProfileManager['importData']>[0]) => {
    DeploymentProfileManager.getInstance().importData(data);
  }, []);

  const manager = typeof window !== 'undefined' ? DeploymentProfileManager.getInstance() : null;

  return {
    activeEnv: manager?.getActiveEnv() ?? 'development',
    activeProfile: manager?.getActiveProfile() ?? { ...BUILT_IN_PROFILES.development },
    availableEnvs: manager?.getAvailableEnvs() ?? [...ALL_ENVS],
    setActiveEnv,
    updateProfile,
    resetProfile,
    resetAll,
    getProfile,
    setFeatureFlag,
    validate,
    validateEnv,
    hasOverrides,
    exportData,
    importData,
  };
}
