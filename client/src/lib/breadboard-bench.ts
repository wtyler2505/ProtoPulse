import type { BomItem } from '@/lib/project-context';
import { getVerificationStatus } from '@shared/component-trust';
import type { Connector, PartMeta } from '@shared/component-types';
import type { ComponentPart } from '@shared/schema';

export type BreadboardBenchFilter = 'all' | 'owned' | 'ready' | 'verified' | 'starter';

export type BreadboardFit = NonNullable<PartMeta['breadboardFit']>;
export type BreadboardModelQuality = NonNullable<PartMeta['breadboardModelQuality']>;

export interface BreadboardBenchInsight {
  partId: number;
  bomItemId: string | null;
  title: string;
  family: string;
  benchCategory: string;
  pinCount: number;
  fit: BreadboardFit;
  modelQuality: BreadboardModelQuality;
  hasPreciseArtwork: boolean;
  isTracked: boolean;
  isOwned: boolean;
  ownedQuantity: number;
  requiredQuantity: number;
  missingQuantity: number;
  storageLocation: string | null;
  lowStock: boolean;
  readyNow: boolean;
  starterFriendly: boolean;
  manufacturer?: string;
  mpn?: string;
}

export interface BreadboardBenchSummary {
  insights: BreadboardBenchInsight[];
  totals: {
    projectPartCount: number;
    trackedCount: number;
    ownedCount: number;
    readyCount: number;
    verifiedCount: number;
    starterFriendlyCount: number;
    lowStockCount: number;
    missingCount: number;
    missingModelCount: number;
  };
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function includesNormalized(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const normalizedHaystack = normalizeToken(haystack);
  const normalizedNeedle = normalizeToken(needle);
  if (!normalizedHaystack || !normalizedNeedle) {
    return false;
  }
  return normalizedHaystack.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedHaystack);
}

function getPartMeta(part: ComponentPart): Partial<PartMeta> {
  return (part.meta as Partial<PartMeta> | null) ?? {};
}

function getPartPinCount(part: ComponentPart): number {
  return ((part.connectors ?? []) as Connector[]).length;
}

export function hasPreciseBreadboardArtwork(part: ComponentPart): boolean {
  const views = part.views as { breadboard?: { shapes?: unknown[] } } | null;
  return Array.isArray(views?.breadboard?.shapes) && views.breadboard.shapes.length > 0;
}

function inferBreadboardFit(meta: Partial<PartMeta>, pinCount: number): BreadboardFit {
  if (meta.breadboardFit) {
    return meta.breadboardFit;
  }

  const packageType = (meta.packageType ?? '').toLowerCase();
  const family = (meta.family ?? '').toLowerCase();
  const tags = meta.tags ?? [];
  const mountingType = meta.mountingType ?? '';
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));

  if (mountingType === 'smd') {
    return 'breakout_required';
  }

  if (
    packageType.includes('dip') ||
    packageType.includes('sip') ||
    packageType.includes('to-92') ||
    packageType.includes('axial') ||
    family === 'resistor' ||
    family === 'led' ||
    family === 'switch'
  ) {
    return 'native';
  }

  if (
    tagSet.has('module') ||
    tagSet.has('sensor') ||
    tagSet.has('breakout') ||
    family === 'sensor' ||
    family === 'display' ||
    family === 'comm'
  ) {
    return 'requires_jumpers';
  }

  if (
    packageType.includes('qfn') ||
    packageType.includes('bga') ||
    packageType.includes('lga') ||
    packageType.includes('dfn') ||
    packageType.includes('qfp')
  ) {
    return 'not_breadboard_friendly';
  }

  if (pinCount >= 24 || family === 'mcu' || family === 'ic') {
    return 'requires_jumpers';
  }

  return 'native';
}

function inferModelQuality(
  meta: Partial<PartMeta>,
  hasPreciseArtwork: boolean,
  fit: BreadboardFit,
): BreadboardModelQuality {
  if (getVerificationStatus(meta) === 'verified') {
    return 'verified';
  }
  if (meta.breadboardModelQuality) {
    return meta.breadboardModelQuality;
  }

  if (!hasPreciseArtwork) {
    return 'ai_drafted';
  }

  if (fit === 'native' || fit === 'requires_jumpers') {
    return 'basic';
  }

  return 'community';
}

function inferBenchCategory(meta: Partial<PartMeta>): string {
  if (meta.benchCategory && meta.benchCategory.trim().length > 0) {
    return meta.benchCategory;
  }

  const family = meta.family?.toLowerCase();
  switch (family) {
    case 'mcu':
      return 'Microcontrollers';
    case 'sensor':
      return 'Sensors';
    case 'power':
      return 'Power';
    case 'comm':
      return 'Communication';
    case 'connector':
      return 'Connectors';
    case 'led':
      return 'Indicators';
    default:
      return meta.family ?? 'Workbench';
  }
}

function isStarterFriendly(meta: Partial<PartMeta>, pinCount: number, fit: BreadboardFit): boolean {
  if (fit === 'breakout_required' || fit === 'not_breadboard_friendly') {
    return false;
  }

  const family = (meta.family ?? '').toLowerCase();
  const hardModeFamilies = new Set(['power', 'driver', 'rf', 'motor']);
  if (hardModeFamilies.has(family)) {
    return false;
  }

  if (family === 'mcu') {
    return pinCount <= 28;
  }

  return pinCount <= 20;
}

