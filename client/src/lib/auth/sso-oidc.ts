/**
 * SsoOidcManager — SSO/OIDC authentication with PKCE S256.
 *
 * Singleton + subscribe pattern. Supports 7 preset OIDC providers
 * (Google, Microsoft, GitHub, Okta, Auth0, GitLab, Keycloak), PKCE S256
 * code challenge generation, authorization URL building, JWT payload
 * decoding, token refresh, and group-to-role mapping.
 *
 * Pure client-side — no server dependencies. Designed for integration
 * with ProtoPulse's existing session-based auth.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderName = 'google' | 'microsoft' | 'github' | 'okta' | 'auth0' | 'gitlab' | 'keycloak';

export type AppRole = 'owner' | 'editor' | 'viewer' | 'admin';

export interface OidcProviderConfig {
  name: ProviderName;
  displayName: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  scopes: string[];
  issuer: string;
  supportsRefresh: boolean;
  supportsPkce: boolean;
  discoveryUrl?: string;
}

export interface OidcClientConfig {
  clientId: string;
  redirectUri: string;
  provider: ProviderName;
  scopes?: string[];
  audience?: string;
  domain?: string; // For Okta/Auth0/Keycloak
}

export interface PkceChallenge {
  codeVerifier: string;
  codeChallenge: string;
  method: 'S256';
}

export interface AuthorizationParams {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface TokenResponse {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

export interface JwtPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  name?: string;
  picture?: string;
  groups?: string[];
  roles?: string[];
  [key: string]: unknown;
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  groups?: string[];
  roles?: AppRole[];
  provider: ProviderName;
  raw: JwtPayload;
}

export interface GroupRoleMapping {
  group: string;
  role: AppRole;
}

export interface SsoState {
  authenticated: boolean;
  user: UserInfo | null;
  tokens: TokenResponse | null;
  provider: ProviderName | null;
  expiresAt: number | null;
}

export interface TokenValidation {
  valid: boolean;
  expired: boolean;
  errors: string[];
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Provider presets
// ---------------------------------------------------------------------------

export const PROVIDER_PRESETS: Record<ProviderName, OidcProviderConfig> = {
  google: {
    name: 'google',
    displayName: 'Google',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userinfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    scopes: ['openid', 'email', 'profile'],
    issuer: 'https://accounts.google.com',
    supportsRefresh: true,
    supportsPkce: true,
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
  },
  microsoft: {
    name: 'microsoft',
    displayName: 'Microsoft',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
    jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    scopes: ['openid', 'email', 'profile'],
    issuer: 'https://login.microsoftonline.com/common/v2.0',
    supportsRefresh: true,
    supportsPkce: true,
    discoveryUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
  },
  github: {
    name: 'github',
    displayName: 'GitHub',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    userinfoEndpoint: 'https://api.github.com/user',
    jwksUri: '',
    scopes: ['read:user', 'user:email'],
    issuer: 'https://github.com',
    supportsRefresh: false,
    supportsPkce: false,
  },
  okta: {
    name: 'okta',
    displayName: 'Okta',
    authorizationEndpoint: '/oauth2/default/v1/authorize',
    tokenEndpoint: '/oauth2/default/v1/token',
    userinfoEndpoint: '/oauth2/default/v1/userinfo',
    jwksUri: '/oauth2/default/v1/keys',
    scopes: ['openid', 'email', 'profile', 'groups'],
    issuer: '/oauth2/default',
    supportsRefresh: true,
    supportsPkce: true,
  },
  auth0: {
    name: 'auth0',
    displayName: 'Auth0',
    authorizationEndpoint: '/authorize',
    tokenEndpoint: '/oauth/token',
    userinfoEndpoint: '/userinfo',
    jwksUri: '/.well-known/jwks.json',
    scopes: ['openid', 'email', 'profile'],
    issuer: '',
    supportsRefresh: true,
    supportsPkce: true,
  },
  gitlab: {
    name: 'gitlab',
    displayName: 'GitLab',
    authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
    tokenEndpoint: 'https://gitlab.com/oauth/token',
    userinfoEndpoint: 'https://gitlab.com/oauth/userinfo',
    jwksUri: 'https://gitlab.com/oauth/discovery/keys',
    scopes: ['openid', 'email', 'profile'],
    issuer: 'https://gitlab.com',
    supportsRefresh: true,
    supportsPkce: true,
  },
  keycloak: {
    name: 'keycloak',
    displayName: 'Keycloak',
    authorizationEndpoint: '/protocol/openid-connect/auth',
    tokenEndpoint: '/protocol/openid-connect/token',
    userinfoEndpoint: '/protocol/openid-connect/userinfo',
    jwksUri: '/protocol/openid-connect/certs',
    scopes: ['openid', 'email', 'profile', 'roles'],
    issuer: '',
    supportsRefresh: true,
    supportsPkce: true,
  },
};

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

export function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((v) => charset[v % charset.length])
    .join('');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePkceChallenge(): Promise<PkceChallenge> {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return {
    codeVerifier,
    codeChallenge,
    method: 'S256',
  };
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    // Restore base64 padding
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = payload.length % 4;
    if (padding) {
      payload += '='.repeat(4 - padding);
    }

    const decoded = atob(payload);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: JwtPayload, clockSkewSeconds = 30): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now - clockSkewSeconds;
}

export function validateJwtPayload(payload: JwtPayload, expectedIssuer?: string, expectedAudience?: string): TokenValidation {
  const errors: string[] = [];

  if (!payload.sub) {
    errors.push('Missing subject (sub) claim');
  }

  if (!payload.iss) {
    errors.push('Missing issuer (iss) claim');
  }

  if (!payload.exp) {
    errors.push('Missing expiration (exp) claim');
  }

  if (expectedIssuer && payload.iss !== expectedIssuer) {
    errors.push(`Issuer mismatch: expected ${expectedIssuer}, got ${payload.iss}`);
  }

  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAudience)) {
      errors.push(`Audience mismatch: expected ${expectedAudience}`);
    }
  }

  const expired = payload.exp ? isTokenExpired(payload) : true;

  return {
    valid: errors.length === 0 && !expired,
    expired,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Provider URL helpers
// ---------------------------------------------------------------------------

export function resolveProviderUrl(config: OidcProviderConfig, domain?: string, path?: string): string {
  const endpoint = path ?? config.authorizationEndpoint;
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  if (!domain) {
    return endpoint;
  }
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  return `${base.replace(/\/$/, '')}${endpoint}`;
}

export function buildAuthorizationUrl(
  config: OidcProviderConfig,
  clientConfig: OidcClientConfig,
  state: string,
  nonce: string,
  pkce?: PkceChallenge,
): string {
  const baseUrl = resolveProviderUrl(config, clientConfig.domain);
  const params = new URLSearchParams();

  params.set('response_type', 'code');
  params.set('client_id', clientConfig.clientId);
  params.set('redirect_uri', clientConfig.redirectUri);
  params.set('state', state);
  params.set('nonce', nonce);

  const scopes = clientConfig.scopes ?? config.scopes;
  params.set('scope', scopes.join(' '));

  if (clientConfig.audience) {
    params.set('audience', clientConfig.audience);
  }

  if (pkce && config.supportsPkce) {
    params.set('code_challenge', pkce.codeChallenge);
    params.set('code_challenge_method', pkce.method);
  }

  return `${baseUrl}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Group-to-role mapping
// ---------------------------------------------------------------------------

export function mapGroupsToRoles(groups: string[], mappings: GroupRoleMapping[]): AppRole[] {
  const roles = new Set<AppRole>();

  for (const group of groups) {
    for (const mapping of mappings) {
      if (group === mapping.group || group.toLowerCase() === mapping.group.toLowerCase()) {
        roles.add(mapping.role);
      }
    }
  }

  return Array.from(roles);
}

export function createDefaultGroupMappings(): GroupRoleMapping[] {
  return [
    { group: 'admins', role: 'admin' },
    { group: 'administrators', role: 'admin' },
    { group: 'editors', role: 'editor' },
    { group: 'developers', role: 'editor' },
    { group: 'viewers', role: 'viewer' },
    { group: 'readonly', role: 'viewer' },
    { group: 'owners', role: 'owner' },
  ];
}

export function extractUserInfo(payload: JwtPayload, provider: ProviderName, mappings?: GroupRoleMapping[]): UserInfo {
  const groups = payload.groups ?? [];
  const effectiveMappings = mappings ?? createDefaultGroupMappings();
  const roles = mapGroupsToRoles(groups, effectiveMappings);

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    groups,
    roles: roles.length > 0 ? roles : ['viewer'],
    provider,
    raw: payload,
  };
}

// ---------------------------------------------------------------------------
// SsoOidcManager
// ---------------------------------------------------------------------------

export class SsoOidcManager {
  private static instance: SsoOidcManager | null = null;

  private state: SsoState;
  private clientConfig: OidcClientConfig | null = null;
  private groupMappings: GroupRoleMapping[];
  private listeners: Set<Listener> = new Set();
  private pendingState: string | null = null;
  private pendingNonce: string | null = null;
  private pendingCodeVerifier: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = {
      authenticated: false,
      user: null,
      tokens: null,
      provider: null,
      expiresAt: null,
    };
    this.groupMappings = createDefaultGroupMappings();
  }

  static getInstance(): SsoOidcManager {
    if (!SsoOidcManager.instance) {
      SsoOidcManager.instance = new SsoOidcManager();
    }
    return SsoOidcManager.instance;
  }

  static resetInstance(): void {
    if (SsoOidcManager.instance) {
      SsoOidcManager.instance.dispose();
    }
    SsoOidcManager.instance = null;
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
  // Configuration
  // -------------------------------------------------------------------------

  configure(config: OidcClientConfig): void {
    this.clientConfig = config;
    this.notify();
  }

  getClientConfig(): OidcClientConfig | null {
    return this.clientConfig ? { ...this.clientConfig } : null;
  }

  getProviderConfig(provider?: ProviderName): OidcProviderConfig | null {
    const name = provider ?? this.clientConfig?.provider;
    if (!name) {
      return null;
    }
    return PROVIDER_PRESETS[name] ?? null;
  }

  setGroupMappings(mappings: GroupRoleMapping[]): void {
    this.groupMappings = [...mappings];
    // Re-map roles if user is authenticated
    if (this.state.user) {
      const groups = this.state.user.groups ?? [];
      this.state.user.roles = mapGroupsToRoles(groups, this.groupMappings);
      if (this.state.user.roles.length === 0) {
        this.state.user.roles = ['viewer'];
      }
    }
    this.notify();
  }

  getGroupMappings(): GroupRoleMapping[] {
    return [...this.groupMappings];
  }

  // -------------------------------------------------------------------------
  // Authentication flow
  // -------------------------------------------------------------------------

  async startAuthFlow(): Promise<AuthorizationParams> {
    if (!this.clientConfig) {
      throw new Error('SSO not configured. Call configure() first.');
    }

    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${this.clientConfig.provider}`);
    }

    const state = generateRandomString(32);
    const nonce = generateRandomString(32);

    let pkce: PkceChallenge | undefined;
    if (providerConfig.supportsPkce) {
      pkce = await generatePkceChallenge();
    }

    const url = buildAuthorizationUrl(providerConfig, this.clientConfig, state, nonce, pkce);

    this.pendingState = state;
    this.pendingNonce = nonce;
    this.pendingCodeVerifier = pkce?.codeVerifier ?? null;

    return {
      url,
      state,
      nonce,
      codeVerifier: pkce?.codeVerifier ?? '',
    };
  }

  validateCallback(receivedState: string): boolean {
    if (!this.pendingState) {
      return false;
    }
    return receivedState === this.pendingState;
  }

  handleTokenResponse(tokenResponse: TokenResponse): UserInfo | null {
    if (!this.clientConfig) {
      return null;
    }

    this.state.tokens = tokenResponse;
    this.state.expiresAt = Date.now() + tokenResponse.expiresIn * 1000;
    this.state.provider = this.clientConfig.provider;

    if (tokenResponse.idToken) {
      const payload = decodeJwtPayload(tokenResponse.idToken);
      if (payload) {
        const user = extractUserInfo(payload, this.clientConfig.provider, this.groupMappings);
        this.state.user = user;
        this.state.authenticated = true;
        this.scheduleRefresh(tokenResponse.expiresIn);
        this.notify();
        return user;
      }
    }

    // If no id_token (e.g. GitHub), still mark as authenticated
    this.state.authenticated = true;
    this.notify();
    return this.state.user;
  }

  // -------------------------------------------------------------------------
  // Token management
  // -------------------------------------------------------------------------

  getTokens(): TokenResponse | null {
    return this.state.tokens ? { ...this.state.tokens } : null;
  }

  isAuthenticated(): boolean {
    return this.state.authenticated;
  }

  isTokenExpired(): boolean {
    if (!this.state.expiresAt) {
      return true;
    }
    return Date.now() >= this.state.expiresAt;
  }

  getTimeUntilExpiry(): number {
    if (!this.state.expiresAt) {
      return 0;
    }
    return Math.max(0, this.state.expiresAt - Date.now());
  }

  canRefresh(): boolean {
    if (!this.state.tokens?.refreshToken) {
      return false;
    }
    const providerConfig = this.getProviderConfig();
    return providerConfig?.supportsRefresh ?? false;
  }

  getRefreshToken(): string | null {
    return this.state.tokens?.refreshToken ?? null;
  }

  updateTokens(tokenResponse: TokenResponse): void {
    this.state.tokens = tokenResponse;
    this.state.expiresAt = Date.now() + tokenResponse.expiresIn * 1000;

    if (tokenResponse.idToken && this.clientConfig) {
      const payload = decodeJwtPayload(tokenResponse.idToken);
      if (payload) {
        this.state.user = extractUserInfo(payload, this.clientConfig.provider, this.groupMappings);
      }
    }

    this.scheduleRefresh(tokenResponse.expiresIn);
    this.notify();
  }

  private scheduleRefresh(expiresIn: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Refresh at 75% of expiry time
    const refreshIn = Math.max(0, Math.floor(expiresIn * 0.75) * 1000);
    this.refreshTimer = setTimeout(() => {
      this.notify(); // Notify listeners to trigger refresh
    }, refreshIn);
  }

  // -------------------------------------------------------------------------
  // User info
  // -------------------------------------------------------------------------

  getUser(): UserInfo | null {
    return this.state.user ? { ...this.state.user } : null;
  }

  getState(): SsoState {
    return { ...this.state };
  }

  getUserRoles(): AppRole[] {
    return this.state.user?.roles ?? [];
  }

  hasRole(role: AppRole): boolean {
    return this.getUserRoles().includes(role);
  }

  hasAnyRole(roles: AppRole[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.some((r) => userRoles.includes(r));
  }

  // -------------------------------------------------------------------------
  // Pending auth state
  // -------------------------------------------------------------------------

  getPendingState(): string | null {
    return this.pendingState;
  }

  getPendingNonce(): string | null {
    return this.pendingNonce;
  }

  getPendingCodeVerifier(): string | null {
    return this.pendingCodeVerifier;
  }

  clearPendingAuth(): void {
    this.pendingState = null;
    this.pendingNonce = null;
    this.pendingCodeVerifier = null;
  }

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  logout(): void {
    this.state = {
      authenticated: false,
      user: null,
      tokens: null,
      provider: null,
      expiresAt: null,
    };
    this.clearPendingAuth();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Provider discovery
  // -------------------------------------------------------------------------

  getAvailableProviders(): OidcProviderConfig[] {
    return Object.values(PROVIDER_PRESETS);
  }

  getProviderByName(name: ProviderName): OidcProviderConfig {
    return PROVIDER_PRESETS[name];
  }

  getSupportedScopes(provider: ProviderName): string[] {
    return [...PROVIDER_PRESETS[provider].scopes];
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  toJSON(): {
    state: SsoState;
    clientConfig: OidcClientConfig | null;
    groupMappings: GroupRoleMapping[];
  } {
    return {
      state: { ...this.state },
      clientConfig: this.clientConfig ? { ...this.clientConfig } : null,
      groupMappings: [...this.groupMappings],
    };
  }

  static fromJSON(data: {
    state: SsoState;
    clientConfig: OidcClientConfig | null;
    groupMappings?: GroupRoleMapping[];
  }): SsoOidcManager {
    const manager = new SsoOidcManager();
    manager.state = { ...data.state };
    manager.clientConfig = data.clientConfig ? { ...data.clientConfig } : null;
    if (data.groupMappings) {
      manager.groupMappings = [...data.groupMappings];
    }
    return manager;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
  }
}
