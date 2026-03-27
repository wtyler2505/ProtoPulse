# Client AI UI Components Analysis

> Generated: 2026-03-27 | Auditor: Claude Opus 4.6 (agent-teammate)

---

## Component Inventory

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| ChatPanel | `client/src/components/panels/ChatPanel.tsx` | 1206 | Main AI chat panel (orchestrator) |
| MessageList | ChatPanel.tsx:58-249 (inline) | 192 | Virtualized message rendering |
| DesignAgentPanel | `client/src/components/panels/chat/DesignAgentPanel.tsx` | 327 | Multi-turn agentic AI loop UI |
| MessageBubble | `client/src/components/panels/chat/MessageBubble.tsx` | 299 | Individual message rendering with markdown, tool calls, actions |
| MarkdownContent | MessageBubble.tsx:47-87 | 41 | Sanitized markdown renderer (react-markdown + remark-gfm + rehype-sanitize) |
| SettingsPanel | `client/src/components/panels/chat/SettingsPanel.tsx` | ~200 | AI provider/model/temperature/API key config |
| MessageInput | `client/src/components/panels/chat/MessageInput.tsx` | ~300 | Text input, file upload, voice toggle, multimodal menu |
| ChatHeader | `client/src/components/panels/chat/ChatHeader.tsx` | ~100 | Title bar, search/settings/export/close buttons, branch selector |
| ChatSearchBar | `client/src/components/panels/chat/ChatSearchBar.tsx` | ~50 | Search filter for messages |
| StreamingIndicator | `client/src/components/panels/chat/StreamingIndicator.tsx` | ~60 | Streaming animation + cancel button |
| FollowUpSuggestions | `client/src/components/panels/chat/FollowUpSuggestions.tsx` | ~50 | Context-aware suggestion chips |
| ActionPreviewList | `client/src/components/panels/chat/ActionPreviewList.tsx` | ~80 | List of pending AI actions for review |
| AnswerSourcePanel | `client/src/components/panels/chat/AnswerSourcePanel.tsx` | 94 | Design sources and confidence score display |
| ApiKeySetupDialog | `client/src/components/panels/chat/ApiKeySetupDialog.tsx` | ~100 | First-time API key onboarding dialog |
| SafetyConfirmDialog | `client/src/components/panels/SafetyConfirmDialog.tsx` | ~120 | Safety mode confirmation for destructive actions |
| ConnectionStatusDot | `client/src/components/panels/chat/ConnectionStatusDot.tsx` | ~50 | API key validation status indicator |
| QuickActionsBar | `client/src/components/panels/chat/QuickActionsBar.tsx` | ~80 | Quick action command buttons |
| VoiceInput | `client/src/components/panels/chat/VoiceInput.tsx` | ~60 | Web Speech API voice input |
| ConfidenceBadge | `client/src/components/ui/ConfidenceBadge.tsx` | 97 | AI confidence score badge (4-tier color system) |
| ActionErrorBanner | `client/src/components/circuit-editor/ActionErrorBanner.tsx` | 221 | AI action failure display with retry/dismiss |
| CameraComponentId | `client/src/components/panels/CameraComponentId.tsx` | 525 | Camera-based component identification |
| GenerativeDesignView | `client/src/components/views/GenerativeDesignView.tsx` | 363 | Evolutionary circuit design UI |

### Custom Hooks

| Hook | File | Lines | Purpose |
|------|------|-------|---------|
| useChatPanelUI | `client/src/components/panels/chat/hooks/useChatPanelUI.ts` | 116 | 8-boolean UI visibility state via useReducer |
| useChatMessaging | `client/src/components/panels/chat/hooks/useChatMessaging.ts` | 101 | 7-value messaging state via useReducer |
| useMultimodalState | `client/src/components/panels/chat/hooks/useMultimodalState.ts` | 59 | 3-value multimodal state via useReducer |
| useActionExecutor | `client/src/components/panels/chat/hooks/useActionExecutor.ts` | 93 | Executes AI actions against project state |

### State Context

| Context | File | Lines | Purpose |
|---------|------|-------|---------|
| ChatContext / ChatProvider | `client/src/lib/contexts/chat-context.tsx` | 185 | Messages, branches, optimistic updates via React Query |

---

## ChatPanel.tsx Deep Dive

### Architecture Overview

ChatPanel is the orchestrator component at 1206 lines. It has been significantly decomposed from an earlier monolithic form (referenced as BL-0026). The decomposition is organized into:

1. **Sub-components** (14 `.tsx` files in `chat/`): MessageBubble, SettingsPanel, MessageInput, ChatHeader, ChatSearchBar, StreamingIndicator, FollowUpSuggestions, ActionPreviewList, AnswerSourcePanel, ApiKeySetupDialog, VoiceInput, QuickActionsBar, ConnectionStatusDot, DesignAgentPanel
2. **Custom hooks** (4 files in `chat/hooks/`): useChatPanelUI, useChatMessaging, useMultimodalState, useActionExecutor
3. **Inline sub-component**: MessageList (lines 58-249, memoized with `memo()`)

