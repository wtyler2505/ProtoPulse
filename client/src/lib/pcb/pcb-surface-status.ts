import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow } from '@shared/schema';

import { calculateRoutingStatus } from './routing-status';

export const PCB_RUN_DRC_EVENT = 'protopulse:run-drc';

export type PcbSurfaceTrustKind = 'verified' | 'estimated' | 'unverified';
export type PcbSurfaceGateSeverity = 'blocked' | 'warning' | 'clear';

type PcbInstanceProperties = Record<string, unknown>;

export interface PcbSurfaceStatus {
  trustKind: PcbSurfaceTrustKind;
  trustLabel: string;
  originLabel: string;
  trustSummary: string;
  instanceCount: number;
  placedCount: number;
  unplacedCount: number;
  generatedCount: number;
  unverifiedCount: number;
  routedCount: number;
  totalNets: number;
  boardSizeLabel: string;
  provenanceFlagLabel: string;
}

export interface PcbSurfaceSafetyGate {
  severity: PcbSurfaceGateSeverity;
  label: string;
  summary: string;
  reasons: string[];
  actionLabel: string;
  canRunDrc: boolean;
  blocksFabrication: boolean;
}

export interface PcbRunDrcEventDetail {
  source: 'pcb-layout';
  surfaceStatus: PcbSurfaceStatus;
  safetyGate: PcbSurfaceSafetyGate;
}

const GENERATED_PCB_MARKERS = new Set([
  'ai',
  'ai-chat',
  'generated',
  'generative',
  'exact-part-workflow',
  'schematic-ai',
]);

const UNVERIFIED_PCB_MARKERS = new Set([
  'candidate',
  'community-only',
  'generated',
  'heuristic',
  'needs-review',
  'provisional',
  'rejected',
  'unverified',
]);

function isInstancePlaced(instance: CircuitInstanceRow): boolean {
  return instance.pcbX != null && instance.pcbY != null;
}

function countPlacedInstances(instances: CircuitInstanceRow[]): number {
  return instances.filter(isInstancePlaced).length;
}

function readInstanceProperties(instance: CircuitInstanceRow): PcbInstanceProperties {
  return typeof instance.properties === 'object' && instance.properties != null && !Array.isArray(instance.properties)
    ? instance.properties as PcbInstanceProperties
    : {};
}

