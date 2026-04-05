import type { PartMeta } from './component-types';
import {
  canUseAuthoritativeWiring,
  getVerificationLevel,
  getVerificationStatus,
  inferPartFamily,
  requiresVerifiedExactness,
  summarizePartTrust,
  type ExactPartFamily,
  type PartVerificationLevel,
  type PartVerificationStatus,
} from './component-trust';
import type { ComponentPart } from './schema';

export type ExactPartAiPlacementMode = 'standard' | 'verified-exact' | 'provisional-exact';

export interface ExactPartAiPolicy {
  aiRule: string;
  authoritativeWiringAllowed: boolean;
  family: ExactPartFamily;
  level: PartVerificationLevel;
  partId: number;
  placementMode: ExactPartAiPlacementMode;
  requiresVerification: boolean;
  status: PartVerificationStatus;
  summary: string;
  title: string;
}

export interface ExactPartAiUsage extends ExactPartAiPolicy {
  referenceDesignator: string;
}

export interface GeneratedCircuitTrustSummary {
  authoritativeWiringAllowed: boolean;
  missingPartIds: number[];
  summary: string;
  usedParts: ExactPartAiUsage[];
  warnings: string[];
}

type ExactPartPolicyCarrier = Pick<ComponentPart, 'id' | 'meta'>;

function getPartMeta(part: ExactPartPolicyCarrier): PartMeta {
  return ((part.meta ?? {}) as Partial<PartMeta>) as PartMeta;
}

function getPartTitle(meta: PartMeta, fallbackId: number): string {
  return typeof meta.title === 'string' && meta.title.trim().length > 0
    ? meta.title.trim()
    : `Part #${String(fallbackId)}`;
}

export function buildExactPartAiPolicy(part: ExactPartPolicyCarrier): ExactPartAiPolicy {
  const meta = getPartMeta(part);
  const title = getPartTitle(meta, part.id);
  const family = inferPartFamily(meta);
  const level = getVerificationLevel(meta);
  const status = getVerificationStatus(meta);
  const requiresVerification = requiresVerifiedExactness(meta);
  const authoritativeWiringAllowed = canUseAuthoritativeWiring(meta);
  const trustSummary = summarizePartTrust(meta).summary;

  let placementMode: ExactPartAiPlacementMode = 'standard';
  let aiRule = 'This part can be used normally for placement and wiring generation.';

  if (requiresVerification && authoritativeWiringAllowed) {
    placementMode = 'verified-exact';
    aiRule = 'This exact board/module is verified. Placement and wiring can treat its connector mapping as authoritative.';
  } else if (requiresVerification) {
    placementMode = 'provisional-exact';
    aiRule =
      'This exact board/module is still a candidate. It may be placed visually, but exact hookup guidance must stay provisional until review is complete.';
  }

  return {
    aiRule,
    authoritativeWiringAllowed,
    family,
    level,
    partId: part.id,
    placementMode,
    requiresVerification,
    status,
    summary: trustSummary,
    title,
  };
}

export function summarizeGeneratedCircuitTrust(
  instances: Array<{ partId: number; referenceDesignator: string }>,
  parts: ExactPartPolicyCarrier[],
): GeneratedCircuitTrustSummary {
  const partMap = new Map(parts.map((part) => [part.id, part]));
  const usedParts: ExactPartAiUsage[] = [];
  const warnings: string[] = [];
  const missingPartIds: number[] = [];

  for (const instance of instances) {
    const part = partMap.get(instance.partId);
    if (!part) {
      missingPartIds.push(instance.partId);
      continue;
    }

    const policy = buildExactPartAiPolicy(part);
    const usage: ExactPartAiUsage = {
      ...policy,
      referenceDesignator: instance.referenceDesignator,
    };
    usedParts.push(usage);

    if (policy.placementMode === 'provisional-exact') {
      warnings.push(
        `${instance.referenceDesignator} uses candidate exact part "${policy.title}". Exact hookup guidance for this board/module remains provisional until verification is complete.`,
      );
    }
  }

  for (const partId of missingPartIds) {
    warnings.push(`AI output referenced missing Part #${String(partId)}. ProtoPulse skipped trust analysis for that instance.`);
  }

  const authoritativeWiringAllowed = missingPartIds.length === 0 && usedParts.every((usage) => usage.authoritativeWiringAllowed);
  const provisionalExactParts = usedParts.filter((usage) => usage.placementMode === 'provisional-exact');

  let summary = 'All placed parts are standard or verified exact parts, so wiring guidance can stay authoritative.';
  if (provisionalExactParts.length > 0) {
    summary = provisionalExactParts.length === 1
      ? 'One placed exact board/module is still provisional, so exact wiring guidance must stay provisional.'
      : `${String(provisionalExactParts.length)} placed exact board/module parts are still provisional, so exact wiring guidance must stay provisional.`;
  } else if (missingPartIds.length > 0) {
    summary = 'ProtoPulse generated the circuit, but some referenced parts were missing from the available library.';
  }

  return {
    authoritativeWiringAllowed,
    missingPartIds,
    summary,
    usedParts,
    warnings,
  };
}
