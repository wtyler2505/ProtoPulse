import { describe, expect, it } from 'vitest';

import {
  canUseAuthoritativeWiring,
  inferPartFamily,
  markPartMetaAsCandidate,
  markPartMetaAsVerified,
  shouldPreferExactBreadboardView,
  summarizePartTrust,
} from '../component-trust';

describe('component-trust helpers', () => {
  it('classifies board-like parts from tags and family hints', () => {
    expect(inferPartFamily({
      family: 'mcu',
      tags: ['arduino', 'module'],
    })).toBe('board-module');

    expect(inferPartFamily({
      family: 'power',
      tags: ['motor', 'driver'],
    })).toBe('driver');

    expect(inferPartFamily({
      family: 'mcu',
      packageType: 'DIP-8',
      tags: ['microcontroller'],
    })).toBe('ic-package');
  });

  it('marks generated board modules as candidates and blocks authoritative wiring', () => {
    const meta = markPartMetaAsCandidate(
      {
        title: 'Arduino Mega 2560 R3',
        family: 'mcu',
        tags: ['arduino', 'module'],
      },
      {
        evidence: [
          {
            type: 'text-request',
            label: 'User exact-part request',
            supports: ['outline', 'pins'],
            confidence: 'medium',
            reviewStatus: 'pending',
          },
          {
            type: 'community-fzpz',
            label: 'Community FZPZ import',
            supports: ['outline', 'labels'],
            confidence: 'medium',
            reviewStatus: 'pending',
          },
        ],
      },
    );

    expect(meta.verificationStatus).toBe('candidate');
    expect(meta.partFamily).toBe('board-module');
    expect(meta.verificationLevel).toBe('community-only');
    expect(canUseAuthoritativeWiring(meta)).toBe(false);
    expect(String((meta.verificationNotes as string[] | undefined)?.[0])).toContain('authoritative wiring');
  });

  it('promotes reviewed exact parts to verified authoritative wiring', () => {
    const candidate = markPartMetaAsCandidate(
      {
        title: 'RioRand motor controller',
        family: 'driver',
        tags: ['motor', 'driver', 'module'],
      },
      {
        evidence: [
          {
            type: 'official-image',
            label: 'Manufacturer board photo',
            supports: ['outline', 'labels', 'mounting-holes'],
            confidence: 'high',
            reviewStatus: 'accepted',
          },
          {
            type: 'datasheet',
            label: 'Pinout PDF',
            supports: ['pins', 'dimensions'],
            confidence: 'high',
            reviewStatus: 'accepted',
          },
        ],
      },
    );

    const verified = markPartMetaAsVerified(candidate, {
      note: 'Reviewed against official pinout and board photo.',
      verifiedBy: 'test-reviewer',
    });

    expect(verified.verificationStatus).toBe('verified');
    expect(verified.verificationLevel).toBe('official-backed');
    expect(verified.breadboardModelQuality).toBe('verified');
    expect(verified.verifiedBy).toBe('test-reviewer');
    expect(canUseAuthoritativeWiring(verified)).toBe(true);
    expect(summarizePartTrust(verified).summary).toContain('verified enough');
  });

  it('prefers exact breadboard views only for board-like parts with artwork', () => {
    expect(
      shouldPreferExactBreadboardView(
        {
          family: 'mcu',
          tags: ['arduino', 'module'],
          verificationStatus: 'candidate',
        },
        {
          breadboard: { shapes: [{ id: 'board', type: 'rect' }] },
        },
      ),
    ).toBe(true);

    expect(
      shouldPreferExactBreadboardView(
        {
          family: 'resistor',
          tags: ['passive'],
          verificationStatus: 'candidate',
        },
        {
          breadboard: { shapes: [{ id: 'body', type: 'rect' }] },
        },
      ),
    ).toBe(false);
  });
});
