import crypto from "crypto";
import { db } from "./db";
import { users, sessions, apiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex') === key);
    });
  });
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });
  return sessionId;
}

export async function validateSession(sessionId: string): Promise<{ userId: number } | null> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  return { userId: session.userId };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
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
