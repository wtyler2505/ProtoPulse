import type { ProjectExportData } from '@/lib/export-validation';
import type { BomItem } from '@/lib/project-context';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

export type ValidationSafetyGateData = Pick<
  ProjectExportData,
  | 'aiGeneratedCircuitInstanceCount'
  | 'unverifiedAiGeneratedCircuitInstanceCount'
  | 'placedPartCount'
  | 'verifiedExactPartCount'
  | 'verifiedMechanicalModelCount'
  | 'redBreadboardHealthCount'
  | 'eolPartCount'
  | 'obsoletePartCount'
  | 'nrndPartCount'
  | 'lifecycleNoAlternateCount'
  | 'estimatedInventoryLineCount'
>;

export interface BuildValidationSafetyGateDataInput {
  readonly circuitInstances: readonly CircuitInstanceRow[];
  readonly componentParts: readonly ComponentPart[];
  readonly bomItems: readonly BomItem[];
}

type LifecycleStatus = 'active' | 'eol' | 'obsolete' | 'nrnd';

const LIFECYCLE_KEYS = [
  'lifecycleStatus',
  'lifecycle_status',
  'lifecycle',
  'partLifecycle',
  'productStatus',
  'product_status',
  'availabilityStatus',
  'availability_status',
] as const;

const HEALTH_KEYS = [
  'breadboardHealth',
  'breadboardHealthStatus',
  'breadboardHealthGrade',
  'boardHealth',
  'prototypeHealth',
] as const;

const ALTERNATE_KEYS = [
  'replacementPartId',
  'replacementPartNumber',
  'replacementPartMpn',
  'replacement',
  'replacementPart',
  'alternatePartNumber',
  'alternatePartNumbers',
  'alternateMpn',
  'alternateMpns',
  'alternates',
  'alternateParts',
  'approvedAlternates',
] as const;

const ESTIMATED_CONFIDENCE_VALUES = new Set([
  'estimated',
  'estimate',
  'unknown',
  'unverified',
  'fallback',
  'fallback_unknown',
  'historical_estimate',
  'mock',
]);

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function readLifecycleStatus(record: Record<string, unknown>): LifecycleStatus | null {
  for (const key of LIFECYCLE_KEYS) {
    const status = normalizeStatus(record[key]);
    if (status === 'active' || status === 'in-production' || status === 'production') {
      return 'active';
    }
    if (status === 'eol' || status === 'end-of-life' || status === 'end-of-sale') {
      return 'eol';
    }
    if (status === 'obsolete' || status === 'discontinued') {
      return 'obsolete';
    }
    if (status === 'nrnd' || status === 'not-recommended-for-new-designs') {
      return 'nrnd';
    }
  }

  return null;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null || value === false) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

function hasKnownAlternate(record: Record<string, unknown>): boolean {
  return ALTERNATE_KEYS.some((key) => hasMeaningfulValue(record[key]));
}