### Props (ChatPanelProps, line 251)

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `isOpen` | `boolean` | required | Mobile drawer visibility |
| `onClose` | `() => void` | required | Close handler |
| `collapsed` | `boolean` | `false` | Collapsed sidebar state |
| `width` | `number` | `350` | Panel width in pixels |
| `onToggleCollapse` | `() => void` | optional | Collapse toggle handler |

### State Variables (ChatPanel function body)

ChatPanel uses 6 context hooks + 3 custom reducer hooks + additional useState/useRef:

**Context hooks (line 260-267):**
- `useChat()` -> messages, addMessage, isGenerating, setIsGenerating, branches, activeBranchId, setActiveBranchId, createBranch
- `useValidation()` -> runValidation, addValidationIssue, deleteValidationIssue, issues
- `useArchitecture()` -> setNodes, setEdges, nodes, edges, selectedNodeId, captureSnapshot, getChangeDiff
- `useBom()` -> bom, addBomItem, deleteBomItem, updateBomItem
- `useProjectMeta()` -> activeView, setActiveView, activeSheetId, setActiveSheetId, projectName, setProjectName, projectDescription, setProjectDescription
- `useHistory()` -> addToHistory
- `useOutput()` -> addOutputLog

**Custom reducer hooks (lines 268-290):**
- `useChatPanelUI()` -> 8 boolean visibility flags + 15 toggle/set functions
- `useChatMessaging()` -> 7 messaging values + 8 setter functions
- `useMultimodalState()` -> 3 multimodal values + 4 setter functions

**Additional state (lines 292-328):**
- `scrollRef`, `textareaRef`, `abortRef`, `fileInputRef`, `multimodalFileRef` (5 refs)
- `isListening` (voice input state, line 311)
- `safetyPending` (safety confirmation queue, lines 315-324)
- `useChatSettings()` -> aiProvider, aiModel, aiTemperature, customSystemPrompt, routingStrategy, previewAiChanges, googleWorkspaceToken + setters
- `useApiKeyStatus()` -> status, errorMessage, validate, reset
- `useApiKeys()` -> apiKey, updateLocalKey, clearApiKey
- `sendStateRef` (ref-based optimization, lines 437-470)

**Total state surface**: ~45+ reactive values + ~35+ setter/handler functions. Even with the reducer consolidation, this is an extremely large surface for a single component.

### Key Handlers

| Handler | Line | Purpose |
|---------|------|---------|
| `handleMultimodalTypeSelect` | 330 | Routes multimodal input type selection |
| `handleMultimodalFile` | 345 | Processes uploaded file through multimodal pipeline |
| `clearSavedApiKey` | 390 | Clears stored API key for current provider |
| `filteredMessages` (useMemo) | 394 | Case-insensitive search filter on messages |
| Escape key handler (useEffect) | 401 | Closes panel on Escape |
| `resizeTextarea` | 410 | Auto-resize textarea up to 120px |
| `copyMessage` | 420 | Copy message content to clipboard with feedback |
| `toggleVoiceInput` | 472 | Web Speech API recognition start/stop |
| `cancelRequest` | 509 | Aborts in-flight SSE request |
| `handleSend` | 520-835 | **THE CORE HANDLER** - 315 lines of SSE streaming logic |
| `handleRegenerate` | 837 | Re-sends last user message |
| `handleRetry` | 843 | Retry a failed message |
| `exportChat` | 859 | Export chat as plain text file |
| `followUpSuggestions` (useMemo) | 880 | Keyword-based suggestion generation |
| `acceptPendingActions` | 911 | Execute confirmed pending actions |
| `rejectPendingActions` | 924 | Discard pending actions |
| `handleSafetyConfirm` | 937 | Safety mode confirm + optional dismiss |
| `handleSafetyCancel` | 953 | Cancel safety-mode-flagged action |
| `apiKeyValid` | 965 | Validate API key format |

### handleSend Deep Dive (lines 520-835)

This is the most critical function. It handles:

1. **Guard clauses** (522-524): Empty input, already generating
2. **User message creation** (531-538): UUID ID, timestamp, optional image attachments
3. **No-API-key fallback** (543-565): Opens setup dialog, falls back to `parseLocalIntent()` for local commands
4. **AbortController setup** (567-569): 150-second timeout via `setTimeout`
5. **Request body construction** (578-596): Includes provider, model, apiKey, projectId, temperature, customSystemPrompt, activeView, activeSheetId, selectedNodeId, changeDiff, routingStrategy, googleWorkspaceToken, imageBase64/imageMimeType
6. **SSE fetch with retry** (598-625): Exponential backoff (2^retries * 1000ms), max 3 retries, only on `TypeError` (network errors)
7. **Response error handling** (629-632): JSON error extraction
8. **SSE stream parsing** (643-718): Line-by-line parsing of `data: ` prefixed SSE events
   - Event types: `text`, `chunk` (legacy), `tool_call`, `tool_result`, `done`, `error`
   - Tool call display in streaming indicator
   - Source deduplication on `done` event
   - Token estimation (chars/4 approximation)
