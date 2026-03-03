/**
 * Extended Thinking — opt-in deep reasoning for complex circuit operations
 */

import type { ThinkingConfig } from './types';

const THINKING_BUDGET = parseInt(process.env.THINKING_BUDGET ?? '10000', 10);
const THINKING_DISABLED = process.env.DISABLE_EXTENDED_THINKING === '1';

export function getThinkingConfig(): ThinkingConfig | Record<string, never> {
  if (THINKING_DISABLED) {
    return {};
  }
  return { thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET } };
}
