import { describe, it, expect } from 'vitest';
import {
  compareValues,
  compareCircuit,
  overallHealth,
  defaultComparisonConfig,
  type ComparisonConfig,
  type ComparisonShadowState,
  type ComparisonResult,
} from '../comparison-engine';

// ---------------------------------------------------------------------------
// compareValues
// ---------------------------------------------------------------------------

describe('compareValues', () => {
  const config = defaultComparisonConfig(); // 5% warn, 20% fail, 0.1V abs min

  it('returns match when values are identical', () => {
    expect(compareValues(5.0, 5.0, config)).toBe('match');
  });

  it('returns match within 5% threshold', () => {
    // 5.0 * 0.04 = 0.2 deviation → 4% → match
    expect(compareValues(5.0, 5.2, config)).toBe('match');
  });

  it('returns warn at exactly 5% deviation', () => {
    // 5.0 * 0.05 = 0.25 → exactly 5%
    expect(compareValues(5.0, 5.25, config)).toBe('warn');
  });

  it('returns warn between 5% and 20%', () => {
    // 5.0 → 5.5 = 10% deviation
    expect(compareValues(5.0, 5.5, config)).toBe('warn');
  });

  it('returns fail at 20% deviation', () => {
    // 5.0 → 6.0 = 20%
    expect(compareValues(5.0, 6.0, config)).toBe('fail');
  });

  it('returns fail above 20% deviation', () => {
    // 5.0 → 8.0 = 60%
    expect(compareValues(5.0, 8.0, config)).toBe('fail');
  });

  it('handles negative simulated values', () => {
    // -5.0 → -5.5 = 10% deviation
    expect(compareValues(-5.0, -5.5, config)).toBe('warn');
  });

  it('handles negative measured values', () => {
    // 5.0 → -5.0 = 200% deviation
    expect(compareValues(5.0, -5.0, config)).toBe('fail');
  });

  it('uses absolute comparison for small values (below 0.1V)', () => {
    // simulated = 0.01, measured = 0.01 → 0 deviation → match
    expect(compareValues(0.01, 0.01, config)).toBe('match');
  });

  it('matches for zero simulated and zero measured', () => {
    expect(compareValues(0, 0, config)).toBe('match');
  });

  it('uses absolute threshold for zero simulated value', () => {
    // simulated = 0, measured = 0.001 → small absolute deviation → match
    expect(compareValues(0, 0.001, config)).toBe('match');
  });

  it('fails for zero simulated with large measured', () => {
    // simulated = 0, measured = 1.0 → large absolute deviation → fail
    expect(compareValues(0, 1.0, config)).toBe('fail');
  });

  it('respects custom thresholds', () => {
    const custom: ComparisonConfig = {
      warnThresholdPercent: 10,
      failThresholdPercent: 50,
      absoluteMinThreshold: 0.01,
    };
    // 5.0 → 5.3 = 6% → below 10% warn → match
    expect(compareValues(5.0, 5.3, custom)).toBe('match');
    // 5.0 → 5.6 = 12% → above 10% warn, below 50% fail → warn
    expect(compareValues(5.0, 5.6, custom)).toBe('warn');
    // 5.0 → 8.0 = 60% → above 50% fail → fail
    expect(compareValues(5.0, 8.0, custom)).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// compareCircuit
// ---------------------------------------------------------------------------

describe('compareCircuit', () => {
  function makeShadow(
    channels: Array<{ id: string; name: string; value: number | boolean | string }>,
  ): ComparisonShadowState {
    const reported = new Map<string, { value: number | boolean | string }>();
    const manifestChannels: Array<{ id: string; name: string }> = [];
    for (const ch of channels) {
      reported.set(ch.id, { value: ch.value });
      manifestChannels.push({ id: ch.id, name: ch.name });
    }
    return {
      reported,
      manifest: { channels: manifestChannels },
    };
  }

  it('produces match results for identical values', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Analog 0', value: 3.3 }]);
    const sim = new Map([['A0', 3.3]]);
    const results = compareCircuit(shadow, sim);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('match');
    expect(results[0].channelId).toBe('A0');
    expect(results[0].channelName).toBe('Analog 0');
    expect(results[0].simulated).toBe(3.3);
    expect(results[0].measured).toBe(3.3);
    expect(results[0].deviation).toBe(0);
  });

  it('produces warn result for 10% deviation', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Analog 0', value: 5.5 }]);
    const sim = new Map([['A0', 5.0]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].status).toBe('warn');
    expect(results[0].deviation).toBeCloseTo(0.5);
  });

  it('produces fail result for 25% deviation', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Analog 0', value: 6.25 }]);
    const sim = new Map([['A0', 5.0]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].status).toBe('fail');
  });

  it('produces no_data when simulation data is missing', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Analog 0', value: 3.3 }]);
    const sim = new Map<string, number>();
    const results = compareCircuit(shadow, sim);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('no_data');
    expect(results[0].simulated).toBeNull();
    expect(results[0].measured).toBe(3.3);
  });

  it('produces no_data when measured data is missing', () => {
    const shadow: ComparisonShadowState = {
      reported: new Map(),
      manifest: { channels: [] },
    };
    const sim = new Map([['A0', 3.3]]);
    const results = compareCircuit(shadow, sim);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('no_data');
    expect(results[0].simulated).toBe(3.3);
    expect(results[0].measured).toBeNull();
  });

  it('handles multiple channels', () => {
    const shadow = makeShadow([
      { id: 'A0', name: 'Analog 0', value: 3.3 },
      { id: 'A1', name: 'Analog 1', value: 2.5 },
      { id: 'D13', name: 'LED', value: true },
    ]);
    const sim = new Map([
      ['A0', 3.3],
      ['A1', 5.0],
      ['D13', 1.0],
    ]);
    const results = compareCircuit(shadow, sim);
    expect(results).toHaveLength(3);
    const a0 = results.find((r) => r.channelId === 'A0')!;
    const a1 = results.find((r) => r.channelId === 'A1')!;
    const d13 = results.find((r) => r.channelId === 'D13')!;
    expect(a0.status).toBe('match');
    expect(a1.status).toBe('fail'); // 2.5 vs 5.0 = 50%
    expect(d13.status).toBe('match'); // true=1 vs 1.0 = match
  });

  it('converts boolean measured values to 0/1', () => {
    const shadow = makeShadow([{ id: 'D13', name: 'LED', value: false }]);
    const sim = new Map([['D13', 0]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].measured).toBe(0);
    expect(results[0].status).toBe('match');
  });

  it('treats string measured values as no_data', () => {
    const shadow = makeShadow([{ id: 'status', name: 'Status', value: 'running' }]);
    const sim = new Map([['status', 1.0]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].status).toBe('no_data');
    expect(results[0].measured).toBeNull();
  });

  it('uses custom config', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Analog 0', value: 5.3 }]);
    const sim = new Map([['A0', 5.0]]);
    const custom: ComparisonConfig = {
      warnThresholdPercent: 10,
      failThresholdPercent: 50,
      absoluteMinThreshold: 0.01,
    };
    const results = compareCircuit(shadow, sim, custom);
    // 6% deviation, custom warn at 10% → match
    expect(results[0].status).toBe('match');
  });

  it('uses channel name from manifest', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Temperature Sensor', value: 3.3 }]);
    const sim = new Map([['A0', 3.3]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].channelName).toBe('Temperature Sensor');
  });

  it('falls back to channelId when no manifest', () => {
    const shadow: ComparisonShadowState = {
      reported: new Map([['A0', { value: 3.3 }]]),
      manifest: null,
    };
    const sim = new Map([['A0', 3.3]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].channelName).toBe('A0');
  });

  it('returns empty array for empty inputs', () => {
    const shadow: ComparisonShadowState = {
      reported: new Map(),
      manifest: null,
    };
    const sim = new Map<string, number>();
    expect(compareCircuit(shadow, sim)).toHaveLength(0);
  });

  it('includes message with deviation percentage', () => {
    const shadow = makeShadow([{ id: 'A0', name: 'Analog 0', value: 5.5 }]);
    const sim = new Map([['A0', 5.0]]);
    const results = compareCircuit(shadow, sim);
    expect(results[0].message).toContain('10.0%');
  });
});

