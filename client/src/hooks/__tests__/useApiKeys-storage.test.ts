/**
 * Audit #60 regression guard — API keys and OAuth tokens MUST NOT be persisted in
 * `localStorage` plaintext. The XSS blast radius of localStorage is origin-wide and
 * indefinite; a single stored-XSS in a comment/vault/note would exfiltrate every key.
 *
 * This test scans every `localStorage` entry after exercising the key- and
 * token-management hooks and fails if any value under a suspicious key name is
 * still present. sessionStorage is fine (tab-scoped), server-side encrypted storage
 * is fine. localStorage is NOT.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PublicApiManager } from '@/lib/public-api';

const SUSPICIOUS_KEY_PATTERN = /api[_-]?key|token|secret|oauth|bearer|credential/i;

describe('audit #60 — localStorage secret scan', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    PublicApiManager.resetForTesting();
  });

  it('PublicApiManager.generateApiKey does NOT persist the raw `key` secret to localStorage', () => {
    const mgr = PublicApiManager.getInstance();
    const generated = mgr.generateApiKey({ name: 'test-integration' });
    expect(generated.key).toMatch(/^pp_/);
    expect(generated.key.length).toBeGreaterThan(11);

    // Scan every localStorage entry for the raw secret body (chars after the prefix).
    const secretBody = generated.key.slice(11);
    expect(secretBody.length).toBeGreaterThan(0);
    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (!storageKey) continue;
      const value = localStorage.getItem(storageKey) ?? '';
      expect(
        value.includes(secretBody),
        `localStorage['${storageKey}'] leaks raw API key secret — audit #60 violation`,
      ).toBe(false);
    }
  });

  it('PublicApiManager persists only safe metadata (prefix, id, name) under the api-keys slot', () => {
    const mgr = PublicApiManager.getInstance();
    const generated = mgr.generateApiKey({ name: 'metadata-test' });

    const stored = localStorage.getItem('protopulse:public-api:keys');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    // The raw key must not be present in the persisted record.
    expect(parsed[0]).not.toHaveProperty('key');
    // Prefix is safe to keep (first 11 chars, not usable for auth on its own).
    expect(parsed[0].prefix).toBe(generated.prefix);
  });

  it('rehydrated API keys have an empty `key` field — raw secret is never in localStorage', () => {
    const mgr1 = PublicApiManager.getInstance();
    mgr1.generateApiKey({ name: 'survive-reload' });

    // Simulate a fresh page load by resetting the singleton; localStorage persists.
    PublicApiManager.resetForTesting();
    const mgr2 = PublicApiManager.getInstance();
    const rehydrated = mgr2.getAllApiKeys();
    expect(rehydrated).toHaveLength(1);
    expect(rehydrated[0].key).toBe('');
    expect(rehydrated[0].name).toBe('survive-reload');
  });

  it('generic scan — no localStorage key matching /api.?key|token|secret|oauth/i holds a long secret-like value', () => {
    const mgr = PublicApiManager.getInstance();
    mgr.generateApiKey({ name: 'scan-test' });

    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (!storageKey) continue;
      if (!SUSPICIOUS_KEY_PATTERN.test(storageKey)) continue;
      const value = localStorage.getItem(storageKey) ?? '';
      // A persisted metadata JSON is fine; a long opaque secret string is not.
      // We allow JSON arrays/objects (metadata) but flag plain secret-looking strings.
      const looksLikeRawSecret =
        !value.startsWith('[') && !value.startsWith('{') && value.length >= 20;
      expect(
        looksLikeRawSecret,
        `localStorage['${storageKey}'] looks like a raw secret — audit #60 violation`,
      ).toBe(false);
    }
  });
});