9. **Cache invalidation** (724-726): Full `queryClient.invalidateQueries()` when server-side tools executed
10. **Action routing** (728-797): Three paths:
    - Destructive/preview -> pending actions (user confirmation required)
    - Safety mode intercept -> safety confirmation dialog
    - Direct execution -> immediate `executeAIActions()`
11. **Error handling** (799-824): AbortError (timeout vs cancel), mapped user-friendly errors, isKeyError detection
12. **Cleanup** (825-834): clearTimeout, setIsGenerating(false), clearStreamingContent, abort ref reset, captureSnapshot

### Rendering Structure (lines 976-1205)

```
<> (Fragment)
  [collapsed state -> vertical "AI Assistant" label] (976-993)
  [mobile backdrop] (997-999)
  <div class="chat-panel-container"> (1000-1177)
    <ChatHeader /> (1009-1021)
    <div class="tab-switcher"> (1024-1048)
      [Chat tab] [Design Agent tab]
    </div>
    <ChatSearchBar /> (1050-1054)
    {showDesignAgent ? <DesignAgentPanel /> : (
      <>
        <MessageList /> (memoized, virtualized) (1061-1081)
        <FollowUpSuggestions /> (1083-1090)
        [Settings slide-over overlay] (1092-1130)
        <MessageInput /> (1132-1173)
      </>
    )}
  </div>
  <ApiKeySetupDialog /> (1179-1184)
  <SafetyConfirmDialog /> (conditional, 1187-1202)
</>
```

### Performance Optimizations Applied

| ID | Description | Line |
|----|-------------|------|
| CAPX-PERF-01 | Static style objects at module scope | 51 |
| CAPX-PERF-01 | Memoized panelWidthStyle | 974 |
| CAPX-PERF-02 | sendStateRef to reduce handleSend deps from 23 to 1 | 437-470, 520 |
| CAPX-PERF-10 | MessageList memoized with `memo()` | 80 |
| CAPX-PERF-11 | Memoized virtualizer callbacks | 102-104 |
| BL-0026 | 8 booleans consolidated into useReducer | 268-276 |
| BL-0026 | 7 messaging values consolidated into useReducer | 278-284 |
| BL-0026 | 3 multimodal values consolidated into useReducer | 286-290 |

### Virtualization

MessageList uses `@tanstack/react-virtual` (line 106):
- `estimateSize`: 120px per message
- `overscan`: 5 items
- `measureElement`: actual DOM height + 16px padding
- Absolute positioning with `translateY` for each virtual row

---

## DesignAgentPanel Analysis

### Architecture

Standalone component (327 lines) with local state only -- no shared context dependencies. Communicates with the server via `resilientStreamFetch` from `@/lib/stream-resilience`.

### Props (line 34)

| Prop | Type | Purpose |
|------|------|---------|
| `projectId` | `number` | Target project for agent operations |
| `apiKey` | `string` | API key for AI requests |

### State Variables (lines 44-55)

| Variable | Type | Initial | Purpose |
|----------|------|---------|---------|
| `description` | `string` | `''` | Circuit description input |
| `maxSteps` | `number` | `8` | Maximum agent steps (1-15 slider) |
| `showAdvanced` | `boolean` | `false` | Advanced settings visibility |
| `isRunning` | `boolean` | `false` | Agent execution state |
| `isReconnecting` | `boolean` | `false` | Network reconnection state |
| `reconnectAttempt` | `number` | `0` | Current reconnect attempt |
| `steps` | `StepEntry[]` | `[]` | Accumulated step log |
| `completeSummary` | `string \| null` | `null` | Completion message |
| `stepsUsed` | `number \| null` | `null` | Steps consumed |
| `error` | `string \| null` | `null` | Error message |

### SSE Event Types (AgentSSEEvent, line 17)

| Type | Description |
|------|-------------|
| `thinking` | Agent reasoning step |
| `tool_call` | Agent calling a tool |
| `tool_result` | Tool execution result |
| `text` | Free-text output |
| `complete` | Agent finished (with summary + stepsUsed) |
| `error` | Agent error |

### Network Resilience (lines 78-145)

Uses `resilientStreamFetch` with lifecycle callbacks:
- `onReconnecting(attempt, maxRetries)`: Shows reconnecting UI + adds log entry
- `onReconnected()`: Clears reconnecting state + adds success log
- `onRetriesExhausted(lastError)`: Sets error with "partial results may still be useful"

