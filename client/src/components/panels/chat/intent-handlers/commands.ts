import type { IntentHandler } from './types';

function extractSlashCommand(msgText: string): string | null {
  const match = msgText.match(/\/[a-z0-9-]+/i);
  return match ? match[0] : null;
}

export const runJitSkillCommandHandler: IntentHandler = {
  match(lower) {
    return /\/[a-z0-9-]+/.test(lower);
  },
  handle(msgText) {
    const command = extractSlashCommand(msgText);
    if (!command) {
      return { actions: [], response: null };
    }

    return {
      actions: [
        {
          type: 'run_jit_skill',
          command,
        },
      ],
      response: `Queued skill command: ${command}`,
    };
  },
};

