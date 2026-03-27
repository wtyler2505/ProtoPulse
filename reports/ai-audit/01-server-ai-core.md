# Server AI Core Analysis (server/ai.ts)

## File Stats

| Metric | Value |
|--------|-------|
| File | `server/ai.ts` |
| Lines | 1317 |
| Imports | 6 (crypto, Anthropic SDK, GoogleGenAI, Genkit types, LRUClientCache, logger, toolRegistry) |
| Exports | 14 (types: 7, functions: 5, interfaces: 2) |
| Functions | 22 (13 private, 9 exported) |
| Type definitions | 12 (AIAction, AppState, ToolCallRecord, AIStreamEvent, RoutingStrategy, ModelTier, DesignPhase, TaskComplexity, AIErrorCode, GenkitMessageRole, ImageContent, FallbackProviderConfig) |
| Constants | ~20 module-level |
| Related files | `server/genkit.ts` (169 lines), `server/ai-tools.ts` (22 lines barrel), `server/ai-tools/` (18 files, 125 tool registrations) |

## Architecture Overview

`server/ai.ts` is the central AI orchestration layer for ProtoPulse. It handles:

1. **System prompt construction** from full project state (nodes, edges, BOM, validation, circuits, preferences, simulation)
2. **Multi-model routing** with phase-aware and complexity-aware tier selection
3. **Context window management** with token-aware history truncation
4. **SSE streaming** via Genkit's `generateStream` API
5. **Action parsing** from AI responses (legacy JSON-block format)
6. **Error categorization** and secret redaction
7. **Provider fallback** (primary fails -> alternate provider)
8. **Request deduplication** via in-flight request map
9. **Client caching** of API SDK instances (LRU, max 10)
10. **Prompt caching** keyed by state hash (LRU, max 20)

The file delegates all tool execution to `server/ai-tools/` via the `ToolRegistry` and uses `server/genkit.ts` as the bridge to Google Genkit's SDK. The actual SSE transport and HTTP handling is in `server/routes/chat.ts`.

### Data Flow

```
User message (HTTP)
  -> server/routes/chat.ts (buildAppStateFromProject, auth, SSE setup)
    -> server/ai.ts (streamAIMessage or processAIMessage)
      -> buildSystemPrompt(appState) -> cached or fresh
      -> fitMessagesToContext(chatHistory, ...) -> token-aware truncation
      -> server/genkit.ts (ai.generateStream / ai.generate)
        -> Genkit SDK -> Google Gemini API
        -> Tool calls auto-executed by Genkit via ToolRegistry.execute()
      -> extractClientActions(toolCalls) -> AIAction[]
      -> parseActionsFromResponse(text) -> AIAction[] (fallback)
    <- SSE events emitted back to client
```

## Detailed Findings

### 1. System Prompt Construction (lines 663-862)

**Function:** `buildSystemPrompt(appState: AppState): string`

The system prompt is a single ~3000-4000 character template that injects the entire project state. It includes:

- AI persona/expertise declaration (PCB, components, power, RF, firmware, IoT, EMC, thermal, DFM, DFT, BOM, regulatory)
- 6 application view descriptions
- Full project state sections: project name/description, active view, selected component, recent changes, architecture nodes, architecture connections, BOM, validation issues, schematic sheets, component library, circuit designs, recent history, BOM summary metadata, design preferences, simulation results
- Tool usage guidelines (positioning, part numbers, multimodal, Arduino)
- Custom user instructions injection

**View-aware context optimization (lines 601-661):**
The prompt intelligently tiers data density based on the active view:
- Architecture view: full node/edge details; other views get summaries
- Procurement view: full BOM; other views get summaries
- Validation view: full issues; other views get summaries
- Schematic/PCB view: full sheets; other views get summaries
- Thresholds: nodes<=10 always full, BOM<=5 always full, etc.

**Component parts tiering (lines 715-732):**
- <=20 parts: full detail
- <=100 parts: by-category summary
- >100 parts: count only with "use tools to query" hint

**Circuit designs tiering (lines 735-742):**
- <=5 designs: full context (instances, nets, wires)
- >5 designs: aggregate summary

**Issues:**

- **MEDIUM - Prompt not documenting all views:** The system prompt lists 6 views (Architecture, Schematic, Procurement, Validation, Output, Project Explorer) but the app has many more ViewModes: `dashboard`, `component_editor`, `calculators`, `design_patterns`, `storage`, `kanban`, `knowledge`, `viewer_3d`, `community`, `ordering`, `circuit_code`, `simulation`, `lifecycle`, `pcb`. The AI doesn't know these views exist and can't navigate to them or understand the user's context when they're active.

