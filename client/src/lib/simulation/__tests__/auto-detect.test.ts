import { describe, it, expect } from 'vitest';
import { autoDetectAnalysisType, detectSimulationType } from '../auto-detect';
import type { CircuitInstanceForDetection, CircuitNetForDetection } from '../auto-detect';

describe('autoDetectAnalysisType', () => {
  it('returns dcop with no instances', () => {
    const result = autoDetectAnalysisType([]);
    expect(result.recommended).toBe('dcop');
    expect(result.hasACSources).toBe(false);
    expect(result.hasTransientSources).toBe(false);
    expect(result.hasDCSources).toBe(false);
  });

  it('returns dcop for DC-only sources', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('dcop');
    expect(result.hasDCSources).toBe(true);
    expect(result.hasACSources).toBe(false);
  });

  it('returns ac when AC sources are present', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('ac');
    expect(result.hasACSources).toBe(true);
  });

  it('returns ac when source has sine waveform property', () => {
    const instances: CircuitInstanceForDetection[] = [
      {
        referenceDesignator: 'V1',
        componentType: 'voltage_source',
        properties: { sourceType: 'sine', componentType: 'voltage_source' },
      },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('ac');
    expect(result.hasACSources).toBe(true);
  });

  it('returns transient for pulse sources', () => {
    const instances: CircuitInstanceForDetection[] = [
      {
        referenceDesignator: 'V1',
        componentType: 'voltage_source',
        properties: { sourceType: 'pulse', componentType: 'voltage_source' },
      },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('transient');
    expect(result.hasTransientSources).toBe(true);
  });

  it('returns transient for square wave sources', () => {
    const instances: CircuitInstanceForDetection[] = [
      {
        referenceDesignator: 'V2',
        componentType: 'signal_source',
        properties: { waveform: 'square', componentType: 'signal_source' },
      },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('transient');
    expect(result.hasTransientSources).toBe(true);
  });

  it('prioritizes AC over transient when both present', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      {
        referenceDesignator: 'V2',
        componentType: 'voltage_source',
        properties: { sourceType: 'pulse', componentType: 'voltage_source' },
      },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('ac');
    expect(result.hasACSources).toBe(true);
    expect(result.hasTransientSources).toBe(true);
  });

  it('ignores non-source components', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
      { referenceDesignator: 'C1', componentType: 'capacitor', properties: {} },
      { referenceDesignator: 'L1', componentType: 'inductor', properties: {} },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('dcop');
    expect(result.hasDCSources).toBe(false);
  });

  it('detects current source by refDes prefix', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'I1', componentType: '', properties: {} },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('dcop');
    expect(result.hasDCSources).toBe(true);
  });

  it('detects sinusoidal componentType', () => {
    const instances: CircuitInstanceForDetection[] = [
      {
        referenceDesignator: 'V1',
        componentType: 'voltage_source',
        properties: { componentType: 'sinusoidal_source' },
      },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('ac');
  });

  it('handles null properties gracefully', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: null },
    ];
    const result = autoDetectAnalysisType(instances);
    expect(result.recommended).toBe('dcop');
    expect(result.hasDCSources).toBe(true);
  });

  it('provides a human-readable reason', () => {
    const result = autoDetectAnalysisType([]);
    expect(result.reason).toBeTruthy();
    expect(typeof result.reason).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// detectSimulationType — enriched detection with confidence scoring
// ---------------------------------------------------------------------------

describe('detectSimulationType', () => {
  it('returns dc with 0.5 confidence for empty circuit', () => {
    const result = detectSimulationType([]);
    expect(result.type).toBe('dc');
    expect(result.confidence).toBe(0.5);
    expect(result.reason).toContain('Empty circuit');
  });

  it('returns dc with high confidence for resistor + DC source network', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
      { referenceDesignator: 'R2', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('dc');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns ac with high confidence for AC source + reactive components', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      { referenceDesignator: 'C1', componentType: 'capacitor', properties: {} },
      { referenceDesignator: 'L1', componentType: 'inductor', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('ac');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns ac with moderate confidence for AC source without reactive components', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('ac');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.confidence).toBeLessThan(0.95);
  });

  it('returns transient with high confidence for pulse source + time-varying components', () => {
    const instances: CircuitInstanceForDetection[] = [
      {
        referenceDesignator: 'V1',
        componentType: 'voltage_source',
        properties: { sourceType: 'pulse', componentType: 'voltage_source' },
      },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
      { referenceDesignator: 'SW1', componentType: 'switch', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('transient');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns transient for time-varying components even without transient source', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'SW1', componentType: 'switch', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    // DC source + switch = transient domain detected
    expect(result.type).toBe('transient');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('returns mixed with low confidence for AC + transient sources', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      {
        referenceDesignator: 'V2',
        componentType: 'voltage_source',
        properties: { sourceType: 'pulse', componentType: 'voltage_source' },
      },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    // Both AC and transient detected — mixed
    expect(result.type).toBe('mixed');
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('returns dc with lower confidence when many reactive components with DC source', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'C1', componentType: 'capacitor', properties: {} },
      { referenceDesignator: 'C2', componentType: 'capacitor', properties: {} },
      { referenceDesignator: 'L1', componentType: 'inductor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('dc');
    // Lowered because many reactive components suggest AC/transient may be relevant
    expect(result.confidence).toBeLessThan(0.9);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('returns dc with 0.5 confidence for passives-only (no sources)', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
      { referenceDesignator: 'C1', componentType: 'capacitor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('dc');
    expect(result.confidence).toBe(0.5);
  });

  it('uses nets for confidence enrichment', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const nets: CircuitNetForDetection[] = Array.from({ length: 15 }, (_, i) => ({
      name: `net${i}`,
      connectedPins: [`pin${i}a`, `pin${i}b`],
    }));
    const withNets = detectSimulationType(instances, nets);
    const withoutNets = detectSimulationType(instances);
    // Net complexity adds a small confidence boost
    expect(withNets.confidence).toBeGreaterThanOrEqual(withoutNets.confidence);
  });

  it('always returns a non-empty reason string', () => {
    const result = detectSimulationType([]);
    expect(result.reason).toBeTruthy();
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('confidence is always between 0 and 1', () => {
    const scenarios: CircuitInstanceForDetection[][] = [
      [],
      [{ referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} }],
      [{ referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} }],
      [
        { referenceDesignator: 'V1', componentType: 'voltage_source', properties: { sourceType: 'pulse' } },
        { referenceDesignator: 'SW1', componentType: 'switch', properties: {} },
      ],
    ];
    for (const instances of scenarios) {
      const result = detectSimulationType(instances);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('detects 555 timer as time-varying', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'U1', componentType: '555_timer', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('transient');
  });

  it('detects relay as time-varying', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'K1', componentType: 'relay', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('transient');
  });

  it('returns ac with moderate confidence for AC + DC sources (no transient)', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      { referenceDesignator: 'V1', componentType: 'voltage_source', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    // AC + DC = two domains, but no transient — AC wins with moderate confidence
    expect(result.type).toBe('ac');
    expect(result.confidence).toBe(0.6);
  });

  it('detects transformer as frequency-dependent', () => {
    const instances: CircuitInstanceForDetection[] = [
      { referenceDesignator: 'VAC1', componentType: 'ac_source', properties: {} },
      { referenceDesignator: 'T1', componentType: 'transformer', properties: {} },
      { referenceDesignator: 'R1', componentType: 'resistor', properties: {} },
    ];
    const result = detectSimulationType(instances);
    expect(result.type).toBe('ac');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