function normalizeMarker(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function matchesMarker(value: unknown, markers: Set<string>): boolean {
  const normalized = normalizeMarker(value);
  return normalized != null && markers.has(normalized);
}

function hasTruthyProperty(properties: PcbInstanceProperties, key: string): boolean {
  return properties[key] === true || properties[key] === 'true' || properties[key] === 1;
}

function hasGeneratedPcbProvenance(instance: CircuitInstanceRow): boolean {
  const properties = readInstanceProperties(instance);
  return (
    properties.generatedFrom != null ||
    hasTruthyProperty(properties, 'aiGenerated') ||
    hasTruthyProperty(properties, 'isAiGenerated') ||
    matchesMarker(properties.sourceView, GENERATED_PCB_MARKERS) ||
    matchesMarker(properties.source, GENERATED_PCB_MARKERS) ||
    matchesMarker(properties.createdBy, GENERATED_PCB_MARKERS) ||
    matchesMarker(properties.provenance, GENERATED_PCB_MARKERS)
  );
}

function hasUnverifiedPcbProvenance(instance: CircuitInstanceRow): boolean {
  const properties = readInstanceProperties(instance);
  return (
    properties.authoritativeWiringAllowed === false ||
    hasTruthyProperty(properties, 'requiresVerification') ||
    hasTruthyProperty(properties, 'unverified') ||
    hasTruthyProperty(properties, 'hasUnverifiedPinGuesses') ||
    matchesMarker(properties.verificationStatus, UNVERIFIED_PCB_MARKERS) ||
    matchesMarker(properties.verificationLevel, UNVERIFIED_PCB_MARKERS) ||
    matchesMarker(properties.footprintVerificationStatus, UNVERIFIED_PCB_MARKERS) ||
    matchesMarker(properties.partVerificationStatus, UNVERIFIED_PCB_MARKERS) ||
    matchesMarker(properties.trustLevel, UNVERIFIED_PCB_MARKERS) ||
    matchesMarker(properties.trustTier, UNVERIFIED_PCB_MARKERS)
  );
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

function formatBoardDimension(value: number): string {
  const mm = value / 10;
  return Number.isInteger(mm) ? String(mm) : mm.toFixed(1);
}

export function getPcbSurfaceStatus({
  instances,
  nets,
  wires,
  boardWidth,
  boardHeight,
}: {
  instances: CircuitInstanceRow[];
  nets: CircuitNetRow[];
  wires: CircuitWireRow[];
  boardWidth: number;
  boardHeight: number;
}): PcbSurfaceStatus {
  const instanceCount = instances.length;
  const placedCount = countPlacedInstances(instances);
  const unplacedCount = Math.max(0, instanceCount - placedCount);
  const generatedCount = instances.filter(hasGeneratedPcbProvenance).length;
  const unverifiedCount = instances.filter(hasUnverifiedPcbProvenance).length;
  const routing = calculateRoutingStatus(nets, wires);
  const boardSizeLabel = `${formatBoardDimension(boardWidth)} x ${formatBoardDimension(boardHeight)} mm`;

  if (instanceCount === 0) {
    return {
      trustKind: 'estimated',
      trustLabel: 'PCB_EMPTY',
      originLabel: 'No placed PCB geometry',
      trustSummary: 'Place parts before export or board-order checks.',
      instanceCount,
      placedCount,
      unplacedCount,
      generatedCount,
      unverifiedCount,
      routedCount: routing.routed,
      totalNets: routing.total,
      boardSizeLabel,
      provenanceFlagLabel: 'No footprints',
    };
  }

  if (unverifiedCount > 0) {
    const unverifiedSignalLabel = formatCountLabel(unverifiedCount, 'footprint signal');
    return {
      trustKind: 'unverified',
      trustLabel: 'PCB_UNVERIFIED',
      originLabel: `${unverifiedSignalLabel} ${unverifiedCount === 1 ? 'needs' : 'need'} verification`,
      trustSummary: 'Verify generative or exact-part footprint provenance before fabrication outputs.',
      instanceCount,
      placedCount,
      unplacedCount,
      generatedCount,
      unverifiedCount,
      routedCount: routing.routed,
      totalNets: routing.total,
      boardSizeLabel,
      provenanceFlagLabel: `${formatCountLabel(unverifiedCount, 'needs verification', 'need verification')}`,
    };
  }

  if (generatedCount > 0 || unplacedCount > 0) {
    return {
      trustKind: 'estimated',
      trustLabel: 'PCB_REVIEW',
      originLabel: generatedCount > 0
        ? `${formatCountLabel(generatedCount, 'generated footprint')} tracked`
        : `${formatCountLabel(unplacedCount, 'unplaced component')} remaining`,
      trustSummary: generatedCount > 0
        ? 'Review generated footprint provenance before order or export.'
        : 'Place remaining components before fabrication outputs.',
      instanceCount,
      placedCount,
      unplacedCount,
      generatedCount,
      unverifiedCount,
      routedCount: routing.routed,
      totalNets: routing.total,
      boardSizeLabel,
      provenanceFlagLabel: generatedCount > 0
        ? formatCountLabel(generatedCount, 'generated', 'generated')
        : formatCountLabel(unplacedCount, 'unplaced', 'unplaced'),
    };
  }

  return {
    trustKind: 'verified',
    trustLabel: 'PCB_LOCAL',
    originLabel: 'Local footprint geometry',
    trustSummary: 'No unverified footprint provenance detected on this PCB surface.',
    instanceCount,
    placedCount,
    unplacedCount,
    generatedCount,
    unverifiedCount,
    routedCount: routing.routed,
    totalNets: routing.total,
    boardSizeLabel,
    provenanceFlagLabel: 'No flags',
  };
}

export function getPcbSurfaceSafetyGate(status: PcbSurfaceStatus): PcbSurfaceSafetyGate {
  if (status.instanceCount === 0) {
    return {
      severity: 'blocked',
      label: 'FAB_BLOCKED',
      summary: 'DRC can run, but fabrication output is blocked until PCB footprints exist.',
      reasons: ['No PCB footprints placed'],
      actionLabel: 'Place PCB footprints',
      canRunDrc: true,
      blocksFabrication: true,
    };
  }

  const blockingReasons: string[] = [];
  const reviewReasons: string[] = [];

  if (status.unverifiedCount > 0) {
    blockingReasons.push(`${formatCountLabel(status.unverifiedCount, 'footprint signal')} ${status.unverifiedCount === 1 ? 'needs' : 'need'} verification`);
  }

  if (status.unplacedCount > 0) {
    blockingReasons.push(`${formatCountLabel(status.unplacedCount, 'component')} unplaced`);
  }

  const unroutedCount = Math.max(0, status.totalNets - status.routedCount);
  if (unroutedCount > 0) {
    blockingReasons.push(`${formatCountLabel(unroutedCount, 'net')} unrouted`);
  }

  if (blockingReasons.length > 0) {
    return {
      severity: 'blocked',
      label: 'FAB_BLOCKED',
      summary: 'DRC can run, but fabrication output is blocked until these PCB issues are resolved.',
      reasons: blockingReasons,
      actionLabel: 'Fix PCB blockers',
      canRunDrc: true,
      blocksFabrication: true,
    };
  }

  if (status.generatedCount > 0) {
    reviewReasons.push(`${formatCountLabel(status.generatedCount, 'generated footprint')} needs provenance review`);
  }

  if (status.totalNets === 0) {
    reviewReasons.push('No nets available for PCB routing checks');
  }

  if (reviewReasons.length > 0) {
    return {
      severity: 'warning',
      label: 'FAB_REVIEW',
      summary: 'Run DRC with this PCB review context before fabrication outputs.',
      reasons: reviewReasons,
      actionLabel: 'Review PCB provenance',
      canRunDrc: true,
      blocksFabrication: false,
    };
  }

  return {
    severity: 'clear',
    label: 'FAB_CLEAR',
    summary: 'DRC and fabrication gates have no PCB provenance blockers.',
    reasons: ['Placed, routed, and locally trusted PCB geometry'],
    actionLabel: 'Run DRC',
    canRunDrc: true,
    blocksFabrication: false,
  };
}
