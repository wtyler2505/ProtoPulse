import { describe, it, expect } from 'vitest';
import {
  STANDARD_LIBRARY_COMPONENTS,
  STANDARD_LIBRARY_CATEGORIES,
} from '../../shared/standard-library';
import type { StandardComponentDef } from '../../shared/standard-library';

// ---------------------------------------------------------------------------
// Tests for the standard library data module
// ---------------------------------------------------------------------------

describe('STANDARD_LIBRARY_COMPONENTS', () => {
  it('exports at least 100 components', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.length).toBeGreaterThanOrEqual(100);
  });

  it('every component has a non-empty title', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(c.title).toBeTruthy();
      expect(typeof c.title).toBe('string');
    }
  });

  it('every component has a non-empty description', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(c.description).toBeTruthy();
    }
  });

  it('every component has a category', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(c.category).toBeTruthy();
    }
  });

  it('every component has at least one tag', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(Array.isArray(c.tags)).toBe(true);
      expect(c.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every component has a meta object', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(typeof c.meta).toBe('object');
      expect(c.meta).not.toBeNull();
    }
  });

  it('every component has connectors array', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(Array.isArray(c.connectors)).toBe(true);
      expect(c.connectors.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every component has views with schematic shapes', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(c.views).toBeDefined();
      expect(c.views.schematic).toBeDefined();
      expect(Array.isArray(c.views.schematic.shapes)).toBe(true);
      expect(c.views.schematic.shapes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every component has buses and constraints arrays', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(Array.isArray(c.buses)).toBe(true);
      expect(Array.isArray(c.constraints)).toBe(true);
    }
  });

  it('all titles are unique', () => {
    const titles = STANDARD_LIBRARY_COMPONENTS.map((c) => c.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('connector ids are unique within each component', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      const ids = c.connectors.map((conn) => conn.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });

  it('schematic shape ids are unique within each component', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      const ids = c.views.schematic.shapes.map((s) => s.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });
});

describe('STANDARD_LIBRARY_CATEGORIES', () => {
  it('exports 13 categories', () => {
    expect(STANDARD_LIBRARY_CATEGORIES.length).toBe(13);
  });

  it('every category except Misc has at least one component', () => {
    for (const cat of STANDARD_LIBRARY_CATEGORIES) {
      if (cat === 'Misc') { continue; }
      const components = STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === cat);
      expect(components.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every component category is in STANDARD_LIBRARY_CATEGORIES', () => {
    const catSet = new Set<string>(STANDARD_LIBRARY_CATEGORIES);
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      expect(catSet.has(c.category)).toBe(true);
    }
  });
});

describe('Category counts', () => {
  it('has 11 Logic ICs', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Logic ICs').length).toBe(11);
  });

  it('has at least 16 Passives (resistors + capacitors + inductors)', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Passives').length).toBeGreaterThanOrEqual(16);
  });

  it('has 6 Microcontrollers', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Microcontrollers').length).toBe(6);
  });

  it('has 6 Power ICs', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Power').length).toBe(6);
  });

  it('has 6 Op-Amps', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Op-Amps').length).toBe(6);
  });

  it('has 8 Transistors', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Transistors').length).toBe(8);
  });

  it('has 8 Diodes', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Diodes').length).toBe(8);
  });

  it('has 6 LEDs', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'LEDs').length).toBe(6);
  });

  it('has 11 Connectors', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Connectors').length).toBe(11);
  });

  it('has 4 Displays & UI', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Displays & UI').length).toBe(4);
  });

  it('has 8 Sensors', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Sensors').length).toBe(8);
  });

  it('has 4 Communication modules', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.filter((c) => c.category === 'Communication').length).toBe(4);
  });
});

describe('Specific component spot checks', () => {
  const byTitle = (title: string): StandardComponentDef | undefined =>
    STANDARD_LIBRARY_COMPONENTS.find((c) => c.title === title);

  it('ATmega328P exists with correct metadata', () => {
    const c = byTitle('ATmega328P');
    expect(c).toBeDefined();
    expect(c!.category).toBe('Microcontrollers');
    expect(c!.meta.manufacturer).toBe('Microchip');
    expect(c!.meta.mpn).toBe('ATMEGA328P-PU');
    expect(c!.tags).toContain('Arduino');
  });

  it('ESP32-WROOM-32 exists', () => {
    const c = byTitle('ESP32-WROOM-32');
    expect(c).toBeDefined();
    expect(c!.tags).toContain('Wi-Fi');
    expect(c!.tags).toContain('Bluetooth');
  });

  it('LM7805 has 3 connectors (IN, GND, OUT)', () => {
    const c = byTitle('LM7805 — 5V Linear Regulator');
    expect(c).toBeDefined();
    expect(c!.connectors.length).toBe(3);
    const names = c!.connectors.map((cn) => cn.name);
    expect(names).toContain('IN');
    expect(names).toContain('GND');
    expect(names).toContain('OUT');
  });

  it('1N4148 is a Diode', () => {
    const c = byTitle('1N4148 — Small Signal Diode');
    expect(c).toBeDefined();
    expect(c!.category).toBe('Diodes');
    expect(c!.tags).toContain('switching');
  });

  it('Red LED has correct wavelength in meta', () => {
    const c = byTitle('Red LED');
    expect(c).toBeDefined();
    expect(c!.meta.wavelength).toContain('620');
  });

  it('2N2222 is a transistor with E/B/C pins', () => {
    const c = byTitle('2N2222 — NPN Transistor');
    expect(c).toBeDefined();
    const names = c!.connectors.map((cn) => cn.name);
    expect(names).toContain('E');
    expect(names).toContain('B');
    expect(names).toContain('C');
  });

  it('USB Type-C Receptacle exists', () => {
    const c = byTitle('USB Type-C Receptacle');
    expect(c).toBeDefined();
    expect(c!.category).toBe('Connectors');
  });

  it('DHT22 sensor has accuracy in meta', () => {
    const c = byTitle('DHT22 — Temperature & Humidity Sensor');
    expect(c).toBeDefined();
    expect(c!.meta.accuracy).toBeDefined();
  });

  it('NRF24L01 is a Communication module', () => {
    const c = byTitle('NRF24L01 — 2.4GHz Transceiver');
    expect(c).toBeDefined();
    expect(c!.category).toBe('Communication');
    expect(c!.meta.interface).toBe('SPI');
  });
});

describe('component data integrity', () => {
  it('all connector padSpec have valid drill and diameter', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      for (const conn of c.connectors) {
        expect(conn.padSpec.drill).toBeGreaterThan(0);
        expect(conn.padSpec.diameter).toBeGreaterThan(conn.padSpec.drill);
      }
    }
  });

  it('all schematic body shapes have positive dimensions', () => {
    for (const c of STANDARD_LIBRARY_COMPONENTS) {
      const body = c.views.schematic.shapes.find((s) => s.id === 'body-sch');
      if (body) {
        expect(body.width).toBeGreaterThan(0);
        expect(body.height).toBeGreaterThan(0);
      }
    }
  });

  it('total component count is exactly 100', () => {
    expect(STANDARD_LIBRARY_COMPONENTS.length).toBe(100);
  });
});
