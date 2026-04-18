/**
 * Breadboard Pre-flight Safety Scanner — cross-component interaction checks.
 *
 * Unlike the per-component board audit, the preflight scanner looks at the
 * whole board holistically: voltage rail mismatches, missing decoupling,
 * power budget, ADC2/WiFi conflicts, and unconnected required pins.
 *
 * Scans ALL placed instances — both on-board (breadboardX/Y) and on-bench
 * (benchX/Y).  Unplaced instances (both null) are excluded.
 *
 * Pure functions only — no side effects, no React, no DOM.
 */

import type { Connector, PartMeta } from '@shared/component-types';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import { VAULT_SLUGS } from '@shared/vault-citation';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PreflightStatus = 'pass' | 'warn' | 'fail';

export interface PreflightCheck {
  id: string;
  label: string;
  status: PreflightStatus;
  detail: string;
  affectedInstanceIds: number[];
  affectedPinIds: string[];
  /**
   * Vault-note slug pointing to the authoritative rule explanation.
   * Wave 2 audit #270, #276, #292 — preflight checks now cite Ars Contexta
   * notes so the UI can render clickable source chips. Optional for backward
   * compatibility with consumers that only read label/detail.
   */
  remediationLink?: string;
}

export interface PreflightResult {
  overallStatus: PreflightStatus;
  checks: PreflightCheck[];
}

