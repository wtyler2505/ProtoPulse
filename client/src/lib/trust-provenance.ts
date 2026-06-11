export type ProvenanceTrustKind = 'verified' | 'estimated' | 'unverified';

export function trustLevelToKind(trustLevel: string | null | undefined): ProvenanceTrustKind {
  if (trustLevel === 'manufacturer_verified' || trustLevel === 'protopulse_gold' || trustLevel === 'verified') {
    return 'verified';
  }
  if (trustLevel === 'library' || trustLevel === 'community') {
    return 'estimated';
  }
  return 'unverified';
}

export function formatTrustLevelLabel(trustLevel: string | null | undefined, fallback = 'unknown trust'): string {
  return trustLevel ? trustLevel.replaceAll('_', ' ') : fallback;
}

export function formatConfidencePercent(
  score: number | null | undefined,
  options: { suffix?: string; fallback?: string } = {},
): string {
  const { suffix = '', fallback = 'pending' } = options;
  return typeof score === 'number' && Number.isFinite(score)
    ? `${Math.round(score * 100)}%${suffix ? ` ${suffix}` : ''}`
    : fallback;
}