Retry config: max 3 retries, 1s initial delay, 30s max delay, 120s idle timeout.

### UI States

1. **Input** (lines 181-223): Description textarea + advanced settings (max steps slider) + Run/Cancel buttons
2. **Reconnecting** (255-263): Amber banner with WifiOff icon and attempt counter
3. **Progress log** (266-291): Scrollable step list with type-specific icons (Loader2 spinning for thinking, Wrench for tool_call, CheckCircle for tool_result, Bot for text)
4. **Complete** (294-304): Green bordered card with step count + summary
5. **Error** (307-323): Red bordered card with error message + Retry button

### Issues

- **MEDIUM**: No input validation on `description` beyond empty check -- the textarea accepts unlimited text length
- **MEDIUM**: `steps` array grows unboundedly via `setSteps((prev) => [...prev, ...])` -- no cap for extremely long agent runs
- **LOW**: `logRef` scrollToBottom uses `setTimeout(scrollToBottom, 50)` -- should use `requestAnimationFrame` or `useEffect`
- **INFO**: The `stepIcon` function (lines 165-178) is recreated every render since it's not memoized -- minor but could be module-scope

---

## Supporting Components

### ConfidenceBadge (97 lines)

Well-structured memoized component with 4-tier confidence scoring:

| Score Range | Label | Color |
|-------------|-------|-------|
| 80-100 | High | Emerald/Green |
| 50-79 | Medium | Yellow |
| 25-49 | Low | Orange |
| 0-24 | Very Low | Red/Destructive |

- Score is clamped to 0-100 and rounded
- Tooltip shows explanation + contributing factors
- `data-testid="confidence-badge"` and `data-testid="confidence-tooltip"` present
- Exports both the component and the `ConfidenceScore` interface
- **Clean implementation** -- no issues found

### ActionErrorBanner (221 lines)

Singleton-pattern error tracker using `useSyncExternalStore` for tear-free reads from `ActionErrorTracker.getInstance()`.

**Key features:**
- Collapsible banner with error count badge
- Per-error retry button (for retryable errors) and dismiss button
- "Dismiss All" bulk action
- Error rows color-coded: amber for retryable, red for non-retryable
- `maxVisible` prop (default 5) with overflow counter
- `aria-expanded` and `aria-label` present on toggle button

**Issues:**
- **LOW**: `tracker.getErrors()` is called inside `handleRetry` callback (line 140) -- reads full array to find one error by ID. Could use a `getError(id)` method if available.
- **INFO**: The `getSnapshot` callback (line 121) only returns the error count, not the errors themselves. The actual errors are read via `tracker.getRecentErrors(maxVisible)` during render (line 154), which is outside the `useSyncExternalStore` contract -- technically this could cause tearing if errors change between the count snapshot and the render read, though practically unlikely.

### CameraComponentId (525 lines)

Comprehensive camera-based component identification with a well-designed state machine:

**State machine phases:** `idle` -> `requesting` -> `streaming` -> `captured` -> `identifying` -> `result` -> `error`

**Key features:**
- `getUserMedia` with `facingMode: 'environment'` for rear camera preference
- Canvas-based frame capture at 85% JPEG quality
- Detailed DOMException error handling (NotAllowedError, NotFoundError, NotReadableError)
- Clean stream teardown on unmount via useEffect cleanup
- Result display with structured fields (componentType, packageType, partNumber, manufacturer, pinCount, confidence, specifications, notes)
- "Add to BOM" integration via callback prop
- Confidence styling for 3 tiers (high/medium/low)

**Issues:**
- **MEDIUM**: `onIdentify` callback contract requires the parent to handle the AI API call -- CameraComponentId is currently only used as a standalone component with optional callbacks. In practice, the `onIdentify` prop is often undefined, making the Identify button permanently disabled (line 361: `disabled={!onIdentify}`). This means the component is partially orphaned in the current UI.
- **LOW**: No loading timeout for the `identifying` state -- if `onIdentify` hangs, the user is stuck with a spinner and no way to cancel (only the general "reset" button is available in other states).
- **INFO**: The `capture` attribute for mobile camera is set via imperative DOM manipulation (`multimodalFileRef.current?.setAttribute('capture', 'environment')`) rather than React-controlled props.

### GenerativeDesignView (363 lines)

Split-panel evolutionary design UI:

**Left panel:** Description textarea, constraint sliders (budget $1-200, power 0.1-50W, temperature 25-150C), population/generation controls, Generate/Cancel buttons, progress indicators.

**Right panel:** Candidate cards grid (2-3 columns) with fitness scores, component counts, fitness breakdowns, Compare/Adopt/Export buttons, inline comparison panels.

**Key features:**
- Uses `useGenerativeDesign()` custom hook for state machine (`idle` -> `generating` -> `scoring` -> `evolving` -> `complete`)
- `AdoptCandidateDialog` for adopting a candidate into the project
- `compareCandidateWithCurrent()` for inline diff view
- `exportCandidate()` for JSON export

