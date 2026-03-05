import type { db as dbInstance } from '../db';
import type { cache as cacheInstance } from '../cache';

export type DbClient = typeof dbInstance;
export type CacheClient = typeof cacheInstance;

export interface StorageDeps {
  db: DbClient;
  cache: CacheClient;
}
