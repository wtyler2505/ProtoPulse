/**
 * Self-Healing Assistant — hazard detectors (part 2 of 2).
 * Split from self-healing.ts. Contains:
 *   detectEsdExposure, detectMissingLevelShifter, detectPowerOverload,
 *   detectAdcReference, detectThermalRisk, detectBusContention.
 */

import { DEFAULT_APPROVAL_EXPIRY_MS } from './config';
import { nextId } from './id';
import {
  getIcVoltage,
  isConnector,
  isIcOrMcu,
  isLevelShifter,
  isRegulator,
  netsShareInstance,
  parseCurrent,
  parsePower,
  parseVoltage,
} from './parsers';
import type { AnalysisInstance, AnalysisNet, Hazard } from './types';

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

