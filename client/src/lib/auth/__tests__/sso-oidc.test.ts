import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SsoOidcManager,
  PROVIDER_PRESETS,
  generateRandomString,
  generateCodeChallenge,
  base64UrlEncode,
  generatePkceChallenge,
  decodeJwtPayload,
  isTokenExpired,
  validateJwtPayload,
  resolveProviderUrl,
  buildAuthorizationUrl,
  mapGroupsToRoles,
  createDefaultGroupMappings,
  extractUserInfo,
} from '../sso-oidc';
import type {
  ProviderName,
  AppRole,
  OidcProviderConfig,
  OidcClientConfig,
  PkceChallenge,
  TokenResponse,
  JwtPayload,
  GroupRoleMapping,
  UserInfo,
  SsoState,
} from '../sso-oidc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    iss: 'https://accounts.google.com',
    sub: 'user-123',
    aud: 'client-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  };
}

function encodeJwt(payload: JwtPayload): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const sig = btoa('fake-signature')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.${sig}`;
}

function makeTokenResponse(overrides: Partial<TokenResponse> = {}): TokenResponse {
  return {
    accessToken: 'access-token-123',
    idToken: encodeJwt(makePayload()),
    refreshToken: 'refresh-token-456',
    tokenType: 'Bearer',
    expiresIn: 3600,
    ...overrides,
  };
}

function makeClientConfig(overrides: Partial<OidcClientConfig> = {}): OidcClientConfig {
  return {
    clientId: 'test-client-id',
    redirectUri: 'https://app.example.com/callback',
    provider: 'google',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateRandomString
// ---------------------------------------------------------------------------

describe('generateRandomString', () => {
  it('generates string of requested length', () => {
    const result = generateRandomString(32);
    expect(result).toHaveLength(32);
  });

  it('generates different strings each time', () => {
    const a = generateRandomString(64);
    const b = generateRandomString(64);
    expect(a).not.toBe(b);
  });

  it('uses only URL-safe characters', () => {
    const result = generateRandomString(256);
    expect(result).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });
});

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

describe('generateCodeChallenge', () => {
  it('produces a non-empty base64url string', async () => {
    const challenge = await generateCodeChallenge('test-verifier');
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
  });

  it('produces consistent output for same input', async () => {
    const a = await generateCodeChallenge('same-verifier');
    const b = await generateCodeChallenge('same-verifier');
    expect(a).toBe(b);
  });

  it('produces different output for different input', async () => {
    const a = await generateCodeChallenge('verifier-a');
    const b = await generateCodeChallenge('verifier-b');
    expect(a).not.toBe(b);
  });
});

describe('base64UrlEncode', () => {
  it('encodes bytes to base64url', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const result = base64UrlEncode(bytes);
    expect(result).toBe('SGVsbG8');
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });

  it('handles empty input', () => {
    const result = base64UrlEncode(new Uint8Array(0));
    expect(result).toBe('');
  });
});

describe('generatePkceChallenge', () => {
  it('produces a valid PKCE challenge', async () => {
    const pkce = await generatePkceChallenge();
    expect(pkce.method).toBe('S256');
    expect(pkce.codeVerifier.length).toBe(128);
    expect(pkce.codeChallenge.length).toBeGreaterThan(0);
  });

  it('verifier and challenge are different', async () => {
    const pkce = await generatePkceChallenge();
    expect(pkce.codeVerifier).not.toBe(pkce.codeChallenge);
  });
});

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT', () => {
    const payload = makePayload();
    const token = encodeJwt(payload);
    const decoded = decodeJwtPayload(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('user-123');
    expect(decoded!.email).toBe('test@example.com');
  });

  it('returns null for invalid token (no dots)', () => {
    expect(decodeJwtPayload('invalid-token')).toBeNull();
  });

  it('returns null for token with only 2 parts', () => {
    expect(decodeJwtPayload('a.b')).toBeNull();
  });

  it('returns null for malformed base64 payload', () => {
    expect(decodeJwtPayload('header.!!!invalid!!!.sig')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns false for future expiry', () => {
    const payload = makePayload({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(payload)).toBe(false);
  });

  it('returns true for past expiry', () => {
    const payload = makePayload({ exp: Math.floor(Date.now() / 1000) - 100 });
    expect(isTokenExpired(payload)).toBe(true);
  });

  it('respects clock skew', () => {
    const payload = makePayload({ exp: Math.floor(Date.now() / 1000) - 10 });
    // With 30s clock skew, -10s is still valid
    expect(isTokenExpired(payload, 30)).toBe(false);
    // With 5s clock skew, -10s is expired
    expect(isTokenExpired(payload, 5)).toBe(true);
  });
});

describe('validateJwtPayload', () => {
  it('validates a complete valid payload', () => {
    const payload = makePayload();
    const result = validateJwtPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing sub', () => {
    const payload = makePayload({ sub: '' });
    const result = validateJwtPayload(payload);
    expect(result.errors).toContain('Missing subject (sub) claim');
  });

  it('reports missing iss', () => {
    const payload = makePayload({ iss: '' });
    const result = validateJwtPayload(payload);
    expect(result.errors).toContain('Missing issuer (iss) claim');
  });

  it('reports issuer mismatch', () => {
    const payload = makePayload({ iss: 'https://evil.com' });
    const result = validateJwtPayload(payload, 'https://accounts.google.com');
    expect(result.errors.some((e) => e.includes('Issuer mismatch'))).toBe(true);
  });

  it('reports audience mismatch', () => {
    const payload = makePayload({ aud: 'wrong-client' });
    const result = validateJwtPayload(payload, undefined, 'expected-client');
    expect(result.errors.some((e) => e.includes('Audience mismatch'))).toBe(true);
  });

  it('accepts array audience containing expected value', () => {
    const payload = makePayload({ aud: ['client-a', 'expected-client'] });
    const result = validateJwtPayload(payload, undefined, 'expected-client');
    expect(result.errors.filter((e) => e.includes('Audience'))).toHaveLength(0);
  });

  it('reports expired token', () => {
    const payload = makePayload({ exp: Math.floor(Date.now() / 1000) - 3600 });
    const result = validateJwtPayload(payload);
    expect(result.expired).toBe(true);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Provider URL helpers
// ---------------------------------------------------------------------------

describe('resolveProviderUrl', () => {
  it('returns absolute URL as-is', () => {
    const config = PROVIDER_PRESETS.google;
    const url = resolveProviderUrl(config);
    expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('prepends domain for relative endpoint', () => {
    const config = PROVIDER_PRESETS.okta;
    const url = resolveProviderUrl(config, 'myorg.okta.com');
    expect(url).toBe('https://myorg.okta.com/oauth2/default/v1/authorize');
  });

  it('handles domain with https prefix', () => {
    const config = PROVIDER_PRESETS.auth0;
    const url = resolveProviderUrl(config, 'https://myapp.auth0.com');
    expect(url).toBe('https://myapp.auth0.com/authorize');
  });

  it('strips trailing slash from domain', () => {
    const config = PROVIDER_PRESETS.keycloak;
    const url = resolveProviderUrl(config, 'https://keycloak.example.com/');
    expect(url).toBe('https://keycloak.example.com/protocol/openid-connect/auth');
  });

  it('uses custom path when provided', () => {
    const config = PROVIDER_PRESETS.google;
    const url = resolveProviderUrl(config, undefined, 'https://custom.endpoint.com/auth');
    expect(url).toBe('https://custom.endpoint.com/auth');
  });
});

describe('buildAuthorizationUrl', () => {
  it('builds valid URL for Google', () => {
    const config = PROVIDER_PRESETS.google;
    const client = makeClientConfig();
    const url = buildAuthorizationUrl(config, client, 'state-123', 'nonce-456');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=state-123');
    expect(url).toContain('nonce=nonce-456');
    expect(url).toContain('scope=openid+email+profile');
  });

  it('includes PKCE parameters when supported', () => {
    const config = PROVIDER_PRESETS.google;
    const client = makeClientConfig();
    const pkce: PkceChallenge = { codeVerifier: 'v', codeChallenge: 'challenge-val', method: 'S256' };
    const url = buildAuthorizationUrl(config, client, 'state', 'nonce', pkce);
    expect(url).toContain('code_challenge=challenge-val');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('omits PKCE for providers that do not support it', () => {
    const config = PROVIDER_PRESETS.github;
    const client = makeClientConfig({ provider: 'github' });
    const pkce: PkceChallenge = { codeVerifier: 'v', codeChallenge: 'c', method: 'S256' };
    const url = buildAuthorizationUrl(config, client, 'state', 'nonce', pkce);
    expect(url).not.toContain('code_challenge');
  });

  it('includes audience when provided', () => {
    const config = PROVIDER_PRESETS.auth0;
    const client = makeClientConfig({ provider: 'auth0', audience: 'https://api.example.com', domain: 'myapp.auth0.com' });
    const url = buildAuthorizationUrl(config, client, 'state', 'nonce');
    expect(url).toContain('audience=');
  });

  it('uses custom scopes from client config', () => {
    const config = PROVIDER_PRESETS.google;
    const client = makeClientConfig({ scopes: ['openid', 'custom'] });
    const url = buildAuthorizationUrl(config, client, 'state', 'nonce');
    expect(url).toContain('scope=openid+custom');
  });
});

// ---------------------------------------------------------------------------
// Group-to-role mapping
// ---------------------------------------------------------------------------

describe('mapGroupsToRoles', () => {
  it('maps groups to roles', () => {
    const mappings: GroupRoleMapping[] = [
      { group: 'admins', role: 'admin' },
      { group: 'dev', role: 'editor' },
    ];
    const roles = mapGroupsToRoles(['admins', 'dev'], mappings);
    expect(roles).toContain('admin');
    expect(roles).toContain('editor');
  });

  it('deduplicates roles', () => {
    const mappings: GroupRoleMapping[] = [
      { group: 'a', role: 'editor' },
      { group: 'b', role: 'editor' },
    ];
    const roles = mapGroupsToRoles(['a', 'b'], mappings);
    expect(roles).toHaveLength(1);
  });

  it('returns empty for unmatched groups', () => {
    const roles = mapGroupsToRoles(['unknown'], [{ group: 'admins', role: 'admin' }]);
    expect(roles).toHaveLength(0);
  });

  it('case-insensitive matching', () => {
    const roles = mapGroupsToRoles(['ADMINS'], [{ group: 'admins', role: 'admin' }]);
    expect(roles).toContain('admin');
  });
});

describe('createDefaultGroupMappings', () => {
  it('returns 7 default mappings', () => {
    const mappings = createDefaultGroupMappings();
    expect(mappings).toHaveLength(7);
    expect(mappings.some((m) => m.group === 'admins' && m.role === 'admin')).toBe(true);
    expect(mappings.some((m) => m.group === 'editors' && m.role === 'editor')).toBe(true);
    expect(mappings.some((m) => m.group === 'viewers' && m.role === 'viewer')).toBe(true);
  });
});

describe('extractUserInfo', () => {
  it('extracts user info from JWT payload', () => {
    const payload = makePayload({ groups: ['admins'] });
    const user = extractUserInfo(payload, 'google');
    expect(user.sub).toBe('user-123');
    expect(user.email).toBe('test@example.com');
    expect(user.provider).toBe('google');
    expect(user.roles).toContain('admin');
  });

  it('defaults to viewer role when no groups match', () => {
    const payload = makePayload({ groups: ['unknown-group'] });
    const user = extractUserInfo(payload, 'github');
    expect(user.roles).toEqual(['viewer']);
  });

  it('uses custom mappings when provided', () => {
    const payload = makePayload({ groups: ['my-editors'] });
    const user = extractUserInfo(payload, 'okta', [{ group: 'my-editors', role: 'editor' }]);
    expect(user.roles).toContain('editor');
  });

  it('includes raw payload', () => {
    const payload = makePayload();
    const user = extractUserInfo(payload, 'google');
    expect(user.raw).toBe(payload);
  });
});

// ---------------------------------------------------------------------------
// PROVIDER_PRESETS
// ---------------------------------------------------------------------------

describe('PROVIDER_PRESETS', () => {
  it('has 7 providers', () => {
    expect(Object.keys(PROVIDER_PRESETS)).toHaveLength(7);
  });

  const providerNames: ProviderName[] = ['google', 'microsoft', 'github', 'okta', 'auth0', 'gitlab', 'keycloak'];

  providerNames.forEach((name) => {
    it(`${name} has required fields`, () => {
      const config = PROVIDER_PRESETS[name];
      expect(config.name).toBe(name);
      expect(config.displayName.length).toBeGreaterThan(0);
      expect(config.authorizationEndpoint.length).toBeGreaterThan(0);
      expect(config.tokenEndpoint.length).toBeGreaterThan(0);
      expect(config.userinfoEndpoint.length).toBeGreaterThan(0);
      expect(config.scopes.length).toBeGreaterThan(0);
      expect(typeof config.supportsRefresh).toBe('boolean');
      expect(typeof config.supportsPkce).toBe('boolean');
    });
  });

  it('google supports PKCE and refresh', () => {
    expect(PROVIDER_PRESETS.google.supportsPkce).toBe(true);
    expect(PROVIDER_PRESETS.google.supportsRefresh).toBe(true);
  });

  it('github does not support PKCE or refresh', () => {
    expect(PROVIDER_PRESETS.github.supportsPkce).toBe(false);
    expect(PROVIDER_PRESETS.github.supportsRefresh).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SsoOidcManager
// ---------------------------------------------------------------------------

describe('SsoOidcManager', () => {
  let manager: SsoOidcManager;

  beforeEach(() => {
    SsoOidcManager.resetInstance();
    manager = new SsoOidcManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns same instance', () => {
      const a = SsoOidcManager.getInstance();
      const b = SsoOidcManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets instance', () => {
      const a = SsoOidcManager.getInstance();
      SsoOidcManager.resetInstance();
      const b = SsoOidcManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on state changes', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.configure(makeClientConfig());
      expect(listener).toHaveBeenCalledOnce();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.configure(makeClientConfig());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  describe('configure', () => {
    it('stores client config', () => {
      manager.configure(makeClientConfig());
      const config = manager.getClientConfig();
      expect(config).not.toBeNull();
      expect(config!.clientId).toBe('test-client-id');
    });

    it('returns null when not configured', () => {
      expect(manager.getClientConfig()).toBeNull();
    });
  });

  describe('getProviderConfig', () => {
    it('returns provider config by name', () => {
      const config = manager.getProviderConfig('google');
      expect(config).not.toBeNull();
      expect(config!.name).toBe('google');
    });

    it('returns config for configured provider', () => {
      manager.configure(makeClientConfig({ provider: 'microsoft' }));
      const config = manager.getProviderConfig();
      expect(config!.name).toBe('microsoft');
    });

    it('returns null when no provider set', () => {
      expect(manager.getProviderConfig()).toBeNull();
    });
  });

  describe('group mappings', () => {
    it('uses default group mappings', () => {
      const mappings = manager.getGroupMappings();
      expect(mappings.length).toBeGreaterThan(0);
    });

    it('updates group mappings', () => {
      const custom: GroupRoleMapping[] = [{ group: 'team', role: 'editor' }];
      manager.setGroupMappings(custom);
      expect(manager.getGroupMappings()).toEqual(custom);
    });

    it('re-maps roles on authenticated user when mappings change', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(
        makeTokenResponse({ idToken: encodeJwt(makePayload({ groups: ['my-team'] })) }),
      );

      manager.setGroupMappings([{ group: 'my-team', role: 'admin' }]);
      expect(manager.getUserRoles()).toContain('admin');
    });
  });

  // -------------------------------------------------------------------------
  // Auth flow
  // -------------------------------------------------------------------------

  describe('startAuthFlow', () => {
    it('throws when not configured', async () => {
      await expect(manager.startAuthFlow()).rejects.toThrow('SSO not configured');
    });

    it('generates authorization params', async () => {
      manager.configure(makeClientConfig());
      const params = await manager.startAuthFlow();
      expect(params.url).toContain('accounts.google.com');
      expect(params.state.length).toBeGreaterThan(0);
      expect(params.nonce.length).toBeGreaterThan(0);
      expect(params.codeVerifier.length).toBeGreaterThan(0);
    });

    it('stores pending state', async () => {
      manager.configure(makeClientConfig());
      const params = await manager.startAuthFlow();
      expect(manager.getPendingState()).toBe(params.state);
      expect(manager.getPendingNonce()).toBe(params.nonce);
    });

    it('generates empty codeVerifier for non-PKCE providers', async () => {
      manager.configure(makeClientConfig({ provider: 'github' }));
      const params = await manager.startAuthFlow();
      expect(params.codeVerifier).toBe('');
    });
  });

  describe('validateCallback', () => {
    it('returns true for matching state', async () => {
      manager.configure(makeClientConfig());
      const params = await manager.startAuthFlow();
      expect(manager.validateCallback(params.state)).toBe(true);
    });

    it('returns false for mismatched state', async () => {
      manager.configure(makeClientConfig());
      await manager.startAuthFlow();
      expect(manager.validateCallback('wrong-state')).toBe(false);
    });

    it('returns false when no pending state', () => {
      expect(manager.validateCallback('any')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Token handling
  // -------------------------------------------------------------------------

  describe('handleTokenResponse', () => {
    it('marks authenticated with valid id_token', () => {
      manager.configure(makeClientConfig());
      const user = manager.handleTokenResponse(makeTokenResponse());
      expect(user).not.toBeNull();
      expect(manager.isAuthenticated()).toBe(true);
    });

    it('extracts user info from id_token', () => {
      manager.configure(makeClientConfig());
      const user = manager.handleTokenResponse(makeTokenResponse());
      expect(user!.email).toBe('test@example.com');
      expect(user!.sub).toBe('user-123');
    });

    it('returns null user but marks authenticated without id_token', () => {
      manager.configure(makeClientConfig({ provider: 'github' }));
      const user = manager.handleTokenResponse(makeTokenResponse({ idToken: undefined }));
      expect(user).toBeNull();
      expect(manager.isAuthenticated()).toBe(true);
    });

    it('stores tokens', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      const tokens = manager.getTokens();
      expect(tokens).not.toBeNull();
      expect(tokens!.accessToken).toBe('access-token-123');
    });

    it('sets expiration time', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse({ expiresIn: 3600 }));
      expect(manager.isTokenExpired()).toBe(false);
      expect(manager.getTimeUntilExpiry()).toBeGreaterThan(0);
    });
  });

  describe('updateTokens', () => {
    it('updates tokens and notifies', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.updateTokens(makeTokenResponse({ accessToken: 'new-token' }));
      expect(manager.getTokens()!.accessToken).toBe('new-token');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('canRefresh', () => {
    it('returns true when refresh token and provider support exist', () => {
      manager.configure(makeClientConfig({ provider: 'google' }));
      manager.handleTokenResponse(makeTokenResponse());
      expect(manager.canRefresh()).toBe(true);
    });

    it('returns false without refresh token', () => {
      manager.configure(makeClientConfig({ provider: 'google' }));
      manager.handleTokenResponse(makeTokenResponse({ refreshToken: undefined }));
      expect(manager.canRefresh()).toBe(false);
    });

    it('returns false for provider without refresh support', () => {
      manager.configure(makeClientConfig({ provider: 'github' }));
      manager.handleTokenResponse(makeTokenResponse());
      expect(manager.canRefresh()).toBe(false);
    });
  });

  describe('getRefreshToken', () => {
    it('returns refresh token when available', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      expect(manager.getRefreshToken()).toBe('refresh-token-456');
    });

    it('returns null when no tokens', () => {
      expect(manager.getRefreshToken()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // User info & roles
  // -------------------------------------------------------------------------

  describe('getUser', () => {
    it('returns user info when authenticated', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      const user = manager.getUser();
      expect(user).not.toBeNull();
      expect(user!.provider).toBe('google');
    });

    it('returns null when not authenticated', () => {
      expect(manager.getUser()).toBeNull();
    });

    it('returns a copy (not reference)', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      const a = manager.getUser();
      const b = manager.getUser();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('role checks', () => {
    beforeEach(() => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(
        makeTokenResponse({ idToken: encodeJwt(makePayload({ groups: ['admins', 'developers'] })) }),
      );
    });

    it('getUserRoles returns mapped roles', () => {
      const roles = manager.getUserRoles();
      expect(roles).toContain('admin');
      expect(roles).toContain('editor');
    });

    it('hasRole checks single role', () => {
      expect(manager.hasRole('admin')).toBe(true);
      expect(manager.hasRole('owner')).toBe(false);
    });

    it('hasAnyRole checks multiple roles', () => {
      expect(manager.hasAnyRole(['owner', 'admin'])).toBe(true);
      expect(manager.hasAnyRole(['owner', 'viewer'])).toBe(false);
    });

    it('returns empty roles when not authenticated', () => {
      const fresh = new SsoOidcManager();
      expect(fresh.getUserRoles()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  describe('getState', () => {
    it('returns initial unauthenticated state', () => {
      const state = manager.getState();
      expect(state.authenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.provider).toBeNull();
    });

    it('returns authenticated state after login', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      const state = manager.getState();
      expect(state.authenticated).toBe(true);
      expect(state.provider).toBe('google');
    });
  });

  // -------------------------------------------------------------------------
  // Pending auth
  // -------------------------------------------------------------------------

  describe('pending auth', () => {
    it('clearPendingAuth removes pending values', async () => {
      manager.configure(makeClientConfig());
      await manager.startAuthFlow();
      expect(manager.getPendingState()).not.toBeNull();
      manager.clearPendingAuth();
      expect(manager.getPendingState()).toBeNull();
      expect(manager.getPendingNonce()).toBeNull();
      expect(manager.getPendingCodeVerifier()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  describe('logout', () => {
    it('clears all state', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      expect(manager.isAuthenticated()).toBe(true);

      manager.logout();
      expect(manager.isAuthenticated()).toBe(false);
      expect(manager.getUser()).toBeNull();
      expect(manager.getTokens()).toBeNull();
    });

    it('notifies listeners', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.logout();
      expect(listener).toHaveBeenCalledOnce();
    });

    it('clears pending auth', async () => {
      manager.configure(makeClientConfig());
      await manager.startAuthFlow();
      manager.logout();
      expect(manager.getPendingState()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Provider discovery
  // -------------------------------------------------------------------------

  describe('provider discovery', () => {
    it('getAvailableProviders returns all 7', () => {
      expect(manager.getAvailableProviders()).toHaveLength(7);
    });

    it('getProviderByName returns correct config', () => {
      const gitlab = manager.getProviderByName('gitlab');
      expect(gitlab.name).toBe('gitlab');
      expect(gitlab.displayName).toBe('GitLab');
    });

    it('getSupportedScopes returns provider scopes', () => {
      const scopes = manager.getSupportedScopes('google');
      expect(scopes).toContain('openid');
      expect(scopes).toContain('email');
    });
  });

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  describe('serialization', () => {
    it('round-trips through JSON', () => {
      manager.configure(makeClientConfig());
      manager.handleTokenResponse(makeTokenResponse());

      const json = manager.toJSON();
      const restored = SsoOidcManager.fromJSON(json);

      expect(restored.isAuthenticated()).toBe(true);
      expect(restored.getClientConfig()!.clientId).toBe('test-client-id');
      expect(restored.getUser()!.email).toBe('test@example.com');
    });

    it('handles null client config', () => {
      const json = manager.toJSON();
      const restored = SsoOidcManager.fromJSON(json);
      expect(restored.getClientConfig()).toBeNull();
    });

    it('preserves custom group mappings', () => {
      const custom: GroupRoleMapping[] = [{ group: 'team', role: 'editor' }];
      manager.setGroupMappings(custom);
      const json = manager.toJSON();
      const restored = SsoOidcManager.fromJSON(json);
      expect(restored.getGroupMappings()).toEqual(custom);
    });
  });

  // -------------------------------------------------------------------------
  // Token expiry
  // -------------------------------------------------------------------------

  describe('token expiry', () => {
    it('isTokenExpired returns true when no expiration', () => {
      expect(manager.isTokenExpired()).toBe(true);
    });

    it('getTimeUntilExpiry returns 0 when no expiration', () => {
      expect(manager.getTimeUntilExpiry()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Dispose
  // -------------------------------------------------------------------------

  describe('dispose', () => {
    it('clears listeners and timer', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.dispose();
      // After dispose, configure should not trigger listener
      manager.configure(makeClientConfig());
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