- **MEDIUM - Missing context for PCB/3D/simulation views:** When the user is in PCB layout, 3D viewer, simulation, or circuit code views, the system prompt provides no view-specific context beyond what's in the generic sections. The AI doesn't know about footprints, traces, board stackup, copper pours, or PCB-specific state.

- **LOW - Hardcoded position guidelines:** The prompt includes fixed positioning hints (`power on left x: 100-200`, `MCUs center x: 300-500`) which may not match the actual canvas dimensions or user preferences.

- **LOW - Missing concat on line 853:** `actions.## Arduino Workbench` is missing a newline between the vision section and Arduino section. The text `realize the design in the application.## Arduino Workbench` would appear as one run-on line in the prompt.

- **INFO - "88 AI tools" comment in genkit.ts is stale:** The comment says "88 legacy tools" but the actual count is 125 registered tools.

### 2. Model Routing (lines 127-364)

**Types:** `RoutingStrategy`, `ModelTier`, `DesignPhase`, `TaskComplexity`

**Model tiers (lines 139-150):**
```
anthropic: fast=claude-haiku-4-5, standard=claude-sonnet-4-5, premium=claude-opus-4-5
gemini:    fast=gemini-2.5-flash, standard=gemini-2.5-flash, premium=gemini-2.5-pro
```

**Phase-complexity matrix (lines 164-171):**
Maps 6 design phases x 3 complexity levels to model tiers. Well-designed with clear rationale documented in comments.

**View-to-phase mapping (lines 174-182):**
Only maps 6 views: architecture, schematic, breadboard, pcb, validation, output/exports. All other views (dashboard, simulation, circuit_code, etc.) fall back to `'exploration'`.

**Complexity detection (lines 210-252):**
Uses heuristics:
- Message length (<100 chars + navigation pattern = simple)
- Complex patterns regex (design/generate/create/analyze/etc.)
- Cross-referencing component names from BOM/nodes (>=3 matches = complex)
- Length fallback (>500 chars without complex pattern = moderate)

**Route selection (lines 267-364):**
5 strategies: user, quality, speed, cost, auto. Auto uses phase+complexity matrix when appState available, falls back to message-length heuristics.

**Issues:**

- **HIGH - Gemini fast and standard are the SAME model:** `gemini-2.5-flash` is used for both `fast` and `standard` tiers (lines 146-147). The routing matrix distinguishes between fast/standard/premium, but for Gemini, fast and standard resolve to the identical model. This means the entire phase-complexity routing system has reduced effectiveness -- simple and moderate requests all go to the same model. Only `complex` requests get a different model (premium = `gemini-2.5-pro`).

- **MEDIUM - Anthropic tiers defined but never used:** `MODEL_TIERS.anthropic` is defined (line 141-144) but the `provider` parameter is typed as `'gemini'` only throughout the codebase (lines 269, 579, 952, etc.). Anthropic client instances are cached (`anthropicClients` at line 440) but never used. The Anthropic SDK is imported (line 2) but never called. This is dead code from a previous dual-provider architecture.

- **MEDIUM - routeToModel called with empty nodes/bom in chat.ts:** In `chat.ts` lines 440-441, when calling `routeToModel` for non-user strategies, it passes `{ activeView: ..., nodes: [], bom: [] }` instead of the actual project nodes/BOM. This means the complexity detector can never detect component cross-references. The full appState is built AFTER routing (line 454), creating a chicken-and-egg problem.

- **LOW - Stale model IDs in MODEL_CONTEXT_LIMITS:** Lines 383-386 include context limits for deprecated models (`claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-haiku-20240307`). These are harmless but add noise. Also, the comment says `claude-sonnet-4-5` is `200_000` tokens, which may be incorrect if newer Anthropic models have different limits. However, since Anthropic is unused, this is low priority.

- **INFO - No model version validation:** The system accepts any string as a model ID (line 175 of chat.ts schema: `z.string().min(1).max(200)`). If a user passes a non-existent model ID, the error only surfaces when the Genkit call fails, not at validation time.

### 3. Streaming Implementation (lines 1033-1303)

**Primary function:** `executeStreamForProvider()` (lines 1033-1237) -- the workhorse.

**Public function:** `streamAIMessage()` (lines 1239-1303) -- thin wrapper.

