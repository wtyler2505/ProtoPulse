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
import { inferTraps } from './heuristic-trap-inference';
import { VAULT_SLUGS } from './circuit-editor/breadboard-constants';

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
  /** Vault slug for the relevant design rule — Wave 2 finding #292 scaffold. */
  remediationLink?: string;
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

// ---------------------------------------------------------------------------
// Strapping-pin net classification (audit #283)
// ---------------------------------------------------------------------------

/**
 * Families that are considered purely passive for the purpose of
 * strapping-pin net classification. Switches/buttons are included because
 * a reset-button pull-up circuit (GPIO → button → resistor → VCC) is a
 * CORRECT and COMMON configuration — the switch is a passive mechanical
 * element, not an active signal driver.
 */
const PASSIVE_FAMILIES = new Set([
  'resistor',
  'capacitor',
  'capacitor',
  'inductor',
  'ferrite',
  'switch',
  'button',
  'cap',
]);

/**
 * Return true if the part's family is a passive component that cannot
 * actively drive a strapping pin to an unsafe level.
 */
function isPassivePart(part: ComponentPart | undefined): boolean {
  if (!part) return false;
  const family = getFamily(getMeta(part));
  if (PASSIVE_FAMILIES.has(family)) return true;
  // Also accept type-keyword aliases in the part type field.
  const title = (typeof getMeta(part).title === 'string' ? getMeta(part).title as string : '').toLowerCase();
  return title.includes('resistor') || title.includes('capacitor') || title.includes('inductor');
}

type StrappingNetClass = 'pullup-to-vcc' | 'pulldown-to-gnd' | 'active-signal';

/**
 * Walks the net graph through chains of passive components (resistors,
 * capacitors, inductors, ferrites, switches/buttons) looking for a path
 * to VCC or GND. An active device found anywhere in the reachable set
 * causes an immediate `active-signal` classification.
 *
 * The walk is bounded to MAX_PASSIVE_HOPS hops to avoid infinite loops
 * while still handling real-world reset-button circuits:
 *   GPIO → (signal net) → button → (intermediate net) → resistor → (VCC net)
 * which requires 2 hops through passives.
 */
const MAX_PASSIVE_HOPS = 4; // covers any realistic pull-up chain