function findBomMatch(part: ComponentPart, bomItems: BomItem[]): BomItem | undefined {
  const meta = getPartMeta(part);
  const title = meta.title ?? '';
  const mpn = meta.mpn ?? '';

  return bomItems.find((item) => {
    if (normalizeToken(item.partNumber) && normalizeToken(item.partNumber) === normalizeToken(mpn)) {
      return true;
    }

    if (includesNormalized(item.description, title) || includesNormalized(item.partNumber, title)) {
      return true;
    }

    return includesNormalized(item.description, mpn);
  });
}

export function buildBreadboardBenchSummary(
  parts: ComponentPart[] | undefined,
  bomItems: BomItem[] | undefined,
): BreadboardBenchSummary {
  const safeParts = parts ?? [];
  const safeBomItems = bomItems ?? [];

  const insights = safeParts.map((part) => {
    const meta = getPartMeta(part);
    const pinCount = getPartPinCount(part);
    const hasPreciseArtwork = hasPreciseBreadboardArtwork(part);
    const fit = inferBreadboardFit(meta, pinCount);
    const modelQuality = inferModelQuality(meta, hasPreciseArtwork, fit);
    const bomMatch = findBomMatch(part, safeBomItems);
    const requiredQuantity = Math.max(1, bomMatch?.quantity ?? 1);
    const ownedQuantity = Math.max(0, bomMatch?.quantityOnHand ?? 0);
    const lowStock =
      ownedQuantity > 0 &&
      bomMatch?.minimumStock != null &&
      ownedQuantity <= bomMatch.minimumStock;
    const missingQuantity = Math.max(0, requiredQuantity - ownedQuantity);
    const readyNow =
      missingQuantity === 0 &&
      (fit === 'native' || fit === 'requires_jumpers');

    return {
      partId: part.id,
      bomItemId: bomMatch?.id != null ? String(bomMatch.id) : null,
      title: meta.title ?? 'Untitled',
      family: meta.family ?? 'Other',
      benchCategory: inferBenchCategory(meta),
      pinCount,
      fit,
      modelQuality,
      hasPreciseArtwork,
      isTracked: bomMatch != null,
      isOwned: ownedQuantity > 0,
      ownedQuantity,
      requiredQuantity,
      missingQuantity,
      storageLocation: bomMatch?.storageLocation ?? meta.inventoryHint?.defaultStorageLocation ?? null,
      lowStock,
      readyNow,
      starterFriendly: isStarterFriendly(meta, pinCount, fit),
      manufacturer: meta.manufacturer,
      mpn: meta.mpn,
    } satisfies BreadboardBenchInsight;
  });

  return {
    insights,
    totals: {
      projectPartCount: safeParts.length,
      trackedCount: insights.filter((item) => item.isTracked).length,
      ownedCount: insights.filter((item) => item.isOwned).length,
      readyCount: insights.filter((item) => item.readyNow).length,
      verifiedCount: insights.filter((item) => item.modelQuality === 'verified').length,
      starterFriendlyCount: insights.filter((item) => item.starterFriendly).length,
      lowStockCount: insights.filter((item) => item.lowStock).length,
      missingCount: insights.filter((item) => item.missingQuantity > 0).length,
      missingModelCount: insights.filter((item) => !item.hasPreciseArtwork).length,
    },
  };
}

export function indexBreadboardBenchInsights(
  insights: BreadboardBenchInsight[],
): Record<number, BreadboardBenchInsight> {
  return Object.fromEntries(insights.map((insight) => [insight.partId, insight]));
}

export function filterBreadboardBenchInsights(
  insights: BreadboardBenchInsight[],
  filter: BreadboardBenchFilter,
): BreadboardBenchInsight[] {
  switch (filter) {
    case 'owned':
      return insights.filter((item) => item.isOwned);
    case 'ready':
      return insights.filter((item) => item.readyNow);
    case 'verified':
      return insights.filter((item) => item.modelQuality === 'verified');
    case 'starter':
      return insights.filter((item) => item.starterFriendly);
    case 'all':
    default:
      return insights;
  }
}

export function buildBreadboardInventoryDigest(insights: BreadboardBenchInsight[]): string {
  const owned = insights
    .filter((item) => item.isOwned)
    .slice(0, 8)
    .map((item) => {
      const quantity = item.ownedQuantity > 0 ? `${String(item.ownedQuantity)} on hand` : 'not tracked';
      const location = item.storageLocation ? ` @ ${item.storageLocation}` : '';
      return `- ${item.title}: ${quantity}${location}`;
    });

  const blockers = insights
    .filter((item) => !item.isOwned || item.fit === 'breakout_required' || item.fit === 'not_breadboard_friendly')
    .slice(0, 6)
    .map((item) => {
      if (!item.isOwned) {
        return `- ${item.title}: not in current stash`;
      }
      if (item.fit === 'breakout_required') {
        return `- ${item.title}: needs breakout or carrier before breadboard use`;
      }
      return `- ${item.title}: poor direct breadboard fit`;
    });

  const ownedSection = owned.length > 0 ? owned.join('\n') : '- No owned project parts detected yet.';
  const blockerSection = blockers.length > 0 ? blockers.join('\n') : '- No obvious inventory or fit blockers detected.';

  return `Owned bench inventory\n${ownedSection}\n\nBench blockers\n${blockerSection}`;
}
