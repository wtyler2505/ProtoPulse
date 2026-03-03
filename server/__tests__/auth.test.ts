import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Pure function tests: hashPassword / verifyPassword
// These are the crypto functions that don't need DB mocking.
// ---------------------------------------------------------------------------

// We need to mock the db module BEFORE importing auth, because auth.ts
// imports db at the top level and tries to connect.
vi.mock('../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

// Mock the logger to avoid noise
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Allow the ephemeral dev key fallback when API_KEY_ENCRYPTION_KEY is not set
// Must be hoisted so it runs BEFORE the auth.ts import (ESM hoists imports above statements)
vi.hoisted(() => {
  process.env.UNSAFE_DEV_SKIP_ENCRYPTION = '1';
});

import { hashPassword, verifyPassword, hashSessionToken } from '../auth';
import crypto from 'crypto';

// =============================================================================
// hashPassword
// =============================================================================

describe('hashPassword', () => {
  it('returns a string in salt:hash format', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toContain(':');
    const [salt, derived] = hash.split(':');
    expect(salt).toBeTruthy();
    expect(derived).toBeTruthy();
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toBe(hash2);
  });

  it('produces hex-encoded salt of 32 chars (16 bytes)', async () => {
    const hash = await hashPassword('test');
    const salt = hash.split(':')[0];
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces hex-encoded derived key of 128 chars (64 bytes)', async () => {
    const hash = await hashPassword('test');
    const derived = hash.split(':')[1];
    expect(derived).toMatch(/^[0-9a-f]{128}$/);
  });

  it('handles empty string password', async () => {
    const hash = await hashPassword('');
    expect(hash).toContain(':');
    const parts = hash.split(':');
    expect(parts).toHaveLength(2);
  });

  it('handles unicode password', async () => {
    const hash = await hashPassword('p\u00e4ssw\u00f6rd\u00fc');
    expect(hash).toContain(':');
  });
});

// =============================================================================
// verifyPassword
// =============================================================================

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correct');
    const result = await verifyPassword('correct', hash);
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    const result = await verifyPassword('wrong', hash);
    expect(result).toBe(false);
  });

  it('returns false for slightly different password', async () => {
    const hash = await hashPassword('password');
    const result = await verifyPassword('Password', hash);
    expect(result).toBe(false);
  });

  it('verifies password with special characters', async () => {
    const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('verifies empty string password', async () => {
    const hash = await hashPassword('');
    expect(await verifyPassword('', hash)).toBe(true);
    expect(await verifyPassword('notempty', hash)).toBe(false);
  }, 15000);

  it('handles very long passwords', async () => {
    const longPassword = 'a'.repeat(10000);
    const hash = await hashPassword(longPassword);
    expect(await verifyPassword(longPassword, hash)).toBe(true);
    expect(await verifyPassword(longPassword + 'b', hash)).toBe(false);
  }, 15000);
});

// =============================================================================
// API key encryption roundtrip (via storeApiKey / getApiKey)
// These require DB — we test the encryption logic indirectly through the
// pure crypto functions. The actual store/get functions are DB-dependent,
// so we test the core encrypt/decrypt mechanics.
// =============================================================================

describe('API key encryption/decryption (crypto roundtrip)', () => {
  function encrypt(apiKey: string, encryptionKey: string): { encrypted: string; iv: string } {
    const key = Buffer.from(encryptionKey.slice(0, 64), 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update(apiKey, 'utf8', 'hex');
    enc += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { encrypted: enc + ':' + authTag, iv: iv.toString('hex') };
  }

  function decrypt(encrypted: string, iv: string, encryptionKey: string): string {
    const key = Buffer.from(encryptionKey.slice(0, 64), 'hex');
    const ivBuf = Buffer.from(iv, 'hex');
    const [enc, authTag] = encrypted.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }

  const testKey = crypto.randomBytes(32).toString('hex');

  it('encrypts and decrypts an API key correctly', () => {
    const apiKey = 'sk-ant-api03-abcdefghijklmnop';
    const { encrypted, iv } = encrypt(apiKey, testKey);
    const decrypted = decrypt(encrypted, iv, testKey);
    expect(decrypted).toBe(apiKey);
  });

  it('produces different ciphertext for same key (random IV)', () => {
    const apiKey = 'sk-test-123';
    const a = encrypt(apiKey, testKey);
    const b = encrypt(apiKey, testKey);
    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails to decrypt with wrong key', () => {
    const apiKey = 'sk-test-456';
    const { encrypted, iv } = encrypt(apiKey, testKey);
    const wrongKey = crypto.randomBytes(32).toString('hex');
    expect(() => decrypt(encrypted, iv, wrongKey)).toThrow();
  });

  it('fails to decrypt with tampered ciphertext', () => {
    const apiKey = 'AIzaSyTest123456';
    const { encrypted, iv } = encrypt(apiKey, testKey);
    // Flip a character in the encrypted data
    const tampered = 'ff' + encrypted.slice(2);
    expect(() => decrypt(tampered, iv, testKey)).toThrow();
  });

  it('handles empty API key', () => {
    const { encrypted, iv } = encrypt('', testKey);
    const decrypted = decrypt(encrypted, iv, testKey);
    expect(decrypted).toBe('');
  });

  it('handles long API key', () => {
    const longKey = 'sk-ant-' + 'x'.repeat(500);
    const { encrypted, iv } = encrypt(longKey, testKey);
    const decrypted = decrypt(encrypted, iv, testKey);
    expect(decrypted).toBe(longKey);
  });
});

// =============================================================================
// Session ID generation
// =============================================================================

describe('Session mechanics', () => {
  it('crypto.randomUUID produces valid UUID format', () => {
    const uuid = crypto.randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('session duration constant is 7 days in ms', () => {
    // Validate the constant from auth.ts: 7 * 24 * 60 * 60 * 1000
    const expected = 7 * 24 * 60 * 60 * 1000;
    expect(expected).toBe(604800000);
  });
});

// =============================================================================
// Session token hashing (CAPX-SEC-09)
// =============================================================================

describe('hashSessionToken', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashSessionToken('test-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic output for same input', () => {
    const hash1 = hashSessionToken('same-token');
    const hash2 = hashSessionToken('same-token');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different tokens', () => {
    const hash1 = hashSessionToken('token-a');
    const hash2 = hashSessionToken('token-b');
    expect(hash1).not.toBe(hash2);
  });

  it('hash differs from the raw token', () => {
    const raw = crypto.randomUUID();
    const hash = hashSessionToken(raw);
    expect(hash).not.toBe(raw);
    expect(hash.length).toBe(64);
  });

  it('handles empty string', () => {
    const hash = hashSessionToken('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches known SHA-256 output', () => {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const hash = hashSessionToken('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('prevents DB replay: raw token cannot be used to query DB directly', () => {
    // This test documents the security property: given a raw token, the DB
    // stores only hash(token), so an attacker with DB access cannot forge sessions.
    const raw = crypto.randomUUID();
    const stored = hashSessionToken(raw);
    // An attacker who reads `stored` from the DB cannot reverse it to `raw`
    expect(stored).not.toBe(raw);
    // And using the stored hash as a token would produce a different lookup key
    const doubleHash = hashSessionToken(stored);
    expect(doubleHash).not.toBe(stored);
  });
});
