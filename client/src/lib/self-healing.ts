// ---------------------------------------------------------------------------
// BL-0457 — Self-Healing Assistant
// ---------------------------------------------------------------------------
// SelfHealingAssistant: singleton that detects 12 circuit hazards from
// schematic data (instances, nets, architecture nodes) and proposes
// fixes with specific component additions. Each fix proposal has an
// approval gate with a configurable expiry (default 5 min).
//
// Hazard types:
//   1.  voltage_mismatch      — component Vmax < rail voltage
//   2.  missing_decoupling    — IC/MCU without nearby bypass cap
//   3.  unprotected_io        — I/O pins without series resistor or clamp
//   4.  floating_input        — input pins with no pull-up/pull-down
//   5.  reverse_polarity      — no protection diode on power input
//   6.  overcurrent           — load current exceeds pin max
//   7.  esd_exposure          — external connectors without TVS/ESD clamp
//   8.  missing_level_shifter — logic level mismatch between connected ICs
//   9.  power_overload        — total load exceeds regulator capacity
//   10. adc_reference         — ADC input exceeds reference voltage
//   11. thermal_risk          — high-dissipation component without heatsink
//   12. bus_contention        — multiple outputs driving the same net
//
// Singleton+subscribe pattern for useSyncExternalStore compatibility.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** The 12 hazard types the assistant can detect. */
export type HazardType =
  | 'voltage_mismatch'
  | 'missing_decoupling'
  | 'unprotected_io'
  | 'floating_input'
  | 'reverse_polarity'
  | 'overcurrent'
  | 'esd_exposure'
  | 'missing_level_shifter'
  | 'power_overload'
  | 'adc_reference'
  | 'thermal_risk'
  | 'bus_contention';

export type HazardSeverity = 'critical' | 'warning' | 'info';

/** A component addition proposed as part of a fix. */
export interface ProposedComponent {
  /** Component type/value (e.g. "100nF ceramic capacitor"). */
  description: string;
  /** Reference designator suggestion (e.g. "C_bypass_U1"). */
  refDes: string;
  /** Where to place it relative to the hazard source. */
  placement: string;
  /** Connections (net names or pin references). */
  connections: string[];
}

/** A fix proposal for a detected hazard. */
export interface FixProposal {
  /** Unique proposal ID. */
  id: string;
  /** Which hazard this fixes. */
  hazardId: string;
  /** Human-readable description of the fix. */
  description: string;
  /** Components to add. */
  components: ProposedComponent[];
  /** Approval state. */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Timestamp when the proposal was created (ms). */
  createdAt: number;
  /** Expiry timestamp (ms). */
  expiresAt: number;
}

/** A detected circuit hazard. */
export interface Hazard {
  /** Unique hazard ID. */
  id: string;
  /** Hazard type. */
  type: HazardType;
  /** Severity. */
  severity: HazardSeverity;
  /** Human-readable message. */
  message: string;
  /** Reference designator(s) of affected component(s). */
  affectedRefs: string[];
  /** Net name(s) involved (if applicable). */
  affectedNets: string[];
  /** Associated fix proposal (null if no fix available). */
  fix: FixProposal | null;
  /** Timestamp when detected (ms). */
  detectedAt: number;
  /** Whether the hazard has been dismissed by the user. */
  dismissed: boolean;
}

/** A simplified circuit instance for hazard analysis. */
export interface AnalysisInstance {
  /** Reference designator. */
  refDes: string;
  /** Component label/name. */
  label: string;
  /** Properties bag. */
  properties: Record<string, unknown>;
  /** Connected net names. */
  connectedNets: string[];
}

/** A net from the circuit design for hazard analysis. */
export interface AnalysisNet {
  name: string;
  netType: string;
  voltage?: string | null;
}

/** An architecture node for power budget analysis. */
export interface AnalysisNode {
  /** Node ID. */
  nodeId: string;
  /** Node type (e.g. "microcontroller", "sensor", "power_supply"). */
  nodeType: string;
  /** Node label. */
  label: string;
  /** Node data (may include power, voltage, current fields). */
  data?: Record<string, unknown>;
}

/** Configuration for the self-healing assistant. */
export interface HealingConfig {
  /** Approval gate expiry in ms. Default 300000 (5 minutes). */
  approvalExpiryMs: number;
  /** Enable/disable specific hazard checks. */
  enabledChecks: Record<HazardType, boolean>;
  /** Default max pin current in mA. Default 20. */
  defaultMaxPinCurrentMa: number;
  /** Default ADC reference voltage. Default 3.3. */
  defaultAdcRefVoltage: number;
  /** Default max regulator current in mA. Default 500. */
  defaultMaxRegulatorCurrentMa: number;
  /** Thermal dissipation threshold in watts. Default 0.5. */
  thermalThresholdWatts: number;
}

