/**
 * Breadboard Board Audit Engine — whole-board health assessment.
 *
 * Analyzes ALL placed instances + wires on the active breadboard and
 * produces a sorted issues list with an overall health score.
 *
 * Pure functions only — no side effects, no React, no DOM.
 */

import type { Connector, PartMeta } from '@shared/component-types';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import { findVerifiedBoardByAlias } from '@shared/verified-boards';
import type { VerifiedBoardDefinition, VerifiedPin } from '@shared/verified-boards';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BoardAuditIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'power' | 'signal' | 'layout' | 'safety' | 'missing';
  title: string;
  detail: string;
  affectedInstanceIds: number[];
  affectedPinIds: string[];
}

export interface BoardAuditSummary {
  score: number;
  label: string;
  issues: BoardAuditIssue[];
  stats: {
    totalInstances: number;
    totalWires: number;
    instancesWithIssues: number;
    missingDecoupling: number;
    restrictedPinUsage: number;
    strappingPinConflicts: number;
    wireCrossings: number;
  };
}

export interface BoardAuditInput {
  instances: CircuitInstanceRow[];
  wires: CircuitWireRow[];
  nets: CircuitNetRow[];
  parts: ComponentPart[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type LooseProperties = Record<string, unknown> | null;
type LooseMeta = Partial<PartMeta> & Record<string, unknown>;

function getMeta(part: ComponentPart): LooseMeta {
  return (part.meta as LooseMeta | null) ?? {};
}

function getFamily(meta: LooseMeta): string {
  return (typeof meta.family === 'string' ? meta.family : '').toLowerCase();
}

function isIcOrMcu(family: string): boolean {
  return family === 'ic' || family === 'mcu' || family === 'microcontroller';
}

function getProperties(instance: CircuitInstanceRow): LooseProperties {
  return (instance.properties as LooseProperties) ?? null;
}

function getConnectors(part: ComponentPart): Connector[] {
  return (part.connectors ?? []) as Connector[];
}

/** Build a lookup from partId to ComponentPart. */
function buildPartIndex(parts: ComponentPart[]): Map<number, ComponentPart> {
  const map = new Map<number, ComponentPart>();
  for (const part of parts) {
    map.set(part.id, part);
  }
  return map;
}

/** Build a lookup from instance id to CircuitInstanceRow. */
function buildInstanceIndex(instances: CircuitInstanceRow[]): Map<number, CircuitInstanceRow> {
  const map = new Map<number, CircuitInstanceRow>();
  for (const inst of instances) {
    map.set(inst.id, inst);
  }
  return map;
}

/** Try to match an instance's part against the verified board pack. */
function resolveVerifiedBoard(part: ComponentPart | undefined): VerifiedBoardDefinition | undefined {
  if (!part) {
    return undefined;
  }
  const meta = getMeta(part);
  const status = typeof meta.verificationStatus === 'string' ? meta.verificationStatus : '';
  const partFamily = typeof meta.partFamily === 'string' ? meta.partFamily : '';
  if (status !== 'verified') {
    return undefined;
  }
  if (partFamily !== 'board-module' && partFamily !== 'driver') {
    return undefined;
  }
  const mpn = typeof meta.mpn === 'string' ? meta.mpn : '';
  const title = typeof meta.title === 'string' ? meta.title : '';
  return findVerifiedBoardByAlias(mpn) ?? findVerifiedBoardByAlias(title) ?? undefined;
}

/** Index verified pins by their lowercase id and name for broad matching. */
function buildVerifiedPinIndex(board: VerifiedBoardDefinition): Map<string, VerifiedPin> {
  const index = new Map<string, VerifiedPin>();
  for (const pin of board.pins) {
    index.set(pin.id.toLowerCase(), pin);
    index.set(pin.name.toLowerCase(), pin);
  }
  return index;
}

interface NetSegmentJSON {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

/** Parse the segments JSONB from a circuit net. */
function parseNetSegments(net: CircuitNetRow): NetSegmentJSON[] {
  return (net.segments ?? []) as NetSegmentJSON[];
}

/** Check if a connector name looks like it belongs to power role. */
function isPowerConnector(name: string): boolean {
  const lower = name.toLowerCase();
  return /\b(vcc|vdd|vin|vbat|5v|3v3|3\.3v|avcc|vref)\b/.test(lower);
}

/** Check if a connector name looks like it belongs to ground role. */
function isGroundConnector(name: string): boolean {
  const lower = name.toLowerCase();
  return /\b(gnd|ground|vss|agnd|pgnd)\b/.test(lower);
}

/** Check if a net is a power or ground net. */
function isPowerOrGroundNet(net: CircuitNetRow): boolean {
  const netType = (net.netType ?? '').toLowerCase();
  const netName = (net.name ?? '').toLowerCase();
  if (netType === 'power' || netType === 'ground') {
    return true;
  }
  return /\b(vcc|vdd|gnd|ground|5v|3v3|pwr)\b/.test(netName);
}

/** Check if a connector name is a power or ground pin. */
function isPowerOrGroundPin(connectorName: string): boolean {
  return isPowerConnector(connectorName) || isGroundConnector(connectorName);
}

/** Get the breadboard row of an instance (integer from breadboardY). */
function getBreadboardRow(instance: CircuitInstanceRow): number | null {
  if (instance.breadboardY == null) {
    return null;
  }
  return Math.round(instance.breadboardY);
}

// ---------------------------------------------------------------------------
// Wire endpoint extraction from net segments
// ---------------------------------------------------------------------------

interface WireEndpoint {
  instanceId: number;
  pin: string;
}

/** Extract all wire endpoints from all net segments. */
function extractAllWireEndpoints(nets: CircuitNetRow[]): WireEndpoint[] {
  const endpoints: WireEndpoint[] = [];
  for (const net of nets) {
    const segments = parseNetSegments(net);
    for (const seg of segments) {
      endpoints.push({ instanceId: seg.fromInstanceId, pin: seg.fromPin });
      endpoints.push({ instanceId: seg.toInstanceId, pin: seg.toPin });
    }
  }
  return endpoints;
}

/** Get all net segments that touch a given instance. */
function getSegmentsForInstance(
  nets: CircuitNetRow[],
  instanceId: number,
): Array<{ net: CircuitNetRow; segment: NetSegmentJSON }> {
  const results: Array<{ net: CircuitNetRow; segment: NetSegmentJSON }> = [];
  for (const net of nets) {
    const segments = parseNetSegments(net);
    for (const seg of segments) {
      if (seg.fromInstanceId === instanceId || seg.toInstanceId === instanceId) {
        results.push({ net, segment: seg });
      }
    }
  }
  return results;
}

/** Get the set of pins on an instance that are connected via net segments. */
function getConnectedPins(
  nets: CircuitNetRow[],
  instanceId: number,
): Set<string> {
  const pins = new Set<string>();
  for (const net of nets) {
    const segments = parseNetSegments(net);
    for (const seg of segments) {
      if (seg.fromInstanceId === instanceId) {
        pins.add(seg.fromPin.toLowerCase());
      }
      if (seg.toInstanceId === instanceId) {
        pins.add(seg.toPin.toLowerCase());
      }
    }
  }
  return pins;
}

// ---------------------------------------------------------------------------
// Audit checks
// ---------------------------------------------------------------------------

/** Check 1: Missing decoupling capacitors near ICs/MCUs. */
function checkMissingDecoupling(
  instances: CircuitInstanceRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;
    if (!part) {
      continue;
    }
    const meta = getMeta(part);
    const family = getFamily(meta);
    if (!isIcOrMcu(family)) {
      continue;
    }

    const instRow = getBreadboardRow(inst);
    if (instRow == null) {
      continue;
    }

    // Look for a capacitor within 2 rows, or a staged coach support part.
    const hasSupportCap = breadboardInstances.some((other) => {
      if (other.id === inst.id) {
        return false;
      }
      const otherPart = other.partId != null ? partIndex.get(other.partId) : undefined;
      if (!otherPart) {
        return false;
      }
      const otherMeta = getMeta(otherPart);
      const otherFamily = getFamily(otherMeta);
      const isCapacitor = otherFamily === 'capacitor' || otherFamily === 'cap';

      // Also check if this part is a coach-staged support part for the IC.
      const otherProps = getProperties(other);
      const isCoachSupport = otherProps?.coachPlanFor === inst.referenceDesignator;

      if (!isCapacitor && !isCoachSupport) {
        return false;
      }

      const otherRow = getBreadboardRow(other);
      if (otherRow == null) {
        return false;
      }

      return Math.abs(otherRow - instRow) <= 2;
    });

    if (!hasSupportCap) {
      issues.push({
        id: `missing-decoupling-${String(inst.id)}`,
        severity: 'warning',
        category: 'missing',
        title: `Missing decoupling capacitor near ${inst.referenceDesignator}`,
        detail: `${meta.title ?? inst.referenceDesignator} should have a 100 nF bypass capacitor within 2 rows to filter power rail noise. Without it, the chip may behave unpredictably.`,
        affectedInstanceIds: [inst.id],
        affectedPinIds: [],
      });
    }
  }

  return issues;
}

/** Check 2: Restricted pin usage (e.g. ESP32 GPIO 6-11 connected to internal flash). */
function checkRestrictedPinUsage(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;
    const board = resolveVerifiedBoard(part);
    if (!board) {
      continue;
    }

    const pinIndex = buildVerifiedPinIndex(board);
    const connectedPins = getConnectedPins(nets, inst.id);

    for (const pinKey of Array.from(connectedPins)) {
      const vbPin = pinIndex.get(pinKey);
      if (vbPin?.restricted) {
        issues.push({
          id: `restricted-pin-${String(inst.id)}-${vbPin.id}`,
          severity: 'critical',
          category: 'safety',
          title: `Restricted pin ${vbPin.name} wired on ${inst.referenceDesignator}`,
          detail: vbPin.restrictionReason ?? `Pin ${vbPin.name} (${vbPin.id}) is restricted and should not be used for general I/O.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [vbPin.id],
        });
      }
    }
  }

  return issues;
}

/** Check 3: Strapping/boot pin signal routing. */
function checkStrappingPinConflicts(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;
    const board = resolveVerifiedBoard(part);
    if (!board?.bootPins || board.bootPins.length === 0) {
      continue;
    }

    const bootPinIds = new Set(board.bootPins.map((bp) => bp.pinId.toLowerCase()));
    const pinIndex = buildVerifiedPinIndex(board);

    // Check if any non-power net connects to a boot pin.
    const instanceSegments = getSegmentsForInstance(nets, inst.id);
    for (const { net, segment } of instanceSegments) {
      if (isPowerOrGroundNet(net)) {
        continue;
      }

      const pinOnThisInstance =
        segment.fromInstanceId === inst.id ? segment.fromPin : segment.toPin;
      const pinLower = pinOnThisInstance.toLowerCase();

      if (bootPinIds.has(pinLower)) {
        const vbPin = pinIndex.get(pinLower);
        const bootConfig = board.bootPins.find(
          (bp) => bp.pinId.toLowerCase() === pinLower,
        );
        issues.push({
          id: `strapping-pin-${String(inst.id)}-${pinOnThisInstance}`,
          severity: 'warning',
          category: 'safety',
          title: `Signal on strapping pin ${vbPin?.name ?? pinOnThisInstance} (${inst.referenceDesignator})`,
          detail: bootConfig
            ? `${bootConfig.designRule} External loads on this pin can prevent the board from booting correctly.`
            : `Pin ${pinOnThisInstance} is a boot strapping pin. External signal loads can interfere with power-on behavior.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [vbPin?.id ?? pinOnThisInstance],
        });
      }
    }
  }

  return issues;
}

/** Check 4: ADC2 WiFi conflict on ESP32 boards. */
function checkAdcWifiConflict(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const ADC2_WIFI_PATTERN = /\bunavailable when wifi\b/i;
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;
    const board = resolveVerifiedBoard(part);
    if (!board) {
      continue;
    }

    // Collect ADC2 pin IDs that conflict with WiFi.
    const adcWifiPinIds = new Set<string>();
    for (const pin of board.pins) {
      for (const fn of pin.functions) {
        if (fn.notes && ADC2_WIFI_PATTERN.test(fn.notes)) {
          adcWifiPinIds.add(pin.id.toLowerCase());
          adcWifiPinIds.add(pin.name.toLowerCase());
          break;
        }
      }
    }
    if (adcWifiPinIds.size === 0) {
      continue;
    }

    const connectedPins = getConnectedPins(nets, inst.id);
    for (const pinKey of Array.from(connectedPins)) {
      if (adcWifiPinIds.has(pinKey)) {
        const matchingPin = board.pins.find(
          (p) => p.id.toLowerCase() === pinKey || p.name.toLowerCase() === pinKey,
        );
        issues.push({
          id: `adc2-wifi-${String(inst.id)}-${pinKey}`,
          severity: 'warning',
          category: 'signal',
          title: `ADC2 pin ${matchingPin?.name ?? pinKey} conflicts with WiFi (${inst.referenceDesignator})`,
          detail: `Pin ${matchingPin?.name ?? pinKey} is on the ADC2 peripheral, which becomes unavailable when WiFi is active. Use ADC1 pins instead if you need analog reads during WiFi operation.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [matchingPin?.id ?? pinKey],
        });
      }
    }
  }

  return issues;
}

/** Check 5: Missing ground return — parts with power but no ground hookup. */
function checkMissingGroundReturn(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;
    if (!part) {
      continue;
    }

    const connectors = getConnectors(part);
    const powerPinNames = connectors
      .filter((c) => isPowerConnector(c.name ?? ''))
      .map((c) => (c.name ?? '').toLowerCase());
    const groundPinNames = connectors
      .filter((c) => isGroundConnector(c.name ?? ''))
      .map((c) => (c.name ?? '').toLowerCase());

    // Only check parts that HAVE identifiable power and ground pins.
    if (powerPinNames.length === 0 || groundPinNames.length === 0) {
      continue;
    }

    const connectedPins = getConnectedPins(nets, inst.id);

    const hasPowerHooked = powerPinNames.some((name) => connectedPins.has(name));
    const hasGroundHooked = groundPinNames.some((name) => connectedPins.has(name));

    // Also check by connector id.
    const powerConnectorIds = connectors
      .filter((c) => isPowerConnector(c.name ?? ''))
      .map((c) => (c.id ?? '').toLowerCase());
    const groundConnectorIds = connectors
      .filter((c) => isGroundConnector(c.name ?? ''))
      .map((c) => (c.id ?? '').toLowerCase());

    const hasPowerById = powerConnectorIds.some((id) => connectedPins.has(id));
    const hasGroundById = groundConnectorIds.some((id) => connectedPins.has(id));

    const powerConnected = hasPowerHooked || hasPowerById;
    const groundConnected = hasGroundHooked || hasGroundById;

    if (powerConnected && !groundConnected) {
      const meta = getMeta(part);
      issues.push({
        id: `missing-ground-${String(inst.id)}`,
        severity: 'critical',
        category: 'power',
        title: `No ground return for ${inst.referenceDesignator}`,
        detail: `${meta.title ?? inst.referenceDesignator} has power connected but no ground return path. Without a ground reference, the part cannot function and current has nowhere to go.`,
        affectedInstanceIds: [inst.id],
        affectedPinIds: groundPinNames,
      });
    }
  }

  return issues;
}

/** Check 6: Wire density hotspots — congested row bands. */
function checkWireDensityHotspots(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  if (breadboardInstances.length === 0) {
    return issues;
  }

  // Count wires per instance row.
  const endpoints = extractAllWireEndpoints(nets);
  const instanceIndex = buildInstanceIndex(instances);
  const rowWireCount = new Map<number, number>();
  const rowInstanceIds = new Map<number, Set<number>>();

  for (const ep of endpoints) {
    const inst = instanceIndex.get(ep.instanceId);
    if (!inst) {
      continue;
    }
    const row = getBreadboardRow(inst);
    if (row == null) {
      continue;
    }
    rowWireCount.set(row, (rowWireCount.get(row) ?? 0) + 1);
    if (!rowInstanceIds.has(row)) {
      rowInstanceIds.set(row, new Set());
    }
    rowInstanceIds.get(row)!.add(inst.id);
  }

  // Scan 5-row windows.
  const allRows = Array.from(rowWireCount.keys()).sort((a, b) => a - b);
  if (allRows.length === 0) {
    return issues;
  }

  const minRow = allRows[0];
  const maxRow = allRows[allRows.length - 1];
  const WINDOW = 5;
  const THRESHOLD = 8;
  const flaggedBands = new Set<string>();

  // Ensure at least one window pass even when all data is in a single row
  const windowEnd = Math.max(minRow, maxRow - WINDOW + 1);
  for (let start = minRow; start <= windowEnd; start++) {
    let count = 0;
    const affectedIds = new Set<number>();
    for (let r = start; r < start + WINDOW; r++) {
      count += rowWireCount.get(r) ?? 0;
      const ids = rowInstanceIds.get(r);
      if (ids) {
        for (const id of Array.from(ids)) {
          affectedIds.add(id);
        }
      }
    }

    if (count > THRESHOLD) {
      const bandKey = `${String(start)}-${String(start + WINDOW - 1)}`;
      if (!flaggedBands.has(bandKey)) {
        flaggedBands.add(bandKey);
        issues.push({
          id: `wire-density-${bandKey}`,
          severity: 'info',
          category: 'layout',
          title: `Wire congestion in rows ${bandKey}`,
          detail: `${String(count)} wire endpoints crowd into a 5-row band (rows ${bandKey}). Spreading parts or rerouting wires will make this zone easier to probe and debug.`,
          affectedInstanceIds: Array.from(affectedIds),
          affectedPinIds: [],
        });
      }
    }
  }

  return issues;
}

/** Check 7: Unconnected power pins — ICs/MCUs with no power or ground wires. */
function checkUnconnectedPowerPins(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];
  const breadboardInstances = instances.filter((inst) => inst.breadboardX != null && inst.breadboardY != null);

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;
    if (!part) {
      continue;
    }
    const meta = getMeta(part);
    const family = getFamily(meta);
    if (!isIcOrMcu(family)) {
      continue;
    }

    const connectors = getConnectors(part);
    const hasPowerPins = connectors.some((c) => isPowerOrGroundPin(c.name ?? ''));
    if (!hasPowerPins) {
      continue;
    }

    const connectedPins = getConnectedPins(nets, inst.id);
    const anyPowerConnected = connectors.some((c) => {
      const name = (c.name ?? '').toLowerCase();
      const id = (c.id ?? '').toLowerCase();
      return (isPowerOrGroundPin(c.name ?? '')) && (connectedPins.has(name) || connectedPins.has(id));
    });

    if (!anyPowerConnected) {
      issues.push({
        id: `unconnected-power-${String(inst.id)}`,
        severity: 'warning',
        category: 'power',
        title: `No power/ground wires on ${inst.referenceDesignator}`,
        detail: `${meta.title ?? inst.referenceDesignator} has identifiable power and ground pins but none are wired to a net. The chip will not function without a power supply.`,
        affectedInstanceIds: [inst.id],
        affectedPinIds: connectors
          .filter((c) => isPowerOrGroundPin(c.name ?? ''))
          .map((c) => c.id),
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<BoardAuditIssue['severity'], number> = {
  critical: 15,
  warning: 8,
  info: 3,
};

function computeScore(issues: BoardAuditIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= SEVERITY_WEIGHT[issue.severity];
  }
  return Math.max(0, score);
}

function scoreLabel(score: number): string {
  if (score >= 85) {
    return 'Healthy';
  }
  if (score >= 65) {
    return 'Needs attention';
  }
  if (score >= 40) {
    return 'Risky';
  }
  return 'Critical';
}

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

export function auditBreadboard(params: BoardAuditInput): BoardAuditSummary {
  const { instances, wires, nets, parts } = params;
  const partIndex = buildPartIndex(parts);

  // Only consider instances placed on the breadboard.
  const breadboardInstances = instances.filter(
    (inst) => inst.breadboardX != null && inst.breadboardY != null,
  );

  if (breadboardInstances.length === 0) {
    return {
      score: 100,
      label: 'Healthy',
      issues: [],
      stats: {
        totalInstances: 0,
        totalWires: wires.length,
        instancesWithIssues: 0,
        missingDecoupling: 0,
        restrictedPinUsage: 0,
        strappingPinConflicts: 0,
        wireCrossings: 0,
      },
    };
  }

  // Run all audit checks.
  const decouplingIssues = checkMissingDecoupling(breadboardInstances, partIndex);
  const restrictedIssues = checkRestrictedPinUsage(instances, nets, partIndex);
  const strappingIssues = checkStrappingPinConflicts(instances, nets, partIndex);
  const adcIssues = checkAdcWifiConflict(instances, nets, partIndex);
  const groundIssues = checkMissingGroundReturn(instances, nets, partIndex);
  const densityIssues = checkWireDensityHotspots(instances, nets);
  const unconnectedPowerIssues = checkUnconnectedPowerPins(instances, nets, partIndex);

  // Combine and sort by severity (critical first, then warning, then info).
  const severityOrder: Record<BoardAuditIssue['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const allIssues = [
    ...decouplingIssues,
    ...restrictedIssues,
    ...strappingIssues,
    ...adcIssues,
    ...groundIssues,
    ...densityIssues,
    ...unconnectedPowerIssues,
  ].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Compute stats.
  const affectedInstanceSet = new Set<number>();
  for (const issue of allIssues) {
    for (const id of issue.affectedInstanceIds) {
      affectedInstanceSet.add(id);
    }
  }

  const score = computeScore(allIssues);

  return {
    score,
    label: scoreLabel(score),
    issues: allIssues,
    stats: {
      totalInstances: breadboardInstances.length,
      totalWires: wires.length,
      instancesWithIssues: affectedInstanceSet.size,
      missingDecoupling: decouplingIssues.length,
      restrictedPinUsage: restrictedIssues.length,
      strappingPinConflicts: strappingIssues.length,
      wireCrossings: densityIssues.length,
    },
  };
}
