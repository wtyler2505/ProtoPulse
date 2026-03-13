import { describe, it, expect } from 'vitest';
import { buildSimulationContext } from '../lib/simulation-context';
import type { SimulationResultRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date('2026-03-08T12:00:00Z');

function makeSimResult(overrides: Partial<SimulationResultRow> = {}): SimulationResultRow {
  return {
    id: 1,
    circuitId: 1,
    analysisType: 'dc',
    config: {},
    results: {},
    status: 'completed',
    engineUsed: 'mna',
    elapsedMs: 50,
    sizeBytes: null,
    error: null,
    createdAt: now,
    ...overrides,
  } as SimulationResultRow;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSimulationContext', () => {
  it('returns empty string when no results', () => {
    expect(buildSimulationContext([])).toBe('');
  });

  it('returns empty string when all results are non-completed', () => {
    const results = [
      makeSimResult({ status: 'running' }),
      makeSimResult({ status: 'failed', analysisType: 'transient' }),
    ];
    expect(buildSimulationContext(results)).toBe('');
  });

  it('summarizes DC operating point with node voltages (object)', () => {
    const results = [
      makeSimResult({
        analysisType: 'dc',
        results: {
          nodeVoltages: { VCC: 3.3, GND: 0, OUT: 1.65 },
        },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('DC operating point');
    expect(summary).toContain('VCC=3.300V');
    expect(summary).toContain('GND=0.000V');
    expect(summary).toContain('OUT=1.650V');
  });

  it('summarizes DC operating point with node voltages (array)', () => {
    const results = [
      makeSimResult({
        analysisType: 'dc',
        results: {
          nodeVoltages: [
            { node: 'VCC', voltage: 5.0 },
            { node: 'OUT', voltage: 2.5 },
          ],
        },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('VCC=5.000V');
    expect(summary).toContain('OUT=2.500V');
  });

  it('summarizes DC without voltage data gracefully', () => {
    const results = [makeSimResult({ analysisType: 'dc', results: {} })];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('DC operating point: completed (no voltage data)');
  });

  it('summarizes transient analysis', () => {
    const results = [
      makeSimResult({
        analysisType: 'transient',
        results: {
          timeRange: { start: 0, end: 0.001 },
          numSteps: 1000,
          peakValues: { 'V(out)': 3.298, 'I(R1)': 0.015 },
        },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('Transient analysis');
    expect(summary).toContain('0s');
    expect(summary).toContain('0.001s');
    expect(summary).toContain('1000 steps');
    expect(summary).toContain('V(out)=3.298');
  });

  it('summarizes Monte Carlo with yield', () => {
    const results = [
      makeSimResult({
        analysisType: 'monte_carlo',
        results: {
          yield: 0.95,
          iterations: 1000,
          failingParams: ['R1_tolerance', 'C2_tolerance'],
        },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('Monte Carlo');
    expect(summary).toContain('yield: 95.0%');
    expect(summary).toContain('1000 iterations');
    expect(summary).toContain('R1_tolerance');
  });

  it('normalizes Monte Carlo yield >1 as percentage', () => {
    const results = [
      makeSimResult({
        analysisType: 'monte_carlo',
        results: { yield: 87.5, iterations: 500 },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('yield: 87.5%');
  });

  it('summarizes AC/frequency analysis', () => {
    const results = [
      makeSimResult({
        analysisType: 'ac',
        results: {
          bandwidth: 10000,
          gainDb: -3,
          phaseMargin: 45.2,
          frequencyRange: { start: 1, end: 1000000 },
        },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('AC/Frequency analysis');
    expect(summary).toContain('bandwidth: 10000Hz');
    expect(summary).toContain('gain: -3dB');
    expect(summary).toContain('phase margin: 45.2');
  });

  it('handles unknown analysis types with generic summary', () => {
    const results = [
      makeSimResult({
        analysisType: 'noise',
        results: { totalNoise: 1.5e-6 },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('noise: completed');
  });

  it('only shows the latest result per analysis type', () => {
    const older = new Date('2026-03-07T12:00:00Z');
    const newer = new Date('2026-03-08T12:00:00Z');
    const results = [
      makeSimResult({
        id: 2,
        analysisType: 'dc',
        createdAt: newer,
        results: { nodeVoltages: { VCC: 5.0 } },
      }),
      makeSimResult({
        id: 1,
        analysisType: 'dc',
        createdAt: older,
        results: { nodeVoltages: { VCC: 3.3 } },
      }),
    ];
    const summary = buildSimulationContext(results);
    // Should contain 5V (newer), not 3.3V (older)
    expect(summary).toContain('VCC=5.000V');
    expect(summary).not.toContain('VCC=3.300V');
  });

  it('includes circuit name when provided', () => {
    const results = [makeSimResult({ analysisType: 'dc', results: {} })];
    const summary = buildSimulationContext(results, 'PowerSupply');
    expect(summary).toContain('Circuit: "PowerSupply"');
  });

  it('includes timestamp in ISO format', () => {
    const results = [makeSimResult({ analysisType: 'dc', results: {} })];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('2026-03-08T12:00:00.000Z');
  });

  it('handles multiple analysis types in one circuit', () => {
    const results = [
      makeSimResult({
        id: 1,
        analysisType: 'dc',
        results: { nodeVoltages: { VCC: 3.3 } },
      }),
      makeSimResult({
        id: 2,
        analysisType: 'transient',
        results: { timeRange: { start: 0, end: 0.01 } },
      }),
      makeSimResult({
        id: 3,
        analysisType: 'monte_carlo',
        results: { yield: 0.99, iterations: 500 },
      }),
    ];
    const summary = buildSimulationContext(results, 'Main');
    expect(summary).toContain('DC operating point');
    expect(summary).toContain('Transient analysis');
    expect(summary).toContain('Monte Carlo');
    expect(summary).toContain('Circuit: "Main"');
  });

  it('truncates DC voltages to 10 entries with "more" indicator', () => {
    const nodeVoltages: Record<string, number> = {};
    for (let i = 0; i < 15; i++) {
      nodeVoltages[`N${i}`] = i * 0.5;
    }
    const results = [
      makeSimResult({
        analysisType: 'dc',
        results: { nodeVoltages },
      }),
    ];
    const summary = buildSimulationContext(results);
    expect(summary).toContain('... and 5 more');
  });
});