function classifyStrappingNetFull(
  net: CircuitNetRow,
  mcuInstanceId: number,
  allNets: CircuitNetRow[],
  instances: CircuitInstanceRow[],
  partIndex: Map<number, ComponentPart>,
): StrappingNetClass {
  // Build instanceId → partId from the instances array.
  const instancePartIdMap = new Map<number, number | null>();
  for (const inst of instances) {
    instancePartIdMap.set(inst.id, inst.partId ?? null);
  }

  // Build a quick net lookup: instanceId → nets that touch it.
  const instanceToNets = new Map<number, CircuitNetRow[]>();
  for (const n of allNets) {
    for (const seg of parseNetSegments(n)) {
      for (const id of [seg.fromInstanceId, seg.toInstanceId]) {
        if (!instanceToNets.has(id)) instanceToNets.set(id, []);
        instanceToNets.get(id)!.push(n);
      }
    }
  }

  // BFS through passive-component chains starting from the strapping-pin net.
  // Each queue entry is an instance ID to explore. We track visited nets to
  // avoid revisiting (prevents cycles through shared passives).
  const visitedNets = new Set<number>([net.id]);
  // Frontier is instance IDs reachable through passive hops.
  const queue: Array<{ instanceId: number; hop: number }> = [];

  // Seed the queue with direct neighbors on the GPIO net (excluding the MCU).
  const seedSegments = parseNetSegments(net);
  for (const seg of seedSegments) {
    for (const id of [seg.fromInstanceId, seg.toInstanceId]) {
      if (id !== mcuInstanceId) {
        queue.push({ instanceId: id, hop: 0 });
      }
    }
  }

  let foundPullupToVcc = false;
  let foundPulldownToGnd = false;

  const visitedInstances = new Set<number>([mcuInstanceId]);

  while (queue.length > 0) {
    const entry = queue.shift()!;
    const { instanceId, hop } = entry;

    if (visitedInstances.has(instanceId)) continue;
    visitedInstances.add(instanceId);

    const partId = instancePartIdMap.get(instanceId) ?? null;
    const part = partId != null ? partIndex.get(partId) : undefined;

    if (!isPassivePart(part)) {
      // Non-passive (active) device reachable from the strapping pin.
      // Active source wins — no pull-up can suppress this warning.
      return 'active-signal';
    }

    // Passive found. Check all nets connected to this passive (excluding the
    // net we arrived on) for power/GND classification or further passives.
    const neighborNets = instanceToNets.get(instanceId) ?? [];
    for (const neighborNet of neighborNets) {
      if (visitedNets.has(neighborNet.id)) continue;
      visitedNets.add(neighborNet.id);

      if (isPowerOrGroundNet(neighborNet)) {
        const netName = (neighborNet.name ?? '').toLowerCase();
        const netType = (neighborNet.netType ?? '').toLowerCase();
        if (netType === 'ground' || /\b(gnd|ground|vss|agnd|pgnd)\b/.test(netName)) {
          foundPulldownToGnd = true;
        } else {
          foundPullupToVcc = true;
        }
        // Don't continue exploring beyond a power/GND net.
        continue;
      }

      // Non-power net: enqueue instances on this net for further exploration
      // (if we haven't exceeded the hop depth limit).
      if (hop < MAX_PASSIVE_HOPS) {
        for (const seg of parseNetSegments(neighborNet)) {
          for (const nextId of [seg.fromInstanceId, seg.toInstanceId]) {
            if (!visitedInstances.has(nextId)) {
              queue.push({ instanceId: nextId, hop: hop + 1 });
            }
          }
        }
      }
    }
  }

  if (foundPullupToVcc) return 'pullup-to-vcc';
  if (foundPulldownToGnd) return 'pulldown-to-gnd';

  // No active device found, no power/GND path found either — be conservative.
  return 'active-signal';
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

    // Track emitted issue IDs to avoid duplicates when the same net has multiple
    // segments that all touch the same MCU pin (e.g., a mixed net with both a
    // pull-up resistor and an active MCU output on separate segments).
    const emittedIssueIds = new Set<string>();

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
        const issueId = `strapping-pin-${String(inst.id)}-${pinOnThisInstance}`;

        // Skip if we already emitted for this exact instance+pin combination
        // (can happen when a net has multiple segments all touching the same pin).
        if (emittedIssueIds.has(issueId)) {
          continue;
        }

        // Classify the net to distinguish safe pull-ups/pull-downs from active drives.
        const netClass = classifyStrappingNetFull(net, inst.id, nets, instances, partIndex);

        // Pull-up to VCC and pull-down to GND through passive components are
        // CORRECT and COMMON configurations (e.g., GPIO0 + 10kΩ to 3V3 is how
        // a reset button works). Only warn on active-signal connections.
        if (netClass === 'pullup-to-vcc' || netClass === 'pulldown-to-gnd') {
          continue;
        }

        const vbPin = pinIndex.get(pinLower);
        const bootConfig = board.bootPins.find(
          (bp) => bp.pinId.toLowerCase() === pinLower,
        );
        emittedIssueIds.add(issueId);
        issues.push({
          id: issueId,
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

      // Build "Name (id)" labels for each ground pin; suppress the parenthesized ID
      // when it is identical to the name (case-insensitive) to avoid "GND (GND)".
      const groundConnectors = connectors.filter((c) => isGroundConnector(c.name ?? ''));
      const groundPinLabels = groundConnectors.map((c) => {
        const name = c.name ?? '';
        const id = c.id ?? '';
        return name.toLowerCase() === id.toLowerCase() ? name : `${name} (${id})`;
      });
      const groundPinList = groundPinLabels.join(', ');

      issues.push({
        id: `missing-ground-${String(inst.id)}`,
        severity: 'critical',
        category: 'power',
        title: `No ground return for ${inst.referenceDesignator}`,
        detail: `${meta.title ?? inst.referenceDesignator} has power connected but no ground return path on ${groundPinList}. Without a ground reference, the part cannot function and current has nowhere to go.`,
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

/** Check 8: Motor controller behavioral traps — BLDC polarity, H-bridge back-EMF. */
function checkMotorDriverTraps(
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
    if (family !== 'driver') {
      continue;
    }

    const title = (typeof meta.title === 'string' ? meta.title : '').toLowerCase();

    // Only motor-related drivers (skip LED drivers, etc.)
    const isMotor =
      title.includes('motor') ||
      title.includes('bldc') ||
      title.includes('h-bridge') ||
      title.includes('h bridge') ||
      title.includes('l298') ||
      title.includes('l293') ||
      title.includes('l9110') ||
      title.includes('tb6612') ||
      title.includes('drv8') ||
      title.includes('riorand') ||
      title.includes('bts7960');

    if (!isMotor) {
      continue;
    }

    const isBldcType =
      title.includes('bldc') || title.includes('riorand');

    const isHBridgeType =
      title.includes('h-bridge') ||
      title.includes('h bridge') ||
      title.includes('l298') ||
      title.includes('l293') ||
      title.includes('l9110') ||
      title.includes('tb6612') ||
      title.includes('drv8') ||
      title.includes('bts7960');

    if (isBldcType) {
      issues.push({
        id: `motor-bldc-polarity-${String(inst.id)}`,
        severity: 'warning',
        category: 'safety',
        title: `STOP/BRAKE polarity inversion on ${inst.referenceDesignator}`,
        detail:
          'BLDC controllers often use inverted logic: STOP is active-LOW, BRAKE is active-HIGH. Swapping these leaves the motor running or permanently braked. Verify polarity against the datasheet before wiring.',
        affectedInstanceIds: [inst.id],
        affectedPinIds: [],
      });
    }

    if (isHBridgeType) {
      issues.push({
        id: `motor-back-emf-${String(inst.id)}`,
        severity: 'warning',
        category: 'safety',
        title: `Back-EMF protection needed on ${inst.referenceDesignator}`,
        detail:
          'H-bridge drivers require flyback diodes across motor terminals to absorb back-EMF during deceleration. Without protection, voltage spikes can destroy the driver IC.',
        affectedInstanceIds: [inst.id],
        affectedPinIds: [],
      });
    }
  }

  return issues;
}

/**
 * Run heuristic trap inference on unverified parts (S2-01 integration).
 * Verified boards already surface traps via their pin maps; this adds
 * pattern-matched warnings for parts without a verified profile.
 */
function checkHeuristicTraps(
  instances: CircuitInstanceRow[],
  partIndex: Map<number, ComponentPart>,
): BoardAuditIssue[] {
  const issues: BoardAuditIssue[] = [];

  for (const inst of instances) {
    if (inst.breadboardX == null || inst.breadboardY == null) continue;
    if (inst.partId == null) continue;
    const part = partIndex.get(inst.partId);
    if (!part) continue;

    // Skip if this part is already a verified board — those have exact trap data.
    const meta = getMeta(part);
    const status = typeof meta.verificationStatus === 'string' ? meta.verificationStatus : '';
    if (status === 'verified') {
      const mpn = typeof meta.mpn === 'string' ? meta.mpn : '';
      const title = typeof meta.title === 'string' ? meta.title : '';
      if (findVerifiedBoardByAlias(mpn) ?? findVerifiedBoardByAlias(title)) {
        continue;
      }
    }

    const family = getFamily(meta);
    const title = typeof meta.title === 'string' ? meta.title : '';
    if (!title) continue;
    const inferred = inferTraps({ family, title });

    for (const trap of inferred) {
      issues.push({
        id: `${trap.id}-${String(inst.id)}`,
        severity: trap.severity,
        category: trap.category,
        title: `${trap.title} on ${inst.referenceDesignator}`,
        detail: `${trap.detail} (inferred from part family/title — place a verified profile for exact data)`,
        affectedInstanceIds: [inst.id],
        affectedPinIds: [],
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
// Check 9: ESP32 heuristic restricted-pin fallback (audit #241, #256)
// Fires when an ESP32 part does NOT match any verified-boards profile.
// Verified-path (checkRestrictedPinUsage) is authoritative; this covers the
// large set of generic "ESP32 dev module" library entries that have no
// verified-boards entry.
// ---------------------------------------------------------------------------

/** Patterns for restricted ESP32 pins — kept as named constants. */
const HEURISTIC_ESP32_FLASH_PINS = /^(gpio|io|d)\s*(6|7|8|9|10|11)\b/i;
const HEURISTIC_ESP32_GPIO12 = /^(gpio|io|d)\s*12\b/i;
const HEURISTIC_ESP32_GPIO5 = /^(gpio|io|d)\s*5\b/i;
const HEURISTIC_ESP32_GPIO0 = /^(gpio|io|d)\s*0\b/i;

/**
 * Return true when the part looks like an ESP32 family member but is NOT
 * an ESP8266. Uses title/family/type soft-matching — no verified-boards lookup.
 */
function isHeuristicEsp32(
  part: ComponentPart | undefined,
  instance: CircuitInstanceRow,
): boolean {
  if (!part) return false;
  const meta = getMeta(part);
  const title = (typeof meta.title === 'string' ? meta.title : '').toLowerCase();
  const family = getFamily(meta);
  const props = getProperties(instance);
  const instanceType = (
    typeof (props as Record<string, unknown> | null)?.['type'] === 'string'
      ? (props as Record<string, string>)['type']
      : ''
  ).toLowerCase();

  const combined = `${title} ${family} ${instanceType}`;
  return combined.includes('esp32') && !combined.includes('esp8266');
}

/**
 * Return true when a verified-boards alias matches this part — meaning the
 * authoritative verified path will handle it, so the heuristic must skip it.
 */
function hasVerifiedBoardMatch(part: ComponentPart): boolean {
  const meta = getMeta(part);
  const mpn = typeof meta.mpn === 'string' ? meta.mpn : '';
  const title = typeof meta.title === 'string' ? meta.title : '';
  return !!(findVerifiedBoardByAlias(mpn) ?? findVerifiedBoardByAlias(title));
}

/** Check 9: Heuristic ESP32 restricted-pin fallback. */
function checkHeuristicEsp32RestrictedPins(input: BoardAuditInput): BoardAuditIssue[] {
  const { instances, nets, parts } = input;
  const issues: BoardAuditIssue[] = [];
  const partIndex = buildPartIndex(parts);

  const breadboardInstances = instances.filter(
    (inst) => inst.breadboardX != null && inst.breadboardY != null,
  );

  for (const inst of breadboardInstances) {
    const part = inst.partId != null ? partIndex.get(inst.partId) : undefined;

    // Only heuristic ESP32 parts with no verified-board match.
    if (!isHeuristicEsp32(part, inst)) continue;
    if (part && hasVerifiedBoardMatch(part)) continue;

    const connectedPins = getConnectedPins(nets, inst.id);

    for (const pinKey of Array.from(connectedPins)) {
      const normalized = pinKey.trim().toLowerCase();

      if (HEURISTIC_ESP32_FLASH_PINS.test(normalized)) {
        issues.push({
          id: `heuristic-esp32-flash-${String(inst.id)}-${pinKey}`,
          severity: 'critical',
          category: 'safety',
          title: 'ESP32 flash GPIO wired — must never be used for I/O',
          detail:
            `GPIO6-11 on the ESP32 are connected directly to the internal SPI flash chip. ` +
            `Driving these pins from external circuitry will corrupt the flash, cause random ` +
            `crashes, or permanently brick the module. Pin "${pinKey}" on ${inst.referenceDesignator} ` +
            `must be left completely unconnected.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [pinKey],
          remediationLink: VAULT_SLUGS.ESP32_GPIO6_11_FLASH,
        });
        continue;
      }

      if (HEURISTIC_ESP32_GPIO12.test(normalized)) {
        issues.push({
          id: `heuristic-esp32-gpio12-${String(inst.id)}-${pinKey}`,
          severity: 'critical',
          category: 'safety',
          title: 'ESP32 GPIO12 must be LOW at boot or module will not start',
          detail:
            `GPIO12 (MTDI) is a flash-voltage strapping pin on the ESP32. If GPIO12 is pulled HIGH ` +
            `at power-on, the chip selects 1.8 V flash supply. On modules with 3.3 V flash (the vast ` +
            `majority of dev boards), this causes immediate hardware damage — the module will draw ` +
            `excessive current and the flash die can be destroyed. Pin "${pinKey}" on ` +
            `${inst.referenceDesignator} must be LOW or floating at boot.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [pinKey],
          remediationLink: VAULT_SLUGS.ESP32_GPIO12_STRAPPING,
        });
        continue;
      }

      if (HEURISTIC_ESP32_GPIO5.test(normalized)) {
        issues.push({
          id: `heuristic-esp32-gpio5-${String(inst.id)}-${pinKey}`,
          severity: 'warning',
          category: 'safety',
          title: 'ESP32 GPIO5 is a strapping pin — external loads can affect boot',
          detail:
            `GPIO5 controls SDIO slave timing during boot on the ESP32. An external pull-down or ` +
            `active-low driver on pin "${pinKey}" (${inst.referenceDesignator}) can alter boot ` +
            `message routing and occasionally prevent clean startup. Keep external loads weak ` +
            `(>10 kΩ) or conditional on the chip being fully booted.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [pinKey],
          remediationLink: VAULT_SLUGS.ESP32_GPIO5_STRAPPING,
        });
        continue;
      }

      if (HEURISTIC_ESP32_GPIO0.test(normalized)) {
        issues.push({
          id: `heuristic-esp32-gpio0-${String(inst.id)}-${pinKey}`,
          severity: 'warning',
          category: 'safety',
          title: 'ESP32 GPIO0 is a boot-mode strapping pin — verify pull-up at boot',
          detail:
            `GPIO0 selects boot mode: HIGH = normal boot, LOW = serial programming mode. An ` +
            `external pull-down or open-drain driver on pin "${pinKey}" (${inst.referenceDesignator}) ` +
            `that is asserted at power-on will hold the ESP32 in download mode. Ensure the pin is ` +
            `HIGH (or floating with on-board pull-up) during normal power-on.`,
          affectedInstanceIds: [inst.id],
          affectedPinIds: [pinKey],
          remediationLink: VAULT_SLUGS.ESP32_GPIO5_STRAPPING,
        });
        continue;
      }
    }
  }

  return issues;
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
  const motorDriverIssues = checkMotorDriverTraps(instances, partIndex);
  const heuristicIssues = checkHeuristicTraps(breadboardInstances, partIndex);
  // Heuristic ESP32 fallback fires AFTER the verified path so that verified
  // parts are already excluded (hasVerifiedBoardMatch check inside the fn).
  const heuristicEsp32Issues = checkHeuristicEsp32RestrictedPins(params);

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
    ...motorDriverIssues,
    ...heuristicIssues,
    ...heuristicEsp32Issues,
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
