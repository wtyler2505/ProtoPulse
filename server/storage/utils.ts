import type { PgTable } from 'drizzle-orm/pg-core';
import type { DbClient } from './types';

export async function chunkedInsert<R>(
  db: DbClient,
  table: PgTable,
  items: Record<string, unknown>[],
  chunkSize = 100,
): Promise<R[]> {
  if (items.length <= chunkSize) {
    return db.insert(table).values(items).returning() as unknown as Promise<R[]>;
  }
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const inserted = await db.insert(table).values(chunk).returning();
    results.push(...(inserted as unknown as R[]));
  }
  return results;
}