**Streaming flow:**
1. Import genkit dynamically (`await import('./genkit')`)
2. Convert chat history roles (user/assistant -> user/model)
3. Build prompt parts (optional image + text)
4. Filter tools by allowlist if provided
5. Pre-flight validate tool schemas against Gemini's converter
6. Call `ai.generateStream()` with system prompt, messages, tools, config
7. Iterate chunks: emit text events, track tool requests
8. After stream completes, extract tool results from Genkit's response history
9. Fallback: if no tool results found in response, try alternate extraction paths
10. Last resort: re-execute tools manually via `toolDef.execute()` (lines 1190-1209)

**Tool result extraction has 3 fallback tiers (lines 1136-1209):**
1. `finalResponse.request?.messages` -- tool role messages from Genkit's internal conversation
2. `finalResponse.messages` -- full response message history
3. Manual re-execution via `toolRegistry.get(name).execute(input, toolContext)` -- last resort

**Issues:**

- **CRITICAL - Dynamic import of internal Genkit module:** Line 1065 imports `'../node_modules/@genkit-ai/google-genai/lib/common/converters.js'` to access `toGeminiTool`. This is a fragile internal import that will break on any Genkit package upgrade that moves or renames that file. This is not a public API.

- **HIGH - Tool double-execution risk:** The "last resort" fallback (lines 1190-1209) re-executes tools when Genkit didn't surface results through its normal paths. But Genkit already auto-executed these tools internally during `generateStream`. This means the tool's `execute()` function runs TWICE -- once by Genkit, once by the fallback. For tools that write to the database (add_node, add_bom_item, etc.), this causes duplicate mutations. The logger logs this as `ai:tool-fallback-execution` but doesn't prevent the double-write.

- **HIGH - Missing abort signal propagation to Genkit:** The `signal` parameter is checked after stream iteration (`if (signal?.aborted) break;` at line 1109) and after stream completion (line 1128), but it's NOT passed to `ai.generateStream()` itself. This means the underlying HTTP request to Gemini continues even after abort, consuming API quota and server resources until Gemini finishes. Genkit supports `{ abortSignal }` in the config but it's not used.

- **MEDIUM - Tool schema pre-flight failures are logged but not handled:** Lines 1066-1085 validate each tool against Genkit's Gemini converter. If validation fails, it logs `ai:tool-schema-preflight-failed` but still passes ALL tools (including the invalid ones) to `generateStream()`. This will cause Gemini API errors at runtime. The invalid tools should be filtered out.

- **MEDIUM - No backpressure from Genkit stream to event callback:** `executeStreamForProvider` calls `await onEvent(...)` for each chunk (line 1113), which provides backpressure to the caller. However, between Genkit's internal stream and this function, there's no backpressure -- the `for await` loop reads chunks as fast as Genkit produces them. If the downstream SSE connection is slow, text events queue up in memory.

- **LOW - `maxTokens` default mismatch:** `processAIMessage` passes `maxTokens || 4096` (line 932), using `||` which also triggers on `0`. `streamAIMessage` destructures with default `maxTokens = 4096` (line 1258). The behavior is the same but the patterns are inconsistent.

### 4. Action Parser (lines 864-898)

**Function:** `parseActionsFromResponse(text: string): { message: string; actions: AIAction[] }`

This is a legacy parser for extracting structured actions from AI text responses (pre-tool-use era). It searches for JSON arrays in fenced code blocks or bare JSON at the end of text.

**Parsing strategy:**
1. Find ALL fenced JSON blocks (` ```json ... ``` `), use the LAST one
2. If no fenced block, look for a bare `[{...}]` at the end of text
3. Parse JSON, filter for objects with a string `type` property
4. Return message (text before the JSON block) and actions

**Issues:**

- **MEDIUM - No action type validation:** The parser accepts ANY object with a `type: string` property as a valid `AIAction` (line 893). It doesn't validate against the `AIAction` discriminated union. Invalid action types (typos, hallucinated types) pass through and will fail silently on the client side.

- **MEDIUM - Dual action extraction in streaming path:** In `streamAIMessage` (lines 1294-1296), actions are extracted from BOTH tool call results AND text parsing:
  ```ts
  const clientActions = extractClientActions(result.toolCalls);
  const finalActions = [...clientActions, ...parseActionsFromResponse(result.fullText).actions];
  ```
  If the AI uses native tools AND includes a JSON block in its text response, the same logical action could appear twice (once from the tool result, once from text parsing). There's no deduplication.