**Issues:**
- **HIGH**: `defaultBaseCircuit()` is called fresh every render as `currentIR` for comparison and adopt dialog (lines 78, 355). This means the comparison is always against a hardcoded single-resistor circuit, never the actual project state. The "Adopt" callback on line 356 is a no-op comment: `// AdoptResult is produced -- in the future, this calls the project mutation`. This means the entire Adopt workflow is **non-functional**.
- **MEDIUM**: No connection to the actual project circuit state -- the view operates in isolation with a hardcoded seed circuit.
- **LOW**: Slider for max power uses `step={0.1}` but min is `0.1` -- the `<input type="range">` may produce floating point imprecision.
- **INFO**: The fitness breakdown rendering (lines 272-289) assumes all breakdown entries have a `score` property but doesn't validate the shape.

### AnswerSourcePanel (94 lines)

Clean memoized component showing design sources and confidence details.

**Features:**
- Source list with type-based icons (Database, Search, Info)
- Expandable confidence details with "Why this score?" toggle
- Smooth animation via `animate-in fade-in slide-in-from-top-1`

**Issues:**
- **INFO**: Uses `ExternalLink` icon in imports (line 2) but never uses it in the component body -- dead import.

### MessageBubble (299 lines)

Memoized message rendering component with rich features:

**Features:**
- User vs assistant alignment (flex-row-reverse vs flex-row)
- Avatar icons (User/Bot)
- Markdown rendering for assistant messages (via `MarkdownContent` sub-component with rehype-sanitize for XSS protection)
- Image attachment display with lazy loading
- Tool call result display (success/failure color coding)
- Action badges (executed actions)
- Pending action review panel (ActionPreviewList + Confirm/Discard buttons)
- Answer sources + confidence display (AnswerSourcePanel)
- Message metadata (timestamp, token info, model ID)
- Copy/Regenerate/Retry/Branch action buttons (visible on hover)
- Error state with API key update button
- `data-testid` coverage on key interactive elements

**Security:**
- `rehype-sanitize` applied to markdown -- mitigates XSS
- Link `href` validation: only allows `https?://` protocols (line 76) -- blocks `javascript:` URIs
- External links use `noopener noreferrer` (line 76)

**Issues:**
- **MEDIUM**: The `modelId` field check (line 145) uses `'modelId' in msg` with a type assertion to `Record<string, unknown>` -- fragile runtime type check. The `ChatMessage` type doesn't include `modelId`, so this is reaching beyond the type system.
- **LOW**: The `confidence` prop on `AnswerSourcePanel` comes from `msg.confidence` (line 189) but is also extractable from `msg.toolCalls` via `extractConfidence()` (defined at line 32 but never called in the component). This function appears to be dead code.
- **INFO**: `msg.actions` iteration key (line 197) uses `action.type + idx` which can produce duplicate keys if the same action type appears twice.

---

## Chat Context Analysis

### ChatProvider (185 lines)

**Architecture:** React Context + TanStack React Query for server synchronization.

**Query keys:**
- Messages: `/api/projects/${projectId}/chat` (with optional `?branchId=`)
- Branches: `/api/projects/${projectId}/chat/branches`

**Optimistic updates:** `addChatMutation` uses `onMutate` to immediately append a `temp-{uuid}` message to the cache, with rollback on error via `onError`.

**Branch support:**
- `createBranchMutation`: POST to create branch, auto-switches to new branch
- `activeBranchId`: nullable state, included in query key for branch-specific message loading

**Serialization:** `serializeMetadata()` / `deserializeMetadata()` bridge between the client `ChatMessage` type (with `actions`, `toolCalls`, `isError`, `isKeyError`) and the server's `metadata` JSON column.

**Issues:**
- **MEDIUM**: `addMessage` always mutates via API -- there's no local-only message support. System messages like `"[System: User accepted proposed actions]"` (ChatPanel line 916) are persisted to the database, which pollutes the chat history with internal state messages.
- **MEDIUM**: The `select` transform (lines 79-89) sorts by timestamp on every query response. This is O(n log n) per fetch and could be avoided if the server returns sorted data (which it likely does since chat messages are typically timestamp-ordered).
- **LOW**: `seeded` prop gates query execution (line 78: `enabled: seeded`) but there's no loading/error state exposed for the initial seed check -- the UI just shows empty messages.
- **INFO**: `isBranchesLoading` is exposed but never consumed by any component in the current codebase.

---

## Test Coverage Assessment

### ChatPanel.test.tsx (431 lines, 10 tests)

**Coverage:** Basic structural and interaction tests. Mocks ALL sub-components and context hooks.

