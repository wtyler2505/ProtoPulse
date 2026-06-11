import { describe, expect, it } from 'vitest';
import { parsePinVerificationIssues } from '@/lib/pin-verification';

describe('parsePinVerificationIssues', () => {
  it('extracts unverified_ai_guess and conflict entries from instance properties', () => {
    const issues = parsePinVerificationIssues([
      {
        id: 1,
        referenceDesignator: 'U1',
        properties: {
          pinVerificationEntries: [
            { pinLabel: 'GPIO0', status: 'unverified_ai_guess', source: 'auditor_mcp' },
            { pinLabel: 'EN', status: 'conflict', source: 'judge_crosscheck' },
            { pinLabel: 'VCC', status: 'verified', source: 'judge_crosscheck' },
          ],
        },
      },
    ]);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({
      referenceDesignator: 'U1',
      pinLabel: 'GPIO0',
      status: 'unverified_ai_guess',
      source: 'auditor_mcp',
      trust: {
        verified: false,
        isMock: true,
        source: 'fallback_unknown',
      },
    });
    expect(issues[1]).toMatchObject({
      referenceDesignator: 'U1',
      pinLabel: 'EN',
      status: 'conflict',
      source: 'judge_crosscheck',
      trust: {
        verified: false,
        isMock: true,
        source: 'fallback_unknown',
      },
    });
  });

  it('ignores malformed entries and falls back to instance-<id> label when missing refdes', () => {
    const issues = parsePinVerificationIssues([
      {
        id: 7,
        properties: {
          pinVerificationEntries: [
            null,
            { status: 'unverified_ai_guess' },
            { pinLabel: 'SCL', status: 'unverified_ai_guess', source: 'auditor_mcp' },
          ],
        },
      },
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      referenceDesignator: 'instance-7',
      pinLabel: 'SCL',
      status: 'unverified_ai_guess',
      trust: {
        verified: false,
        isMock: true,
        source: 'fallback_unknown',
      },
    });
  });
});