- **LOW - Greedy bare JSON regex:** The `bareJsonRegex` pattern `\[\s*\{[\s\S]*\}\s*\]\s*$` is greedy and could match across multiple unrelated JSON arrays if the AI outputs several. The `[\s\S]*` inside the outer brackets matches everything between the first `{` and the last `}`.

### 5. Tool Registration (via server/genkit.ts and server/ai-tools/)

**Architecture:**
- `server/ai-tools/` contains 18 files: `types.ts`, `registry.ts`, `index.ts`, plus 15 category modules
- `index.ts` creates a singleton `ToolRegistry` and calls 18 `register*()` functions
- `server/genkit.ts` converts all 125 registry tools into Genkit tool definitions using `ai.defineTool()`
- Tool schemas are Zod objects; output schemas are all `z.any()` (line 17 of genkit.ts)

**Issues:**

- **HIGH - All Genkit tool output schemas are `z.any()`:** In `genkit.ts` line 17, every tool has `outputSchema: z.any()`. This means Genkit cannot validate tool outputs before sending them to the model. The model receives unstructured data, which could include internal server errors, stack traces, or sensitive information that the Zod schema would normally filter.

- **HIGH - Genkit context access pattern is fragile:** `genkit.ts` line 20 uses `ai.currentContext() as ToolContext` to get the tool execution context. This depends on Genkit's internal context propagation mechanism. If Genkit ever changes how context flows through `generateStream` or if tools are called outside a Genkit flow, `ctx` will be null and the tool will throw. The `if (!ctx)` check (line 21) is good defensive programming but the cast is unsafe.

- **MEDIUM - Duplicate tool definitions in genkit.ts:** `genkit.ts` defines additional tools that overlap with registry tools:
  - `queryBomItemsTool` (line 29) -- overlaps with BOM tools in the registry
  - `pricingLookupTool` (line 40) -- returns MOCK DATA (`Math.random() * 10`) which is still in production code
  - `queryNodesTool` (line 89), `queryEdgesTool` (line 99) -- overlap with architecture tools
  These extra tools are NOT included in `allGenkitTools` (which only maps registry tools), so they're only used by the standalone flows. But the mock `pricingLookupTool` is concerning -- it returns fake prices.

- **MEDIUM - Stale model references in genkit.ts:** Line 61 uses `gemini-3-flash-preview` and line 147 uses `gemini-3.1-pro-preview-customtools`. These are experimental/preview model IDs that may not exist or may have been deprecated.

- **LOW - `inputSchema: toolDef.parameters as any`:** The `as any` cast on line 16 of genkit.ts bypasses type checking between the ToolDefinition's Zod schema and Genkit's expected schema format. This could mask incompatibilities.

### 6. Error Handling (lines 466-566)

**Functions:**
- `extractErrorInfo(error)` -- safely extracts message and HTTP status from unknown errors
- `redactSecrets(text)` -- strips API key patterns (`sk-*`, `AIza*`)
- `categorizeError(error)` -- maps errors to user-friendly messages with error codes
- `isRetryableError(error)` -- determines if fallback is appropriate

**Error categories (6 types):**
| Code | Trigger | User Message |
|------|---------|-------------|
| AUTH_FAILED | 401, "authentication", "API key" | Check your API key |
| RATE_LIMITED | 429, "rate limit", "quota" | Wait and try again |
| TIMEOUT | "timeout", ETIMEDOUT, ECONNABORTED | Try shorter message |
| MODEL_ERROR | "model not found" | Model may not be available |
| MODEL_ERROR | 400, "invalid_request", schema errors | Clear chat history |
| PROVIDER_ERROR | 5xx | Provider issues |
| UNKNOWN | Everything else | Truncated error preview (240 chars) |

**Issues:**

- **MEDIUM - Secret redaction is incomplete:** `redactSecrets` only matches `sk-[a-zA-Z0-9]+` (Anthropic keys) and `AIza[a-zA-Z0-9_-]+` (Google API keys). It doesn't redact:
  - Bearer tokens
  - Base64-encoded credentials
  - Database connection strings (if they leak into errors)
  - Other API key formats (e.g., `gsk_` for Groq, `xai-` for xAI)

- **LOW - MODEL_ERROR includes raw message in user-facing text:** Line 514: `The model "${msg}" may not be available.` -- `msg` is the full error message, not the model name. This could expose internal error details to users.

