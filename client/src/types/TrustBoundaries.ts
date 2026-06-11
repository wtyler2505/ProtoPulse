export type TrustSource =
  | 'live_supplier_api'
  | 'historical_estimate'
  | 'manual_entry'
  | 'fallback_unknown';

interface TrustEnvelopeBase<T> {
  value: T;
  source: TrustSource;
  note?: string;
}

export interface Verified<T> extends TrustEnvelopeBase<T> {
  verified: true;
}

export interface Unverified<T> extends TrustEnvelopeBase<T> {
  verified: false;
  isMock: boolean;
}

export type TrustBoundary<T> = Verified<T> | Unverified<T>;

export function asVerified<T>(value: T, source: TrustSource, note?: string): Verified<T> {
  return {
    value,
    source,
    note,
    verified: true,
  };
}

export function asUnverified<T>(value: T, source: TrustSource, options?: { isMock?: boolean; note?: string }): Unverified<T> {
  return {
    value,
    source,
    note: options?.note,
    verified: false,
    isMock: options?.isMock ?? true,
  };
}

export function isUnverified<T>(value: unknown): value is Unverified<T> {
  return Boolean(value && typeof value === 'object' && 'verified' in value && (value as { verified?: unknown }).verified === false);
}

export function normalizeTrustBoundary<T>(
  value: TrustBoundary<T> | null | undefined,
  fallback: Unverified<T>,
): TrustBoundary<T> {
  if (!value) {
    return fallback;
  }
  return value.verified
    ? asVerified(value.value, value.source, value.note)
    : asUnverified(value.value, value.source, {
        isMock: value.isMock,
        note: value.note,
      });
}
