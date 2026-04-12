/**
 * Idempotent backfill migration — Phase 4 of the unified parts catalog consolidation.
 *
 * Migrates all existing data from legacy tables (componentLibrary, componentParts,
 * bomItems, circuitInstances, componentLifecycle, spiceModels) and static lookup
 * files (verified-boards, standard-library, starter-circuits) into the canonical
 * `parts` / `part_stock` / `part_placements` / `part_lifecycle` / `part_spice_models`
 * tables.
 *
 * Run: `tsx scripts/migrations/backfill-parts-catalog.ts`
 *
 * Idempotency: each step checks for existing `originRef` values before inserting.
 * Re-running is safe and will skip already-migrated rows.
 *
 * Alternates population is deferred to Phase 7 — the `alternate-parts.ts` module is
 * an algorithmic matching engine (not a static equivalence list), so generating pairs
 * requires the full catalog to be populated first.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, inArray, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import {
  parts,
  partStock,
  partPlacements,
  partLifecycle,
  partSpiceModels,
  componentLibrary,
  componentParts,
  bomItems,
  circuitInstances,
  componentLifecycle,
  spiceModels,
} from '@shared/schema';
import type { Part, InsertPart } from '@shared/schema';
import { generateSlug, appendCollisionSuffix, slugify } from '@shared/parts/part-slug';
import type { SlugInput } from '@shared/parts/part-slug';
import type { PartOrigin, TrustLevel, AssemblyCategory } from '@shared/parts/part-row';
import { ASSEMBLY_CATEGORIES } from '@shared/parts/part-row';

// Re-export the db type for callers and tests
type DbClient = ReturnType<typeof drizzle>;

// ---------------------------------------------------------------------------
// Step result
// ---------------------------------------------------------------------------

export interface StepResult {
  step: string;
  migrated: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Pure transformation functions (exported for testing)
// ---------------------------------------------------------------------------

export function componentLibraryToInsert(
  row: typeof componentLibrary.$inferSelect,
): Omit<InsertPart, 'slug'> {
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  return {
    title: row.title,
    description: row.description ?? null,
    manufacturer: (meta['manufacturer'] as string) ?? null,
    mpn: (meta['mpn'] as string) ?? null,
    canonicalCategory: row.category ?? 'unknown',
    packageType: (meta['packageType'] as string) ?? null,
    tolerance: (meta['tolerance'] as string) ?? null,
    esdSensitive: (meta['esdSensitive'] as boolean) ?? null,
    assemblyCategory: normalizeAssemblyCategory(meta['assemblyCategory']),
    meta: meta,
    connectors: (row.connectors ?? []) as unknown[],
    datasheetUrl: (meta['datasheetUrl'] as string) ?? null,
    manufacturerUrl: (meta['manufacturerUrl'] as string) ?? null,
    origin: 'library' as PartOrigin,
    originRef: `library:${row.id}`,
    forkedFromId: null,
    authorUserId: null,
    isPublic: row.isPublic,
    trustLevel: 'library' as TrustLevel,
  };
}

export function componentPartToInsert(
  row: typeof componentParts.$inferSelect,
): Omit<InsertPart, 'slug'> {
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  return {
    title: (meta['title'] as string) ?? (meta['componentTitle'] as string) ?? `Component Part ${row.id}`,
    description: (meta['description'] as string) ?? null,
    manufacturer: (meta['manufacturer'] as string) ?? null,
    mpn: (meta['mpn'] as string) ?? null,
    canonicalCategory: (meta['category'] as string) ?? (meta['canonicalCategory'] as string) ?? 'unknown',
    packageType: (meta['packageType'] as string) ?? null,
    tolerance: (meta['tolerance'] as string) ?? null,
    esdSensitive: (meta['esdSensitive'] as boolean) ?? null,
    assemblyCategory: normalizeAssemblyCategory(meta['assemblyCategory']),
    meta: meta,
    connectors: (row.connectors ?? []) as unknown[],
    datasheetUrl: (meta['datasheetUrl'] as string) ?? null,
    manufacturerUrl: (meta['manufacturerUrl'] as string) ?? null,
    origin: 'user' as PartOrigin,
    originRef: `legacy_component_parts:${row.id}`,
    forkedFromId: null,
    authorUserId: null,
    isPublic: false,
    trustLevel: 'user' as TrustLevel,
  };
}

export function bomItemToInsert(
  row: typeof bomItems.$inferSelect,
): Omit<InsertPart, 'slug'> {
  return {
    title: row.description,
    description: null,
    manufacturer: row.manufacturer,
    mpn: row.partNumber,
    canonicalCategory: inferCategoryFromBom(row.description, row.partNumber),
    packageType: null,
    tolerance: row.tolerance ?? null,
    esdSensitive: row.esdSensitive ?? null,
    assemblyCategory: normalizeAssemblyCategory(row.assemblyCategory),
    meta: {},
    connectors: [],
    datasheetUrl: row.datasheetUrl ?? null,
    manufacturerUrl: row.manufacturerUrl ?? null,
    origin: 'user' as PartOrigin,
    originRef: `legacy_bom:${row.id}`,
    forkedFromId: null,
    authorUserId: null,
    isPublic: false,
    trustLevel: 'user' as TrustLevel,
  };
}

export function bomItemToStockFields(
  row: typeof bomItems.$inferSelect,
  partId: string,
): {
  projectId: number;
  partId: string;
  quantityNeeded: number;
  quantityOnHand: number | null;
  minimumStock: number | null;
  storageLocation: string | null;
  unitPrice: string | null;
  supplier: string | null;
  leadTime: string | null;
  status: string;
  notes: string | null;
} {
  return {
    projectId: row.projectId,
    partId,
    quantityNeeded: row.quantity,
    quantityOnHand: row.quantityOnHand ?? row.stock,
    minimumStock: row.minimumStock ?? null,
    storageLocation: row.storageLocation ?? null,
    unitPrice: row.unitPrice,
    supplier: row.supplier,
    leadTime: row.leadTime ?? null,
    status: row.status,
    notes: null,
  };
}

export function normalizeAssemblyCategory(value: unknown): AssemblyCategory | null {
  if (typeof value !== 'string') { return null; }
  const lower = value.toLowerCase().replace(/[\s-]/g, '_');
  if ((ASSEMBLY_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as AssemblyCategory;
  }
  if (lower === 'smd') { return 'smt'; }
  if (lower === 'tht' || lower === 'through-hole' || lower === 'dip') { return 'through_hole'; }
  return null;
}

export function inferCategoryFromBom(description: string, partNumber: string): string {
  const text = `${description} ${partNumber}`.toLowerCase();
  if (/\bresist/i.test(text) || /\b\d+[kKmM]?\s*[Ωo]hm/i.test(text) || /\d+\s*[Ωω]/.test(text)) { return 'resistor'; }
  if (/\bcap(acitor)?/i.test(text) || /\b\d+[pnuμ][Ff]\b/.test(text)) { return 'capacitor'; }
  if (/\binduct/i.test(text) || /\b\d+[munμ][Hh]\b/.test(text)) { return 'inductor'; }
  if (/\bdiode/i.test(text) || /\b1N\d/i.test(text)) { return 'diode'; }
  if (/\bled\b/i.test(text)) { return 'led'; }
  if (/\btransistor/i.test(text) || /\b2N\d/i.test(text) || /\bBC\d/i.test(text)) { return 'transistor'; }
  if (/\bmosfet/i.test(text) || /\bIRF\d/i.test(text)) { return 'mosfet'; }
  if (/\b(mcu|microcontroller|arduino|esp32|stm32|pic|avr)/i.test(text)) { return 'mcu'; }
  if (/\bop[\s-]?amp/i.test(text) || /\bLM3\d\d/i.test(text)) { return 'amplifier'; }
  if (/\bconnect/i.test(text) || /\bheader/i.test(text) || /\bUSB/i.test(text)) { return 'connector'; }
  if (/\bsensor/i.test(text)) { return 'sensor'; }
  if (/\bcrystal/i.test(text) || /\boscillat/i.test(text)) { return 'crystal'; }
  if (/\bregulat/i.test(text) || /\bLDO/i.test(text) || /\bLM78\d/i.test(text)) { return 'regulator'; }
  if (/\brelay/i.test(text)) { return 'relay'; }
  if (/\bfuse/i.test(text)) { return 'fuse'; }
  if (/\bswitch/i.test(text) || /\bbutton/i.test(text)) { return 'switch'; }
  if (/\bdisplay/i.test(text) || /\bLCD/i.test(text) || /\bOLED/i.test(text)) { return 'display'; }
  if (/\bmotor/i.test(text) || /\bservo/i.test(text)) { return 'motor'; }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Slug resolution helpers
// ---------------------------------------------------------------------------

function buildSlugInput(data: Omit<InsertPart, 'slug'>): SlugInput {
  const meta = data.meta ?? {};
  const value =
    (typeof meta['value'] === 'string' && meta['value']) ||
    (typeof meta['resistance'] === 'string' && meta['resistance']) ||
    (typeof meta['capacitance'] === 'string' && meta['capacitance']) ||
    (typeof meta['inductance'] === 'string' && meta['inductance']) ||
    null;
  return {
    canonicalCategory: data.canonicalCategory,
    value,
    packageType: data.packageType ?? null,
    tolerance: data.tolerance ?? null,
    manufacturer: data.manufacturer ?? null,
    mpn: data.mpn ?? null,
  };
}

async function resolveSlugFromBase(db: DbClient, baseSlug: string): Promise<string> {
  const existing = await db
    .select({ slug: parts.slug })
    .from(parts)
    .where(eq(parts.slug, baseSlug))
    .limit(1);
  if (existing.length === 0) { return baseSlug; }
  for (let n = 2; n < 200; n += 1) {
    const candidate = appendCollisionSuffix(baseSlug, n);
    const found = await db
      .select({ slug: parts.slug })
      .from(parts)
      .where(eq(parts.slug, candidate))
      .limit(1);
    if (found.length === 0) { return candidate; }
  }
  throw new Error(`Slug collision cap exceeded for "${baseSlug}"`);
}

async function resolveSlug(db: DbClient, data: Omit<InsertPart, 'slug'>): Promise<string> {
  const baseSlug = generateSlug(buildSlugInput(data));
  return resolveSlugFromBase(db, baseSlug);
}

// ---------------------------------------------------------------------------
// Step 1: componentLibrary → parts
// ---------------------------------------------------------------------------

export async function migrateComponentLibrary(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'componentLibrary', migrated: 0, skipped: 0, errors: [] };

  const rows = await db.select().from(componentLibrary);
  if (rows.length === 0) { return result; }

  const originRefs = rows.map((r) => `library:${r.id}`);
  const existing = await db
    .select({ originRef: parts.originRef })
    .from(parts)
    .where(inArray(parts.originRef, originRefs));
  const existingSet = new Set(existing.map((e) => e.originRef));

  for (const row of rows) {
    const ref = `library:${row.id}`;
    if (existingSet.has(ref)) {
      result.skipped += 1;
      continue;
    }
    try {
      const data = componentLibraryToInsert(row);
      const slug = await resolveSlug(db, data);
      await db.insert(parts).values({ ...data, slug });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`library:${row.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 2: componentParts → parts
// ---------------------------------------------------------------------------

export async function migrateComponentParts(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'componentParts', migrated: 0, skipped: 0, errors: [] };

  const rows = await db.select().from(componentParts);
  if (rows.length === 0) { return result; }

  const originRefs = rows.map((r) => `legacy_component_parts:${r.id}`);
  const existing = await db
    .select({ originRef: parts.originRef })
    .from(parts)
    .where(inArray(parts.originRef, originRefs));
  const existingSet = new Set(existing.map((e) => e.originRef));

  for (const row of rows) {
    const ref = `legacy_component_parts:${row.id}`;
    if (existingSet.has(ref)) {
      result.skipped += 1;
      continue;
    }
    try {
      const data = componentPartToInsert(row);
      const slug = await resolveSlug(db, data);
      await db.insert(parts).values({ ...data, slug });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`component_parts:${row.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 3: bomItems → parts + partStock
// ---------------------------------------------------------------------------

export async function migrateBomItems(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'bomItems', migrated: 0, skipped: 0, errors: [] };

  const rows = await db
    .select()
    .from(bomItems)
    .where(isNull(bomItems.deletedAt));
  if (rows.length === 0) { return result; }

  const originRefs = rows.map((r) => `legacy_bom:${r.id}`);
  const existing = await db
    .select({ originRef: parts.originRef })
    .from(parts)
    .where(inArray(parts.originRef, originRefs));
  const existingSet = new Set(existing.map((e) => e.originRef));

  for (const row of rows) {
    const ref = `legacy_bom:${row.id}`;
    try {
      let partRow: Part;

      if (existingSet.has(ref)) {
        // Part already migrated — just ensure stock row exists
        const existingPart = await db
          .select()
          .from(parts)
          .where(eq(parts.originRef, ref))
          .limit(1);
        if (!existingPart[0]) {
          result.skipped += 1;
          continue;
        }
        partRow = existingPart[0];
      } else {
        // Try dedup by (manufacturer, mpn) first
        let deduped: Part | null = null;
        if (row.manufacturer && row.partNumber) {
          const found = await db
            .select()
            .from(parts)
            .where(
              and(
                eq(parts.manufacturer, row.manufacturer),
                eq(parts.mpn, row.partNumber),
                isNull(parts.deletedAt),
              ),
            )
            .limit(1);
          if (found[0]) { deduped = found[0]; }
        }

        if (deduped) {
          partRow = deduped;
          result.skipped += 1;
        } else {
          const data = bomItemToInsert(row);
          const slug = await resolveSlug(db, data);
          const inserted = await db.insert(parts).values({ ...data, slug }).returning();
          partRow = inserted[0];
          result.migrated += 1;
        }
      }

      // Ensure stock row exists for this (project, part)
      const existingStock = await db
        .select({ id: partStock.id })
        .from(partStock)
        .where(
          and(
            eq(partStock.projectId, row.projectId),
            eq(partStock.partId, partRow.id),
            isNull(partStock.deletedAt),
          ),
        )
        .limit(1);

      if (existingStock.length === 0) {
        const stockData = bomItemToStockFields(row, partRow.id);
        await db.insert(partStock).values(stockData);
      }
    } catch (err) {
      result.errors.push(`bom:${row.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 4: circuitInstances → partPlacements
// ---------------------------------------------------------------------------

export async function migrateCircuitInstances(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'circuitInstances', migrated: 0, skipped: 0, errors: [] };

  const rows = await db
    .select()
    .from(circuitInstances)
    .where(sql`${circuitInstances.partId} IS NOT NULL`);
  if (rows.length === 0) { return result; }

  for (const row of rows) {
    if (!row.partId) { continue; }
    try {
      // Look up the canonical part via the component_parts originRef
      const canonicalPart = await db
        .select()
        .from(parts)
        .where(eq(parts.originRef, `legacy_component_parts:${row.partId}`))
        .limit(1);

      if (!canonicalPart[0]) {
        result.errors.push(`circuit_instance:${row.id} — no canonical part found for component_parts:${row.partId}`);
        continue;
      }

      const partId = canonicalPart[0].id;

      // Check for existing placement by (partId, containerId, referenceDesignator)
      const existingPlacement = await db
        .select({ id: partPlacements.id })
        .from(partPlacements)
        .where(
          and(
            eq(partPlacements.partId, partId),
            eq(partPlacements.containerId, row.circuitId),
            eq(partPlacements.referenceDesignator, row.referenceDesignator),
            isNull(partPlacements.deletedAt),
          ),
        )
        .limit(1);

      if (existingPlacement.length > 0) {
        result.skipped += 1;
        continue;
      }

      // Create placement rows for each surface that has coordinates
      const surfaces: Array<{
        surface: 'schematic' | 'breadboard' | 'bench' | 'pcb';
        x: number | null;
        y: number | null;
        rotation: number;
        layer: string | null;
      }> = [];

      surfaces.push({
        surface: 'schematic',
        x: row.schematicX,
        y: row.schematicY,
        rotation: row.schematicRotation,
        layer: null,
      });

      if (row.breadboardX !== null && row.breadboardY !== null) {
        surfaces.push({
          surface: 'breadboard',
          x: row.breadboardX,
          y: row.breadboardY,
          rotation: row.breadboardRotation ?? 0,
          layer: null,
        });
      }

      if (row.benchX !== null && row.benchY !== null) {
        surfaces.push({
          surface: 'bench',
          x: row.benchX,
          y: row.benchY,
          rotation: 0,
          layer: null,
        });
      }

      if (row.pcbX !== null && row.pcbY !== null) {
        surfaces.push({
          surface: 'pcb',
          x: row.pcbX,
          y: row.pcbY,
          rotation: row.pcbRotation ?? 0,
          layer: row.pcbSide ?? 'front',
        });
      }

      for (const s of surfaces) {
        await db.insert(partPlacements).values({
          partId,
          surface: s.surface,
          containerType: 'circuit' as const,
          containerId: row.circuitId,
          referenceDesignator: row.referenceDesignator,
          x: s.x,
          y: s.y,
          rotation: s.rotation,
          layer: s.layer,
          properties: { legacyInstanceId: row.id } as Record<string, unknown>,
        });
      }

      result.migrated += 1;
    } catch (err) {
      result.errors.push(`circuit_instance:${row.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 5: componentLifecycle → partLifecycle
// ---------------------------------------------------------------------------

export async function migrateComponentLifecycle(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'componentLifecycle', migrated: 0, skipped: 0, errors: [] };

  const rows = await db.select().from(componentLifecycle);
  if (rows.length === 0) { return result; }

  for (const row of rows) {
    try {
      // Try to find the canonical part by matching the partNumber as mpn
      let canonicalPart: Part | undefined;

      if (row.manufacturer && row.partNumber) {
        const found = await db
          .select()
          .from(parts)
          .where(
            and(
              eq(parts.manufacturer, row.manufacturer),
              eq(parts.mpn, row.partNumber),
              isNull(parts.deletedAt),
            ),
          )
          .limit(1);
        canonicalPart = found[0];
      }

      if (!canonicalPart) {
        // Fallback: search by mpn only
        const found = await db
          .select()
          .from(parts)
          .where(and(eq(parts.mpn, row.partNumber), isNull(parts.deletedAt)))
          .limit(1);
        canonicalPart = found[0];
      }

      if (!canonicalPart) {
        result.errors.push(`lifecycle:${row.id} — no canonical part found for partNumber="${row.partNumber}"`);
        continue;
      }

      // Check if lifecycle already exists
      const existing = await db
        .select({ id: partLifecycle.id })
        .from(partLifecycle)
        .where(eq(partLifecycle.partId, canonicalPart.id))
        .limit(1);

      if (existing.length > 0) {
        result.skipped += 1;
        continue;
      }

      const isObsolete = row.lifecycleStatus === 'obsolete' || row.lifecycleStatus === 'eol';
      await db.insert(partLifecycle).values({
        partId: canonicalPart.id,
        obsoleteDate: isObsolete ? (row.lastCheckedAt ?? new Date()) : null,
        replacementPartId: null,
        notes: [
          row.notes,
          row.alternatePartNumbers ? `Legacy alternates: ${row.alternatePartNumbers}` : null,
          row.dataSource ? `Data source: ${row.dataSource}` : null,
          `Legacy status: ${row.lifecycleStatus}`,
        ].filter(Boolean).join('. '),
      });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`lifecycle:${row.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 6: spiceModels → partSpiceModels
// ---------------------------------------------------------------------------

export async function migrateSpiceModels(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'spiceModels', migrated: 0, skipped: 0, errors: [] };

  const rows = await db.select().from(spiceModels);
  if (rows.length === 0) { return result; }

  for (const row of rows) {
    try {
      // Find a canonical part that matches this SPICE model by name or category
      const found = await db
        .select()
        .from(parts)
        .where(
          and(
            sql`lower(${parts.title}) LIKE ${`%${row.name.toLowerCase()}%`}`,
            isNull(parts.deletedAt),
          ),
        )
        .limit(1);

      let targetPartId: string;

      if (found[0]) {
        targetPartId = found[0].id;
      } else {
        // Create a stub part for this SPICE model
        const stubData: InsertPart = {
          slug: `spice-${slugify(row.name)}`,
          title: row.name,
          description: row.description ?? null,
          canonicalCategory: mapSpiceCategory(row.category),
          origin: 'library',
          originRef: `legacy_spice_stub:${row.id}`,
          trustLevel: 'library',
          isPublic: true,
          meta: { spiceModelType: row.modelType } as Record<string, unknown>,
          connectors: [],
        };

        // Resolve slug collision
        const existing = await db
          .select({ slug: parts.slug })
          .from(parts)
          .where(eq(parts.slug, stubData.slug))
          .limit(1);
        if (existing.length > 0) {
          stubData.slug = await resolveSlugFromBase(db, stubData.slug);
        }

        const inserted = await db.insert(parts).values(stubData).returning();
        targetPartId = inserted[0].id;
      }

      // Check if spice model already exists
      const existingModel = await db
        .select({ id: partSpiceModels.id })
        .from(partSpiceModels)
        .where(
          and(
            eq(partSpiceModels.partId, targetPartId),
            eq(partSpiceModels.filename, `${slugify(row.name)}.spice`),
          ),
        )
        .limit(1);

      if (existingModel.length > 0) {
        result.skipped += 1;
        continue;
      }

      await db.insert(partSpiceModels).values({
        partId: targetPartId,
        filename: `${slugify(row.name)}.spice`,
        modelText: row.spiceDirective,
        category: row.category,
      });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`spice:${row.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

function mapSpiceCategory(spiceCategory: string): string {
  const map: Record<string, string> = {
    transistor: 'transistor',
    diode: 'diode',
    opamp: 'amplifier',
    passive: 'resistor',
    ic: 'ic',
    voltage_regulator: 'regulator',
    mosfet: 'mosfet',
    jfet: 'transistor',
  };
  return map[spiceCategory] ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Step 7: Seed verified boards
// ---------------------------------------------------------------------------

export async function seedVerifiedBoards(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'seedVerifiedBoards', migrated: 0, skipped: 0, errors: [] };

  // Dynamic import to avoid pulling in all board definitions at module load
  const { getAllVerifiedBoards } = await import('@shared/verified-boards/index');
  const boards = getAllVerifiedBoards();

  const originRefs = boards.map((b) => `verified_board:${b.id}`);
  const existing = await db
    .select({ originRef: parts.originRef })
    .from(parts)
    .where(inArray(parts.originRef, originRefs));
  const existingSet = new Set(existing.map((e) => e.originRef));

  for (const board of boards) {
    const ref = `verified_board:${board.id}`;
    if (existingSet.has(ref)) {
      result.skipped += 1;
      continue;
    }
    try {
      const slug = `brd-${slugify(board.id)}`;
      const existingSlug = await db
        .select({ slug: parts.slug })
        .from(parts)
        .where(eq(parts.slug, slug))
        .limit(1);

      const finalSlug = existingSlug.length > 0
        ? await resolveSlugFromBase(db, slug)
        : slug;

      await db.insert(parts).values({
        slug: finalSlug,
        title: board.title,
        description: board.description ?? null,
        manufacturer: board.manufacturer,
        mpn: board.mpn,
        canonicalCategory: 'board',
        origin: 'verified_board',
        originRef: ref,
        trustLevel: 'verified',
        isPublic: true,
        meta: {
          boardId: board.id,
          family: board.family,
          dimensions: board.dimensions,
          breadboardFit: board.breadboardFit,
          operatingVoltage: board.operatingVoltage,
          inputVoltageRange: board.inputVoltageRange,
          maxCurrentPerPin: board.maxCurrentPerPin,
          pinCount: board.pins.length,
          busCount: board.buses.length,
        } as Record<string, unknown>,
        connectors: board.pins.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          direction: p.direction,
          voltage: p.voltage,
          functions: p.functions,
        })) as unknown[],
      });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`verified_board:${board.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 8: Seed standard library
// ---------------------------------------------------------------------------

export async function seedStandardLibrary(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'seedStandardLibrary', migrated: 0, skipped: 0, errors: [] };

  const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
  const components = STANDARD_LIBRARY_COMPONENTS;

  // Index suffix prevents collisions when titles slugify identically (e.g. "10kΩ Resistor" x2).
  // Safe for a one-shot migration; array order is stable in STANDARD_LIBRARY_COMPONENTS.
  const refs = components.map((c, i) => `standard_library:${slugify(c.title)}-${i}`);
  const existing = await db
    .select({ originRef: parts.originRef })
    .from(parts)
    .where(inArray(parts.originRef, refs));
  const existingSet = new Set(existing.map((e) => e.originRef));

  for (let i = 0; i < components.length; i += 1) {
    const comp = components[i];
    const ref = `standard_library:${slugify(comp.title)}-${i}`;
    if (existingSet.has(ref)) {
      result.skipped += 1;
      continue;
    }
    try {
      const meta = (comp.meta ?? {}) as Record<string, unknown>;
      const data: Omit<InsertPart, 'slug'> = {
        title: comp.title,
        description: comp.description ?? null,
        manufacturer: (meta['manufacturer'] as string) ?? null,
        mpn: (meta['mpn'] as string) ?? null,
        canonicalCategory: comp.category ?? 'unknown',
        packageType: (meta['packageType'] as string) ?? null,
        tolerance: (meta['tolerance'] as string) ?? null,
        esdSensitive: (meta['esdSensitive'] as boolean) ?? null,
        assemblyCategory: normalizeAssemblyCategory(meta['assemblyCategory']),
        meta,
        connectors: (comp.connectors ?? []) as unknown[],
        datasheetUrl: (meta['datasheetUrl'] as string) ?? null,
        manufacturerUrl: null,
        origin: 'library',
        originRef: ref,
        forkedFromId: null,
        authorUserId: null,
        isPublic: true,
        trustLevel: 'library',
      };
      const slug = await resolveSlug(db, data);
      await db.insert(parts).values({ ...data, slug });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`standard_library:${comp.title} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 9: Seed starter circuits (as template entries)
// ---------------------------------------------------------------------------

export async function seedStarterCircuits(db: DbClient): Promise<StepResult> {
  const result: StepResult = { step: 'seedStarterCircuits', migrated: 0, skipped: 0, errors: [] };

  const { getAllStarterCircuits } = await import('@shared/starter-circuits');
  const circuits = getAllStarterCircuits();

  const originRefs = circuits.map((c) => `starter_circuit:${c.id}`);
  const existing = await db
    .select({ originRef: parts.originRef })
    .from(parts)
    .where(inArray(parts.originRef, originRefs));
  const existingSet = new Set(existing.map((e) => e.originRef));

  for (const circuit of circuits) {
    const ref = `starter_circuit:${circuit.id}`;
    if (existingSet.has(ref)) {
      result.skipped += 1;
      continue;
    }
    try {
      const slug = `starter-${slugify(circuit.id)}`;
      const existingSlug = await db
        .select({ slug: parts.slug })
        .from(parts)
        .where(eq(parts.slug, slug))
        .limit(1);

      const finalSlug = existingSlug.length > 0
        ? await resolveSlugFromBase(db, slug)
        : slug;

      await db.insert(parts).values({
        slug: finalSlug,
        title: circuit.name,
        description: circuit.description,
        canonicalCategory: 'starter_circuit',
        origin: 'starter_circuit',
        originRef: ref,
        trustLevel: 'library',
        isPublic: true,
        meta: {
          category: circuit.category,
          difficulty: circuit.difficulty,
          boardType: circuit.boardType,
          components: circuit.components,
          learningObjectives: circuit.learningObjectives,
          tags: circuit.tags,
        } as Record<string, unknown>,
        connectors: [],
      });
      result.migrated += 1;
    } catch (err) {
      result.errors.push(`starter_circuit:${circuit.id} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runBackfill(db: DbClient): Promise<StepResult[]> {
  const steps = [
    migrateComponentLibrary,
    migrateComponentParts,
    migrateBomItems,
    migrateCircuitInstances,
    migrateComponentLifecycle,
    migrateSpiceModels,
    seedVerifiedBoards,
    seedStandardLibrary,
    seedStarterCircuits,
  ];

  const results: StepResult[] = [];
  for (const step of steps) {
    const stepResult = await step(db);
    results.push(stepResult);
    const status = stepResult.errors.length > 0 ? '⚠' : '✓';
    console.log(
      `  ${status} ${stepResult.step}: migrated=${stepResult.migrated} skipped=${stepResult.skipped} errors=${stepResult.errors.length}`,
    );
    for (const err of stepResult.errors) {
      console.log(`    ERROR: ${err}`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL must be set.');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool, { schema });

  console.log('Parts catalog backfill migration — Phase 4');
  console.log('==========================================\n');

  try {
    const results = await runBackfill(db);

    console.log('\n--- Summary ---');
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    for (const r of results) {
      totalMigrated += r.migrated;
      totalSkipped += r.skipped;
      totalErrors += r.errors.length;
    }
    console.log(`Total migrated: ${totalMigrated}`);
    console.log(`Total skipped:  ${totalSkipped}`);
    console.log(`Total errors:   ${totalErrors}`);

    if (totalErrors > 0) {
      console.log('\n⚠  Migration completed with errors. Review above output.');
      process.exit(1);
    } else {
      console.log('\n✓  Migration completed successfully.');
    }
  } finally {
    await pool.end();
  }
}

// Only run when executed directly (not imported for testing)
const isDirectRun = process.argv[1]?.endsWith('backfill-parts-catalog.ts') ||
  process.argv[1]?.endsWith('backfill-parts-catalog.js');
if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