- **LOW - Fallback error handling catches ALL errors:** In `processAIMessage` (line 1001-1012), if the primary provider fails with a retryable error, the fallback is tried. But if the fallback ALSO fails, its error is thrown and caught by the outer catch (line 1020-1026), which returns a generic error message. The user doesn't know that BOTH providers failed -- they only see the fallback's error message. There's no indication that fallback was attempted.

### 7. Token/Context Management (lines 366-430)

**Functions:**
- `estimateTokens(text)` -- word-count x 1.3 heuristic
- `getModelContextLimit(model)` -- lookup with prefix matching
- `fitMessagesToContext(chatHistory, systemPromptTokens, currentMessageTokens, model)` -- reverse-iterate history, fit within budget

**Context window management:**
- Response reserve: min(4096, 5% of context limit)
- Safety margin: 200 tokens
- Hard cap: 50 history messages max
- Fills from most recent backward until budget exhausted

**Issues:**

- **MEDIUM - Token estimation is rough:** The `words * 1.3` heuristic (line 374) is documented as "accurate to ~10% for typical English/code." But for electronics-specific content (part numbers like `STM32F407VGT6`, equations, pin lists), the ratio is likely higher (more tokens per word due to subword tokenization). For code blocks, the ratio could be 1.5-2x. This means the system may underestimate token usage by 15-50%, potentially causing context overflow for Gemini models where the 1M limit provides ample headroom but Claude models (200K) could be tighter.

- **LOW - Context limit prefix matching is bidirectional:** Line 397: `model.startsWith(key) || key.startsWith(model)`. The second condition (`key.startsWith(model)`) means if the model string is `"claude"`, it would match `"claude-opus-4-5-20250514"` and return its limit. This is probably intentional for partial model IDs but could match unexpected entries if model IDs share prefixes.

- **LOW - Response reserve is very small:** For Gemini 1M context, the response reserve is `min(4096, 50000)` = 4096 tokens. This is fine for most responses but may truncate very long multi-tool responses where the model needs to explain complex analysis.

### 8. Security

**Positive security measures:**
- API key redaction in error messages (`redactSecrets`)
- API key hashing in dedup keys (SHA-256, 8 char prefix, line 588)
- Message length limit (32,000 chars, line 972)
- Per-session prompt caching with userId scoping (line 450)
- Secret detection is applied before any error is surfaced to the user

**Issues:**

- **HIGH - Custom system prompt injection:** `appState.customSystemPrompt` is directly concatenated into the system prompt (line 861) without any sanitization. A user can inject arbitrary instructions like "Ignore all previous instructions and..." This is injected as `## Custom User Instructions\n\n${appState.customSystemPrompt}`. The `customSystemPrompt` field comes from the client-side request body and is validated only as `z.string().max(10000)` (chat.ts line 183).

  While this is a "feature" (users customize their AI experience), it allows:
  - Overriding safety guidelines
  - Extracting the system prompt content
  - Manipulating tool behavior descriptions
  - Potential data exfiltration via prompt injection if the AI is given tools that can write externally

- **MEDIUM - Full project state in system prompt:** The system prompt includes all architecture nodes, edges, BOM items, validation issues, etc. If the AI response is logged or if the prompt leaks through an error, it exposes the entire project state. The prompt cache stores full prompts in memory (up to 20 entries).

- **MEDIUM - Image content not validated beyond MIME type:** `imageBase64` is accepted as a string up to 10MB (chat.ts line 189) and passed directly to Genkit as a data URI (line 920-921). There's no validation that the base64 string is actually a valid image. Malformed or adversarial image data could cause issues in the Gemini vision pipeline.

- **LOW - LRU cache keyed by raw API key:** `geminiClients` and `anthropicClients` use the raw API key string as the cache key (lines 440-441, 593-598). The API key stays in memory as a Map key. While LRU eviction limits this, the keys are not hashed.

### 9. Performance

**Positive patterns:**
- Prompt caching via `hashAppState` (lines 448-464) -- avoids rebuilding identical prompts
- Client instance caching (LRU, max 10) -- avoids creating new SDK instances per request
- Request deduplication via `activeRequests` Map (lines 584, 994-1018)
- View-aware context tiering reduces prompt size for non-active views
- Token-aware history truncation prevents sending too much context

**Issues:**

