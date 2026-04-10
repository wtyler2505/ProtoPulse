import { describe, expect, it } from 'vitest';

import { inferTraps } from '../heuristic-trap-inference';
import type { InferredTrap } from '../heuristic-trap-inference';

describe('heuristic-trap-inference', () => {
  describe('ESP32 family inference', () => {
    it('infers flash GPIO traps for unverified ESP32 parts', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32-WROOM-32E' });
      const flashTrap = traps.find((t) => t.id === 'esp32-flash-gpio');
      expect(flashTrap).toBeDefined();
      expect(flashTrap!.confidence).toBe('inferred');
      expect(flashTrap!.severity).toBe('critical');
      expect(flashTrap!.category).toBe('safety');
      expect(flashTrap!.trapId).toBe('esp32-flash-gpio');
    });

    it('infers ADC2/WiFi conflict for ESP32 family', () => {
      const traps = inferTraps({ family: 'mcu', title: 'NodeMCU ESP32S' });
      const adc2Trap = traps.find((t) => t.id === 'esp32-adc2-wifi');
      expect(adc2Trap).toBeDefined();
      expect(adc2Trap!.severity).toBe('warning');
      expect(adc2Trap!.confidence).toBe('inferred');
    });

    it('infers GPIO12 strapping pin trap', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32 DevKit' });
      const strappingTrap = traps.find((t) => t.id === 'esp32-gpio12-strapping');
      expect(strappingTrap).toBeDefined();
      expect(strappingTrap!.severity).toBe('critical');
    });

    it('infers GPIO0 boot-mode trap', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32-S3-DevKitC' });
      const bootTrap = traps.find((t) => t.id === 'esp32-gpio0-boot');
      expect(bootTrap).toBeDefined();
      expect(bootTrap!.severity).toBe('warning');
    });

    it('returns all four ESP32 traps together', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32-WROOM-32' });
      expect(traps).toHaveLength(4);
      const ids = traps.map((t) => t.id);
      expect(ids).toContain('esp32-flash-gpio');
      expect(ids).toContain('esp32-adc2-wifi');
      expect(ids).toContain('esp32-gpio12-strapping');
      expect(ids).toContain('esp32-gpio0-boot');
    });

    it('matches ESP32 case-insensitively', () => {
      const traps = inferTraps({ family: 'MCU', title: 'esp32 devkit v1' });
      expect(traps.length).toBeGreaterThan(0);
      expect(traps.every((t) => t.confidence === 'inferred')).toBe(true);
    });
  });

  describe('ATmega family inference', () => {
    it('infers 5V logic warning for ATmega328 parts', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ATmega328P' });
      const logicTrap = traps.find((t) => t.id === 'avr-5v-logic');
      expect(logicTrap).toBeDefined();
      expect(logicTrap!.severity).toBe('warning');
      expect(logicTrap!.category).toBe('power');
    });

    it('infers serial pin conflict for Arduino-family boards', () => {
      const traps = inferTraps({ family: 'mcu', title: 'Arduino Pro Mini' });
      const serialTrap = traps.find((t) => t.id === 'avr-serial-conflict');
      expect(serialTrap).toBeDefined();
      expect(serialTrap!.severity).toBe('info');
    });

    it('infers reset pin noise warning for ATmega', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ATmega2560' });
      const resetTrap = traps.find((t) => t.id === 'avr-reset-noise');
      expect(resetTrap).toBeDefined();
      expect(resetTrap!.severity).toBe('info');
    });

    it('matches Arduino Uno as ATmega family', () => {
      const traps = inferTraps({ family: 'mcu', title: 'Arduino Uno R3' });
      expect(traps.find((t) => t.id === 'avr-5v-logic')).toBeDefined();
      expect(traps.find((t) => t.id === 'avr-serial-conflict')).toBeDefined();
      expect(traps.find((t) => t.id === 'avr-reset-noise')).toBeDefined();
    });

    it('matches Arduino Nano as ATmega family', () => {
      const traps = inferTraps({ family: 'mcu', title: 'Arduino Nano' });
      expect(traps.length).toBe(3);
    });
  });

  describe('3.3V MCU inference', () => {
    it('infers voltage level warning for RP2040', () => {
      const traps = inferTraps({ family: 'mcu', title: 'RP2040 Pico' });
      const voltageTrap = traps.find((t) => t.id === 'mcu-3v3-logic');
      expect(voltageTrap).toBeDefined();
      expect(voltageTrap!.severity).toBe('warning');
      expect(voltageTrap!.category).toBe('power');
    });

    it('infers voltage level warning for STM32', () => {
      const traps = inferTraps({ family: 'mcu', title: 'STM32F411CEU6 Black Pill' });
      expect(traps.find((t) => t.id === 'mcu-3v3-logic')).toBeDefined();
    });

    it('infers voltage level warning for nRF52', () => {
      const traps = inferTraps({ family: 'mcu', title: 'nRF52840 Dongle' });
      expect(traps.find((t) => t.id === 'mcu-3v3-logic')).toBeDefined();
    });

    it('infers voltage level warning for SAMD21', () => {
      const traps = inferTraps({ family: 'mcu', title: 'SAMD21 Xplained Pro' });
      expect(traps.find((t) => t.id === 'mcu-3v3-logic')).toBeDefined();
    });

    it('returns exactly one trap for 3.3V-only MCUs', () => {
      const traps = inferTraps({ family: 'mcu', title: 'Raspberry Pi Pico (RP2040)' });
      expect(traps).toHaveLength(1);
    });
  });

  describe('generic / passthrough cases', () => {
    it('returns empty traps for passive components', () => {
      expect(inferTraps({ family: 'resistor', title: '1k Resistor' })).toHaveLength(0);
    });

    it('returns empty traps for capacitors', () => {
      expect(inferTraps({ family: 'capacitor', title: '100nF Ceramic' })).toHaveLength(0);
    });

    it('returns empty for unknown MCU families', () => {
      expect(inferTraps({ family: 'mcu', title: 'Unknown Board XYZ' })).toHaveLength(0);
    });

    it('returns empty for connectors', () => {
      expect(inferTraps({ family: 'connector', title: '2.54mm Header' })).toHaveLength(0);
    });

    it('returns empty for empty input', () => {
      expect(inferTraps({ family: '', title: '' })).toHaveLength(0);
    });
  });

  describe('motor controller traps', () => {
    it('warns about STOP/BRAKE polarity inversion on BLDC drivers', () => {
      const traps = inferTraps({ family: 'driver', title: 'RioRand BLDC Controller' });
      const brakeTrap = traps.find((t) => t.id === 'motor-brake-polarity');
      expect(brakeTrap).toBeDefined();
      expect(brakeTrap!.severity).toBe('critical');
      expect(brakeTrap!.category).toBe('safety');
    });

    it('warns about hall sensor wiring order on BLDC', () => {
      const traps = inferTraps({ family: 'driver', title: 'BLDC Motor Controller 48V' });
      expect(traps.find((t) => t.id === 'motor-hall-order')).toBeDefined();
    });

    it('warns about back-EMF protection for H-bridge', () => {
      const traps = inferTraps({ family: 'driver', title: 'L298N H-Bridge' });
      const emfTrap = traps.find((t) => t.id === 'motor-back-emf');
      expect(emfTrap).toBeDefined();
      expect(emfTrap!.severity).toBe('warning');
    });

    it('warns about PWM frequency range', () => {
      const traps = inferTraps({ family: 'driver', title: 'TB6612FNG Motor Driver' });
      const pwmTrap = traps.find((t) => t.id === 'motor-pwm-frequency');
      expect(pwmTrap).toBeDefined();
      expect(pwmTrap!.severity).toBe('info');
    });

    it('warns about shoot-through dead zone on H-bridge drivers', () => {
      const traps = inferTraps({ family: 'driver', title: 'L9110S H-Bridge' });
      expect(traps.find((t) => t.id === 'motor-shoot-through')).toBeDefined();
    });

    it('BLDC drivers get BLDC-specific traps (brake polarity, hall order)', () => {
      const traps = inferTraps({ family: 'driver', title: 'RioRand KJL-01 BLDC' });
      const ids = traps.map((t) => t.id);
      expect(ids).toContain('motor-brake-polarity');
      expect(ids).toContain('motor-hall-order');
      expect(ids).toContain('motor-pwm-frequency');
    });

    it('H-bridge drivers get H-bridge-specific traps (back-EMF, shoot-through)', () => {
      const traps = inferTraps({ family: 'driver', title: 'L298N Dual H-Bridge' });
      const ids = traps.map((t) => t.id);
      expect(ids).toContain('motor-back-emf');
      expect(ids).toContain('motor-shoot-through');
      expect(ids).toContain('motor-pwm-frequency');
    });

    it('generic motor driver gets PWM frequency trap', () => {
      const traps = inferTraps({ family: 'driver', title: 'Motor Driver Board' });
      expect(traps.find((t) => t.id === 'motor-pwm-frequency')).toBeDefined();
    });

    it('non-motor drivers return empty (e.g. LED driver)', () => {
      expect(inferTraps({ family: 'driver', title: 'WS2812B LED Driver' })).toHaveLength(0);
    });
  });

  describe('InferredTrap structure', () => {
    it('every trap has required fields', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32-WROOM-32' });
      for (const trap of traps) {
        expect(trap.id).toEqual(expect.any(String));
        expect(trap.severity).toMatch(/^(critical|warning|info)$/);
        expect(trap.confidence).toBe('inferred');
        expect(trap.category).toMatch(/^(power|signal|layout|safety|missing)$/);
        expect(trap.title).toEqual(expect.any(String));
        expect(trap.detail).toEqual(expect.any(String));
        expect(trap.trapId).toEqual(expect.any(String));
        expect(trap.title.length).toBeGreaterThan(0);
        expect(trap.detail.length).toBeGreaterThan(0);
      }
    });

    it('trapId matches the trap id for knowledge card linking', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32 DevKit' });
      for (const trap of traps) {
        expect(trap.trapId).toBe(trap.id);
      }
    });
  });
});
