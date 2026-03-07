import { describe, it, expect } from 'vitest';
import {
  detectContext,
  getOptionsForContext,
  getComponentNames,
  getMethodCompletions,
} from '../completions';

// ---------------------------------------------------------------------------
// detectContext — determines what kind of completion to offer
// ---------------------------------------------------------------------------

describe('detectContext', () => {
  it('returns "method" after "c."', () => {
    expect(detectContext('c.')).toBe('method');
  });

  it('returns "method" after whitespace + "c."', () => {
    expect(detectContext('  c.')).toBe('method');
  });

  it('returns "method" after "c.r" (partial method)', () => {
    expect(detectContext('c.r')).toBe('method');
  });

  it('returns "method" after "c.con" (partial method)', () => {
    expect(detectContext('c.con')).toBe('method');
  });

  it('returns "option-key" after "c.resistor({"', () => {
    expect(detectContext('c.resistor({')).toBe('option-key');
  });

  it('returns "option-key" after "c.capacitor({ "', () => {
    expect(detectContext('c.capacitor({ ')).toBe('option-key');
  });

  it('returns "option-key" after "c.ic({ part: "ATmega328P", "', () => {
    expect(detectContext('c.ic({ part: "ATmega328P", ')).toBe('option-key');
  });

  it('returns "option-key" after "c.resistor({ v" (partial key)', () => {
    expect(detectContext('c.resistor({ v')).toBe('option-key');
  });

  it('returns "part-name" after \'c.ic({ part: "\'', () => {
    expect(detectContext('c.ic({ part: "')).toBe('part-name');
  });

  it('returns "part-name" after \'c.ic({ part: "ATm\'', () => {
    expect(detectContext('c.ic({ part: "ATm')).toBe('part-name');
  });

  it('returns "part-name" after \'c.diode({ part: "\'', () => {
    expect(detectContext('c.diode({ part: "')).toBe('part-name');
  });

  it('returns "part-name" after \'c.transistor({ part: "2N\'', () => {
    expect(detectContext('c.transistor({ part: "2N')).toBe('part-name');
  });

  it('returns "connect-arg" after "c.connect("', () => {
    expect(detectContext('c.connect(')).toBe('connect-arg');
  });

  it('returns "connect-arg" after "c.connect(vcc, "', () => {
    expect(detectContext('c.connect(vcc, ')).toBe('connect-arg');
  });

  it('returns "connect-arg" after "c.chain("', () => {
    expect(detectContext('c.chain(')).toBe('connect-arg');
  });

  it('returns null for unrecognized input', () => {
    expect(detectContext('const x = 5')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectContext('')).toBeNull();
  });

  it('returns null for plain "c" without dot', () => {
    expect(detectContext('c')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOptionsForContext — returns completion options for detected context
// ---------------------------------------------------------------------------

describe('getOptionsForContext', () => {
  describe('method context', () => {
    it('returns all builder methods after "c."', () => {
      const options = getOptionsForContext('method', 'c.');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('resistor');
      expect(labels).toContain('capacitor');
      expect(labels).toContain('inductor');
      expect(labels).toContain('diode');
      expect(labels).toContain('led');
      expect(labels).toContain('transistor');
      expect(labels).toContain('ic');
      expect(labels).toContain('connector');
      expect(labels).toContain('net');
      expect(labels).toContain('connect');
      expect(labels).toContain('chain');
      expect(labels).toContain('generic');
      expect(labels).toContain('export');
    });

    it('includes detail text for each method', () => {
      const options = getOptionsForContext('method', 'c.');
      const resistor = options.find((o) => o.label === 'resistor');
      expect(resistor?.detail).toBeDefined();
      expect(resistor?.detail?.length).toBeGreaterThan(0);
    });

    it('marks methods with type "method"', () => {
      const options = getOptionsForContext('method', 'c.');
      for (const opt of options) {
        expect(opt.type).toBe('method');
      }
    });
  });

  describe('option-key context', () => {
    it('returns value, footprint, refdes for resistor', () => {
      const options = getOptionsForContext('option-key', 'c.resistor({');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('value');
      expect(labels).toContain('footprint');
      expect(labels).toContain('refdes');
    });

    it('returns value, footprint, refdes, part for capacitor', () => {
      const options = getOptionsForContext('option-key', 'c.capacitor({');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('value');
      expect(labels).toContain('footprint');
      expect(labels).toContain('refdes');
      expect(labels).toContain('part');
    });

    it('returns part, footprint, refdes, value for ic', () => {
      const options = getOptionsForContext('option-key', 'c.ic({');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('part');
      expect(labels).toContain('footprint');
      expect(labels).toContain('refdes');
    });

    it('returns part, pins, footprint, refdes, value for connector', () => {
      const options = getOptionsForContext('option-key', 'c.connector({');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('part');
      expect(labels).toContain('pins');
      expect(labels).toContain('footprint');
      expect(labels).toContain('refdes');
    });

    it('returns name, voltage, ground options for net', () => {
      const options = getOptionsForContext('option-key', 'c.net("VCC", {');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('voltage');
      expect(labels).toContain('ground');
    });

    it('marks option keys with type "property"', () => {
      const options = getOptionsForContext('option-key', 'c.resistor({');
      for (const opt of options) {
        expect(opt.type).toBe('property');
      }
    });
  });

  describe('part-name context', () => {
    it('returns IC names for ic part field', () => {
      const options = getOptionsForContext('part-name', 'c.ic({ part: "');
      const labels = options.map((o) => o.label);
      expect(labels).toContain('ATmega328P');
      expect(labels).toContain('ATmega2560');
      expect(labels).toContain('ESP32');
      expect(labels).toContain('NE555');
      expect(labels).toContain('LM358');
      expect(labels).toContain('LM741');
      expect(labels).toContain('7400');
    });

    it('returns IC names for any active component part field', () => {
      const options = getOptionsForContext('part-name', 'c.diode({ part: "');
      const labels = options.map((o) => o.label);
      // All known parts should still be offered — the user can type any part
      expect(labels.length).toBeGreaterThan(0);
    });

    it('marks part names with type "constant"', () => {
      const options = getOptionsForContext('part-name', 'c.ic({ part: "');
      for (const opt of options) {
        expect(opt.type).toBe('constant');
      }
    });
  });

  describe('connect-arg context', () => {
    it('returns variable names found in the code', () => {
      const code = 'const vcc = c.net("VCC");\nconst r1 = c.resistor({ value: "10k" });\nc.connect(';
      const options = getOptionsForContext('connect-arg', code);
      const labels = options.map((o) => o.label);
      expect(labels).toContain('vcc');
      expect(labels).toContain('r1');
    });

    it('does not include "c" itself as a suggestion', () => {
      const code = 'const c = circuit("test");\nconst r1 = c.resistor({ value: "10k" });\nc.connect(';
      const options = getOptionsForContext('connect-arg', code);
      const labels = options.map((o) => o.label);
      expect(labels).not.toContain('c');
    });

    it('marks connect args with type "variable"', () => {
      const code = 'const vcc = c.net("VCC");\nc.connect(';
      const options = getOptionsForContext('connect-arg', code);
      for (const opt of options) {
        expect(opt.type).toBe('variable');
      }
    });

    it('returns empty array when no variables found', () => {
      const options = getOptionsForContext('connect-arg', 'c.connect(');
      expect(options).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// getComponentNames — returns known IC/component part names
// ---------------------------------------------------------------------------

describe('getComponentNames', () => {
  it('returns an array of strings', () => {
    const names = getComponentNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(typeof name).toBe('string');
    }
  });

  it('includes ATmega328P', () => {
    expect(getComponentNames()).toContain('ATmega328P');
  });

  it('includes ATmega2560', () => {
    expect(getComponentNames()).toContain('ATmega2560');
  });

  it('includes ESP32', () => {
    expect(getComponentNames()).toContain('ESP32');
  });

  it('includes NE555', () => {
    expect(getComponentNames()).toContain('NE555');
  });

  it('includes logic gate ICs', () => {
    const names = getComponentNames();
    expect(names).toContain('7400');
    expect(names).toContain('7402');
    expect(names).toContain('7404');
    expect(names).toContain('7408');
    expect(names).toContain('7432');
  });

  it('includes op-amps', () => {
    const names = getComponentNames();
    expect(names).toContain('LM358');
    expect(names).toContain('LM741');
  });
});

// ---------------------------------------------------------------------------
// getMethodCompletions — returns builder method suggestions
// ---------------------------------------------------------------------------

describe('getMethodCompletions', () => {
  it('returns an array of completion objects', () => {
    const completions = getMethodCompletions();
    expect(Array.isArray(completions)).toBe(true);
    expect(completions.length).toBeGreaterThan(0);
  });

  it('each completion has label, detail, and type', () => {
    const completions = getMethodCompletions();
    for (const comp of completions) {
      expect(comp.label).toBeDefined();
      expect(typeof comp.label).toBe('string');
      expect(comp.detail).toBeDefined();
      expect(typeof comp.detail).toBe('string');
      expect(comp.type).toBe('method');
    }
  });

  it('includes resistor method', () => {
    const completions = getMethodCompletions();
    const resistor = completions.find((c) => c.label === 'resistor');
    expect(resistor).toBeDefined();
    expect(resistor?.detail).toContain('resistor');
  });

  it('includes connect and chain methods', () => {
    const completions = getMethodCompletions();
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('connect');
    expect(labels).toContain('chain');
  });

  it('includes export method', () => {
    const completions = getMethodCompletions();
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('export');
  });
});