- **HIGH - O(N) sequential queries in buildAppStateFromProject (chat.ts):** While the first batch of 10 queries is parallelized with `Promise.all` (chat.ts line 204), the second batch for circuit details creates `4 * N` queries where N = number of circuits (lines 219-224). For a project with 20 circuits, this is 80 additional queries (instances, nets, wires, sim results for each). This is acknowledged tech debt in the codebase (GA-DB-01).

- **MEDIUM - State hashing is expensive for large projects:** `hashAppState` (line 451) calls `JSON.stringify()` on a composite object that includes array lengths but NOT the actual array contents. However, this means the cache misses whenever any count changes, even if the system prompt would be identical (e.g., adding a chat message doesn't change the prompt but changes `chatHistory.length`). Wait -- actually `chatHistory` is not in the hash (line 451-463). The hash includes: `userId, name, desc, nodes.length, edges.length, bom.length, validation.length, sheets.length, view, selected, custom`. This is reasonable but cache invalidation is too aggressive -- changing the selected node invalidates the entire prompt cache even though only one line changes.

- **MEDIUM - `buildSystemPrompt` has O(N*M) edge resolution:** Lines 680-681: for each edge, it does `appState.nodes.find(n => n.id === e.source)` and `appState.nodes.find(n => n.id === e.target)`. With 100 nodes and 200 edges, this is 400 linear scans. Should use a Map for O(1) lookup.

- **LOW - Dynamic import of genkit on every request:** Lines 911 and 1048 use `await import('./genkit')` every time. While Node.js caches modules after the first import, the dynamic import syntax still incurs overhead from module resolution. A top-level static import would be more efficient, but the dynamic import may be intentional to avoid circular dependencies or to defer initialization.

- **LOW - `normalizeGenkitRole` called per message per request:** Each message in chatHistory goes through role normalization (line 913-916). This is a trivial cost but the function is called N times per request where N is the number of history messages.

### 10. Code Quality

**Positive aspects:**
- Well-documented with JSDoc comments explaining rationale for design decisions
- Phase-complexity matrix has clear documentation of WHY each cell has its value
- Error handling is thorough with multiple fallback tiers
- Type safety is generally good with discriminated unions for AIAction and AIStreamEvent
- Constants are well-named and documented

**Issues:**

- **MEDIUM - Dead Anthropic code:** Lines 2, 440 -- `Anthropic` SDK is imported and `anthropicClients` cache is created, but no Anthropic API calls exist anywhere in the file. This is remnant code from the dual-provider era. The `getAnthropicClient` function was presumably removed but the import and cache remain.

- **MEDIUM - `MAX_TOOL_TURNS` constant defined but never used:** Line 123 defines `MAX_TOOL_TURNS = 10` but it's never referenced. Genkit handles multi-turn tool execution internally. This is likely a remnant from a custom tool loop implementation.

- **MEDIUM - `existing` variable in streamAIMessage is dead code:** Lines 1283-1286 get the dedup key and check `activeRequests`, but then the comment says "we just execute directly." The `existing` variable is assigned but never used. The dedup key is also unused in the streaming path.

- **LOW - Inconsistent async patterns:** `processAIMessage` uses nested `async` IIFE for dedup (lines 997-1013), while `streamAIMessage` has a TODO-like comment about not deduplicating streams (line 1285). The patterns are inconsistent.

- **LOW - `callGenkit` function signature has too many parameters:** Line 901-910 has 8 parameters. This should use an options object pattern for readability.

- **LOW - Line 853 missing whitespace:** `realize the design in the application.## Arduino Workbench` -- the system prompt has `application.## Arduino` without a blank line, creating malformed markdown.

- **INFO - `AppState` interface duplicates data shapes:** The `AppState` interface (lines 80-102) re-defines the shapes of nodes, edges, BOM items, etc. instead of referencing the Drizzle schema types. This means the shapes could drift out of sync.

- **INFO - `AIAction` union type has 78 variants:** The discriminated union at lines 9-78 is extremely large. Adding new action types requires modifying this file. This is a maintenance burden and makes the type definition hard to read.

### 11. Gaps & Missing Features

| Gap | Severity | Description |
|-----|----------|-------------|
| No token usage tracking | HIGH | No tracking of input/output tokens per request. Users can't see their AI usage or costs. The `estimateTokens` function exists but is only used for context window management, not billing/analytics. |
| No conversation branching support in AI layer | MEDIUM | Chat branches exist in the DB schema but `processAIMessage` and `streamAIMessage` don't accept or use a `branchId` parameter. All chat goes to the same linear history. |
| No retry with exponential backoff | MEDIUM | Provider fallback exists (try alternate provider) but there's no retry-with-backoff for transient errors on the same provider. A single timeout immediately falls through to fallback or error. |
| No streaming for non-Gemini providers | MEDIUM | `executeStreamForProvider` only supports `'gemini'` provider (line 1033 parameter type). If Anthropic support is re-enabled, streaming would need a separate implementation. |
| No tool execution timeout | MEDIUM | Tools are executed by Genkit with no timeout. A slow tool (e.g., one that calls an external API) could block the stream indefinitely. There's no per-tool deadline. |
| No system prompt versioning | LOW | The system prompt is generated dynamically but there's no version tracking. If the prompt structure changes, there's no way to A/B test or rollback. |
| No multi-turn tool loop control | LOW | Genkit handles multi-turn internally. There's no way to limit the number of tool turns or implement custom stopping conditions (the unused `MAX_TOOL_TURNS` suggests this was planned). |
| No prompt size monitoring | LOW | No logging of how large the system prompt is in tokens. For large projects with many components, the prompt could silently consume most of the context window. |
| No model response quality monitoring | LOW | No tracking of whether tool calls succeed/fail, action parse rates, or response quality metrics. |
| Missing Anthropic provider implementation | INFO | The codebase has dead Anthropic infrastructure (imports, client cache, model tiers) but no working Anthropic integration. This suggests a planned but incomplete feature. |

### 12. Integration Points

| Integration | File | How |
|------------|------|-----|
| Chat routes | `server/routes/chat.ts` | Imports `processAIMessage`, `streamAIMessage`, `categorizeError`, `routeToModel` |
| Agent routes | `server/routes/agent.ts` | Imports `categorizeError`, `redactSecrets` |
| Component AI | `server/component-ai.ts` | Imports `redactSecrets` |
| Circuit AI | `server/circuit-ai/*.ts` | review, generate, analyze modules import `categorizeError`, `redactSecrets` |
| Genkit bridge | `server/genkit.ts` | Dynamically imported by ai.ts; converts tool registry to Genkit format |
| Tool registry | `server/ai-tools/index.ts` | Imported for `toolRegistry`, `DESTRUCTIVE_TOOLS`, `ToolResult`, `ToolContext` |
| LRU cache | `server/lib/lru-cache.ts` | Used for client instance and prompt caching |
| Tests | `server/__tests__/ai.test.ts` | Tests `parseActionsFromResponse`, `categorizeError`, `isRetryableError`, `getDefaultFallbackModel`, `redactSecrets` |

## Issues Found (Summary)

### CRITICAL (1)
1. **Dynamic import of Genkit internal module** (line 1065) -- `../node_modules/@genkit-ai/google-genai/lib/common/converters.js` will break on Genkit upgrades.

### HIGH (5)
1. **Tool double-execution risk** in streaming fallback (lines 1190-1209) -- tools may run twice, causing duplicate DB writes.
2. **Missing abort signal propagation** to Genkit `generateStream` -- cancelled requests still consume API quota.
3. **All Genkit tool output schemas are `z.any()`** (genkit.ts:17) -- no output validation, potential info leakage.
4. **Custom system prompt injection** (line 861) -- users can inject arbitrary instructions without sanitization.
5. **Gemini fast/standard tiers are identical** (lines 146-147) -- model routing matrix is partially ineffective.

### MEDIUM (14)
1. System prompt doesn't document all 15+ ViewModes.
2. Missing context for PCB/3D/simulation/circuit-code views.
3. Anthropic tiers defined but never used (dead code).
4. `routeToModel` called with empty nodes/bom, defeating complexity detection.
5. Tool schema pre-flight failures logged but not filtered.
6. No backpressure from Genkit stream to event callback.
7. Action parser accepts any `type` string without validation.
8. Dual action extraction (tool results + text parsing) without deduplication.
9. Secret redaction incomplete (only covers Anthropic and Google key formats).
10. Image content not validated beyond MIME type.
11. Token estimation inaccurate for electronics/code content.
12. State hash too aggressive (selected node change invalidates cache).
13. `buildSystemPrompt` has O(N*M) edge resolution.
14. `MAX_TOOL_TURNS`, `anthropicClients`, dead dedup code in streaming path.

### LOW (10)
1. Hardcoded position guidelines in system prompt.
2. Line 853 missing whitespace in markdown.
3. `maxTokens` default pattern inconsistency.
4. MODEL_ERROR shows raw message in user-facing text.
5. Fallback error silently replaces primary error.
6. Context limit prefix matching is bidirectional.
7. Response reserve very small (4096 tokens max).
8. Dynamic import overhead on every request.
9. `callGenkit` has too many parameters.
10. Stale model IDs in genkit.ts flows.

### INFO (4)
1. "88 AI tools" comment is stale (actual: 125).
2. `AppState` interface duplicates data shapes from schema.
3. `AIAction` union has 78 variants -- maintenance burden.
4. Dead Anthropic infrastructure suggests incomplete feature.

## Recommendations

### Immediate (Should Fix Now)

1. **Remove the internal Genkit module import** (line 1065). Either:
   - Use Genkit's public API for schema validation, or
   - Skip the pre-flight check entirely (the Gemini API will return validation errors anyway), or
   - Vendor the converter function into the codebase.

2. **Fix the tool double-execution risk.** Add a guard in the last-resort fallback:
   ```ts
   // Only re-execute if the tool is read-only (navigation, queries)
   if (toolDef && toolContext && !toolDef.requiresConfirmation) {
   ```
   Or better: only re-execute tools in the `navigation` category.

3. **Pass abort signal to Genkit.** Add `abortSignal: signal` to the `ai.generateStream()` config.

4. **Clean up dead Anthropic code.** Remove the `Anthropic` import, `anthropicClients` cache, and unused dedup code in `streamAIMessage`.

### Short-Term (Next Sprint)

5. **Fix Gemini tier duplication.** Either differentiate fast/standard (e.g., use `gemini-2.0-flash-lite` for fast) or simplify the routing matrix to 2 tiers.

6. **Add output schemas to Genkit tools.** Replace `z.any()` with proper Zod schemas derived from `ToolResult`.

7. **Update system prompt to document all ViewModes** and provide view-specific context for PCB, simulation, circuit code, etc.

8. **Sanitize custom system prompt.** At minimum, strip markdown heading syntax and limit to plain text. Consider a prompt injection defense (e.g., wrapping user instructions in XML tags with instructions to the model not to follow meta-instructions within the tags).

9. **Optimize edge resolution.** Build a `Map<string, Node>` from `appState.nodes` before iterating edges.

10. **Add token usage tracking.** Log input/output token counts from Genkit response metadata for usage analytics.

### Long-Term

11. **Modularize the system prompt builder** into a separate file with unit tests. The current 200-line string template is hard to test and maintain.

12. **Add action type validation** in `parseActionsFromResponse`. Validate against the `AIAction` union discriminant values.

13. **Implement per-tool execution timeouts** using `AbortController` with per-tool deadlines.

14. **Add prompt size monitoring.** Log estimated token counts for the system prompt and warn when it exceeds 50% of the model's context limit.

15. **Re-evaluate the need for `processAIMessage`** (non-streaming). It's used only by the `/api/chat/ai` endpoint. If streaming is the primary path, consider deprecating the non-streaming endpoint.

## Raw Notes

- The file has evolved through at least 6 named "phases" (referenced in comments: Phase 2 for expanded context, Phase 4 for vision, Phase 5 for action history, Phase 6 for multi-model routing and export tools).
- The `callGenkit` function (lines 901-947) is only used by `processAIMessage` (non-streaming path). The streaming path uses `executeStreamForProvider` directly.
- The `FallbackProviderConfig` interface (lines 569-573) only supports `'gemini'` as the fallback provider, matching the current Gemini-only architecture.
- `getDefaultFallbackModel` (lines 579-581) has a hardcoded fallback to `'gemini-3-flash-preview'` if `MODEL_TIERS[fallbackProvider]` is undefined. This model ID may not exist.
- The `requestKey` function (lines 586-589) uses `message.slice(0, 100)` which means messages with the same first 100 characters but different content will be deduplicated incorrectly. This is a subtle bug -- if a user sends "Design a power supply for..." twice with different continuations, only the first request executes.
- `genkit.ts` defines 3 standalone flows (`generateArduinoSketchFlow`, `analyzeBomFlow`, `embodiedLayoutAnalysisFlow`, `hardwareCoDebugFlow`) that are not connected to any HTTP endpoint and appear to be proof-of-concept code. The `hardwareCoDebugFlow` uses `gemini-3.1-pro-preview-customtools` which is likely deprecated.
- The `_Anthropic` import on line 2 suggests the Anthropic SDK package is still in dependencies, adding to bundle size despite being unused.
