/**
 * Self-Healing Assistant — unit parsers and component classifiers.
 * Split from self-healing.ts.
 */

import type { AnalysisInstance, AnalysisNet } from './types';

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
export function isIcOrMcu(inst: AnalysisInstance): boolean {
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
export function isCapacitor(inst: AnalysisInstance): boolean {
  return inst.refDes.toUpperCase().startsWith('C');
}

/** Check if a component is a connector. */
export function isConnector(inst: AnalysisInstance): boolean {
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
export function isProtectionDiode(inst: AnalysisInstance): boolean {
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
export function isLevelShifter(inst: AnalysisInstance): boolean {
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
export function isRegulator(inst: AnalysisInstance): boolean {
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
export function isResistor(inst: AnalysisInstance): boolean {
  return inst.refDes.toUpperCase().startsWith('R');
}

/** Check if two nets share any instances (i.e. are connected through some component). */
export function netsShareInstance(
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
export function getIcVoltage(
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
