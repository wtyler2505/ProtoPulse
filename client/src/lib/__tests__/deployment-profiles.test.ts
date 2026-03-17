import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DeploymentProfileManager,
  validateProfile,
  useDeploymentProfile,
  BUILT_IN_PROFILES,
} from '../deployment-profiles';
import type {
  DeploymentEnv,
  DeploymentProfile,
  ValidationResult,
} from '../deployment-profiles';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let manager: DeploymentProfileManager;
let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  DeploymentProfileManager.resetForTesting();
  manager = DeploymentProfileManager.getInstance();
});

afterEach(() => {
  DeploymentProfileManager.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = DeploymentProfileManager.getInstance();
    const b = DeploymentProfileManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = DeploymentProfileManager.getInstance();
    DeploymentProfileManager.resetForTesting();
    const second = DeploymentProfileManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Built-in Profiles
// ---------------------------------------------------------------------------

describe('BUILT_IN_PROFILES', () => {
  it('has exactly 3 environments', () => {
    expect(Object.keys(BUILT_IN_PROFILES)).toHaveLength(3);
    expect(BUILT_IN_PROFILES).toHaveProperty('development');
    expect(BUILT_IN_PROFILES).toHaveProperty('staging');
    expect(BUILT_IN_PROFILES).toHaveProperty('production');
  });

  it('development profile has debug enabled and analytics disabled', () => {
    const dev = BUILT_IN_PROFILES.development;
    expect(dev.enableDebug).toBe(true);
    expect(dev.enableAnalytics).toBe(false);
    expect(dev.env).toBe('development');
  });

  it('production profile has debug disabled and analytics enabled', () => {
    const prod = BUILT_IN_PROFILES.production;
    expect(prod.enableDebug).toBe(false);
    expect(prod.enableAnalytics).toBe(true);
    expect(prod.env).toBe('production');
  });

  it('staging profile has analytics enabled and debug disabled', () => {
    const staging = BUILT_IN_PROFILES.staging;
    expect(staging.enableDebug).toBe(false);
    expect(staging.enableAnalytics).toBe(true);
    expect(staging.env).toBe('staging');
  });

  it('all profiles have valid apiUrl and dbUrl', () => {
    for (const env of ['development', 'staging', 'production'] as DeploymentEnv[]) {
      const profile = BUILT_IN_PROFILES[env];
      expect(profile.apiUrl).toMatch(/^https?:\/\/.+/);
      expect(profile.dbUrl).toMatch(/^postgres(ql)?:\/\/.+/);
    }
  });

  it('all built-in profiles pass validation', () => {
    for (const env of ['development', 'staging', 'production'] as DeploymentEnv[]) {
      const result = validateProfile(BUILT_IN_PROFILES[env]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  it('production has lower rate limit than development', () => {
    expect(BUILT_IN_PROFILES.production.rateLimit).toBeLessThan(BUILT_IN_PROFILES.development.rateLimit);
  });
});

// ---------------------------------------------------------------------------
// Default State
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Default State', () => {
  it('defaults to development environment', () => {
    expect(manager.getActiveEnv()).toBe('development');
  });

  it('returns development profile by default', () => {
    const profile = manager.getActiveProfile();
    expect(profile.env).toBe('development');
    expect(profile.apiUrl).toBe(BUILT_IN_PROFILES.development.apiUrl);
  });

  it('returns all 3 available environments', () => {
    const envs = manager.getAvailableEnvs();
    expect(envs).toEqual(['development', 'staging', 'production']);
  });

  it('has no overrides by default', () => {
    expect(manager.hasOverrides('development')).toBe(false);
    expect(manager.hasOverrides('staging')).toBe(false);
    expect(manager.hasOverrides('production')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setActiveEnv
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - setActiveEnv', () => {
  it('switches to staging', () => {
    manager.setActiveEnv('staging');
    expect(manager.getActiveEnv()).toBe('staging');
    expect(manager.getActiveProfile().env).toBe('staging');
  });

  it('switches to production', () => {
    manager.setActiveEnv('production');
    expect(manager.getActiveEnv()).toBe('production');
    expect(manager.getActiveProfile().apiUrl).toBe(BUILT_IN_PROFILES.production.apiUrl);
  });

  it('throws on invalid environment', () => {
    expect(() => {
      manager.setActiveEnv('invalid' as DeploymentEnv);
    }).toThrow(/Invalid environment/);
  });

  it('does not notify when setting the same env', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setActiveEnv('development'); // already development
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers on env change', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setActiveEnv('staging');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists to localStorage', () => {
    manager.setActiveEnv('production');
    expect(mockStorage.setItem).toHaveBeenCalled();

    // Verify it reloads correctly
    DeploymentProfileManager.resetForTesting();
    const reloaded = DeploymentProfileManager.getInstance();
    expect(reloaded.getActiveEnv()).toBe('production');
  });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - updateProfile', () => {
  it('updates apiUrl on development', () => {
    const result = manager.updateProfile('development', { apiUrl: 'http://localhost:8080' });
    expect(result.apiUrl).toBe('http://localhost:8080');
    expect(result.env).toBe('development');
  });

  it('marks environment as having overrides', () => {
    expect(manager.hasOverrides('staging')).toBe(false);
    manager.updateProfile('staging', { enableDebug: true });
    expect(manager.hasOverrides('staging')).toBe(true);
  });

  it('merges feature flags with built-in defaults', () => {
    const result = manager.updateProfile('development', {
      featureFlags: { newFeature: true },
    });
    expect(result.featureFlags.experimentalAI).toBe(true); // from built-in
    expect(result.featureFlags.newFeature).toBe(true); // from override
  });

  it('overrides corsOrigins entirely', () => {
    const result = manager.updateProfile('production', {
      corsOrigins: ['https://custom.example.com'],
    });
    expect(result.corsOrigins).toEqual(['https://custom.example.com']);
  });

  it('preserves existing overrides when adding new ones', () => {
    manager.updateProfile('staging', { enableDebug: true });
    const result = manager.updateProfile('staging', { rateLimit: 300 });
    expect(result.enableDebug).toBe(true);
    expect(result.rateLimit).toBe(300);
  });

  it('throws on invalid environment', () => {
    expect(() => {
      manager.updateProfile('invalid' as DeploymentEnv, { enableDebug: true });
    }).toThrow(/Invalid environment/);
  });

  it('locks env field to the environment key', () => {
    const result = manager.updateProfile('development', { apiUrl: 'http://localhost:9999' });
    expect(result.env).toBe('development');
  });

  it('notifies subscribers', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.updateProfile('development', { enableDebug: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// resetProfile / resetAll
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Reset', () => {
  it('resetProfile removes overrides for a specific env', () => {
    manager.updateProfile('development', { apiUrl: 'http://localhost:9999' });
    expect(manager.hasOverrides('development')).toBe(true);
    manager.resetProfile('development');
    expect(manager.hasOverrides('development')).toBe(false);
    expect(manager.getProfile('development').apiUrl).toBe(BUILT_IN_PROFILES.development.apiUrl);
  });

  it('resetProfile does not notify when no overrides existed', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.resetProfile('staging'); // no overrides
    expect(listener).not.toHaveBeenCalled();
  });

  it('resetProfile throws on invalid env', () => {
    expect(() => {
      manager.resetProfile('invalid' as DeploymentEnv);
    }).toThrow(/Invalid environment/);
  });

  it('resetAll clears all overrides and resets to development', () => {
    manager.updateProfile('staging', { enableDebug: true });
    manager.setActiveEnv('production');
    manager.resetAll();
    expect(manager.getActiveEnv()).toBe('development');
    expect(manager.hasOverrides('staging')).toBe(false);
  });

  it('resetAll does not notify if already at defaults', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.resetAll(); // already at defaults
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setFeatureFlag
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - setFeatureFlag', () => {
  it('sets a feature flag on the active environment', () => {
    manager.setFeatureFlag('newFlag', true);
    const profile = manager.getActiveProfile();
    expect(profile.featureFlags.newFlag).toBe(true);
  });

  it('overrides an existing flag', () => {
    manager.setFeatureFlag('experimentalAI', false);
    const profile = manager.getActiveProfile();
    expect(profile.featureFlags.experimentalAI).toBe(false);
  });

  it('notifies subscribers', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setFeatureFlag('test', true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists flag changes to localStorage', () => {
    manager.setFeatureFlag('persistedFlag', true);
    DeploymentProfileManager.resetForTesting();
    const reloaded = DeploymentProfileManager.getInstance();
    expect(reloaded.getActiveProfile().featureFlags.persistedFlag).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Subscription', () => {
  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.setActiveEnv('production');
    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple subscribers are all notified', () => {
    const a = vi.fn();
    const b = vi.fn();
    manager.subscribe(a);
    manager.subscribe(b);
    manager.setActiveEnv('staging');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Export/Import', () => {
  it('exports current state', () => {
    manager.setActiveEnv('staging');
    manager.updateProfile('staging', { enableDebug: true });
    const exported = manager.exportData();
    expect(exported.activeEnv).toBe('staging');
    expect(exported.overrides.staging).toBeDefined();
  });

  it('imports exported state', () => {
    const data = {
      activeEnv: 'production' as DeploymentEnv,
      overrides: {
        production: { rateLimit: 50 },
      },
    };
    manager.importData(data);
    expect(manager.getActiveEnv()).toBe('production');
    expect(manager.getActiveProfile().rateLimit).toBe(50);
  });

  it('throws on invalid activeEnv in import', () => {
    expect(() => {
      manager.importData({ activeEnv: 'bad' as DeploymentEnv, overrides: {} });
    }).toThrow(/Invalid activeEnv/);
  });

  it('throws on invalid override keys in import', () => {
    expect(() => {
      manager.importData({
        activeEnv: 'development',
        overrides: { bad: { enableDebug: true } } as Record<string, Partial<DeploymentProfile>>,
      });
    }).toThrow(/Invalid environment key/);
  });

  it('round-trips export/import correctly', () => {
    manager.setActiveEnv('staging');
    manager.updateProfile('development', { rateLimit: 500 });
    manager.setFeatureFlag('customFlag', true);

    const exported = manager.exportData();
    DeploymentProfileManager.resetForTesting();
    const fresh = DeploymentProfileManager.getInstance();
    fresh.importData(exported);

    expect(fresh.getActiveEnv()).toBe('staging');
    expect(fresh.getProfile('development').rateLimit).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Persistence', () => {
  it('survives a singleton reset (simulates page reload)', () => {
    manager.setActiveEnv('production');
    manager.updateProfile('production', { rateLimit: 42 });

    DeploymentProfileManager.resetForTesting();
    const reloaded = DeploymentProfileManager.getInstance();
    expect(reloaded.getActiveEnv()).toBe('production');
    expect(reloaded.getActiveProfile().rateLimit).toBe(42);
  });

  it('handles corrupt localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-valid-json{{{');
    DeploymentProfileManager.resetForTesting();
    const fresh = DeploymentProfileManager.getInstance();
    expect(fresh.getActiveEnv()).toBe('development'); // falls back to default
  });

  it('handles missing localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    DeploymentProfileManager.resetForTesting();
    const fresh = DeploymentProfileManager.getInstance();
    expect(fresh.getActiveEnv()).toBe('development');
  });

  it('handles non-object localStorage value gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"just a string"');
    DeploymentProfileManager.resetForTesting();
    const fresh = DeploymentProfileManager.getInstance();
    expect(fresh.getActiveEnv()).toBe('development');
  });
});

// ---------------------------------------------------------------------------
// getProfile returns defensive copies
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - Defensive copies', () => {
  it('getProfile returns a new object each time', () => {
    const a = manager.getProfile('development');
    const b = manager.getProfile('development');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('mutating returned featureFlags does not affect the manager', () => {
    const profile = manager.getProfile('development');
    profile.featureFlags.experimentalAI = false;
    const fresh = manager.getProfile('development');
    expect(fresh.featureFlags.experimentalAI).toBe(true); // unchanged
  });

  it('mutating returned corsOrigins does not affect the manager', () => {
    const profile = manager.getProfile('development');
    profile.corsOrigins.push('http://hacked.com');
    const fresh = manager.getProfile('development');
    expect(fresh.corsOrigins).not.toContain('http://hacked.com');
  });
});

// ---------------------------------------------------------------------------
// validateProfile
// ---------------------------------------------------------------------------

describe('validateProfile', () => {
  it('returns valid for a correct profile', () => {
    const result = validateProfile(BUILT_IN_PROFILES.development);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on empty apiUrl', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, apiUrl: '' };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'apiUrl')).toBe(true);
  });

  it('errors on invalid apiUrl format', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, apiUrl: 'ftp://bad.com' };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'apiUrl' && e.message.includes('http'))).toBe(true);
  });

  it('errors on empty dbUrl', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, dbUrl: '' };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'dbUrl')).toBe(true);
  });

  it('errors on invalid dbUrl format', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, dbUrl: 'mysql://localhost/db' };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'dbUrl' && e.message.includes('postgres'))).toBe(true);
  });

  it('errors on invalid env', () => {
    const profile = { ...BUILT_IN_PROFILES.development, env: 'invalid' as DeploymentEnv };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'env')).toBe(true);
  });

  it('errors on negative rateLimit', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, rateLimit: -1 };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'rateLimit')).toBe(true);
  });

  it('errors on zero rateLimit', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, rateLimit: 0 };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'rateLimit' && e.message.includes('positive'))).toBe(true);
  });

  it('errors on non-integer rateLimit', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, rateLimit: 10.5 };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'rateLimit' && e.message.includes('integer'))).toBe(true);
  });

  it('errors on NaN rateLimit', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, rateLimit: NaN };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'rateLimit' && e.message.includes('finite'))).toBe(true);
  });

  it('errors on invalid CORS origin', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, corsOrigins: ['not-a-url'] };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'corsOrigins')).toBe(true);
  });

  it('errors on non-boolean feature flag values', () => {
    const profile: DeploymentProfile = {
      ...BUILT_IN_PROFILES.development,
      featureFlags: { bad: 'yes' as unknown as boolean },
    };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'featureFlags')).toBe(true);
  });

  it('warns when debug is enabled in production', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.production, enableDebug: true };
    const result = validateProfile(profile);
    expect(result.warnings.some((w) => w.field === 'enableDebug')).toBe(true);
  });

  it('warns when analytics is disabled in production', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.production, enableAnalytics: false };
    const result = validateProfile(profile);
    expect(result.warnings.some((w) => w.field === 'enableAnalytics')).toBe(true);
  });

  it('warns on empty corsOrigins', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, corsOrigins: [] };
    const result = validateProfile(profile);
    expect(result.warnings.some((w) => w.field === 'corsOrigins')).toBe(true);
  });

  it('warns on high rateLimit in production', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.production, rateLimit: 999 };
    const result = validateProfile(profile);
    expect(result.warnings.some((w) => w.field === 'rateLimit')).toBe(true);
  });

  it('warns on http:// apiUrl in production', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.production, apiUrl: 'http://insecure.example.com' };
    const result = validateProfile(profile);
    expect(result.warnings.some((w) => w.field === 'apiUrl' && w.message.includes('https'))).toBe(true);
  });

  it('warns on http:// apiUrl in staging', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.staging, apiUrl: 'http://insecure.staging.com' };
    const result = validateProfile(profile);
    expect(result.warnings.some((w) => w.field === 'apiUrl' && w.message.includes('https'))).toBe(true);
  });

  it('does not warn on http:// apiUrl in development', () => {
    const result = validateProfile(BUILT_IN_PROFILES.development);
    expect(result.warnings.some((w) => w.field === 'apiUrl')).toBe(false);
  });

  it('accepts postgres:// without "ql" suffix', () => {
    const profile: DeploymentProfile = { ...BUILT_IN_PROFILES.development, dbUrl: 'postgres://localhost/db' };
    const result = validateProfile(profile);
    expect(result.errors.some((e) => e.field === 'dbUrl')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateActive (manager integration)
// ---------------------------------------------------------------------------

describe('DeploymentProfileManager - validateActive', () => {
  it('validates the active profile', () => {
    const result = manager.validateActive();
    expect(result.valid).toBe(true);
  });

  it('detects errors after applying invalid overrides', () => {
    manager.updateProfile('development', { apiUrl: 'not-a-url' });
    const result = manager.validateActive();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'apiUrl')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useDeploymentProfile hook
// ---------------------------------------------------------------------------

describe('useDeploymentProfile', () => {
  it('returns activeEnv and activeProfile', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    expect(result.current.activeEnv).toBe('development');
    expect(result.current.activeProfile.env).toBe('development');
  });

  it('returns available environments', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    expect(result.current.availableEnvs).toEqual(['development', 'staging', 'production']);
  });

  it('setActiveEnv updates the hook state', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    act(() => {
      result.current.setActiveEnv('production');
    });
    expect(result.current.activeEnv).toBe('production');
    expect(result.current.activeProfile.env).toBe('production');
  });

  it('updateProfile updates and returns the new profile', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    let updated: DeploymentProfile | undefined;
    act(() => {
      updated = result.current.updateProfile('development', { rateLimit: 777 });
    });
    expect(updated?.rateLimit).toBe(777);
    expect(result.current.activeProfile.rateLimit).toBe(777);
  });

  it('resetProfile restores defaults', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    act(() => {
      result.current.updateProfile('development', { rateLimit: 999 });
    });
    expect(result.current.activeProfile.rateLimit).toBe(999);
    act(() => {
      result.current.resetProfile('development');
    });
    expect(result.current.activeProfile.rateLimit).toBe(BUILT_IN_PROFILES.development.rateLimit);
  });

  it('validate returns a ValidationResult', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    let validation: ValidationResult | undefined;
    act(() => {
      validation = result.current.validate();
    });
    expect(validation?.valid).toBe(true);
    expect(validation?.errors).toEqual([]);
  });

  it('setFeatureFlag updates the active profile', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    act(() => {
      result.current.setFeatureFlag('hookFlag', true);
    });
    expect(result.current.activeProfile.featureFlags.hookFlag).toBe(true);
  });

  it('hasOverrides reflects override state', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    expect(result.current.hasOverrides('development')).toBe(false);
    act(() => {
      result.current.updateProfile('development', { enableDebug: false });
    });
    expect(result.current.hasOverrides('development')).toBe(true);
  });

  it('resetAll returns to defaults', () => {
    const { result } = renderHook(() => useDeploymentProfile());
    act(() => {
      result.current.setActiveEnv('production');
      result.current.updateProfile('production', { rateLimit: 10 });
    });
    act(() => {
      result.current.resetAll();
    });
    expect(result.current.activeEnv).toBe('development');
    expect(result.current.hasOverrides('production')).toBe(false);
  });
});