/** Snapshot for useSyncExternalStore. */
export interface HealingSnapshot {
  /** All detected hazards. */
  hazards: Hazard[];
  /** Active (non-dismissed, non-expired) hazards. */
  activeHazards: Hazard[];
  /** Pending fix proposals. */
  pendingFixes: FixProposal[];
  /** Current config. */
  config: HealingConfig;
  /** Timestamp of last scan. */
  lastScanAt: number | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const ALL_HAZARD_TYPES: HazardType[] = [
  'voltage_mismatch',
  'missing_decoupling',
  'unprotected_io',
  'floating_input',
  'reverse_polarity',
  'overcurrent',
  'esd_exposure',
  'missing_level_shifter',
  'power_overload',
  'adc_reference',
  'thermal_risk',
  'bus_contention',
];

function defaultEnabledChecks(): Record<HazardType, boolean> {
  const checks: Partial<Record<HazardType, boolean>> = {};
  for (const t of ALL_HAZARD_TYPES) {
    checks[t] = true;
  }
  return checks as Record<HazardType, boolean>;
}

const DEFAULT_CONFIG: HealingConfig = {
  approvalExpiryMs: 5 * 60 * 1000, // 5 minutes
  enabledChecks: defaultEnabledChecks(),
  defaultMaxPinCurrentMa: 20,
  defaultAdcRefVoltage: 3.3,
  defaultMaxRegulatorCurrentMa: 500,
  thermalThresholdWatts: 0.5,
};

const DEFAULT_APPROVAL_EXPIRY_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/** Reset ID counter (for testing). */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse voltage from a string like "5V", "3.3V", "12", "3V3". */
export function parseVoltage(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === 'number') {
    return v;
  }
  const s = v.trim().toUpperCase();

  // Handle "3V3" format
  const v3v3Match = /^(\d+)V(\d+)$/.exec(s);
  if (v3v3Match) {
    return parseFloat(`${v3v3Match[1]}.${v3v3Match[2]}`);
  }

  // Handle "5V", "12V", "3.3V"
  const vMatch = /^([\d.]+)\s*V?$/.exec(s);
  if (vMatch) {
    const n = parseFloat(vMatch[1]);
    return isNaN(n) ? null : n;
  }

  return null;
}

/** Parse current from a string like "20mA", "1.5A", "500". */
export function parseCurrent(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === 'number') {
    return v; // Assume mA
  }
  const s = v.trim().toUpperCase();

  // "1.5A" → 1500 mA
  const aMatch = /^([\d.]+)\s*A$/.exec(s);
  if (aMatch) {
    const n = parseFloat(aMatch[1]);
    return isNaN(n) ? null : n * 1000;
  }

  // "20mA" → 20
  const maMatch = /^([\d.]+)\s*MA$/.exec(s);
  if (maMatch) {
    const n = parseFloat(maMatch[1]);
    return isNaN(n) ? null : n;
  }

  // Plain number → mA
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Parse power from a string like "0.5W", "250mW". */
export function parsePower(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === 'number') {
    return v; // Assume watts
  }
  const s = v.trim().toUpperCase();

  const mwMatch = /^([\d.]+)\s*MW$/.exec(s);
  if (mwMatch) {
    const n = parseFloat(mwMatch[1]);
    return isNaN(n) ? null : n / 1000;
  }

  const wMatch = /^([\d.]+)\s*W?$/.exec(s);
  if (wMatch) {
    const n = parseFloat(wMatch[1]);
    return isNaN(n) ? null : n;
  }

  return null;
}

/** Check if a component looks like an IC/MCU. */
function isIcOrMcu(inst: AnalysisInstance): boolean {
  const label = inst.label.toLowerCase();
  const ref = inst.refDes.toUpperCase();
  return (
    ref.startsWith('U') ||
    ref.startsWith('IC') ||
    label.includes('mcu') ||
    label.includes('arduino') ||
    label.includes('esp') ||
    label.includes('atmega') ||
    label.includes('stm32') ||
    label.includes('pic') ||
    label.includes('microcontroller')
  );
}

/** Check if a component is a capacitor. */
function isCapacitor(inst: AnalysisInstance): boolean {
  return inst.refDes.toUpperCase().startsWith('C');
}

/** Check if a component is a connector. */
function isConnector(inst: AnalysisInstance): boolean {
  const ref = inst.refDes.toUpperCase();
  const label = inst.label.toLowerCase();
  return (
    ref.startsWith('J') ||
    ref.startsWith('CONN') ||
    ref.startsWith('P') ||
    label.includes('connector') ||
    label.includes('header') ||
    label.includes('usb') ||
    label.includes('jack') ||
    label.includes('terminal')
  );
}

/** Check if a component is a protection diode. */
function isProtectionDiode(inst: AnalysisInstance): boolean {
  const label = inst.label.toLowerCase();
  return (
    label.includes('tvs') ||
    label.includes('esd') ||
    label.includes('protection') ||
    label.includes('schottky') ||
    label.includes('clamp')
  );
}