// ---------------------------------------------------------------------------
// overallHealth
// ---------------------------------------------------------------------------

describe('overallHealth', () => {
  function makeResult(status: 'match' | 'warn' | 'fail' | 'no_data'): ComparisonResult {
    return {
      channelId: 'test',
      channelName: 'test',
      simulated: 1,
      measured: 1,
      deviation: 0,
      deviationPercent: 0,
      status,
      message: '',
    };
  }

  it('returns match when all channels match', () => {
    const health = overallHealth([makeResult('match'), makeResult('match')]);
    expect(health.status).toBe('match');
    expect(health.passCount).toBe(2);
    expect(health.warnCount).toBe(0);
    expect(health.failCount).toBe(0);
  });

  it('returns warn when worst is warn', () => {
    const health = overallHealth([makeResult('match'), makeResult('warn')]);
    expect(health.status).toBe('warn');
    expect(health.passCount).toBe(1);
    expect(health.warnCount).toBe(1);
  });

  it('returns fail when any channel fails', () => {
    const health = overallHealth([makeResult('match'), makeResult('warn'), makeResult('fail')]);
    expect(health.status).toBe('fail');
    expect(health.failCount).toBe(1);
  });

  it('returns no_data when all are no_data', () => {
    const health = overallHealth([makeResult('no_data'), makeResult('no_data')]);
    expect(health.status).toBe('no_data');
    expect(health.noDataCount).toBe(2);
  });

  it('returns match for mix of match and no_data', () => {
    const health = overallHealth([makeResult('match'), makeResult('no_data')]);
    // no_data alone does not degrade overall status when there are passing results
    expect(health.status).toBe('match');
  });

  it('returns match for empty results', () => {
    const health = overallHealth([]);
    expect(health.status).toBe('match');
    expect(health.passCount).toBe(0);
  });

  it('counts all categories correctly', () => {
    const health = overallHealth([
      makeResult('match'),
      makeResult('match'),
      makeResult('warn'),
      makeResult('fail'),
      makeResult('no_data'),
    ]);
    expect(health.passCount).toBe(2);
    expect(health.warnCount).toBe(1);
    expect(health.failCount).toBe(1);
    expect(health.noDataCount).toBe(1);
    expect(health.status).toBe('fail');
  });
});