**What's tested:**
- Collapsed state rendering + toggle callback
- Expanded panel structure (header, input, empty state)
- Mobile backdrop click -> onClose
- Text input + Enter key -> handleSend
- Message bubble rendering with messages
- Streaming indicator when isGenerating
- Settings toggle open/close
- Search toggle shows search bar
- Empty state suggestion buttons trigger handleSend

**What's NOT tested:**
- SSE streaming flow (the entire handleSend async flow)
- Action confirmation/rejection (pendingActions)
- Safety confirmation dialog
- Multimodal file upload
- Voice input
- Chat export
- Follow-up suggestion generation logic
- API key validation
- Tab switching (Chat vs Design Agent)
- Escape key handler
- Error states (API errors, timeout, abort)
- Branch creation
- Token info display
- Settings panel pass-through props
- No-API-key fallback to local commands

**Assessment: LOW coverage** -- only structural smoke tests. The most critical behavior (SSE streaming, action execution, error handling) is completely untested.

### CameraComponentId.test.tsx (675 lines, 20 tests)

**Coverage: EXCELLENT** -- thorough state machine testing.

**What's tested:**
- Initial idle state rendering
- Camera API unavailable error
- Permission denied (NotAllowedError)
- Camera not found (NotFoundError)
- Camera in use (NotReadableError)
- Generic DOMException errors
- Non-DOMException errors
- Successful camera start and video stream
- Image capture from video
- Retake photo flow
- Full identification flow (start -> capture -> identify -> result)
- Null identification result
- Identification error
- Add to BOM callback
- No suggestedBom -> no Add to BOM button
- Stream cleanup on unmount
- Reset button
- Try again after error
- Medium/low confidence styling
- Empty specifications
- Disabled identify button without onIdentify
- Requesting state during permission
- Base64 prefix stripping
- Minimal result (all null fields)

**Assessment:** One of the best-tested components in the codebase.

### GenerativeDesignView.test.tsx (239 lines, 12 tests)

**Coverage: MODERATE** -- covers basic rendering and interactions.

**What's tested:**
- Spec form rendering
- Generate button rendering and click
- Empty state
- Candidate cards display
- Fitness score display
- Cancel button during generation
- Loading states (scoring, evolving)
- Generation progress info
- Constraint sliders
- Population/generation controls
- Component count
- Disabled state during generation

**What's NOT tested:**
- Compare button click -> comparison panel rendering
- Adopt button click -> dialog opening
- Export button click
- Constraint slider value changes affecting generation
- The `handleGenerate` spec construction

---

## Issues Found

### CRITICAL

| ID | Component | Description |
|----|-----------|-------------|
| C-1 | GenerativeDesignView | **Adopt workflow is non-functional.** The `onAdopt` callback (line 356) is a no-op comment. The `currentIR` for comparison is always `defaultBaseCircuit()` (a single resistor), never the actual project state. Users can click "Adopt" but nothing happens. |

### HIGH

| ID | Component | Description |
|----|-----------|-------------|
| H-1 | ChatPanel.handleSend | **315-line monolith** (lines 520-835). This single function handles input validation, message creation, API key check, abort controller setup, request body construction, SSE fetch with retry, stream parsing (6 event types), cache invalidation, action routing (3 paths), error handling, and cleanup. This is the most complex function in the entire client codebase and is **zero percent tested**. |
| H-2 | ChatPanel | **Token estimation is a rough approximation** (lines 697-700). Uses `chars/4` for both input and output tokens, with hardcoded pricing ($0.00025/input, $0.0005/output per 1000 tokens). These prices don't match any current model pricing and the estimation method is inaccurate. Users see misleading cost information. |
| H-3 | ChatPanel | **Full `queryClient.invalidateQueries()` on server tool calls** (line 725). Every time the AI uses a server-side tool, ALL React Query caches are invalidated. This triggers re-fetches for every cached query in the app, causing unnecessary network traffic and potential UI flicker. |

### MEDIUM

