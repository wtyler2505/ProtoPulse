/**
 * Self-Healing Assistant — hazard detectors (part 1 of 2).
 * Split from self-healing.ts. Contains:
 *   detectVoltageMismatch, detectMissingDecoupling, detectUnprotectedIo,
 *   detectFloatingInputs, detectReversePolarity, detectOvercurrent.
 */

import { DEFAULT_APPROVAL_EXPIRY_MS } from './config';
import { nextId } from './id';
import {
  getIcVoltage,
  isCapacitor,
  isConnector,
  isIcOrMcu,
  isProtectionDiode,
  isResistor,
  parseCurrent,
  parseVoltage,
} from './parsers';
import type { AnalysisInstance, AnalysisNet, Hazard } from './types';

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

