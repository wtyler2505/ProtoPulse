/**
 * Node-classification heuristics. Static pattern tables + predicates used by
 * every prediction rule to recognize common electronics components.
 */

import type { PredictionNode } from './types';

// ---------------------------------------------------------------------------
// Pattern tables
// ---------------------------------------------------------------------------

export const MCU_PATTERNS = [
  'mcu', 'microcontroller', 'arduino', 'esp32', 'esp8266', 'stm32',
  'atmega', 'attiny', 'processor', 'controller', 'pic', 'nrf52',
];
export const SENSOR_PATTERNS = ['sensor', 'thermistor', 'photodiode', 'accelerometer', 'gyroscope', 'humidity', 'pressure', 'temperature'];
export const MOTOR_PATTERNS = ['motor', 'stepper', 'servo', 'actuator', 'dc-motor', 'bldc'];
export const RELAY_PATTERNS = ['relay', 'solenoid', 'contactor'];
export const REGULATOR_PATTERNS = ['regulator', 'vreg', 'ldo', 'buck', 'boost', 'switching-regulator'];
export const CAPACITOR_PATTERNS = ['capacitor', 'cap', 'decoupling', 'bypass', '100nf', '10uf'];
export const CRYSTAL_PATTERNS = ['crystal', 'oscillator', 'xtal', 'resonator', 'clock'];
export const DIODE_PATTERNS = ['diode', 'flyback', 'schottky', 'zener', 'tvs', 'rectifier'];
export const RESISTOR_PATTERNS = ['resistor', 'pull-up', 'pull-down', 'pullup', 'pulldown', 'current-limit'];
export const LED_PATTERNS = ['led', 'light-emitting', 'indicator', 'neopixel', 'ws2812'];
export const H_BRIDGE_PATTERNS = ['h-bridge', 'hbridge', 'motor-driver', 'l298', 'l293', 'drv8825', 'a4988'];
export const USB_PATTERNS = ['usb', 'usb-c', 'usb-a', 'usb-b', 'micro-usb'];
export const FUSE_PATTERNS = ['fuse', 'polyfuse', 'ptc', 'circuit-breaker'];
export const VARISTOR_PATTERNS = ['varistor', 'mov', 'surge'];
export const BATTERY_PATTERNS = ['battery', 'lipo', 'li-ion', 'cell', 'coin-cell'];
export const OPTOCOUPLER_PATTERNS = ['optocoupler', 'opto-isolator', 'isolation', 'isolator'];
export const INDUCTOR_PATTERNS = ['inductor', 'choke', 'ferrite', 'coil'];
export const CONNECTOR_PATTERNS = ['connector', 'header', 'terminal', 'jack', 'plug', 'socket'];
export const ADC_PATTERNS = ['adc', 'analog-to-digital', 'analog_to_digital'];
export const FILTER_PATTERNS = ['filter', 'rc-filter', 'lc-filter', 'lowpass', 'highpass', 'bandpass'];
export const TRANSISTOR_PATTERNS = ['transistor', 'mosfet', 'bjt', 'fet', 'igbt'];
export const TEST_POINT_PATTERNS = ['test-point', 'testpoint', 'tp', 'test_point'];
export const MOUNTING_PATTERNS = ['mounting', 'mount-hole', 'standoff', 'mounting-hole'];
export const POWER_INDICATOR_PATTERNS = ['power-led', 'power-indicator', 'pwr-led'];
export const HEATSINK_PATTERNS = ['heatsink', 'heat-sink', 'thermal-pad', 'thermal'];
export const MAINS_PATTERNS = ['mains', 'ac-input', '120v', '240v', '230v', 'line-voltage'];
export const HIGH_VOLTAGE_PATTERNS = ['high-voltage', 'hv', '48v', '60v', '100v'];
export const GROUND_PATTERNS = ['ground', 'gnd', 'earth'];

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------

export function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

export function nodeMatches(node: PredictionNode, patterns: string[]): boolean {
  return matchesAny(node.type, patterns) || matchesAny(node.label, patterns) ||
    (node.data?.description ? matchesAny(node.data.description, patterns) : false);
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function isMcu(n: PredictionNode): boolean { return nodeMatches(n, MCU_PATTERNS); }
export function isSensor(n: PredictionNode): boolean { return nodeMatches(n, SENSOR_PATTERNS); }
export function isMotor(n: PredictionNode): boolean { return nodeMatches(n, MOTOR_PATTERNS); }
export function isRelay(n: PredictionNode): boolean { return nodeMatches(n, RELAY_PATTERNS); }
export function isRegulator(n: PredictionNode): boolean { return nodeMatches(n, REGULATOR_PATTERNS); }
export function isCapacitor(n: PredictionNode): boolean { return nodeMatches(n, CAPACITOR_PATTERNS); }
export function isCrystal(n: PredictionNode): boolean { return nodeMatches(n, CRYSTAL_PATTERNS); }
export function isDiode(n: PredictionNode): boolean { return nodeMatches(n, DIODE_PATTERNS); }
export function isResistor(n: PredictionNode): boolean { return nodeMatches(n, RESISTOR_PATTERNS); }
export function isLed(n: PredictionNode): boolean { return nodeMatches(n, LED_PATTERNS); }
export function isHBridge(n: PredictionNode): boolean { return nodeMatches(n, H_BRIDGE_PATTERNS); }
export function isUsb(n: PredictionNode): boolean {
  if (!nodeMatches(n, USB_PATTERNS)) { return false; }
  // Exclude nodes that are ESD/TVS protection ICs (e.g. "USBLC6 ESD Protection")
  if (nodeMatches(n, ['tvs', 'esd', 'protection', 'clamp', 'suppressor'])) { return false; }
  return true;
}
export function isFuse(n: PredictionNode): boolean { return nodeMatches(n, FUSE_PATTERNS); }
export function isBattery(n: PredictionNode): boolean { return nodeMatches(n, BATTERY_PATTERNS); }
export function isOptocoupler(n: PredictionNode): boolean { return nodeMatches(n, OPTOCOUPLER_PATTERNS); }
export function isInductor(n: PredictionNode): boolean { return nodeMatches(n, INDUCTOR_PATTERNS); }
export function isConnector(n: PredictionNode): boolean { return nodeMatches(n, CONNECTOR_PATTERNS); }
export function hasAdc(n: PredictionNode): boolean { return nodeMatches(n, ADC_PATTERNS) || isMcu(n); }
export function isFilter(n: PredictionNode): boolean { return nodeMatches(n, FILTER_PATTERNS); }
export function isTransistor(n: PredictionNode): boolean { return nodeMatches(n, TRANSISTOR_PATTERNS); }
export function isTestPoint(n: PredictionNode): boolean { return nodeMatches(n, TEST_POINT_PATTERNS); }
export function isMounting(n: PredictionNode): boolean { return nodeMatches(n, MOUNTING_PATTERNS); }
export function isPowerIndicator(n: PredictionNode): boolean { return nodeMatches(n, POWER_INDICATOR_PATTERNS); }
export function isHeatsink(n: PredictionNode): boolean { return nodeMatches(n, HEATSINK_PATTERNS); }
export function isMainsVoltage(n: PredictionNode): boolean { return nodeMatches(n, MAINS_PATTERNS); }
export function isHighVoltage(n: PredictionNode): boolean { return nodeMatches(n, HIGH_VOLTAGE_PATTERNS); }
export function isGround(n: PredictionNode): boolean { return nodeMatches(n, GROUND_PATTERNS); }
