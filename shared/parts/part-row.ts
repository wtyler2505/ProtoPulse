/**
 * Canonical `PartRow` type — the single row shape that unifies all 12 legacy parts representations.
 *
 * Every server route, client hook, AI tool, and exporter in the parts domain reads this shape.
 * See docs/plans/2026-04-10-parts-catalog-consolidation.md and docs/adr/0010-unified-parts-catalog.md.
 *
 * This type intentionally does NOT depend on Drizzle — it is the public contract that every layer
 * (server, client, tests, fixtures) imports. The `parts` Drizzle table in `shared/schema.ts`
 * produces a compatible `$inferSelect` shape that this type mirrors.
 */

export const TRUST_LEVELS = [
  'manufacturer_verified',
  'protopulse_gold',
  'verified',
  'library',
  'community',
  'user',
] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

/** Ordered by trust rank, highest → lowest. `trustRank(a) < trustRank(b)` means `a` is more trusted. */
export function trustRank(level: TrustLevel): number {
  return TRUST_LEVELS.indexOf(level);
}

export const PART_ORIGINS = [
  'library',
  'user',
  'community',
  'verified_board',
  'starter_circuit',
  'scan',
  'ai_generated',
] as const;
export type PartOrigin = (typeof PART_ORIGINS)[number];

export const ASSEMBLY_CATEGORIES = [
  'smt',
  'through_hole',
  'hand_solder',
  'mechanical',
] as const;
export type AssemblyCategory = (typeof ASSEMBLY_CATEGORIES)[number];

export const PLACEMENT_SURFACES = [
  'schematic',
  'breadboard',
  'bench',
  'pcb',
  'snippet',
  'starter',
] as const;
export type PlacementSurface = (typeof PLACEMENT_SURFACES)[number];

export const PLACEMENT_CONTAINER_TYPES = [
  'circuit',
  'snippet_library',
  'starter_circuit',
] as const;
export type PlacementContainerType = (typeof PLACEMENT_CONTAINER_TYPES)[number];

/**
 * The canonical parts row. All twelve legacy shapes collapse into this.
 *
 * Numeric fields are `number` on the TS side even though Postgres `numeric` columns serialize
 * to string by default in pg — the ingress pipeline and storage layer do the coercion.
 */
export interface PartRow {
  id: string; // uuid
  slug: string;
  title: string;
  description: string | null;
  manufacturer: string | null;
  mpn: string | null;
  canonicalCategory: string;
  packageType: string | null;
  tolerance: string | null;
  esdSensitive: boolean | null;
  assemblyCategory: AssemblyCategory | null;
  meta: Record<string, unknown>;
  connectors: unknown[];
  datasheetUrl: string | null;
  manufacturerUrl: string | null;
  origin: PartOrigin;
  originRef: string | null;
  forkedFromId: string | null;
  authorUserId: number | null;
  isPublic: boolean;
  trustLevel: TrustLevel;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Per-project inventory overlay — one row per `(project_id, part_id)`.
 * Replaces the stock/inventory columns that used to live on `bomItems`.
 */
export interface PartStockRow {
  id: string; // uuid
  projectId: number;
  partId: string; // uuid → parts.id
  quantityNeeded: number;
  quantityOnHand: number | null;
  minimumStock: number | null;
  storageLocation: string | null;
  unitPrice: number | null;
  supplier: string | null;
  leadTime: string | null;
  status: string;
  notes: string | null;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Where-used row — replaces `circuit_instances.partId` as the part-join point.
 * `part_id` is non-nullable with `ON DELETE RESTRICT`; orphan placements are impossible.
 */
export interface PartPlacementRow {
  id: string; // uuid
  partId: string; // uuid → parts.id
  surface: PlacementSurface;
  containerType: PlacementContainerType;
  containerId: number;
  referenceDesignator: string;
  x: number | null;
  y: number | null;
  rotation: number;
  layer: string | null;
  properties: Record<string, unknown>;
  createdAt: Date;
  deletedAt: Date | null;
}