| ID | Component | Description |
|----|-----------|-------------|
| M-1 | ChatPanel | **sendStateRef pattern** (lines 437-470). Stores ~23 values in a ref to avoid dependency array bloat. While this prevents stale closures, it bypasses React's dependency tracking entirely. Any future developer must remember that `handleSend` reads ALL state from the ref, not from closure variables. This is an intentional tradeoff but fragile to maintain. |
| M-2 | ChatPanel | **No-API-key path has confusing UX** (lines 543-565). When there's no API key: (1) opens the setup dialog, (2) BUT ALSO immediately processes the message as a local command via `parseLocalIntent()` after LOCAL_COMMAND_DELAY. The user sees the dialog AND gets a response simultaneously, which is contradictory -- they're being asked to set up an API key while also receiving a response without one. |
| M-3 | ChatPanel.followUpSuggestions | **Keyword-based suggestion logic** (lines 880-908) is brittle. Checks for substrings like "architecture", "bom", "validation" in the last assistant message. Produces generic suggestions like "Run Validation" that may not be contextually appropriate. |
| M-4 | DesignAgentPanel | **Unbounded step array** -- steps grow via `setSteps(prev => [...prev, ...])` with no cap. A 15-step agent run with multiple tool calls per step could accumulate dozens of entries. |
| M-5 | MessageBubble | **`extractConfidence()` is dead code** (lines 32-45). Defined but never called. Confidence is now passed via `msg.confidence` prop directly. |
| M-6 | chat-context | **System messages persisted to DB** -- messages like `"[System: User accepted proposed actions]"` are saved as user messages via `addMessage()`, polluting chat history. |
| M-7 | CameraComponentId | **Partially orphaned** -- the `onIdentify` prop is optional and when missing, the Identify button is permanently disabled. Need to verify where this component is wired into the UI and whether `onIdentify` is actually provided. |
| M-8 | ChatPanel | **No message deduplication** -- if `handleSend` is called rapidly (e.g., double-click), two user messages could be added before `isGenerating` guard kicks in, because `isGenerating` is read from `sendStateRef.current` which may not reflect the state set in a concurrent call. |

### LOW

| ID | Component | Description |
|----|-----------|-------------|
| L-1 | ChatPanel | `voice input` Web Speech API detection (line 473) uses `'webkitSpeechRecognition' in window` which only works in Chrome/Edge. No fallback or feature detection for other browsers. The voice button would still render but clicking it silently does nothing. |
| L-2 | ChatPanel.exportChat | `alert('Failed to export chat. Please try again.')` (line 874) uses native browser alert, inconsistent with the rest of the app which uses toast notifications. |
| L-3 | DesignAgentPanel | `setTimeout(scrollToBottom, 50)` (lines 111, 122, 132) -- should use `requestAnimationFrame` or a `useEffect` dependency for reliable timing. |
| L-4 | MessageBubble | `action.type + idx` key (line 197) can produce duplicate keys if the same action type appears more than once. |
| L-5 | AnswerSourcePanel | Dead import: `ExternalLink` imported but never used. |
| L-6 | useChatPanelUI | `toggleSetupDialog` callback (line 82) is defined but never exposed in the return object (line 97). Dead code. |
| L-7 | ChatPanel | `copyMessage` callback (line 420) has empty dependency array `[]` despite using `setCopiedId` from the reducer -- works because dispatch is stable, but the eslint-plugin-react-hooks would flag this. |

### INFO

| ID | Component | Description |
|----|-----------|-------------|
| I-1 | ChatPanel | The `aiProvider` type is hardcoded to `'gemini'` in the `sendStateRef` type (line 440), but the actual `useChatSettings` hook returns it as `string`. This suggests the provider was recently narrowed to Gemini-only. |
| I-2 | ChatPanel | NAVIGATIONAL_ACTIONS set (line 19) includes `'start_tutorial'` but not `'show_tutorial'` -- need to verify this matches the server's action types. |
| I-3 | MessageBubble | `MarkdownContent` is exported (line 47) but only used within MessageBubble itself. Consider whether external usage is intended. |
| I-4 | useChatMessaging | `SET_INPUT_FN` action type (line 28) allows a function updater pattern. This is used by voice input (line 501: `setInput((prev: string) => prev + transcript)`) -- good pattern but uncommon in reducer designs. |

---

## UX/Accessibility Gaps

### Accessibility

| Gap | Severity | Component | Description |
|-----|----------|-----------|-------------|
| A-1 | HIGH | ChatPanel | **No focus management on panel open.** When the panel opens, focus doesn't move to the textarea or any focusable element. Screen reader users won't know the panel appeared. |
| A-2 | HIGH | MessageList | **No ARIA live region for new messages.** When the AI responds, there's no `aria-live` announcement. Screen readers won't announce incoming messages. |
| A-3 | HIGH | StreamingIndicator | **No ARIA live region for streaming content.** The real-time streaming text has no accessibility annotations. |
| A-4 | MEDIUM | ChatPanel tabs | **Tab switcher is not a proper tablist.** The Chat/Design Agent tabs (lines 1024-1048) are plain `<button>` elements without `role="tablist"`, `role="tab"`, `aria-selected`, or `aria-controls`. |
| A-5 | MEDIUM | GenerativeDesignView | **Slider labels not associated.** Constraint slider labels (lines 120-154) use `<label>` without `htmlFor` (or with incorrect association for range inputs). Screen readers won't know what the sliders control. |
| A-6 | MEDIUM | DesignAgentPanel | **Progress log has no ARIA live region.** Step entries are added dynamically but without `aria-live="polite"` or equivalent. |
| A-7 | LOW | MessageBubble | **Hover-only action buttons** (line 255: `opacity-0 group-hover/msg:opacity-100`). Copy/Regenerate/Retry/Branch buttons are invisible until hover. Keyboard-only users cannot discover these actions without tabbing through, and there's no visual indication they exist. |
| A-8 | LOW | ConfidenceBadge | **Tooltip content not keyboard-accessible.** The `StyledTooltip` wrapping requires hover -- keyboard users can't access the explanation and factors. |