export interface PreflightInput {
  instances: CircuitInstanceRow[];
  wires: unknown[];
  nets: CircuitNetRow[];
  parts: ComponentPart[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type LooseMeta = Partial<PartMeta> & Record<string, unknown>;

function getMeta(part: ComponentPart): LooseMeta {
  return (part.meta as LooseMeta | null) ?? {};
}

function getFamily(meta: LooseMeta): string {
  return (typeof meta.family === 'string' ? meta.family : '').toLowerCase();
}

function getTitle(meta: LooseMeta): string {
  return (typeof meta.title === 'string' ? meta.title : '').toLowerCase();
}

function getOperatingVoltage(meta: LooseMeta): number | null {
  if (typeof meta.operatingVoltage === 'number') {
    return meta.operatingVoltage;
  }
  return null;
}

function getCurrentDraw(meta: LooseMeta): number | null {
  if (typeof meta.currentDraw === 'number') {
    return meta.currentDraw;
  }
  return null;
}

function getConnectors(part: ComponentPart): Connector[] {
  return (part.connectors ?? []) as Connector[];
}

function isIcOrMcu(family: string): boolean {
  return family === 'ic' || family === 'mcu' || family === 'microcontroller';
}

function isPassive(family: string): boolean {
  return (
    family === 'resistor' ||
    family === 'capacitor' ||
    family === 'inductor' ||
    family === 'diode' ||
    family === 'led' ||
    family === 'connector' ||
    family === 'crystal' ||
    family === 'fuse'
  );
}

function isPowerOrGroundPin(name: string): boolean {
  const lower = name.toLowerCase();
  return /\b(vcc|vdd|vin|vbat|5v|3v3|3\.3v|avcc|vref|gnd|ground|vss|agnd|pgnd)\b/.test(lower);
}

function isPowerNet(net: CircuitNetRow): boolean {
  const netType = ((net.netType as string) ?? '').toLowerCase();
  return netType === 'power';
}

function buildPartIndex(parts: ComponentPart[]): Map<number, ComponentPart> {
  const map = new Map<number, ComponentPart>();
  for (const part of parts) {
    map.set(part.id, part);
  }
  return map;
}

/** Is this instance placed anywhere (on-board or on-bench)? */
function isPlaced(inst: CircuitInstanceRow): boolean {
  const hasBoard = inst.breadboardX != null && inst.breadboardY != null;
  const hasBench = (inst as Record<string, unknown>).benchX != null && (inst as Record<string, unknown>).benchY != null;
  return hasBoard || hasBench;
}

interface NetSegmentJSON {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

function parseNetSegments(net: CircuitNetRow): NetSegmentJSON[] {
  return (net.segments ?? []) as NetSegmentJSON[];
}

/** Build a set of "instanceId:pinId" strings for all connected pins. */
function buildConnectedPinSet(nets: CircuitNetRow[]): Set<string> {
  const connected = new Set<string>();
  for (const net of nets) {
    for (const seg of parseNetSegments(net)) {
      connected.add(`${String(seg.fromInstanceId)}:${seg.fromPin}`);
      connected.add(`${String(seg.toInstanceId)}:${seg.toPin}`);
    }
  }
  return connected;
}

/** Get instance IDs connected to a power net. */
function getInstancesOnPowerNet(net: CircuitNetRow): number[] {
  const ids = new Set<number>();
  for (const seg of parseNetSegments(net)) {
    ids.add(seg.fromInstanceId);
    ids.add(seg.toInstanceId);
  }
  return Array.from(ids);
}

/** Check if any capacitor is connected on the same power net as the IC. */
function hasDecouplingCapOnNet(
  instanceId: number,
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
  instancePartMap: Map<number, ComponentPart>,
): boolean {
  for (const net of nets) {
    const netType = ((net.netType as string) ?? '').toLowerCase();
    const netName = ((net.name as string) ?? '').toLowerCase();
    const isPwr =
      netType === 'power' || netType === 'ground' || /\b(vcc|vdd|gnd|ground|5v|3v3)\b/.test(netName);
    if (!isPwr) {
      continue;
    }

    const segments = parseNetSegments(net);
    const instOnNet = segments.some((s) => s.fromInstanceId === instanceId || s.toInstanceId === instanceId);
    if (!instOnNet) {
      continue;
    }

    // Check if any capacitor is also on this net
    for (const seg of segments) {
      const otherId = seg.fromInstanceId === instanceId ? seg.toInstanceId : seg.fromInstanceId;
      if (otherId === instanceId) {
        continue;
      }
      const otherPart = instancePartMap.get(otherId);
      if (otherPart) {
        const otherFamily = getFamily(getMeta(otherPart));
        if (otherFamily === 'capacitor') {
          return true;
        }
      }
    }
  }
  return false;
}

// ESP32 ADC2 GPIO pin numbers
const ESP32_ADC2_GPIOS = [0, 2, 4, 12, 13, 14, 15, 25, 26, 27];

function isEsp32Adc2Pin(pinIdOrName: string): boolean {
  const num = parseInt(pinIdOrName.replace(/\D/g, ''), 10);
  if (isNaN(num)) {
    return false;
  }
  return ESP32_ADC2_GPIOS.includes(num);
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkVoltageMismatch(
  placedInstances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
  instancePartMap: Map<number, ComponentPart>,
): PreflightCheck {
  const check: PreflightCheck = {
    id: 'voltage-mismatch',
    label: 'Voltage Rail Compatibility',
    status: 'pass',
    detail: 'All parts on shared power nets have compatible operating voltages.',
    affectedInstanceIds: [],
    affectedPinIds: [],
  };

  const powerNets = nets.filter(isPowerNet);
  for (const net of powerNets) {
    const instIds = getInstancesOnPowerNet(net);
    const voltages: Array<{ instanceId: number; voltage: number }> = [];

    for (const id of instIds) {
      const part = instancePartMap.get(id);
      if (!part) {
        continue;
      }
      const meta = getMeta(part);
      const v = getOperatingVoltage(meta);
      if (v !== null) {
        voltages.push({ instanceId: id, voltage: v });
      }
    }

    if (voltages.length < 2) {
      continue;
    }

    const minV = Math.min(...voltages.map((v) => v.voltage));
    const maxV = Math.max(...voltages.map((v) => v.voltage));

    // Mismatch if the spread exceeds 0.5V (e.g. 3.3V vs 5V)
    if (maxV - minV > 0.5) {
      check.status = 'fail';
      check.detail = `Voltage mismatch on power net "${String(net.name)}": ${String(minV)} V and ${String(maxV)} V parts share the same rail.`;
      check.affectedInstanceIds = voltages.map((v) => v.instanceId);
      return check;
    }
  }

  return check;
}

function checkMissingDecoupling(
  placedInstances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
  instancePartMap: Map<number, ComponentPart>,
): PreflightCheck {
  const check: PreflightCheck = {
    id: 'missing-decoupling',
    label: 'Decoupling Capacitors',
    status: 'pass',
    detail: 'All ICs have decoupling capacitors on their power pins.',
    affectedInstanceIds: [],
    affectedPinIds: [],
  };

  const missingIds: number[] = [];

  for (const inst of placedInstances) {
    const part = instancePartMap.get(inst.id);
    if (!part) {
      continue;
    }
    const family = getFamily(getMeta(part));
    if (!isIcOrMcu(family)) {
      continue;
    }

    if (!hasDecouplingCapOnNet(inst.id, nets, partIndex, instancePartMap)) {
      missingIds.push(inst.id);
    }
  }

  if (missingIds.length > 0) {
    check.status = 'warn';
    check.detail = `${String(missingIds.length)} IC(s) without a decoupling capacitor on their power rail. Add 100 nF ceramic caps near each IC's VCC/GND pins.`;
    check.affectedInstanceIds = missingIds;
  }

  return check;
}

function checkPowerBudget(
  placedInstances: CircuitInstanceRow[],
  partIndex: Map<number, ComponentPart>,
  instancePartMap: Map<number, ComponentPart>,
): PreflightCheck {
  const USB_BUDGET_MA = 500;
  const WARNING_THRESHOLD_MA = 400;

  const check: PreflightCheck = {
    id: 'power-budget',
    label: 'USB Power Budget',
    status: 'pass',
    detail: 'Total current draw is within the USB 500 mA budget.',
    affectedInstanceIds: [],
    affectedPinIds: [],
  };

  let totalDraw = 0;
  let hasDrawData = false;

  for (const inst of placedInstances) {
    const part = instancePartMap.get(inst.id);
    if (!part) {
      continue;
    }
    const meta = getMeta(part);
    const draw = getCurrentDraw(meta);
    if (draw !== null) {
      totalDraw += draw;
      hasDrawData = true;
    }
  }

  if (!hasDrawData) {
    return check;
  }

  if (totalDraw > USB_BUDGET_MA) {
    check.status = 'fail';
    check.detail = `Estimated total current draw is ${String(Math.round(totalDraw))} mA — exceeds the USB 500 mA budget. Use an external power supply.`;
    check.affectedInstanceIds = placedInstances.map((i) => i.id);
  } else if (totalDraw > WARNING_THRESHOLD_MA) {
    check.status = 'warn';
    check.detail = `Estimated total current draw is ${String(Math.round(totalDraw))} mA — approaching the USB 500 mA limit. Consider an external supply.`;
    check.affectedInstanceIds = placedInstances.map((i) => i.id);
  }

  return check;
}

function checkAdc2WifiConflict(
  placedInstances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
  instancePartMap: Map<number, ComponentPart>,
): PreflightCheck {
  const check: PreflightCheck = {
    id: 'adc2-wifi-conflict',
    label: 'ESP32 ADC2/WiFi Conflict',
    status: 'pass',
    detail: 'No ESP32 ADC2 pins are used for analog readings.',
    affectedInstanceIds: [],
    affectedPinIds: [],
  };

  // Find ESP32 instances
  const esp32Instances: CircuitInstanceRow[] = [];
  for (const inst of placedInstances) {
    const part = instancePartMap.get(inst.id);
    if (!part) {
      continue;
    }
    const title = getTitle(getMeta(part));
    if (title.includes('esp32')) {
      esp32Instances.push(inst);
    }
  }

  if (esp32Instances.length === 0) {
    return check;
  }

  // Check if any ADC2 pins are connected to signal nets
  const affectedPins: string[] = [];
  const affectedInstIds: number[] = [];

  for (const esp of esp32Instances) {
    for (const net of nets) {
      const segments = parseNetSegments(net);
      for (const seg of segments) {
        if (seg.fromInstanceId === esp.id && isEsp32Adc2Pin(seg.fromPin)) {
          affectedPins.push(seg.fromPin);
          if (!affectedInstIds.includes(esp.id)) {
            affectedInstIds.push(esp.id);
          }
        }
        if (seg.toInstanceId === esp.id && isEsp32Adc2Pin(seg.toPin)) {
          affectedPins.push(seg.toPin);
          if (!affectedInstIds.includes(esp.id)) {
            affectedInstIds.push(esp.id);
          }
        }
      }
    }
  }

  if (affectedPins.length > 0) {
    check.status = 'warn';
    check.detail = `ESP32 ADC2 pin(s) [${affectedPins.join(', ')}] are wired to signal nets. ADC2 is unavailable when WiFi is active — use ADC1 channels instead.`;
    check.affectedInstanceIds = affectedInstIds;
    check.affectedPinIds = affectedPins;
  }

  return check;
}

function checkUnconnectedRequiredPins(
  placedInstances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partIndex: Map<number, ComponentPart>,
  instancePartMap: Map<number, ComponentPart>,
): PreflightCheck {
  const check: PreflightCheck = {
    id: 'unconnected-required-pins',
    label: 'Required Pin Connections',
    status: 'pass',
    detail: 'All required power and ground pins are connected.',
    affectedInstanceIds: [],
    affectedPinIds: [],
  };

  const connectedPins = buildConnectedPinSet(nets);
  const missingPins: string[] = [];
  const missingInstIds: number[] = [];

  for (const inst of placedInstances) {
    const part = instancePartMap.get(inst.id);
    if (!part) {
      continue;
    }
    const family = getFamily(getMeta(part));
    if (isPassive(family)) {
      continue;
    }

    const connectors = getConnectors(part);
    for (const conn of connectors) {
      const connName = typeof conn.name === 'string' ? conn.name : '';
      const connId = typeof conn.id === 'string' ? conn.id : '';
      if (!isPowerOrGroundPin(connName) && !isPowerOrGroundPin(connId)) {
        continue;
      }

      const key = `${String(inst.id)}:${connId}`;
      if (!connectedPins.has(key)) {
        missingPins.push(`${inst.referenceDesignator}:${connName || connId}`);
        if (!missingInstIds.includes(inst.id)) {
          missingInstIds.push(inst.id);
        }
      }
    }
  }

  if (missingPins.length > 0) {
    check.status = 'warn';
    check.detail = `Unconnected power/ground pins: ${missingPins.join(', ')}. These must be wired for the IC to function.`;
    check.affectedInstanceIds = missingInstIds;
    check.affectedPinIds = missingPins;
  }

  return check;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a pre-flight safety scan across all placed instances (on-board + on-bench).
 *
 * Returns a checklist of 5 checks, each with pass/warn/fail status.
 * The overall status is the worst of any individual check.
 */
export function runPreflight(input: PreflightInput): PreflightResult {
  const partIndex = buildPartIndex(input.parts);

  // Include ALL placed instances (on-board or on-bench)
  const placedInstances = input.instances.filter(isPlaced);

  // Build instanceId → part lookup
  const instancePartMap = new Map<number, ComponentPart>();
  for (const inst of placedInstances) {
    if (inst.partId != null) {
      const part = partIndex.get(inst.partId);
      if (part) {
        instancePartMap.set(inst.id, part);
      }
    }
  }

  const checks: PreflightCheck[] = [
    checkVoltageMismatch(placedInstances, input.nets, partIndex, instancePartMap),
    checkMissingDecoupling(placedInstances, input.nets, partIndex, instancePartMap),
    checkPowerBudget(placedInstances, partIndex, instancePartMap),
    checkAdc2WifiConflict(placedInstances, input.nets, partIndex, instancePartMap),
    checkUnconnectedRequiredPins(placedInstances, input.nets, partIndex, instancePartMap),
  ];

  // Overall status = worst of any check
  let overallStatus: PreflightStatus = 'pass';
  for (const check of checks) {
    if (check.status === 'fail') {
      overallStatus = 'fail';
      break;
    }
    if (check.status === 'warn') {
      overallStatus = 'warn';
    }
  }

  return { overallStatus, checks };
}