/** Check if a component is a level shifter. */
function isLevelShifter(inst: AnalysisInstance): boolean {
  const label = inst.label.toLowerCase();
  return (
    label.includes('level shift') ||
    label.includes('level convert') ||
    label.includes('logic level') ||
    label.includes('txs0') ||
    label.includes('bss138')
  );
}

/** Check if a component is a regulator. */
function isRegulator(inst: AnalysisInstance): boolean {
  const ref = inst.refDes.toUpperCase();
  const label = inst.label.toLowerCase();
  return (
    ref.startsWith('VR') ||
    ref.startsWith('REG') ||
    label.includes('regulator') ||
    label.includes('ldo') ||
    label.includes('buck') ||
    label.includes('boost') ||
    label.includes('lm78') ||
    label.includes('ams1117')
  );
}

/** Check if a component is a resistor. */
function isResistor(inst: AnalysisInstance): boolean {
  return inst.refDes.toUpperCase().startsWith('R');
}

/** Check if two nets share any instances (i.e. are connected through some component). */
function netsShareInstance(
  netA: string,
  netB: string,
  instances: AnalysisInstance[],
): boolean {
  for (const inst of instances) {
    if (inst.connectedNets.includes(netA) && inst.connectedNets.includes(netB)) {
      return true;
    }
  }
  return false;
}

