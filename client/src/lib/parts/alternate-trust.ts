import { formatConfidencePercent, formatTrustLevelLabel, trustLevelToKind } from '@/lib/trust-provenance';

export type AlternateTrustKind = 'verified' | 'estimated' | 'unverified';

export interface AlternateTrustCandidate {
  manufacturer?: string | null;
  canonicalCategory?: string | null;
  trustLevel?: string | null;
  matchScore?: number | null;
}

export function alternateTrustKind(trustLevel: string | null | undefined): AlternateTrustKind {
  return trustLevelToKind(trustLevel);
}

export function formatAlternateTrustLabel(trustLevel: string | null | undefined): string {
  return formatTrustLevelLabel(trustLevel, 'unknown trust');
}

export function formatAlternateMatchScore(score: number | null | undefined): string {
  return formatConfidencePercent(score, { suffix: 'match', fallback: 'match pending' });
}

export function describeAlternateMatchReason(candidate: AlternateTrustCandidate): string {
  const score = candidate.matchScore ?? 0;
  if (score >= 0.9) {
    return 'Strong catalog match. Confirm datasheet limits before changing the project.';
  }
  if (score >= 0.7) {
    return 'Likely functional substitute. Review tolerance, package, and operating range.';
  }
  return 'Candidate substitute only. Treat this as a manual review item.';
}

export function describeAlternateTradeoff(candidate: AlternateTrustCandidate): string {
  const maker = candidate.manufacturer ? `${candidate.manufacturer} part` : 'Alternate part';
  const category = candidate.canonicalCategory ? ` in ${candidate.canonicalCategory}` : '';
  return `${maker}${category}; trust source is ${formatAlternateTrustLabel(candidate.trustLevel)}.`;
}