### UX Issues

| Gap | Severity | Component | Description |
|-----|----------|-----------|-------------|
| U-1 | MEDIUM | ChatPanel | **No message loading state.** When the chat context is fetching messages from the server, no skeleton or spinner is shown -- just the empty state with template buttons. A returning user might think their history is gone. |
| U-2 | MEDIUM | ChatPanel | **150-second timeout** (line 569) is very long with no progress indicator beyond streaming content. If the server is processing but not streaming yet, the user sees nothing for up to 150 seconds. |
| U-3 | MEDIUM | DesignAgentPanel | **No indication of API key requirement.** The Run button is disabled when `!apiKey` (line 232) but there's no message explaining why or how to set up a key. |
| U-4 | LOW | ChatPanel | **Settings overlay blocks the entire chat area** (lines 1094-1130) with a backdrop blur. Users can't read messages while adjusting settings. A slide-out drawer would be better. |
| U-5 | LOW | ChatPanel.collapsed | **Collapsed state only visible on `lg:` screens** (line 980: `hidden lg:flex`). On mobile, the collapsed panel is completely invisible -- there's no collapsed indicator for small screens. |

---

## Performance Concerns

| ID | Severity | Description |
|----|----------|-------------|
| P-1 | HIGH | **Full queryClient invalidation** (ChatPanel line 725). `queryClient.invalidateQueries()` with no filter invalidates EVERY cached query -- all architecture nodes, BOM items, validation issues, chat messages, branches, etc. This triggers a waterfall of re-fetches across the entire app. Should be scoped to only the queries that AI tools can modify. |
| P-2 | MEDIUM | **sendStateRef.current reassigned every render** (lines 464-470). The ref object is updated on every ChatPanel render with all 23 current values. While the ref assignment itself is cheap, the object literal creation and the fact that this forces all children to see updated values on next call could interact poorly with concurrent features. |
| P-3 | MEDIUM | **filteredMessages recalculated on every messages/chatSearch change** (line 394). The `toLowerCase().includes()` search is O(n*m) where n is message count and m is average message length. For long conversations (100+ messages with long AI responses), this could become noticeable. Consider debouncing the search. |
| P-4 | LOW | **useVirtualizer estimateSize returns static 120** (line 103). This means initial layout calculations will be inaccurate for short messages or long AI responses with code blocks. The `measureElement` callback corrects this, but the initial overscan may render wrong items. |
| P-5 | LOW | **followUpSuggestions useMemo depends on `nodes`** (line 909) -- the entire nodes array is a dependency. Any node change (drag, add, delete) triggers suggestion recalculation even though nodes are only used for `nodes.length > 0` check. |
| P-6 | INFO | **DesignAgentPanel creates new step objects via spread** (line 102: `setSteps((prev) => [...prev, { ... }])`). For long agent runs, this creates progressively larger array copies. Not a real issue for 15-step max but worth noting. |

---

## Recommendations

### Critical (Must Fix)

1. **Wire GenerativeDesignView to project state** -- Replace `defaultBaseCircuit()` with actual project circuit IR. Implement the `onAdopt` callback to actually create architecture nodes/edges. This is a fully non-functional feature that users can see but not use.

2. **Extract handleSend into a custom hook** -- The 315-line `handleSend` function should become `useChatSend()` or similar, with the SSE streaming logic, retry mechanism, action routing, and error handling each as separate sub-functions. This is the most complex untested code path in the client.

3. **Add tests for handleSend** -- At minimum: SSE stream parsing, error handling (timeout, abort, network error), action routing (destructive, preview, safety mode, direct), no-API-key fallback.

### High Priority

4. **Scope queryClient invalidation** -- Replace `queryClient.invalidateQueries()` with targeted invalidation based on which tools were called (e.g., only invalidate architecture queries if architecture tools were used).

5. **Fix token cost estimation** -- Either remove the cost display entirely or fetch actual token counts from the server's `done` event (the server likely has this data from the AI provider response).

6. **Add ARIA live regions** -- At minimum, add `aria-live="polite"` to the message list container and the streaming indicator.

### Medium Priority

7. **Fix the no-API-key UX** -- Don't execute local commands while simultaneously showing the API key setup dialog. Either show the dialog and wait, or execute the local command without the dialog.

8. **Add message loading state** -- Show a skeleton while chat messages are loading from the server.

9. **Implement proper tab pattern** -- Use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` for the Chat/Design Agent tab switcher.

10. **Clean up dead code** -- Remove `extractConfidence()` from MessageBubble, unused `ExternalLink` import from AnswerSourcePanel, unused `toggleSetupDialog` from useChatPanelUI.
