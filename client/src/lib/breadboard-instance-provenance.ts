import type { CircuitInstanceRow } from '@shared/schema';

export const BREADBOARD_INSTANCE_PROVENANCE_PROPERTY = 'breadboardProvenance';

export const BREADBOARD_INSTANCE_PROVENANCE_VALUES = [
  'starter',
  'project',
  'bench-stash',
  'exact',
  'coach',
  'synced-from-schematic',
] as const;

export type BreadboardInstanceProvenance =
  (typeof BREADBOARD_INSTANCE_PROVENANCE_VALUES)[number];

export type BreadboardInstancePlacement = 'bench' | 'board' | 'staged' | 'conflicting';

const PROVENANCE_SET = new Set<string>(BREADBOARD_INSTANCE_PROVENANCE_VALUES);

const TRUST_RANK: Record<BreadboardInstanceProvenance, number> = {
  coach: 10,
  'synced-from-schematic': 20,
  starter: 30,
  'bench-stash': 40,
  project: 50,
  exact: 80,
};

function readProps(instance: Pick<CircuitInstanceRow, 'properties'>): Record<string, unknown> {
  return (instance.properties as Record<string, unknown> | null) ?? {};
}

export function isBreadboardInstanceProvenance(
  value: unknown,
): value is BreadboardInstanceProvenance {
  return typeof value === 'string' && PROVENANCE_SET.has(value);
}

export function getBreadboardInstancePlacement(
  instance: Pick<CircuitInstanceRow, 'benchX' | 'benchY' | 'breadboardX' | 'breadboardY'>,
): BreadboardInstancePlacement {
  const hasBenchPlacement = instance.benchX != null && instance.benchY != null;
  const hasBoardPlacement = instance.breadboardX != null && instance.breadboardY != null;

  if (hasBenchPlacement && hasBoardPlacement) {
    return 'conflicting';
  }
  if (hasBenchPlacement) {
    return 'bench';
  }
  if (hasBoardPlacement) {
    return 'board';
  }
  return 'staged';
}

export function getBreadboardInstanceProvenance(
  instance: Pick<
    CircuitInstanceRow,
    'partId' | 'properties' | 'benchX' | 'benchY' | 'breadboardX' | 'breadboardY'
  >,
): BreadboardInstanceProvenance | null {
  const props = readProps(instance);
  const explicit = props[BREADBOARD_INSTANCE_PROVENANCE_PROPERTY];
  if (isBreadboardInstanceProvenance(explicit)) {
    return explicit;
  }

  if (props.coachPlanFor != null || props.coachPlanKey != null) {
    return 'coach';
  }

  const placement = getBreadboardInstancePlacement(instance);
  if (placement === 'bench') {
    return 'bench-stash';
  }

  if (instance.partId != null) {
    return 'project';
  }

  if (typeof props.type === 'string' && props.type.length > 0) {
    return 'starter';
  }

  return null;
}

export function compareBreadboardInstanceProvenanceTrust(
  a: BreadboardInstanceProvenance,
  b: BreadboardInstanceProvenance,
): number {
  return TRUST_RANK[a] - TRUST_RANK[b];
}

export function canCoachSuggestionReplaceProvenance(
  target: BreadboardInstanceProvenance,
  options: { userConfirmed?: boolean } = {},
): boolean {
  if (options.userConfirmed === true) {
    return true;
  }
  return compareBreadboardInstanceProvenanceTrust('coach', target) >= 0;
}
