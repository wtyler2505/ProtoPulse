# Plan: Audit and Scrub Documentation & UI

## Objective
Remove all outdated references to Anthropic/Claude from the codebase, documentation, and UI to ensure the incoming agents are not confused by legacy claims. The application is now fully migrated to Google Genkit.

## Files to Modify

1. **`AGENTS.md`**
   - Update Stack section to reflect Google Genkit.
   - Remove fake "PROJECT_ID = 1" gotcha.
   - Update AI architecture reference (ai.ts -> Genkit).

2. **`docs/DEVELOPER.md`**
   - Update architecture diagrams and descriptions to remove Anthropic and replace with Genkit.
   - Update Batch API references to state Genkit queue mocking.

3. **`docs/AI_AGENT_GUIDE.md`**
   - Standardize AI tool count to 88.
   - Remove Anthropic configuration options and references.

4. **`client/src/components/panels/ChatPanel.tsx`** (Partial)
   - Remove `anthropic` from type unions and state checks.

5. **`client/src/components/panels/chat/SettingsPanel.tsx`**
   - Remove the Anthropic provider selector button.
   - Remove conditional Anthropic placeholders and error messages.

6. **`client/src/components/panels/chat/MessageInput.tsx`**
   - Remove Anthropic conditional rendering for API key formats.

7. **`client/src/components/panels/chat/ApiKeySetupDialog.tsx`**
   - Remove Anthropic from the `aiProvider` type.

## Execution
Once this plan is approved, I will use `replace` and `run_shell_command` (with node patching scripts) to surgically apply these updates across the documentation and UI files.