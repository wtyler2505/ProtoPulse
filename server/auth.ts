import crypto from "crypto";
import { db } from "./db";
import { users, sessions, apiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash a session token using SHA-256 before storage or lookup.
 * The DB never stores raw tokens — only their hashes.
 * This prevents session hijacking via database compromise.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

const ENCRYPTION_KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;

const ENCRYPTION_KEY = (() => {
  const key = process.env.API_KEY_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('API_KEY_ENCRYPTION_KEY environment variable is required in production');
    }
    if (process.env.UNSAFE_DEV_SKIP_ENCRYPTION !== '1') {
      throw new Error(
        'API_KEY_ENCRYPTION_KEY is required. Set it to a 64-char hex string, or set UNSAFE_DEV_SKIP_ENCRYPTION=1 to use an ephemeral key (stored API keys will not persist across restarts).',
      );
    }
    const fallback = crypto.randomBytes(32).toString('hex');
    logger.warn('API_KEY_ENCRYPTION_KEY not set — using ephemeral random key (stored API keys will not persist across restarts)', { env: process.env.NODE_ENV });
    return fallback;
  }
  if (!ENCRYPTION_KEY_HEX_RE.test(key)) {
    throw new Error(
      'API_KEY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return key;
})();

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) { reject(err); return; }
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) { reject(err); return; }
      const keyBuffer = Buffer.from(key, 'hex');
      if (derivedKey.length !== keyBuffer.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(derivedKey, keyBuffer));
    });
  });
}

export async function createSession(userId: number): Promise<string> {
  const rawToken = crypto.randomUUID();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: tokenHash, userId, expiresAt });
  return rawToken;
}

export async function validateSession(sessionId: string): Promise<{ userId: number } | null> {
  const tokenHash = hashSessionToken(sessionId);
  const [session] = await db.select().from(sessions).where(eq(sessions.id, tokenHash));
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
    return null;
  }
  return { userId: session.userId };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const tokenHash = hashSessionToken(sessionId);
  await db.delete(sessions).where(eq(sessions.id, tokenHash));
}

/** Minimum remaining session lifetime before refresh is allowed (1 day). */
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh and rotate a session token.
 *
 * If the session is valid and has been active (i.e. less than
 * `SESSION_DURATION_MS - REFRESH_WINDOW_MS` remaining), a new session
 * token is issued with a fresh expiry and the old token is invalidated.
 *
 * Returns `{ newSessionId, userId }` on success, or `null` if the
 * session is expired, missing, or not yet eligible for refresh.
 */
export async function refreshSession(
  sessionId: string,
): Promise<{ newSessionId: string; userId: number } | null> {
  const oldHash = hashSessionToken(sessionId);
  const [session] = await db.select().from(sessions).where(eq(sessions.id, oldHash));
  if (!session) { return null; }

  const now = new Date();

  // Expired — clean up and reject
  if (now > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, oldHash));
    return null;
  }

  const remaining = session.expiresAt.getTime() - now.getTime();

  // Only refresh if within the refresh window (less than REFRESH_WINDOW_MS before expiry,
  // or equivalently, the session has been alive for at least SESSION_DURATION_MS - REFRESH_WINDOW_MS)
  if (remaining > REFRESH_WINDOW_MS) {
    return null;
  }

  // Rotate: issue new raw token, store its hash, delete old hash
  const newRawToken = crypto.randomUUID();
  const newHash = hashSessionToken(newRawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({ id: newHash, userId: session.userId, expiresAt });
  await db.delete(sessions).where(eq(sessions.id, oldHash));

  return { newSessionId: newRawToken, userId: session.userId };
}

export async function createUser(username: string, password: string) {
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ username, passwordHash }).returning();
  return user;
}

export async function getUserByUsername(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user || null;
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user || null;
}

function getEncryptionKey(): Buffer {
  return Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
}

export async function storeApiKey(userId: number, provider: string, apiKey: string): Promise<void> {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  const encryptedKey = encrypted + ':' + authTag;

  await db.delete(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)));
  await db.insert(apiKeys).values({ userId, provider, encryptedKey, iv: iv.toString('hex') });
}

export async function getApiKey(userId: number, provider: string): Promise<string | null> {
  const [record] = await db.select().from(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)));
  if (!record) return null;

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(record.iv, 'hex');
    const [encrypted, authTag] = record.encryptedKey.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

export async function deleteApiKey(userId: number, provider: string): Promise<boolean> {
  const result = await db.delete(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider))).returning();
  return result.length > 0;
}

export async function listApiKeyProviders(userId: number): Promise<string[]> {
  const records = await db.select({ provider: apiKeys.provider }).from(apiKeys).where(eq(apiKeys.userId, userId));
  return records.map(r => r.provider);
}
