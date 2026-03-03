export type { DesignPattern, PatternCategory, PatternDifficulty } from './types';

import { crystalOscillator } from './patterns/crystal-oscillator';
import { decouplingNetwork } from './patterns/decoupling-network';
import { hBridge } from './patterns/h-bridge';
import { ledDriver } from './patterns/led-driver';
import { levelShifter } from './patterns/level-shifter';
import { pullUpResistor } from './patterns/pull-up-resistor';
import { rcFilter } from './patterns/rc-filter';
import { usbCPower } from './patterns/usb-c-power';
import { voltageDivider } from './patterns/voltage-divider';
import { voltageRegulator } from './patterns/voltage-regulator';

import type { DesignPattern, PatternCategory, PatternDifficulty } from './types';

const allPatterns: DesignPattern[] = [
  crystalOscillator,
  decouplingNetwork,
  hBridge,
  ledDriver,
  levelShifter,
  pullUpResistor,
  rcFilter,
  usbCPower,
  voltageDivider,
  voltageRegulator,
];

/** Returns all 10 design patterns. */
export function getAllPatterns(): DesignPattern[] {
  return allPatterns;
}

/** Returns patterns matching the given functional category. */
export function getPatternsByCategory(category: PatternCategory): DesignPattern[] {
  return allPatterns.filter((p) => p.category === category);
}

/** Returns patterns matching the given difficulty level. */
export function getPatternsByDifficulty(difficulty: PatternDifficulty): DesignPattern[] {
  return allPatterns.filter((p) => p.difficulty === difficulty);
}

/** Case-insensitive search across pattern name, description, and tags. */
export function searchPatterns(query: string): DesignPattern[] {
  const lower = query.toLowerCase();
  return allPatterns.filter((p) => {
    if (p.name.toLowerCase().includes(lower)) {
      return true;
    }
    if (p.description.toLowerCase().includes(lower)) {
      return true;
    }
    return p.tags.some((tag) => tag.toLowerCase().includes(lower));
  });
}
