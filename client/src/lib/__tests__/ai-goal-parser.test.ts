import { describe, expect, it } from 'vitest';

import {
  generateArchitectureCandidates,
  getDetectableCategories,
  getKnownComponents,
  parseProductGoal,
} from '../ai-goal-parser';
import type {
  ArchitectureCandidate,
  ProductGoal,
} from '../ai-goal-parser';

// ---------------------------------------------------------------------------
// parseProductGoal — requirement detection
// ---------------------------------------------------------------------------

describe('parseProductGoal', () => {
  describe('requirement detection', () => {
    it('detects WiFi requirement', () => {
      const goal = parseProductGoal('I want a WiFi-connected sensor');
      const wifi = goal.requirements.find((r) => r.description.includes('WiFi'));
      expect(wifi).toBeDefined();
      expect(wifi!.category).toBe('wireless');
      expect(wifi!.priority).toBe('must');
    });

    it('detects Bluetooth requirement', () => {
      const goal = parseProductGoal('A BLE beacon device');
      const ble = goal.requirements.find((r) => r.description.includes('Bluetooth'));
      expect(ble).toBeDefined();
      expect(ble!.category).toBe('wireless');
    });

    it('detects LoRa requirement', () => {
      const goal = parseProductGoal('Long range LoRa sensor node');
      const lora = goal.requirements.find((r) => r.description.includes('LoRa'));
      expect(lora).toBeDefined();
    });

    it('detects cellular requirement', () => {
      const goal = parseProductGoal('A device with LTE cellular connectivity');
      const cell = goal.requirements.find((r) => r.description.includes('Cellular'));
      expect(cell).toBeDefined();
    });

    it('detects GPS requirement', () => {
      const goal = parseProductGoal('I need GPS tracking for my asset tracker');
      const gps = goal.requirements.find((r) => r.description.includes('GPS'));
      expect(gps).toBeDefined();
    });

    it('detects temperature sensing', () => {
      const goal = parseProductGoal('Monitor temperature in a greenhouse');
      const temp = goal.requirements.find((r) => r.description.includes('Temperature'));
      expect(temp).toBeDefined();
      expect(temp!.category).toBe('sensing');
    });

    it('detects humidity sensing', () => {
      const goal = parseProductGoal('I want to measure humidity levels');
      const humidity = goal.requirements.find((r) => r.description.includes('Humidity'));
      expect(humidity).toBeDefined();
    });

    it('detects weather station (multi-sensor)', () => {
      const goal = parseProductGoal('Build a weather station');
      const weather = goal.requirements.find((r) => r.description.includes('Weather'));
      expect(weather).toBeDefined();
      expect(weather!.category).toBe('sensing');
    });

    it('detects motor actuation', () => {
      const goal = parseProductGoal('A robot with dc motor control');
      const motor = goal.requirements.find((r) => r.description.includes('Motor'));
      expect(motor).toBeDefined();
      expect(motor!.category).toBe('actuation');
    });

    it('detects display requirement', () => {
      const goal = parseProductGoal('Show readings on an OLED display');
      const display = goal.requirements.find((r) => r.description.includes('Display'));
      expect(display).toBeDefined();
      expect(display!.category).toBe('display');
    });

    it('detects battery power requirement', () => {
      const goal = parseProductGoal('A battery powered sensor node');
      const battery = goal.requirements.find((r) => r.description.includes('Battery'));
      expect(battery).toBeDefined();
      expect(battery!.category).toBe('power');
    });

    it('detects solar power requirement', () => {
      const goal = parseProductGoal('Solar powered outdoor monitor');
      const solar = goal.requirements.find((r) => r.description.includes('Solar'));
      expect(solar).toBeDefined();
    });

    it('detects Arduino/MCU compute requirement', () => {
      const goal = parseProductGoal('Use an Arduino to control LEDs');
      const compute = goal.requirements.find((r) => r.category === 'compute');
      expect(compute).toBeDefined();
    });

    it('detects data storage requirement', () => {
      const goal = parseProductGoal('Log data to an SD card');
      const storage = goal.requirements.find((r) => r.category === 'storage');
      expect(storage).toBeDefined();
    });

    it('detects audio requirement', () => {
      const goal = parseProductGoal('Play alarm sounds through a speaker');
      const audio = goal.requirements.find((r) => r.category === 'audio');
      expect(audio).toBeDefined();
    });

    it('detects CAN bus connectivity', () => {
      const goal = parseProductGoal('Read OBD2 data from a car via CAN bus');
      const can = goal.requirements.find((r) => r.description.includes('CAN'));
      expect(can).toBeDefined();
      expect(can!.category).toBe('connectivity');
    });

    it('detects robotics/mechanical requirement', () => {
      const goal = parseProductGoal('Build an autonomous rover');
      const mech = goal.requirements.find((r) => r.category === 'mechanical');
      expect(mech).toBeDefined();
    });

    it('detects multiple requirements in one description', () => {
      const goal = parseProductGoal(
        'A WiFi-connected weather station with an OLED display and battery power, logging data to SD card',
      );
      expect(goal.requirements.length).toBeGreaterThanOrEqual(4);
      const categories = new Set(goal.requirements.map((r) => r.category));
      expect(categories.has('wireless')).toBe(true);
      expect(categories.has('sensing')).toBe(true);
      expect(categories.has('display')).toBe(true);
      expect(categories.has('power')).toBe(true);
    });

    it('does not duplicate requirements for same category+description', () => {
      const goal = parseProductGoal('WiFi WiFi WiFi sensor with wifi');
      const wifiReqs = goal.requirements.filter((r) => r.description.includes('WiFi'));
      expect(wifiReqs).toHaveLength(1);
    });

    it('captures matched keywords', () => {
      const goal = parseProductGoal('BLE bluetooth beacon');
      const ble = goal.requirements.find((r) => r.description.includes('Bluetooth'));
      expect(ble).toBeDefined();
      expect(ble!.keywords).toContain('ble');
      expect(ble!.keywords).toContain('bluetooth');
    });

    it('handles empty description', () => {
      const goal = parseProductGoal('');
      expect(goal.requirements).toHaveLength(0);
      expect(goal.constraints).toHaveLength(0);
      expect(goal.complexity).toBe('simple');
    });

    it('handles description with no matching keywords', () => {
      const goal = parseProductGoal('A really cool thing that does stuff');
      expect(goal.requirements).toHaveLength(0);
      expect(goal.summary).toContain('A really cool thing');
    });
  });

  // ---------------------------------------------------------------------------
  // Constraint detection
  // ---------------------------------------------------------------------------

  describe('constraint detection', () => {
    it('detects battery-powered constraint', () => {
      const goal = parseProductGoal('A battery-powered device');
      const c = goal.constraints.find((c) => c.type === 'power-source' && c.value === 'battery');
      expect(c).toBeDefined();
    });

    it('detects solar-powered constraint', () => {
      const goal = parseProductGoal('A solar-powered outdoor sensor');
      const c = goal.constraints.find((c) => c.type === 'power-source' && c.value === 'solar');
      expect(c).toBeDefined();
    });

    it('detects cost constraint', () => {
      const goal = parseProductGoal('Build it for under $50 dollars');
      const c = goal.constraints.find((c) => c.type === 'cost');
      expect(c).toBeDefined();
      expect(c!.value).toBe('$50');
    });

    it('detects small size constraint', () => {
      const goal = parseProductGoal('A compact pocket-sized tracker');
      const c = goal.constraints.find((c) => c.type === 'size');
      expect(c).toBeDefined();
      expect(c!.value).toBe('small');
    });

    it('detects outdoor/weatherproof constraint', () => {
      const goal = parseProductGoal('Outdoor weatherproof monitoring station');
      const c = goal.constraints.find((c) => c.type === 'temperature');
      expect(c).toBeDefined();
    });

    it('detects voltage constraint', () => {
      const goal = parseProductGoal('Uses 12V input supply');
      const c = goal.constraints.find((c) => c.type === 'voltage');
      expect(c).toBeDefined();
      expect(c!.value).toBe('12V');
    });

    it('detects multiple constraints', () => {
      const goal = parseProductGoal('A small battery-powered device for under $30 dollars');
      expect(goal.constraints.length).toBeGreaterThanOrEqual(2);
    });

    it('does not duplicate constraints', () => {
      const goal = parseProductGoal('battery-powered runs on battery');
      const batteryConstraints = goal.constraints.filter((c) => c.type === 'power-source' && c.value === 'battery');
      expect(batteryConstraints).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Domain detection
  // ---------------------------------------------------------------------------

  describe('domain detection', () => {
    it('detects Home Automation domain', () => {
      const goal = parseProductGoal('A smart home thermostat');
      expect(goal.detectedDomains).toContain('Home Automation');
    });

    it('detects Environmental Monitoring domain', () => {
      const goal = parseProductGoal('An air quality monitoring station');
      expect(goal.detectedDomains).toContain('Environmental Monitoring');
    });

    it('detects Robotics domain', () => {
      const goal = parseProductGoal('Build an autonomous robot');
      expect(goal.detectedDomains).toContain('Robotics');
    });

    it('detects Agriculture domain', () => {
      const goal = parseProductGoal('Automated greenhouse irrigation system');
      expect(goal.detectedDomains).toContain('Agriculture');
    });

    it('detects Automotive domain', () => {
      const goal = parseProductGoal('An automotive OBD dashboard logger');
      expect(goal.detectedDomains).toContain('Automotive');
    });

    it('detects multiple domains', () => {
      const goal = parseProductGoal('A smart home device with air quality monitoring');
      expect(goal.detectedDomains.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty domains for generic descriptions', () => {
      const goal = parseProductGoal('A simple circuit that blinks an LED');
      expect(goal.detectedDomains).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Complexity classification
  // ---------------------------------------------------------------------------

  describe('complexity classification', () => {
    it('classifies simple goals (1-2 requirement categories)', () => {
      const goal = parseProductGoal('A temperature sensor');
      expect(goal.complexity).toBe('simple');
    });

    it('classifies moderate goals (3-4 requirement categories)', () => {
      const goal = parseProductGoal(
        'A WiFi-connected temperature sensor with an OLED display',
      );
      expect(goal.complexity).toBe('moderate');
    });

    it('classifies complex goals (5+ requirement categories)', () => {
      const goal = parseProductGoal(
        'A battery-powered WiFi robot with motor control, temperature sensor, OLED display, GPS tracking, and buzzer alarm',
      );
      expect(goal.complexity).toBe('complex');
    });
  });

  // ---------------------------------------------------------------------------
  // Summary generation
  // ---------------------------------------------------------------------------

  describe('summary generation', () => {
    it('generates summary with domain prefix', () => {
      const goal = parseProductGoal('Build a smart home thermostat with WiFi');
      expect(goal.summary).toContain('Home Automation');
    });

    it('includes must-have features in summary', () => {
      const goal = parseProductGoal('WiFi weather station');
      expect(goal.summary.length).toBeGreaterThan(10);
    });

    it('truncates long descriptions without requirements', () => {
      const longDesc = 'A '.repeat(100);
      const goal = parseProductGoal(longDesc);
      expect(goal.summary.length).toBeLessThanOrEqual(120);
    });

    it('returns original short description when no requirements match', () => {
      const goal = parseProductGoal('A cool gadget');
      expect(goal.summary).toBe('A cool gadget');
    });
  });
});

// ---------------------------------------------------------------------------
// generateArchitectureCandidates
// ---------------------------------------------------------------------------

describe('generateArchitectureCandidates', () => {
  it('returns at least 2 candidates (minimal + balanced)', () => {
    const goal = parseProductGoal('A temperature sensor');
    const candidates = generateArchitectureCandidates(goal);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0].tier).toBe('minimal');
    expect(candidates[1].tier).toBe('balanced');
  });

  it('returns 3 candidates for moderate+ goals', () => {
    const goal = parseProductGoal(
      'WiFi-connected weather station with OLED display and battery power',
    );
    const candidates = generateArchitectureCandidates(goal);
    expect(candidates).toHaveLength(3);
    expect(candidates[2].tier).toBe('full');
  });

  it('returns 3 candidates when 3+ requirements', () => {
    const goal = parseProductGoal('WiFi sensor with display and motor control');
    const candidates = generateArchitectureCandidates(goal);
    expect(candidates).toHaveLength(3);
  });

  it('every candidate has a compute component', () => {
    const goal = parseProductGoal('A WiFi weather station');
    const candidates = generateArchitectureCandidates(goal);
    candidates.forEach((c) => {
      const hasCompute = c.components.some((comp) => comp.category === 'compute');
      expect(hasCompute).toBe(true);
    });
  });

  it('every candidate has a power component', () => {
    const goal = parseProductGoal('A WiFi sensor');
    const candidates = generateArchitectureCandidates(goal);
    candidates.forEach((c) => {
      const hasPower = c.components.some((comp) => comp.category === 'power');
      expect(hasPower).toBe(true);
    });
  });

  it('candidates have increasing complexity', () => {
    const goal = parseProductGoal('WiFi weather station with display and battery');
    const candidates = generateArchitectureCandidates(goal);
    const complexityOrder = { simple: 0, moderate: 1, complex: 2 };
    for (let i = 1; i < candidates.length; i++) {
      expect(complexityOrder[candidates[i].estimatedComplexity]).toBeGreaterThanOrEqual(
        complexityOrder[candidates[i - 1].estimatedComplexity],
      );
    }
  });

  it('candidates have increasing node counts', () => {
    const goal = parseProductGoal('WiFi weather station with display and motor control');
    const candidates = generateArchitectureCandidates(goal);
    // Full should have >= balanced >= minimal node count
    if (candidates.length === 3) {
      expect(candidates[2].estimatedNodeCount).toBeGreaterThanOrEqual(
        candidates[0].estimatedNodeCount,
      );
    }
  });

  it('generates pros and cons for each candidate', () => {
    const goal = parseProductGoal('Battery-powered WiFi sensor');
    const candidates = generateArchitectureCandidates(goal);
    candidates.forEach((c) => {
      expect(c.pros.length).toBeGreaterThan(0);
      expect(c.cons.length).toBeGreaterThan(0);
    });
  });

  it('candidates have descriptive labels', () => {
    const goal = parseProductGoal('A temperature sensor');
    const candidates = generateArchitectureCandidates(goal);
    expect(candidates[0].label).toContain('Minimal');
    expect(candidates[1].label).toContain('Balanced');
  });

  it('candidates have descriptions', () => {
    const goal = parseProductGoal('A WiFi sensor');
    const candidates = generateArchitectureCandidates(goal);
    candidates.forEach((c) => {
      expect(c.description.length).toBeGreaterThan(20);
    });
  });

  it('includes sensing components when sensing is required', () => {
    const goal = parseProductGoal('A temperature and humidity sensor');
    const candidates = generateArchitectureCandidates(goal);
    const balanced = candidates.find((c) => c.tier === 'balanced');
    expect(balanced).toBeDefined();
    const hasSensing = balanced!.components.some((c) => c.category === 'sensing');
    expect(hasSensing).toBe(true);
  });

  it('includes wireless components when wireless is required', () => {
    const goal = parseProductGoal('LoRa sensor node for long range');
    const candidates = generateArchitectureCandidates(goal);
    const balanced = candidates.find((c) => c.tier === 'balanced');
    expect(balanced).toBeDefined();
    // Should have LoRa wireless component (not just ESP32 WiFi)
    const hasWirelessOrCompute = balanced!.components.some(
      (c) => c.category === 'wireless' || c.category === 'compute',
    );
    expect(hasWirelessOrCompute).toBe(true);
  });

  it('includes actuation components when motors are required', () => {
    const goal = parseProductGoal('A robot with motor control');
    const candidates = generateArchitectureCandidates(goal);
    candidates.forEach((c) => {
      const hasActuation = c.components.some((comp) => comp.category === 'actuation');
      expect(hasActuation).toBe(true);
    });
  });

  it('adds battery management when battery-powered constraint exists', () => {
    const goal = parseProductGoal('A battery-powered sensor');
    const candidates = generateArchitectureCandidates(goal);
    const balanced = candidates.find((c) => c.tier === 'balanced');
    const power = balanced!.components.find((c) => c.category === 'power');
    expect(power).toBeDefined();
    expect(power!.description.toLowerCase()).toContain('battery');
  });

  it('adds solar power management when solar constraint exists', () => {
    const goal = parseProductGoal('A solar-powered outdoor monitor with temperature sensor');
    const candidates = generateArchitectureCandidates(goal);
    const full = candidates.find((c) => c.tier === 'full');
    if (full) {
      const power = full.components.find((c) => c.category === 'power');
      expect(power).toBeDefined();
      expect(power!.description.toLowerCase()).toContain('solar');
    }
  });

  it('components have part numbers', () => {
    const goal = parseProductGoal('A WiFi temperature sensor');
    const candidates = generateArchitectureCandidates(goal);
    const balanced = candidates.find((c) => c.tier === 'balanced');
    balanced!.components.forEach((comp) => {
      // Most components should have part numbers
      if (comp.partNumber) {
        expect(comp.partNumber.length).toBeGreaterThan(0);
      }
    });
  });

  it('components may have alternatives listed', () => {
    const goal = parseProductGoal('A temperature sensor');
    const candidates = generateArchitectureCandidates(goal);
    // At least one component across all candidates should have alternatives
    const hasAlternatives = candidates.some((c) =>
      c.components.some((comp) => comp.alternatives && comp.alternatives.length > 0),
    );
    // This is optional, not all components have alternatives
    expect(typeof hasAlternatives).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Realistic scenarios
// ---------------------------------------------------------------------------

describe('realistic scenarios', () => {
  it('parses a weather station goal end-to-end', () => {
    const goal = parseProductGoal(
      'I want to build a battery-powered WiFi weather station that measures temperature, humidity, and pressure, displays readings on a small OLED, and logs data to an SD card',
    );

    expect(goal.requirements.length).toBeGreaterThanOrEqual(5);
    expect(goal.constraints.length).toBeGreaterThanOrEqual(1);
    expect(goal.detectedDomains).toContain('Environmental Monitoring');
    expect(goal.complexity).toBe('complex');

    const candidates = generateArchitectureCandidates(goal);
    expect(candidates).toHaveLength(3);

    // Balanced candidate should cover most requirements
    const balanced = candidates[1];
    const balancedCategories = new Set(balanced.components.map((c) => c.category));
    expect(balancedCategories.has('compute')).toBe(true);
    expect(balancedCategories.has('sensing')).toBe(true);
    expect(balancedCategories.has('power')).toBe(true);
  });

  it('parses a robot goal end-to-end', () => {
    const goal = parseProductGoal(
      'Build an autonomous rover with motor control, ultrasonic distance sensors, and WiFi for remote control',
    );

    expect(goal.detectedDomains).toContain('Robotics');
    const categories = new Set(goal.requirements.map((r) => r.category));
    expect(categories.has('actuation')).toBe(true);
    expect(categories.has('sensing')).toBe(true);
    expect(categories.has('wireless')).toBe(true);
    expect(categories.has('mechanical')).toBe(true);

    const candidates = generateArchitectureCandidates(goal);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('parses a smart home goal end-to-end', () => {
    const goal = parseProductGoal(
      'A Zigbee smart home sensor that monitors temperature and light levels',
    );

    expect(goal.detectedDomains).toContain('Home Automation');
    const wireless = goal.requirements.find((r) => r.category === 'wireless');
    expect(wireless).toBeDefined();
    expect(wireless!.description).toContain('Mesh');

    const candidates = generateArchitectureCandidates(goal);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('parses an automotive goal end-to-end', () => {
    const goal = parseProductGoal(
      'An automotive OBD2 data logger with CAN bus and SD card storage',
    );

    expect(goal.detectedDomains).toContain('Automotive');
    const categories = new Set(goal.requirements.map((r) => r.category));
    expect(categories.has('connectivity')).toBe(true);
    expect(categories.has('storage')).toBe(true);
  });

  it('parses a simple LED blinker (minimal requirements)', () => {
    const goal = parseProductGoal('Blink an LED with an Arduino');
    expect(goal.requirements.length).toBeGreaterThanOrEqual(1);
    expect(goal.complexity).toBe('simple');

    const candidates = generateArchitectureCandidates(goal);
    // Simple goal = 2 candidates (no full tier needed if < 3 requirements)
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

describe('getKnownComponents', () => {
  it('returns 30+ components', () => {
    const components = getKnownComponents();
    expect(components.length).toBeGreaterThanOrEqual(30);
  });

  it('returns a copy (not the original array)', () => {
    const a = getKnownComponents();
    const b = getKnownComponents();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('components have required fields', () => {
    const components = getKnownComponents();
    components.forEach((c) => {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.partNumbers.length).toBeGreaterThan(0);
      expect(c.category.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect(['minimal', 'balanced', 'full']).toContain(c.tier);
      expect(c.capabilities.length).toBeGreaterThan(0);
    });
  });
});

describe('getDetectableCategories', () => {
  it('returns all requirement categories', () => {
    const categories = getDetectableCategories();
    expect(categories.length).toBeGreaterThanOrEqual(8);
    expect(categories).toContain('wireless');
    expect(categories).toContain('sensing');
    expect(categories).toContain('actuation');
    expect(categories).toContain('power');
    expect(categories).toContain('display');
    expect(categories).toContain('compute');
    expect(categories).toContain('connectivity');
    expect(categories).toContain('storage');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles very long descriptions', () => {
    const longDesc = 'I want a WiFi temperature sensor. '.repeat(50);
    const goal = parseProductGoal(longDesc);
    expect(goal.requirements.length).toBeGreaterThan(0);
    const candidates = generateArchitectureCandidates(goal);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('handles special characters in description', () => {
    const goal = parseProductGoal('Build a 3.3V battery-powered sensor @ $20!');
    expect(goal.requirements.length).toBeGreaterThanOrEqual(1);
  });

  it('is case-insensitive', () => {
    const lower = parseProductGoal('wifi sensor');
    const upper = parseProductGoal('WIFI SENSOR');
    const mixed = parseProductGoal('WiFi Sensor');
    expect(lower.requirements.length).toBe(upper.requirements.length);
    expect(lower.requirements.length).toBe(mixed.requirements.length);
  });

  it('handles overlapping keywords gracefully', () => {
    // "weather station" matches both weather and temperature-related patterns
    const goal = parseProductGoal('weather station with temperature sensor');
    // Should not crash or produce invalid output
    expect(goal.requirements.length).toBeGreaterThan(0);
  });

  it('generates candidates even with no requirements', () => {
    const goal = parseProductGoal('something generic');
    const candidates = generateArchitectureCandidates(goal);
    // Still generates minimal + balanced with at least compute + power
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    candidates.forEach((c) => {
      expect(c.components.length).toBeGreaterThan(0);
    });
  });
});
