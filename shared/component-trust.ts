export const PART_VERIFICATION_STATUSES = ['candidate', 'verified', 'deprecated'] as const;
export type PartVerificationStatus = (typeof PART_VERIFICATION_STATUSES)[number];

export const PART_VERIFICATION_LEVELS = ['official-backed', 'mixed-source', 'community-only'] as const;
export type PartVerificationLevel = (typeof PART_VERIFICATION_LEVELS)[number];

export const EXACT_PART_FAMILIES = [
  'board-module',
  'breakout',
  'driver',
  'shield',
  'sensor-module',
  'ic-package',
  'passive',
  'connector',
  'other',
] as const;
export type ExactPartFamily = (typeof EXACT_PART_FAMILIES)[number];

export const PART_EVIDENCE_TYPES = [
  'official-image',
  'datasheet',
  'pinout',
  'mechanical-drawing',
  'marketplace-listing',
  'community-fzpz',
  'community-svg',
  'user-photo',
  'text-request',
  'ai-inference',
] as const;
export type PartEvidenceType = (typeof PART_EVIDENCE_TYPES)[number];

export const PART_EVIDENCE_FACETS = ['outline', 'pins', 'labels', 'dimensions', 'mounting-holes', 'breadboard-fit'] as const;
export type PartEvidenceFacet = (typeof PART_EVIDENCE_FACETS)[number];

export const PART_EVIDENCE_CONFIDENCE = ['low', 'medium', 'high'] as const;
export type PartEvidenceConfidence = (typeof PART_EVIDENCE_CONFIDENCE)[number];

export const PART_EVIDENCE_REVIEW_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type PartEvidenceReviewStatus = (typeof PART_EVIDENCE_REVIEW_STATUSES)[number];

export interface PartSourceEvidence {
  id?: string;
  type: PartEvidenceType;
  label: string;
  href?: string;
  note?: string;
  supports: PartEvidenceFacet[];
  confidence?: PartEvidenceConfidence;
  reviewStatus?: PartEvidenceReviewStatus;
}

export interface PartVisualAccuracyReport {
  outline: 'unknown' | 'approximate' | 'exact';
  connectors: 'unknown' | 'approximate' | 'exact';
  silkscreen: 'unknown' | 'approximate' | 'exact';
  mountingHoles: 'unknown' | 'approximate' | 'exact';
}

export interface PartPinAccuracyReport {
  connectorNames: 'unknown' | 'approximate' | 'exact';
  electricalRoles: 'unknown' | 'approximate' | 'exact';
  breadboardAnchors: 'unknown' | 'approximate' | 'exact';
  unresolved: string[];
}

export interface PartTrustCarrier {
  breadboardModelQuality?: string;
  family?: string;
  mountingType?: string;
  packageType?: string;
  partFamily?: ExactPartFamily;
  pinAccuracyReport?: PartPinAccuracyReport;
  sourceEvidence?: PartSourceEvidence[];
  tags?: string[];
  verificationLevel?: PartVerificationLevel;
  verificationNotes?: string[];
  verificationStatus?: PartVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  visualAccuracyReport?: PartVisualAccuracyReport;
}

export interface PartTrustSummary {
  authoritativeWiringAllowed: boolean;
  family: ExactPartFamily;
  level: PartVerificationLevel;
  requiresVerification: boolean;
  status: PartVerificationStatus;
  summary: string;
}

const BOARD_LIKE_FAMILIES = new Set<ExactPartFamily>([
  'board-module',
  'breakout',
  'driver',
  'shield',
  'sensor-module',
]);

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isEvidenceType(value: unknown): value is PartEvidenceType {
  return typeof value === 'string' && PART_EVIDENCE_TYPES.includes(value as PartEvidenceType);
}

function isEvidenceFacet(value: unknown): value is PartEvidenceFacet {
  return typeof value === 'string' && PART_EVIDENCE_FACETS.includes(value as PartEvidenceFacet);
}

function isConfidence(value: unknown): value is PartEvidenceConfidence {
  return typeof value === 'string' && PART_EVIDENCE_CONFIDENCE.includes(value as PartEvidenceConfidence);
}

function isReviewStatus(value: unknown): value is PartEvidenceReviewStatus {
  return typeof value === 'string' && PART_EVIDENCE_REVIEW_STATUSES.includes(value as PartEvidenceReviewStatus);
}

