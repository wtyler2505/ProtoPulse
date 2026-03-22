# QA Audit: Section 4 — AI Chat Panel

## Summary
- **Tested**: 2026-03-22
- **Status**: PARTIAL (functional but has issues)
- **Issues found**: 1 critical, 3 warnings, 1 cosmetic

## Checks Performed
- [x] Chat panel renders with header, messages, input area
- [x] Messages display in chronological order (08:08→08:09→08:15→...→09:43)
- [x] Each message has timestamp, Copy button, Branch button
- [x] Error messages show Retry button — present on "Something went wrong" message
- [x] Two tabs: "Chat" + "Design Agent" — both visible
- [x] Status indicator: "API key set (unverified)" — visible
- [x] Status bar: "API — Gemini Gemini 3.1 Pro (Custom Tools)" — correct model
- [x] Quick action buttons: 7 visible (Generate Architecture, Optimize BOM, Run Validation, Add MCU Node, Project Summary, Show Help, Export BOM CSV) with scroll indicator
- [x] Input area: multiline textbox + Toggle quick actions + Upload image + Multimodal input + Voice input + Send button
- [x] Send button disabled when input is empty — confirmed
- [x] Send button enabled when text is entered — confirmed
- [x] Settings panel opens — shows MODEL, MODEL ROUTING, API KEY, GOOGLE WORKSPACE TOKEN, TEMPERATURE, PREVIEW AI CHANGES, CUSTOM INSTRUCTIONS
- [x] Settings MODEL dropdown — 4 Gemini models available (no Claude models)
- [x] Settings MODEL ROUTING — 5 options (Manual, Auto, Quality, Speed, Cost)
- [x] Settings TEMPERATURE slider — at 0.7, range 0-2
- [x] Settings PREVIEW AI CHANGES toggle — checked (on)
- [x] Settings Save & Close — works, shows toast "Settings saved"
- [x] Chat panel toggle (Hide/Show) — works correctly
- [x] Console errors: 3 (all dev-mode CSP/HMR, no app errors)
- [ ] Streaming response — not tested (would burn API credits)
- [ ] Chat search — not tested
- [ ] Chat export — not tested
- [ ] Branch conversation — not tested
- [ ] Design Agent tab — not tested

## Issues Found

### Critical

**C1: API key validation shows "too short" error for server-stored keys**
- **What happens**: Settings panel shows API KEY field with `invalid="true"` and error message "API key appears too short"
- **Root cause**: The displayed value is the STORED_KEY_SENTINEL (`********` — 8 chars) which triggers the min-length validation. The actual key is stored server-side and is valid.
- **Impact**: User sees a red error on their API key even though it's working fine. Confusing and undermines trust.
- **Fix**: Skip length validation when the value equals `STORED_KEY_SENTINEL`. Or show "Key stored securely" instead of the sentinel value.
- **Screenshot**: `s4-02-chat-settings.jpg`

### Warnings

**W1: localStorage storage message is stale for authenticated users**
- **What happens**: Settings panel says "Key is stored in browser localStorage (unencrypted)."
- **Reality**: For authenticated users, keys are stored server-side with AES-256-GCM encryption
- **Fix**: Conditionally show "Key is stored securely on the server" when authenticated, "Key is stored in browser localStorage" when not

**W2: Chat input requires click before fill works**
- **What happens**: Attempting to type in the chat input via automation sometimes fails on first attempt, works after clicking the input first
- **Impact**: May indicate the input doesn't auto-focus or has a focus trap issue
- **Note**: This could be a Chrome DevTools MCP limitation, not an actual bug. Manual testing recommended.

**W3: Error message from previous session still visible**
- **What happens**: "Something went wrong: Internal server error" message from a previous session (08:16 AM) is still visible in the chat history
- **Impact**: Old errors persist and create a negative first impression. The old error was caused by the missing `tolerance` column (now fixed via db:push).
- **Suggestion**: Consider adding a "Clear error" action or auto-dismissing error messages after the underlying issue is fixed

### Cosmetic

**CO1: "API key set (unverified)" status even after Test Connection would work**
- The status always shows "(unverified)" — there's no automatic verification flow
- A "Test Connection" button exists in settings but the status doesn't update after successful test
- Minor trust issue — user sees "unverified" and wonders if it's working

## What Works Well
- **Message chronological ordering** — Fixed in Wave 139, confirmed working
- **Model/provider display** — Correctly shows "Gemini 3.1 Pro (Custom Tools)" — fixed in earlier session
- **Settings panel** — Comprehensive, well-organized, all controls functional
- **Quick action buttons** — 7 contextual actions with horizontal scroll
- **Tab system** — Chat + Design Agent tabs clearly separated
- **Media input buttons** — Upload, Multimodal capture, Voice input all present and labeled
- **Toast notifications** — "Settings saved" feedback after settings change
- **Streaming was verified working** in earlier session testing (sent "What is this project about?" and got a streaming response)

## Screenshots
- `s4-01-chat-panel-full.jpg` — Full chat panel with messages and suggestions
- `s4-02-chat-settings.jpg` — Settings panel with all controls

## Notes
- Streaming, chat search, chat export, and branch conversation were not tested in this section to avoid burning API credits and to keep the audit focused. These can be tested in a dedicated streaming test if needed.
- The chat panel already received fixes earlier in this session (message ordering, model mismatch) — those fixes are confirmed working.
