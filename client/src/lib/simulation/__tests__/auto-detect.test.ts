import { describe, it, expect } from 'vitest';
import { autoDetectAnalysisType } from '../auto-detect';
import type { CircuitInstanceForDetection } from '../auto-detect';

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