function sanitizeEvidence(entry: unknown): PartSourceEvidence | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const candidate = entry as Record<string, unknown>;
  if (!isEvidenceType(candidate.type) || typeof candidate.label !== 'string' || candidate.label.trim().length === 0) {
    return null;
  }
  const supports = Array.isArray(candidate.supports)
    ? candidate.supports.filter(isEvidenceFacet)
    : [];
  if (supports.length === 0) {
    return null;
  }
  return {
    id: typeof candidate.id === 'string' ? candidate.id : undefined,
    type: candidate.type,
    label: candidate.label.trim(),
    href: typeof candidate.href === 'string' && candidate.href.trim().length > 0 ? candidate.href.trim() : undefined,
    note: typeof candidate.note === 'string' && candidate.note.trim().length > 0 ? candidate.note.trim() : undefined,
    supports,
    confidence: isConfidence(candidate.confidence) ? candidate.confidence : undefined,
    reviewStatus: isReviewStatus(candidate.reviewStatus) ? candidate.reviewStatus : undefined,
  };
}

function inferVerificationLevelFromEvidence(evidence: PartSourceEvidence[]): PartVerificationLevel {
  if (evidence.some((item) => item.type === 'official-image' || item.type === 'datasheet' || item.type === 'mechanical-drawing' || item.type === 'pinout')) {
    if (evidence.some((item) => item.type === 'community-fzpz' || item.type === 'community-svg' || item.type === 'marketplace-listing' || item.type === 'user-photo')) {
      return 'mixed-source';
    }
    return 'official-backed';
  }
  if (evidence.some((item) => item.type === 'community-fzpz' || item.type === 'community-svg' || item.type === 'marketplace-listing' || item.type === 'user-photo')) {
    return 'community-only';
  }
  return 'community-only';
}

function mergeEvidence(current: PartSourceEvidence[], incoming: PartSourceEvidence[]): PartSourceEvidence[] {
  const merged = [...current];
  for (const evidence of incoming) {
    const duplicate = merged.some((existing) =>
      existing.type === evidence.type &&
      existing.label === evidence.label &&
      existing.href === evidence.href,
    );
    if (!duplicate) {
      merged.push(evidence);
    }
  }
  return merged;
}