function isRedBreadboardHealthValue(value: unknown): boolean {
  const direct = normalizeStatus(value);
  if (direct === 'red' || direct === 'critical' || direct === 'failed' || direct === 'fail' || direct === 'unsafe') {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = readRecord(value);
  return ['status', 'grade', 'level', 'readiness'].some((key) => isRedBreadboardHealthValue(record[key]));
}

function isRedBreadboardHealth(record: Record<string, unknown>): boolean {
  return HEALTH_KEYS.some((key) => isRedBreadboardHealthValue(record[key]));
}

function isAiGeneratedInstance(properties: unknown): boolean {
  const props = readRecord(properties);
  return props.aiGenerated === true || readString(props.generatedFrom) !== null;
}

function hasVerifiedExactPart(properties: unknown, partMeta: Record<string, unknown>): boolean {
  if (partMeta.verificationStatus === 'verified') {
    return true;
  }

  const trust = readRecord(readRecord(properties).exactPartTrust);
  return trust.status === 'verified' || trust.placementMode === 'verified-exact' || trust.requiresVerification === false;
}

function hasVerifiedMechanicalModel(partMeta: Record<string, unknown>): boolean {
  return partMeta.breadboardModelQuality === 'verified'
    || partMeta.mechanicalModelQuality === 'verified'
    || partMeta.modelQuality === 'verified';
}

function isEstimatedTrustBoundary(value: unknown): boolean {
  const trust = readRecord(value);
  if (trust.verified === false || trust.isMock === true) {
    return true;
  }

  const source = normalizeStatus(trust.source);
  return ESTIMATED_CONFIDENCE_VALUES.has(source);
}

function isEstimatedInventoryLine(item: BomItem): boolean {
  const record = item as unknown as Record<string, unknown>;
  if (isEstimatedTrustBoundary(record.pricingTrust) || isEstimatedTrustBoundary(record.inventoryTrust)) {
    return true;
  }

  const confidenceValues = [
    record.inventoryConfidence,
    record.stockConfidence,
    record.quantityConfidence,
    record.confidence,
    record.source,
  ].map(normalizeStatus);

  return confidenceValues.some((value) => ESTIMATED_CONFIDENCE_VALUES.has(value));
}

function countLifecycle(records: readonly Record<string, unknown>[]): Pick<
  ValidationSafetyGateData,
  'eolPartCount' | 'obsoletePartCount' | 'nrndPartCount' | 'lifecycleNoAlternateCount'
> {
  let eolPartCount = 0;
  let obsoletePartCount = 0;
  let nrndPartCount = 0;
  let lifecycleNoAlternateCount = 0;

  for (const record of records) {
    const status = readLifecycleStatus(record);
    if (status === 'eol') {
      eolPartCount += 1;
    } else if (status === 'obsolete') {
      obsoletePartCount += 1;
    } else if (status === 'nrnd') {
      nrndPartCount += 1;
    }

    if ((status === 'eol' || status === 'obsolete') && !hasKnownAlternate(record)) {
      lifecycleNoAlternateCount += 1;
    }
  }

  return { eolPartCount, obsoletePartCount, nrndPartCount, lifecycleNoAlternateCount };
}

export function buildValidationSafetyGateData({
  circuitInstances,
  componentParts,
  bomItems,
}: BuildValidationSafetyGateDataInput): ValidationSafetyGateData {
  const componentPartMetaById = new Map(componentParts.map((part) => [part.id, readRecord(part.meta)]));
  const linkedPartIds = new Set(circuitInstances.map((instance) => instance.partId).filter((partId): partId is number => partId != null));
  const placedWithParts = circuitInstances.filter(
    (instance) => instance.partId != null && instance.pcbX != null && instance.pcbY != null,
  );

  const aiGenerated = circuitInstances.filter((instance) => isAiGeneratedInstance(instance.properties));
  const unverifiedAiGenerated = aiGenerated.filter((instance) => {
    const meta = instance.partId != null ? componentPartMetaById.get(instance.partId) ?? {} : {};
    return !hasVerifiedExactPart(instance.properties, meta);
  });
  const verifiedExactParts = placedWithParts.filter((instance) => {
    const meta = instance.partId != null ? componentPartMetaById.get(instance.partId) ?? {} : {};
    return hasVerifiedExactPart(instance.properties, meta);
  });
  const verifiedMechanicalModels = placedWithParts.filter((instance) => {
    const meta = instance.partId != null ? componentPartMetaById.get(instance.partId) ?? {} : {};
    return hasVerifiedMechanicalModel(meta);
  });
  const linkedPartMeta = componentParts
    .filter((part) => linkedPartIds.has(part.id))
    .map((part) => readRecord(part.meta));
  const bomRecords = bomItems.map((item) => item as unknown as Record<string, unknown>);
  const lifecycle = countLifecycle([...linkedPartMeta, ...bomRecords]);

  return {
    aiGeneratedCircuitInstanceCount: aiGenerated.length,
    unverifiedAiGeneratedCircuitInstanceCount: unverifiedAiGenerated.length,
    placedPartCount: placedWithParts.length,
    verifiedExactPartCount: verifiedExactParts.length,
    verifiedMechanicalModelCount: verifiedMechanicalModels.length,
    redBreadboardHealthCount: linkedPartMeta.filter(isRedBreadboardHealth).length,
    estimatedInventoryLineCount: bomItems.filter(isEstimatedInventoryLine).length,
    ...lifecycle,
  };
}
