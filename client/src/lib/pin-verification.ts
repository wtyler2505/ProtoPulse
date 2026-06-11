import { asUnverified, type TrustBoundary } from '@/types/TrustBoundaries';

export type PinVerificationStatus = 'verified' | 'unverified_ai_guess' | 'conflict';

export interface PinVerificationIssue {
  instanceId: number;
  referenceDesignator: string;
  pinLabel: string;
  status: PinVerificationStatus;
  source: string;
  note?: string;
  trust: TrustBoundary<PinVerificationStatus>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function parsePinVerificationIssues(instances: Array<{ id: number; referenceDesignator?: string | null; properties?: unknown }>): PinVerificationIssue[] {
  const issues: PinVerificationIssue[] = [];

  for (const instance of instances) {
    const properties = isRecord(instance.properties) ? instance.properties : null;
    if (!properties) {
      continue;
    }

    const rawEntries = properties.pinVerificationEntries;
    if (!Array.isArray(rawEntries)) {
      continue;
    }

    for (const entry of rawEntries) {
      if (!isRecord(entry)) {
        continue;
      }
      const rawStatus = toStringValue(entry.status);
      if (!rawStatus) {
        continue;
      }
      if (rawStatus !== 'unverified_ai_guess' && rawStatus !== 'conflict') {
        continue;
      }
      const pinLabel = toStringValue(entry.pinLabel);
      const source = toStringValue(entry.source);
      if (!pinLabel || !source) {
        continue;
      }
      const note = toStringValue(entry.note) ?? undefined;
      issues.push({
        instanceId: instance.id,
        referenceDesignator: toStringValue(instance.referenceDesignator) ?? `instance-${String(instance.id)}`,
        pinLabel,
        status: rawStatus,
        source,
        note,
        trust: asUnverified(rawStatus, 'fallback_unknown', {
          isMock: true,
          note: note ?? `Pin verification status "${rawStatus}" is non-authoritative until audited against datasheet sources.`,
        }),
      });
    }
  }

  return issues;
}