function lowerTokens(meta: PartTrustCarrier): string[] {
  return [
    meta.partFamily,
    meta.family,
    meta.packageType,
    meta.mountingType,
    ...(meta.tags ?? []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase());
}

export function inferPartFamily(meta: PartTrustCarrier): ExactPartFamily {
  if (meta.partFamily && EXACT_PART_FAMILIES.includes(meta.partFamily)) {
    return meta.partFamily;
  }

  const tokens = lowerTokens(meta);
  const tokenSet = new Set(tokens);
  const joined = tokens.join(' ');

  if (
    tokenSet.has('shield') ||
    joined.includes('shield')
  ) {
    return 'shield';
  }

  if (
    tokenSet.has('breakout') ||
    joined.includes('breakout')
  ) {
    return 'breakout';
  }

  if (
    tokenSet.has('driver') ||
    tokenSet.has('motor') ||
    joined.includes('motor driver') ||
    joined.includes('motor controller')
  ) {
    return 'driver';
  }

  if (
    tokenSet.has('arduino') ||
    tokenSet.has('module') ||
    tokenSet.has('board') ||
    joined.includes('nodemcu') ||
    joined.includes('teensy') ||
    joined.includes('mega 2560') ||
    joined.includes('uno r3')
  ) {
    return 'board-module';
  }

  if (
    tokenSet.has('sensor') && (tokenSet.has('module') || tokenSet.has('board') || tokenSet.has('breakout'))
  ) {
    return 'sensor-module';
  }

  if (
    tokenSet.has('connector') ||
    tokenSet.has('header') ||
    joined.includes('socket')
  ) {
    return 'connector';
  }

  if (
    joined.includes('dip') ||
    joined.includes('soic') ||
    joined.includes('qfn') ||
    joined.includes('qfp') ||
    joined.includes('tqfp') ||
    joined.includes('sot-')
  ) {
    return 'ic-package';
  }

  if (
    tokenSet.has('resistor') ||
    tokenSet.has('capacitor') ||
    tokenSet.has('inductor') ||
    tokenSet.has('led') ||
    tokenSet.has('diode') ||
    tokenSet.has('passive')
  ) {
    return 'passive';
  }

  return 'other';
}

export function getVerificationStatus(meta: PartTrustCarrier): PartVerificationStatus {
  return PART_VERIFICATION_STATUSES.includes(meta.verificationStatus as PartVerificationStatus)
    ? (meta.verificationStatus as PartVerificationStatus)
    : 'candidate';
}

export function getVerificationLevel(meta: PartTrustCarrier): PartVerificationLevel {
  if (PART_VERIFICATION_LEVELS.includes(meta.verificationLevel as PartVerificationLevel)) {
    return meta.verificationLevel as PartVerificationLevel;
  }
  return inferVerificationLevelFromEvidence(getSourceEvidence(meta));
}

export function getSourceEvidence(meta: PartTrustCarrier): PartSourceEvidence[] {
  if (!Array.isArray(meta.sourceEvidence)) {
    return [];
  }
  return meta.sourceEvidence.map(sanitizeEvidence).filter((entry): entry is PartSourceEvidence => entry != null);
}

export function getVerificationNotes(meta: PartTrustCarrier): string[] {
  return sanitizeStringArray(meta.verificationNotes);
}

export function requiresVerifiedExactness(meta: PartTrustCarrier): boolean {
  return BOARD_LIKE_FAMILIES.has(inferPartFamily(meta));
}

export function canUseAuthoritativeWiring(meta: PartTrustCarrier): boolean {
  return !requiresVerifiedExactness(meta) || getVerificationStatus(meta) === 'verified';
}

export function shouldPreferExactBreadboardView(
  meta: PartTrustCarrier,
  views: unknown,
): boolean {
  if (!requiresVerifiedExactness(meta)) {
    return false;
  }
  const breadboardShapes =
    (views as { breadboard?: { shapes?: unknown[] } } | null | undefined)?.breadboard?.shapes;
  return Array.isArray(breadboardShapes) && breadboardShapes.length > 0;
}

export function markPartMetaAsCandidate(
  meta: Record<string, unknown>,
  options?: {
    evidence?: PartSourceEvidence[];
    modelQuality?: string;
    note?: string;
    verificationLevel?: PartVerificationLevel;
  },
): Record<string, unknown> {
  const current = meta as PartTrustCarrier;
  const currentEvidence = getSourceEvidence(current);
  const incomingEvidence = (options?.evidence ?? []).map(sanitizeEvidence).filter((entry): entry is PartSourceEvidence => entry != null);
  const mergedEvidence = mergeEvidence(currentEvidence, incomingEvidence);
  const notes = dedupeStrings([
    ...getVerificationNotes(current),
    options?.note ?? 'Candidate exact part. Review against source evidence before using it for authoritative wiring.',
  ]);
  const verificationLevel = options?.verificationLevel ?? getVerificationLevel({ ...current, sourceEvidence: mergedEvidence });

  return {
    ...meta,
    partFamily: inferPartFamily({ ...current, sourceEvidence: mergedEvidence }),
    verificationStatus: 'candidate',
    verificationLevel,
    sourceEvidence: mergedEvidence,
    verificationNotes: notes,
    breadboardModelQuality: options?.modelQuality ?? current.breadboardModelQuality ?? 'ai_drafted',
    verifiedAt: undefined,
    verifiedBy: undefined,
  };
}

export function markPartMetaAsVerified(
  meta: Record<string, unknown>,
  options?: {
    evidence?: PartSourceEvidence[];
    note?: string;
    verificationLevel?: PartVerificationLevel;
    verifiedAt?: string;
    verifiedBy?: string;
  },
): Record<string, unknown> {
  const current = meta as PartTrustCarrier;
  const mergedEvidence = mergeEvidence(
    getSourceEvidence(current),
    (options?.evidence ?? []).map(sanitizeEvidence).filter((entry): entry is PartSourceEvidence => entry != null),
  );
  const verificationLevel = options?.verificationLevel ?? getVerificationLevel({ ...current, sourceEvidence: mergedEvidence });
  const notes = dedupeStrings([
    ...getVerificationNotes(current),
    ...(options?.note ? [options.note] : []),
  ]);

  return {
    ...meta,
    partFamily: inferPartFamily({ ...current, sourceEvidence: mergedEvidence }),
    verificationStatus: 'verified',
    verificationLevel,
    sourceEvidence: mergedEvidence,
    verificationNotes: notes,
    breadboardModelQuality: 'verified',
    verifiedAt: options?.verifiedAt ?? new Date().toISOString(),
    verifiedBy: options?.verifiedBy ?? 'local-review',
  };
}

export function summarizePartTrust(meta: PartTrustCarrier): PartTrustSummary {
  const family = inferPartFamily(meta);
  const status = getVerificationStatus(meta);
  const level = getVerificationLevel(meta);
  const requiresVerification = requiresVerifiedExactness(meta);
  const authoritativeWiringAllowed = canUseAuthoritativeWiring(meta);
  const summary = authoritativeWiringAllowed
    ? requiresVerification
      ? 'This exact board/module is verified enough for authoritative wiring guidance.'
      : 'This part does not require exact-part verification before wiring guidance.'
    : 'This board/module is still a candidate. ProtoPulse can place it visually, but authoritative wiring guidance stays blocked until review is complete.';

  return {
    authoritativeWiringAllowed,
    family,
    level,
    requiresVerification,
    status,
    summary,
  };
}
