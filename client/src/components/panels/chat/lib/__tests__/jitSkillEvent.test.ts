import { describe, expect, it } from 'vitest';
import { buildJitSkillChatMessage } from '../jitSkillEvent';

describe('buildJitSkillChatMessage', () => {
  it('builds a command-oriented chat message from valid detail', () => {
    const message = buildJitSkillChatMessage({
      command: '/resolve-net-driver-conflict',
      ruleType: 'driver-conflict',
      violationId: 'erc-11',
    });

    expect(message).toContain('/resolve-net-driver-conflict');
    expect(message).toContain('driver-conflict');
    expect(message).toContain('erc-11');
  });

  it('returns null when command is missing', () => {
    expect(buildJitSkillChatMessage({ ruleType: 'floating-input', violationId: 'erc-2' })).toBeNull();
  });
});