/** Get logic voltage of an IC from its properties or connected power nets. */
function getIcVoltage(
  inst: AnalysisInstance,
  nets: AnalysisNet[],
): number | null {
  // Check properties first
  const propV = parseVoltage(inst.properties.voltage as string | number | undefined);
  if (propV !== null) {
    return propV;
  }
  const propVcc = parseVoltage(inst.properties.vcc as string | number | undefined);
  if (propVcc !== null) {
    return propVcc;
  }

  // Check connected power nets
  for (const netName of inst.connectedNets) {
    const net = nets.find((n) => n.name === netName);
    if (net && net.netType === 'power' && net.voltage) {
      const v = parseVoltage(net.voltage);
      if (v !== null && v > 0) {
        return v;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hazard detectors
// ---------------------------------------------------------------------------

/** 1. Voltage mismatch — component Vmax < rail voltage. */
export function detectVoltageMismatch(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();

  for (const inst of instances) {
    const vmax = parseVoltage(inst.properties.vmax as string | number | undefined)
      ?? parseVoltage(inst.properties.maxVoltage as string | number | undefined);
    if (vmax === null) {
      continue;
    }

    for (const netName of inst.connectedNets) {
      const net = nets.find((n) => n.name === netName);
      if (!net || !net.voltage) {
        continue;
      }
      const railV = parseVoltage(net.voltage);
      if (railV !== null && railV > vmax) {
        hazards.push({
          id: nextId('hz'),
          type: 'voltage_mismatch',
          severity: 'critical',
          message: `${inst.refDes} (${inst.label}) rated for max ${vmax}V but connected to ${netName} at ${railV}V`,
          affectedRefs: [inst.refDes],
          affectedNets: [netName],
          fix: {
            id: nextId('fix'),
            hazardId: '', // Will be filled
            description: `Replace ${inst.refDes} with a variant rated for ${railV}V or higher, or add a voltage regulator`,
            components: [{
              description: `${railV}V-rated replacement for ${inst.label}`,
              refDes: `${inst.refDes}_replacement`,
              placement: `Same location as ${inst.refDes}`,
              connections: inst.connectedNets,
            }],
            status: 'pending',
            createdAt: now,
            expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
          },
          detectedAt: now,
          dismissed: false,
        });
        // Link fix to hazard
        hazards[hazards.length - 1].fix!.hazardId = hazards[hazards.length - 1].id;
      }
    }
  }

  return hazards;
}

/** 2. Missing decoupling — IC/MCU without nearby bypass cap. */
export function detectMissingDecoupling(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();
  const caps = instances.filter(isCapacitor);

  for (const inst of instances) {
    if (!isIcOrMcu(inst)) {
      continue;
    }

    // Check if there's a capacitor sharing a power net with this IC
    const powerNets = inst.connectedNets.filter((n) => {
      const net = nets.find((nn) => nn.name === n);
      return net && net.netType === 'power';
    });

    let hasDecoupling = false;
    for (const pNet of powerNets) {
      for (const cap of caps) {
        if (cap.connectedNets.includes(pNet)) {
          hasDecoupling = true;
          break;
        }
      }
      if (hasDecoupling) {
        break;
      }
    }

    if (!hasDecoupling && powerNets.length > 0) {
      const hzId = nextId('hz');
      hazards.push({
        id: hzId,
        type: 'missing_decoupling',
        severity: 'warning',
        message: `${inst.refDes} (${inst.label}) has no decoupling capacitor on its power pins`,
        affectedRefs: [inst.refDes],
        affectedNets: powerNets,
        fix: {
          id: nextId('fix'),
          hazardId: hzId,
          description: `Add a 100nF ceramic bypass capacitor close to ${inst.refDes}'s VCC/GND pins`,
          components: [{
            description: '100nF ceramic capacitor (C0402 or C0603)',
            refDes: `C_bypass_${inst.refDes}`,
            placement: `As close as possible to ${inst.refDes} VCC pin`,
            connections: [powerNets[0], 'GND'],
          }],
          status: 'pending',
          createdAt: now,
          expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
        },
        detectedAt: now,
        dismissed: false,
      });
    }
  }

  return hazards;
}

/** 3. Unprotected I/O — I/O pins without series resistor or clamp. */
export function detectUnprotectedIo(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();

  // Find nets that connect ICs to connectors (external interfaces)
  const connectors = instances.filter(isConnector);
  const ics = instances.filter(isIcOrMcu);
  const resistors = instances.filter(isResistor);
  const protectionDiodes = instances.filter(isProtectionDiode);

  for (const conn of connectors) {
    for (const connNet of conn.connectedNets) {
      // Skip power nets
      const net = nets.find((n) => n.name === connNet);
      if (net && net.netType === 'power') {
        continue;
      }

      // Check if any IC is also on this net
      const connectedIcs = ics.filter((ic) => ic.connectedNets.includes(connNet));
      if (connectedIcs.length === 0) {
        continue;
      }

      // Check if there's a series resistor or protection diode on this net
      const hasProtection =
        resistors.some((r) => r.connectedNets.includes(connNet)) ||
        protectionDiodes.some((d) => d.connectedNets.includes(connNet));

      if (!hasProtection) {
        const hzId = nextId('hz');
        hazards.push({
          id: hzId,
          type: 'unprotected_io',
          severity: 'warning',
          message: `I/O net "${connNet}" connects ${conn.refDes} to ${connectedIcs.map((ic) => ic.refDes).join(', ')} without series protection`,
          affectedRefs: [conn.refDes, ...connectedIcs.map((ic) => ic.refDes)],
          affectedNets: [connNet],
          fix: {
            id: nextId('fix'),
            hazardId: hzId,
            description: `Add a series resistor (100-470 ohm) between ${conn.refDes} and the IC`,
            components: [{
              description: '220 ohm series resistor',
              refDes: `R_protect_${connNet}`,
              placement: `In series on net ${connNet} near ${conn.refDes}`,
              connections: [connNet],
            }],
            status: 'pending',
            createdAt: now,
            expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
          },
          detectedAt: now,
          dismissed: false,
        });
      }
    }
  }

  return hazards;
}

/** 4. Floating input — input net connected to IC but no pull-up/pull-down. */
export function detectFloatingInputs(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();
  const resistors = instances.filter(isResistor);

  for (const inst of instances) {
    if (!isIcOrMcu(inst)) {
      continue;
    }

    // Check properties for input pins
    const inputPins = inst.properties.inputPins as string[] | undefined;
    if (!inputPins || !Array.isArray(inputPins)) {
      continue;
    }

    for (const inputNet of inputPins) {
      if (!inst.connectedNets.includes(inputNet)) {
        continue;
      }

      // Check if there's a pull-up/pull-down resistor to VCC or GND on this net
      const hasPull = resistors.some((r) => {
        if (!r.connectedNets.includes(inputNet)) {
          return false;
        }
        // Check if the resistor also connects to a power net
        return r.connectedNets.some((rn) => {
          const rNet = nets.find((n) => n.name === rn);
          return rNet && rNet.netType === 'power';
        });
      });

      if (!hasPull) {
        const hzId = nextId('hz');
        hazards.push({
          id: hzId,
          type: 'floating_input',
          severity: 'warning',
          message: `Input "${inputNet}" on ${inst.refDes} has no pull-up or pull-down resistor — may float`,
          affectedRefs: [inst.refDes],
          affectedNets: [inputNet],
          fix: {
            id: nextId('fix'),
            hazardId: hzId,
            description: `Add a 10K pull-up resistor from "${inputNet}" to VCC`,
            components: [{
              description: '10K ohm pull-up resistor',
              refDes: `R_pullup_${inputNet}`,
              placement: `On net ${inputNet}, connected to VCC`,
              connections: [inputNet, 'VCC'],
            }],
            status: 'pending',
            createdAt: now,
            expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
          },
          detectedAt: now,
          dismissed: false,
        });
      }
    }
  }

  return hazards;
}

/** 5. Reverse polarity — power input without protection diode. */
export function detectReversePolarity(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();
  const connectors = instances.filter(isConnector);
  const protectionDiodes = instances.filter(isProtectionDiode);

  for (const conn of connectors) {
    // Check if this connector is on a power net
    const powerNets = conn.connectedNets.filter((n) => {
      const net = nets.find((nn) => nn.name === n);
      return net && net.netType === 'power' && net.voltage;
    });

    if (powerNets.length === 0) {
      continue;
    }

    // Check if there's a protection diode on the same power net
    const hasProtection = powerNets.some((pNet) =>
      protectionDiodes.some((d) => d.connectedNets.includes(pNet)),
    );

    if (!hasProtection) {
      const hzId = nextId('hz');
      hazards.push({
        id: hzId,
        type: 'reverse_polarity',
        severity: 'warning',
        message: `Power connector ${conn.refDes} has no reverse polarity protection`,
        affectedRefs: [conn.refDes],
        affectedNets: powerNets,
        fix: {
          id: nextId('fix'),
          hazardId: hzId,
          description: `Add a Schottky diode or P-MOSFET reverse polarity protection on ${conn.refDes}'s power line`,
          components: [{
            description: 'Schottky diode (e.g. SS34) for reverse polarity protection',
            refDes: `D_protect_${conn.refDes}`,
            placement: `In series with ${conn.refDes} power output`,
            connections: powerNets,
          }],
          status: 'pending',
          createdAt: now,
          expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
        },
        detectedAt: now,
        dismissed: false,
      });
    }
  }

  return hazards;
}

/** 6. Overcurrent — load current exceeds pin max. */
export function detectOvercurrent(
  instances: AnalysisInstance[],
  _nets: AnalysisNet[],
  maxPinCurrentMa: number,
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();

  for (const inst of instances) {
    const current = parseCurrent(inst.properties.current as string | number | undefined)
      ?? parseCurrent(inst.properties.loadCurrent as string | number | undefined);

    if (current === null || current <= maxPinCurrentMa) {
      continue;
    }

    const hzId = nextId('hz');
    hazards.push({
      id: hzId,
      type: 'overcurrent',
      severity: 'critical',
      message: `${inst.refDes} (${inst.label}) draws ${current}mA, exceeding max pin current of ${maxPinCurrentMa}mA`,
      affectedRefs: [inst.refDes],
      affectedNets: [],
      fix: {
        id: nextId('fix'),
        hazardId: hzId,
        description: `Add a MOSFET driver or relay to switch ${inst.refDes} instead of driving directly from a pin`,
        components: [{
          description: 'N-channel MOSFET (e.g. IRLZ44N) or transistor driver',
          refDes: `Q_driver_${inst.refDes}`,
          placement: `Between MCU pin and ${inst.refDes}`,
          connections: inst.connectedNets,
        }],
        status: 'pending',
        createdAt: now,
        expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
      },
      detectedAt: now,
      dismissed: false,
    });
  }

  return hazards;
}

/** 7. ESD exposure — external connectors without TVS/ESD clamp. */
export function detectEsdExposure(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();
  const connectors = instances.filter(isConnector);
  const protectionDiodes = instances.filter(isProtectionDiode);

  for (const conn of connectors) {
    // Check signal nets on this connector
    const signalNets = conn.connectedNets.filter((n) => {
      const net = nets.find((nn) => nn.name === n);
      return !net || net.netType !== 'power';
    });

    if (signalNets.length === 0) {
      continue;
    }

    const hasEsd = signalNets.some((sNet) =>
      protectionDiodes.some((d) => d.connectedNets.includes(sNet)),
    );

    if (!hasEsd) {
      const hzId = nextId('hz');
      hazards.push({
        id: hzId,
        type: 'esd_exposure',
        severity: 'info',
        message: `Connector ${conn.refDes} (${conn.label}) has signal lines without ESD protection`,
        affectedRefs: [conn.refDes],
        affectedNets: signalNets,
        fix: {
          id: nextId('fix'),
          hazardId: hzId,
          description: `Add TVS diode array on ${conn.refDes}'s signal lines`,
          components: [{
            description: 'TVS diode array (e.g. PRTR5V0U2X for USB)',
            refDes: `D_esd_${conn.refDes}`,
            placement: `Close to ${conn.refDes}`,
            connections: [...signalNets, 'GND'],
          }],
          status: 'pending',
          createdAt: now,
          expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
        },
        detectedAt: now,
        dismissed: false,
      });
    }
  }

  return hazards;
}

/** 8. Missing level shifter — logic level mismatch between connected ICs. */
export function detectMissingLevelShifter(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();
  const ics = instances.filter(isIcOrMcu);
  const levelShifters = instances.filter(isLevelShifter);
  const checkedPairs = new Set<string>();

  // Find pairs of ICs connected via signal nets with different voltages
  for (const net of nets) {
    if (net.netType === 'power') {
      continue;
    }

    const connectedIcs = ics.filter((ic) => ic.connectedNets.includes(net.name));
    if (connectedIcs.length < 2) {
      continue;
    }

    for (let i = 0; i < connectedIcs.length; i++) {
      for (let j = i + 1; j < connectedIcs.length; j++) {
        const icA = connectedIcs[i];
        const icB = connectedIcs[j];
        const pairKey = [icA.refDes, icB.refDes].sort().join(':');
        if (checkedPairs.has(pairKey)) {
          continue;
        }
        checkedPairs.add(pairKey);

        const vA = getIcVoltage(icA, nets);
        const vB = getIcVoltage(icB, nets);

        if (vA === null || vB === null || vA === vB) {
          continue;
        }

        // Check if there's a level shifter on this net
        const hasShifter = levelShifters.some((ls) => ls.connectedNets.includes(net.name));

        if (!hasShifter) {
          const hzId = nextId('hz');
          hazards.push({
            id: hzId,
            type: 'missing_level_shifter',
            severity: 'warning',
            message: `${icA.refDes} (${vA}V) and ${icB.refDes} (${vB}V) share net "${net.name}" without a level shifter`,
            affectedRefs: [icA.refDes, icB.refDes],
            affectedNets: [net.name],
            fix: {
              id: nextId('fix'),
              hazardId: hzId,
              description: `Add a bidirectional level shifter between ${icA.refDes} (${vA}V) and ${icB.refDes} (${vB}V)`,
              components: [{
                description: `Bidirectional level shifter (e.g. TXS0108E) for ${vA}V ↔ ${vB}V`,
                refDes: `U_levelshift_${net.name}`,
                placement: `Between ${icA.refDes} and ${icB.refDes}`,
                connections: [net.name],
              }],
              status: 'pending',
              createdAt: now,
              expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
            },
            detectedAt: now,
            dismissed: false,
          });
        }
      }
    }
  }

  return hazards;
}

/** 9. Power overload — total load exceeds regulator capacity. */
export function detectPowerOverload(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
  maxRegulatorCurrentMa: number,
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();
  const regulators = instances.filter(isRegulator);

  for (const reg of regulators) {
    const regMaxCurrent = parseCurrent(reg.properties.maxCurrent as string | number | undefined)
      ?? maxRegulatorCurrentMa;

    // Find all instances on the same power net as regulator's output
    let totalLoadMa = 0;
    const loadRefs: string[] = [];

    for (const netName of reg.connectedNets) {
      const net = nets.find((n) => n.name === netName);
      if (!net || net.netType !== 'power') {
        continue;
      }

      for (const inst of instances) {
        if (inst.refDes === reg.refDes) {
          continue;
        }
        if (!inst.connectedNets.includes(netName)) {
          continue;
        }
        const loadCurrent = parseCurrent(inst.properties.current as string | number | undefined) ?? 0;
        if (loadCurrent > 0) {
          totalLoadMa += loadCurrent;
          loadRefs.push(inst.refDes);
        }
      }
    }

    if (totalLoadMa > regMaxCurrent) {
      const hzId = nextId('hz');
      hazards.push({
        id: hzId,
        type: 'power_overload',
        severity: 'critical',
        message: `Regulator ${reg.refDes} (${reg.label}) supplies ${totalLoadMa}mA but is rated for ${regMaxCurrent}mA`,
        affectedRefs: [reg.refDes, ...loadRefs],
        affectedNets: reg.connectedNets,
        fix: {
          id: nextId('fix'),
          hazardId: hzId,
          description: `Upgrade ${reg.refDes} to a higher-current regulator or split the load across multiple regulators`,
          components: [{
            description: `Higher-current regulator (>= ${totalLoadMa}mA)`,
            refDes: `${reg.refDes}_upgrade`,
            placement: `Replace ${reg.refDes}`,
            connections: reg.connectedNets,
          }],
          status: 'pending',
          createdAt: now,
          expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
        },
        detectedAt: now,
        dismissed: false,
      });
    }
  }

  return hazards;
}

/** 10. ADC reference — ADC input exceeds reference voltage. */
export function detectAdcReference(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
  adcRefVoltage: number,
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();

  for (const inst of instances) {
    if (!isIcOrMcu(inst)) {
      continue;
    }

    const adcPins = inst.properties.adcPins as string[] | undefined;
    if (!adcPins || !Array.isArray(adcPins)) {
      continue;
    }

    for (const adcNet of adcPins) {
      if (!inst.connectedNets.includes(adcNet)) {
        continue;
      }

      // Check if the signal on this net could exceed ADC ref
      const net = nets.find((n) => n.name === adcNet);
      const netV = net ? parseVoltage(net.voltage) : null;

      if (netV !== null && netV > adcRefVoltage) {
        const hzId = nextId('hz');
        hazards.push({
          id: hzId,
          type: 'adc_reference',
          severity: 'critical',
          message: `ADC input "${adcNet}" on ${inst.refDes} is at ${netV}V but ADC reference is ${adcRefVoltage}V`,
          affectedRefs: [inst.refDes],
          affectedNets: [adcNet],
          fix: {
            id: nextId('fix'),
            hazardId: hzId,
            description: `Add a voltage divider to scale "${adcNet}" below ${adcRefVoltage}V`,
            components: [
              {
                description: `Resistor divider (upper) — reduces ${netV}V to below ${adcRefVoltage}V`,
                refDes: `R_div_upper_${adcNet}`,
                placement: `On net ${adcNet}, before ADC pin`,
                connections: [adcNet],
              },
              {
                description: 'Resistor divider (lower) — to GND',
                refDes: `R_div_lower_${adcNet}`,
                placement: 'From divider midpoint to GND',
                connections: [adcNet, 'GND'],
              },
            ],
            status: 'pending',
            createdAt: now,
            expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
          },
          detectedAt: now,
          dismissed: false,
        });
      }
    }
  }

  return hazards;
}

/** 11. Thermal risk — high-dissipation component without heatsink mention. */
export function detectThermalRisk(
  instances: AnalysisInstance[],
  _nets: AnalysisNet[],
  thresholdWatts: number,
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();

  for (const inst of instances) {
    const power = parsePower(inst.properties.powerDissipation as string | number | undefined)
      ?? parsePower(inst.properties.power as string | number | undefined);

    if (power === null || power <= thresholdWatts) {
      continue;
    }

    const hasHeatsink = !!(
      inst.properties.heatsink ||
      (typeof inst.label === 'string' && inst.label.toLowerCase().includes('heatsink'))
    );

    if (!hasHeatsink) {
      const hzId = nextId('hz');
      hazards.push({
        id: hzId,
        type: 'thermal_risk',
        severity: 'warning',
        message: `${inst.refDes} (${inst.label}) dissipates ${power}W (threshold: ${thresholdWatts}W) with no heatsink`,
        affectedRefs: [inst.refDes],
        affectedNets: [],
        fix: {
          id: nextId('fix'),
          hazardId: hzId,
          description: `Add a heatsink to ${inst.refDes} or choose a component with lower power dissipation`,
          components: [{
            description: `Heatsink for ${inst.label} (thermal pad or clip-on)`,
            refDes: `HS_${inst.refDes}`,
            placement: `Attached to ${inst.refDes}`,
            connections: [],
          }],
          status: 'pending',
          createdAt: now,
          expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
        },
        detectedAt: now,
        dismissed: false,
      });
    }
  }

  return hazards;
}

/** 12. Bus contention — multiple outputs driving the same net. */
export function detectBusContention(
  instances: AnalysisInstance[],
  nets: AnalysisNet[],
): Hazard[] {
  const hazards: Hazard[] = [];
  const now = Date.now();

  for (const net of nets) {
    if (net.netType === 'power') {
      continue;
    }

    // Find instances with output pins on this net
    const outputDrivers: AnalysisInstance[] = [];
    for (const inst of instances) {
      if (!inst.connectedNets.includes(net.name)) {
        continue;
      }
      const outputPins = inst.properties.outputPins as string[] | undefined;
      if (outputPins && Array.isArray(outputPins) && outputPins.includes(net.name)) {
        outputDrivers.push(inst);
      }
    }

    if (outputDrivers.length > 1) {
      const hzId = nextId('hz');
      hazards.push({
        id: hzId,
        type: 'bus_contention',
        severity: 'critical',
        message: `Net "${net.name}" is driven by multiple outputs: ${outputDrivers.map((d) => d.refDes).join(', ')}`,
        affectedRefs: outputDrivers.map((d) => d.refDes),
        affectedNets: [net.name],
        fix: {
          id: nextId('fix'),
          hazardId: hzId,
          description: `Add bus arbitration or use tri-state buffers on net "${net.name}"`,
          components: [{
            description: 'Tri-state buffer (e.g. 74HC245)',
            refDes: `U_buffer_${net.name}`,
            placement: `On net ${net.name}`,
            connections: [net.name],
          }],
          status: 'pending',
          createdAt: now,
          expiresAt: now + DEFAULT_APPROVAL_EXPIRY_MS,
        },
        detectedAt: now,
        dismissed: false,
      });
    }
  }

  return hazards;
}

// ---------------------------------------------------------------------------
// SelfHealingAssistant (singleton + subscribe)
// ---------------------------------------------------------------------------

export class SelfHealingAssistant {
  private listeners: Set<Listener> = new Set();
  private hazards: Hazard[] = [];
  private config: HealingConfig = { ...DEFAULT_CONFIG, enabledChecks: defaultEnabledChecks() };
  private lastScanAt: number | null = null;

  // ── subscribe / getSnapshot ────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): HealingSnapshot {
    this.expirePendingFixes();
    const activeHazards = this.hazards.filter((h) => !h.dismissed);
    const pendingFixes = activeHazards
      .map((h) => h.fix)
      .filter((f): f is FixProposal => f !== null && f.status === 'pending');

    return {
      hazards: [...this.hazards],
      activeHazards,
      pendingFixes,
      config: { ...this.config, enabledChecks: { ...this.config.enabledChecks } },
      lastScanAt: this.lastScanAt,
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      fn();
    });
  }

  // ── Configuration ──────────────────────────────────────────────────

  updateConfig(partial: Partial<HealingConfig>): void {
    if (partial.enabledChecks) {
      this.config.enabledChecks = { ...this.config.enabledChecks, ...partial.enabledChecks };
    }
    const { enabledChecks: _, ...rest } = partial;
    this.config = { ...this.config, ...rest, enabledChecks: this.config.enabledChecks };
    this.notify();
  }

  getConfig(): HealingConfig {
    return { ...this.config, enabledChecks: { ...this.config.enabledChecks } };
  }

  // ── Scanning ───────────────────────────────────────────────────────

  /**
   * Run all enabled hazard checks against the given circuit data.
   * Returns all detected hazards.
   */
  scan(
    instances: AnalysisInstance[],
    nets: AnalysisNet[],
  ): Hazard[] {
    const checks = this.config.enabledChecks;
    const allHazards: Hazard[] = [];

    if (checks.voltage_mismatch) {
      allHazards.push(...detectVoltageMismatch(instances, nets));
    }
    if (checks.missing_decoupling) {
      allHazards.push(...detectMissingDecoupling(instances, nets));
    }
    if (checks.unprotected_io) {
      allHazards.push(...detectUnprotectedIo(instances, nets));
    }
    if (checks.floating_input) {
      allHazards.push(...detectFloatingInputs(instances, nets));
    }
    if (checks.reverse_polarity) {
      allHazards.push(...detectReversePolarity(instances, nets));
    }
    if (checks.overcurrent) {
      allHazards.push(...detectOvercurrent(instances, nets, this.config.defaultMaxPinCurrentMa));
    }
    if (checks.esd_exposure) {
      allHazards.push(...detectEsdExposure(instances, nets));
    }
    if (checks.missing_level_shifter) {
      allHazards.push(...detectMissingLevelShifter(instances, nets));
    }
    if (checks.power_overload) {
      allHazards.push(...detectPowerOverload(instances, nets, this.config.defaultMaxRegulatorCurrentMa));
    }
    if (checks.adc_reference) {
      allHazards.push(...detectAdcReference(instances, nets, this.config.defaultAdcRefVoltage));
    }
    if (checks.thermal_risk) {
      allHazards.push(...detectThermalRisk(instances, nets, this.config.thermalThresholdWatts));
    }
    if (checks.bus_contention) {
      allHazards.push(...detectBusContention(instances, nets));
    }

    this.hazards = allHazards;
    this.lastScanAt = Date.now();
    this.notify();
    return [...allHazards];
  }

  // ── Approval gates ─────────────────────────────────────────────────

  /**
   * Approve a fix proposal by ID.
   */
  approveFix(fixId: string): boolean {
    for (const hz of this.hazards) {
      if (hz.fix && hz.fix.id === fixId && hz.fix.status === 'pending') {
        if (Date.now() > hz.fix.expiresAt) {
          hz.fix.status = 'expired';
          this.notify();
          return false;
        }
        hz.fix.status = 'approved';
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Reject a fix proposal by ID.
   */
  rejectFix(fixId: string): boolean {
    for (const hz of this.hazards) {
      if (hz.fix && hz.fix.id === fixId && hz.fix.status === 'pending') {
        hz.fix.status = 'rejected';
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Dismiss a hazard (mark as acknowledged / not actionable).
   */
  dismissHazard(hazardId: string): boolean {
    const hz = this.hazards.find((h) => h.id === hazardId);
    if (hz && !hz.dismissed) {
      hz.dismissed = true;
      this.notify();
      return true;
    }
    return false;
  }

  /**
   * Expire pending fixes that have passed their expiry time.
   */
  expirePendingFixes(): number {
    const now = Date.now();
    let expired = 0;
    for (const hz of this.hazards) {
      if (hz.fix && hz.fix.status === 'pending' && now > hz.fix.expiresAt) {
        hz.fix.status = 'expired';
        expired++;
      }
    }
    if (expired > 0) {
      this.notify();
    }
    return expired;
  }

  // ── Queries ────────────────────────────────────────────────────────

  /**
   * Get hazards filtered by type.
   */
  getHazardsByType(type: HazardType): Hazard[] {
    return this.hazards.filter((h) => h.type === type);
  }

  /**
   * Get hazards filtered by severity.
   */
  getHazardsBySeverity(severity: HazardSeverity): Hazard[] {
    return this.hazards.filter((h) => h.severity === severity);
  }

  /**
   * Get hazards affecting a specific reference designator.
   */
  getHazardsForRef(refDes: string): Hazard[] {
    return this.hazards.filter((h) => h.affectedRefs.includes(refDes));
  }

  /**
   * Get all approved fixes.
   */
  getApprovedFixes(): FixProposal[] {
    return this.hazards
      .map((h) => h.fix)
      .filter((f): f is FixProposal => f !== null && f.status === 'approved');
  }

  // ── Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.hazards = [];
    this.config = { ...DEFAULT_CONFIG, enabledChecks: defaultEnabledChecks() };
    this.lastScanAt = null;
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let instance: SelfHealingAssistant | null = null;

/** Get the singleton SelfHealingAssistant. */
export function getSelfHealingAssistant(): SelfHealingAssistant {
  if (!instance) {
    instance = new SelfHealingAssistant();
  }
  return instance;
}

/** Reset the singleton (for testing). */
export function resetSelfHealingAssistant(): void {
  instance = null;
}
