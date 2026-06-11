import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  VerifiedFactSchema,
  v3InspectionReports,
  v3ProvenanceEvents,
  type InsertV3InspectionReport,
  type InsertV3ProvenanceEvent,
  type V3InspectionReport,
  type VerifiedFact,
} from './schema';

export type V3Db = NodePgDatabase<Record<string, unknown>>;

export async function upsertVerifiedFact(db: V3Db, input: unknown): Promise<VerifiedFact> {
  const fact = VerifiedFactSchema.parse(input);
  const [event] = await db.insert(v3ProvenanceEvents).values({
    subjectType: 'verified_fact',
    subjectKey: fact.key,
    sourcePath: fact.source,
    sourceKind: 'protopulse-knowledge',
    status: fact.status,
    payload: {
      key: fact.key,
      value: fact.value,
    },
  } satisfies InsertV3ProvenanceEvent).returning();

  return VerifiedFactSchema.parse({
    ...fact,
    provenanceId: event.id,
  });
}

export async function getVerifiedFact(db: V3Db, key: string): Promise<VerifiedFact | undefined> {
  const [event] = await db
    .select()
    .from(v3ProvenanceEvents)
    .where(eq(v3ProvenanceEvents.subjectKey, key))
    .limit(1);

  if (!event) {
    return undefined;
  }

  return VerifiedFactSchema.parse({
    key: event.subjectKey,
    value: event.payload.value,
    source: event.sourcePath,
    status: event.status,
    provenanceId: event.id,
  });
}

export async function storeInspectionReport(db: V3Db, input: InsertV3InspectionReport): Promise<V3InspectionReport> {
  const [report] = await db.insert(v3InspectionReports).values(input).returning();
  return report;
}
