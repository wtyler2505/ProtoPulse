// ---------------------------------------------------------------------------
// parseLocalIntent — unified intent parser for offline (no API key) mode.
//
// Instead of directly mutating state (as the old processLocalCommand did),
// this produces AIAction[] that flow through the same executeAIActions path
// the AI tool system uses. This ensures:
//   - Consistent action execution (one code path for mutations)
//   - Action logging works for both online and offline
//   - Easier testing (pure input → output)
//
// Handler logic lives in intent-handlers/. This file drives the registry loop.
// ---------------------------------------------------------------------------

import { intentHandlers } from './intent-handlers';
import type { IntentContext, ParsedIntent } from './intent-handlers';

export type { IntentContext, ParsedIntent } from './intent-handlers';

const DEFAULT_RESPONSE =
  "I've analyzed your request. I can help with navigation, design, BOM management, validation, and project settings. Type 'help' to see all available commands.";

/**
 * Parse a user's text input into structured AIActions and an optional response.
 * Returns { actions, response } — when actions is non-empty, they should be
 * routed through executeAIActions. When response is non-null, it should be
 * shown as the assistant's message.
 */
export function parseLocalIntent(msgText: string, ctx: IntentContext): ParsedIntent {
  const lower = msgText.toLowerCase().trim();

  for (const handler of intentHandlers) {
    if (handler.match(lower)) {
      const result = handler.handle(msgText, ctx);
      // A handler may match broadly but fail to produce a result for the
      // specific input (e.g. "remove node" matches but no name was parsed).
      // In that case it returns { actions: [], response: null } to signal
      // that the next handler should be tried.
      if (result.response !== null || result.actions.length > 0) {
        return result;
      }
    }
  }

  return { actions: [], response: DEFAULT_RESPONSE };
}
