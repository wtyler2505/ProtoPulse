/**
 * Community Library -> BOM Bridge
 *
 * Maps community component metadata to BOM item fields and determines
 * whether a component has enough metadata to warrant a BOM addition prompt.
 */

import type { CommunityComponent } from '@/lib/community-library';
import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunityToBomMapping {
  communityPartId: string;
  mpn?: string;
  manufacturer?: string;
  supplier?: string;
  category: string;
  packageType?: string;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Extract a mapping of community part metadata relevant to BOM fields.
 */
export function extractBomMapping(part: CommunityComponent): CommunityToBomMapping {
  const data = part.data ?? {};

  return {
    communityPartId: part.id,
    mpn: asOptionalString(data.mpn) ?? asOptionalString(data.partNumber),
    manufacturer: asOptionalString(data.manufacturer),
    supplier: asOptionalString(data.supplier),
    category: part.category,
    packageType: asOptionalString(data.packageType) ?? asOptionalString(data.package),
  };
}

/**
 * Map a community component to a partial BOM item with as many fields
 * pre-populated as the community metadata allows.
 */
export function mapCommunityPartToBom(part: CommunityComponent): Omit<BomItem, 'id'> {
  const mapping = extractBomMapping(part);

  const supplier = resolveSupplier(mapping.supplier);
  const unitPrice = typeof part.data?.unitPrice === 'number' ? part.data.unitPrice : 0;

  return {
    partNumber: mapping.mpn ?? part.name,
    manufacturer: mapping.manufacturer ?? '',
    description: part.description || part.name,
    quantity: 1,
    unitPrice,
    totalPrice: unitPrice,
    supplier,
    stock: 0,
    status: 'In Stock',
    leadTime: undefined,
    esdSensitive: typeof part.data?.esdSensitive === 'boolean' ? part.data.esdSensitive : undefined,
    assemblyCategory: resolveAssemblyCategory(mapping.packageType),
  };
}

// ---------------------------------------------------------------------------
// Prompt decision
// ---------------------------------------------------------------------------

/**
 * Determine whether a community component has enough useful metadata
 * (MPN, manufacturer, or supplier) to warrant prompting the user to add
 * it to the BOM. Components with no identifying metadata beyond name/category
 * would produce a largely-empty BOM entry.
 */
export function shouldPromptBomAdd(part: CommunityComponent): boolean {
  const mapping = extractBomMapping(part);
  return Boolean(mapping.mpn) || Boolean(mapping.manufacturer);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

const KNOWN_SUPPLIERS: Array<{ pattern: RegExp; name: BomItem['supplier'] }> = [
  { pattern: /digi-?key/i, name: 'Digi-Key' },
  { pattern: /mouser/i, name: 'Mouser' },
  { pattern: /lcsc/i, name: 'LCSC' },
];

function resolveSupplier(raw?: string): BomItem['supplier'] {
  if (!raw) {
    return 'Unknown';
  }
  for (const entry of KNOWN_SUPPLIERS) {
    if (entry.pattern.test(raw)) {
      return entry.name;
    }
  }
  return 'Unknown';
}

const SMT_PACKAGES = /^(smd|smt|sop|soic|sot|qfp|qfn|bga|dfn|chip|0402|0603|0805|1206|1210|2512)/i;
const THT_PACKAGES = /^(dip|pdip|sdip|sip|to-?\d|axial|radial|through[- ]?hole)/i;

function resolveAssemblyCategory(packageType?: string): BomItem['assemblyCategory'] {
  if (!packageType) {
    return undefined;
  }
  if (SMT_PACKAGES.test(packageType)) {
    return 'smt';
  }
  if (THT_PACKAGES.test(packageType)) {
    return 'through_hole';
  }
  return undefined;
}
