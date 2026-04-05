import { describe, expect, it } from 'vitest';

import { buildHardwareCoDebugReadiness } from '@/lib/arduino/hardware-co-debug';

describe('buildHardwareCoDebugReadiness', () => {
  it('blocks AI co-debug when both code and serial logs are missing', () => {
    const readiness = buildHardwareCoDebugReadiness({
      code: '',
      monitor: [],
    });

    expect(readiness.canRun).toBe(false);
    expect(readiness.blockedReason).toContain('needs sketch code, serial logs, or both');
  });

  it('allows AI co-debug with serial logs only and fills a code placeholder', () => {
    const readiness = buildHardwareCoDebugReadiness({
      code: '',
      monitor: [
        { timestamp: 1, direction: 'rx', data: 'Guru Meditation Error' },
        { timestamp: 2, direction: 'rx', data: 'Backtrace: 0x400d1234' },
      ],
    });

    expect(readiness.canRun).toBe(true);
    expect(readiness.hasCode).toBe(false);
    expect(readiness.hasSerialLogs).toBe(true);
    expect(readiness.code).toContain('No sketch code was provided');
    expect(readiness.serialLogs).toContain('Guru Meditation Error');
  });
});
