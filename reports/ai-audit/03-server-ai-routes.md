# Server AI Routes & Circuit AI Analysis

> Generated: 2026-03-27 | Analyst: AI Routes Agent | Scope: server/routes/chat.ts, server/routes/agent.ts, server/routes/chat-branches.ts, server/circuit-ai/*, server/genkit.ts, server/routes.ts (genkit-test route)

---

## Endpoint Inventory

| # | Method | Path | Auth | Rate Limit | Streaming | Description |
|---|--------|------|------|------------|-----------|-------------|
| 1 | GET | `/api/projects/:id/chat` | `requireProjectOwnership` | Global only | No | List chat messages (paginated, filterable by branchId) |
| 2 | POST | `/api/projects/:id/chat` | `requireProjectOwnership` | Global only | No | Create a chat message |
| 3 | DELETE | `/api/projects/:id/chat` | `requireProjectOwnership` | Global only | No | Delete all chat messages for project |
| 4 | DELETE | `/api/projects/:id/chat/:msgId` | `requireProjectOwnership` | Global only | No | Delete a specific chat message |
| 5 | POST | `/api/chat/ai` | Manual session + ownership | Global only | No | Non-streaming AI chat (processAIMessage) |
| 6 | POST | `/api/chat/ai/stream` | Manual session + ownership | Per-IP 20/min + concurrency 1 | SSE | Streaming AI chat (streamAIMessage) |
| 7 | GET | `/api/projects/:id/ai-actions` | `requireProjectOwnership` | Global only | No | List AI action history for project |
| 8 | GET | `/api/ai-actions/by-message/:messageId` | Manual session + ownership | Global only | No | Get AI actions by message ID |
| 9 | POST | `/api/projects/:id/agent` | `requireProjectOwnership` | Per-IP 2/min | SSE | Agentic design loop (multi-turn tool use) |
| 10 | POST | `/api/projects/:id/chat/branches` | `requireProjectOwnership` | Global only | No | Create conversation branch |
| 11 | GET | `/api/projects/:id/chat/branches` | `requireProjectOwnership` | Global only | No | List conversation branches |
| 12 | POST | `/api/circuits/:circuitId/ai/generate` | **NONE** | **NONE** | No | Generate schematic from description |
| 13 | POST | `/api/circuits/:circuitId/ai/review` | **NONE** | **NONE** | No | Review schematic for issues |
| 14 | POST | `/api/circuits/:circuitId/ai/analyze` | **NONE** | **NONE** | No | AI circuit analysis (what-if, topology) |
| 15 | POST | `/api/genkit-test` | Global middleware only | Global only | No | Test endpoint for Genkit flows |

---

## Route-by-Route Analysis

### chat.ts (743 lines)

#### Constants and Stream Protection Infrastructure (lines 1-170)

**Stream abuse protections (CAPX-REL-02):**

| Protection | Config | Implementation |
|------------|--------|----------------|
| Concurrent stream limit | 1 per session | `activeStreams` Set keyed by `X-Session-Id` (line 19) |
| Per-IP rate limit | 20 req/60s sliding window | `streamRateBuckets` Map with periodic prune every 2min (line 33) |
| Absolute stream timeout | 5 minutes hard kill | `ABSOLUTE_STREAM_TIMEOUT_MS = 300_000` (line 44) |
| Message body size limit | 32 KB | `STREAM_MESSAGE_MAX_BYTES = 32 * 1024` (line 47) |
| Activity-based timeout | 120s default (configurable via `STREAM_TIMEOUT_MS` env) | `resetStreamTimeout()` called on each `writeWithBackpressure` (line 628) |
| Origin validation | Host match in production, permissive in dev | `streamOriginGuard` middleware (line 120) |
| Heartbeat | Every 15s | `:heartbeat\n\n` SSE comment (line 607) |
| Backpressure handling | 30s drain timeout | `writeWithBackpressure` helper (line 621) |

**Exported test internals** (line 163): `_streamInternals` exposes `activeStreams`, `streamRateBuckets`, and all constants for testing.

#### Request Schema: `aiRequestSchema` (lines 172-191)

```typescript
{
  message: string (1-32000 chars),
  provider: 'gemini' (enum, only gemini allowed),
  model: string (1-200 chars),
  apiKey: string (max 500, optional, default ''),
  projectId: number,
  activeView: string (optional),
  schematicSheets: Array<{id, name}> (optional),
  activeSheetId: string (optional),
  temperature: number (0-2, optional),
  maxTokens: number (256-16384, optional),
  customSystemPrompt: string (max 10000, optional),
  selectedNodeId: string|null (optional),
  changeDiff: string (max 50000, optional),
  routingStrategy: 'user'|'auto'|'quality'|'speed'|'cost' (optional),
  confirmed: boolean (optional),
  imageBase64: string (max 10MB, optional),
  imageMimeType: 'image/jpeg'|'image/png'|'image/gif'|'image/webp' (optional),
}
```

#### `buildAppStateFromProject()` (lines 193-344)

Builds the full application state object for the AI system prompt. This is the O(N) sequential query concern mentioned in project docs.

**Data fetched (parallelized at top level):**
1. `storage.getNodes(projectId)` - architecture nodes
2. `storage.getEdges(projectId)` - architecture edges
3. `storage.getBomItems(projectId)` - BOM items
4. `storage.getValidationIssues(projectId)` - validation issues
5. `storage.getChatMessages(projectId)` - chat history
6. `storage.getProject(projectId)` - project metadata
7. `storage.getComponentParts(projectId)` - component parts
8. `storage.getCircuitDesigns(projectId)` - circuit designs
9. `storage.getHistoryItems(projectId, ...)` - design history (last 20)
10. `storage.getDesignPreferences(projectId)` - design preferences

**Second-level parallel fetches per circuit** (lines 219-224):
- `getCircuitInstances`, `getCircuitNets`, `getCircuitWires`, `getSimulationResults` for each circuit

**Performance note:** This is a fan-out pattern. Each circuit triggers 4 additional queries. For a project with 10 circuits, that's 10 + 40 = 50 queries total on every AI request.

**Chat history limit:** `MAX_CHAT_HISTORY = 10` messages, reversed to chronological order (line 294-300).

**Simulation context (BL-0576):** Lines 333-342 build simulation summaries via `buildSimulationContext()` from `server/lib/simulation-context.ts`.

#### Endpoint 1: `GET /api/projects/:id/chat` (lines 349-359)

- **Auth:** `requireProjectOwnership` middleware
- **Validation:** Pagination via `paginationSchema.safeParse(req.query)` with fallback defaults
- **Query params:** `branchId` (string, optional) for conversation branching
- **Response:** `{ data: ChatMessage[], total: number }`
- **Note:** `total` is just `messages.length`, not a true count of all messages (misleading for paginated results)

#### Endpoint 2: `POST /api/projects/:id/chat` (lines 361-374)

- **Auth:** `requireProjectOwnership` middleware
- **Validation:** `insertChatMessageSchema.omit({ projectId: true })` via Zod
- **Payload limit:** 32 KB via `payloadLimit(32 * 1024)`
- **Response:** 201 with created message object

#### Endpoint 3: `DELETE /api/projects/:id/chat` (lines 376-384)

- **Auth:** `requireProjectOwnership` middleware
- **Response:** 204 No Content
- **Note:** Bulk delete all chat messages. No confirmation required.

#### Endpoint 4: `DELETE /api/projects/:id/chat/:msgId` (lines 386-398)

- **Auth:** `requireProjectOwnership` middleware
- **Validation:** `parseIdParam` for both `:id` and `:msgId`
- **Response:** 204 or 404
- **Note:** `storage.deleteChatMessage(msgId, projectId)` uses both IDs for scoping (BOLA-safe)

#### Endpoint 5: `POST /api/chat/ai` (lines 402-483)

Non-streaming AI chat endpoint.

- **Auth:** Manual inline session validation (lines 412-426) -- NOT using `requireProjectOwnership` middleware
  - Validates `X-Session-Id` header
  - Calls `validateSession(sessionId)`
  - Checks project ownership (returns 404 for non-owners)
- **Payload limit:** 10 MB via `payloadLimit(10 * 1024 * 1024)` -- for image uploads
- **Validation:** `aiRequestSchema.safeParse(req.body)`
- **Model routing:** If `routingStrategy !== 'user'`, calls `routeToModel()` to auto-select model (lines 432-444)
- **API key resolution:** Client key, then falls back to stored key via `getApiKey(req.userId!, provider)` (lines 446-452)
- **Response:** Direct JSON from `processAIMessage()` result
- **Security:** `req.userId!` non-null assertion at line 448 is safe because it's guarded by `if (req.userId)` check

#### Endpoint 6: `POST /api/chat/ai/stream` (lines 485-692)

Streaming AI chat endpoint -- the primary AI interaction path.

**Middleware chain (in order):**
1. `streamOriginGuard` - Origin/Referer validation
2. `payloadLimit(10 * 1024 * 1024)` - 10 MB limit
3. `streamBodySizeGuard` - 32 KB message content limit
4. `streamRateLimiter` - 20/min per IP
5. `streamConcurrencyGuard` - 1 active stream per session

- **Auth:** Manual inline session validation (lines 499-513) -- same pattern as `/api/chat/ai`
- **SSE headers** (lines 554-558): `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
- **Abort handling:** `AbortController` signal passed to `streamAIMessage()`, triggered on `req.on('close')` (lines 613-617)
- **Cleanup:** `cleanup()` function removes session from `activeStreams`, clears all timers (line 564-569)

**Stream event format:** `data: ${JSON.stringify(event)}\n\n` -- standard SSE

**Tool context passed to `streamAIMessage()`** (lines 656-661):
```typescript
{
  projectId: pid,
  storage,
  confirmed: parsed.data.confirmed,
  googleWorkspaceToken: req.body.googleWorkspaceToken
}
```

**Issues found:**
1. `provider` is hardcoded to `"gemini"` at line 650 regardless of what the client sends in `parsed.data.provider`. The schema already constrains to `z.enum(['gemini'])`, so this is technically consistent but obscures intent.
2. `req.body.googleWorkspaceToken` (line 660) is **NOT** validated by the Zod schema `aiRequestSchema`. It's read directly from `req.body`, bypassing validation. This is a passthrough of unvalidated user input into the tool context.

#### Endpoint 7: `GET /api/projects/:id/ai-actions` (lines 696-708)

- **Auth:** `requireProjectOwnership` middleware
- **Additional check:** Redundant `getProject()` + 404 check (lines 701-704) -- the middleware already does this
- **Response:** `{ data: AiAction[], total: number }`

#### Endpoint 8: `GET /api/ai-actions/by-message/:messageId` (lines 711-742)

- **Auth:** Manual inline session validation (lines 720-727)
- **Ownership check:** Post-hoc -- fetches actions first, then checks if the project they belong to is owned by the session user (lines 732-737)
- **Param validation:** `String(req.params.messageId ?? '')` -- accepts any string
- **Security:** If `actions.length === 0`, returns empty array without any ownership check (line 740). This leaks that no actions exist for this messageId to any authenticated user.
- **Response:** `{ data: AiAction[], total: number }`

---

### agent.ts (236 lines)

#### Rate Limiting (lines 17-60)

| Config | Value |
|--------|-------|
| Window | 60 seconds |
| Max requests | 2 per IP |
| Prune interval | 120 seconds |
| Retry-After header | Yes |

Same sliding-window pattern as chat.ts stream rate limiter.

#### Request Schema: `agentRequestSchema` (lines 62-67)

```typescript
{
  description: string (1-10000 chars),
  maxSteps: number (1-15, default 8),
  apiKey: string (max 500, optional, default ''),
  model: string (max 200, optional, default 'gemini-3-pro-preview'),
}
```

**Note:** `maxSteps` has a default of 8 but is not actually enforced in the handler -- it's parsed but the loop relies on Genkit's native multi-turn execution and the stream termination, not a step counter.

#### System Prompt (lines 79-89)

Hardcoded `AGENT_SYSTEM_PROMPT` instructs the model to:
1. Create architecture with components
2. Add BOM items
3. Run DRC validation
4. Run DFM checks

Exported via `_agentInternals` for testing.

#### SSE Event Type (lines 69-77)

```typescript
interface AgentSSEEvent {
  step: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'complete' | 'error';
  message: string;
  toolName?: string;
  result?: ToolResult;
  summary?: string;
  stepsUsed?: number;
}
```

#### Endpoint 9: `POST /api/projects/:id/agent` (lines 98-236)

**Middleware chain:**
1. `requireProjectOwnership` - project + session auth
2. `agentRateLimiter` - 2/min per IP

**Flow:**
1. Validates request body via `agentRequestSchema`
2. Resolves API key: client-provided key or stored Gemini key via `getApiKey()`
3. **Requires API key** -- returns 400 if none available (line 125-126)
4. Sets up SSE response with heartbeat
5. Dynamically imports `../genkit` (lazy loading)
6. Calls `ai.generateStream()` with:
   - `model: googleai/${model}` (user-controlled model name)
   - `system: AGENT_SYSTEM_PROMPT`
   - `tools: allGenkitTools` (all 88+ tools)
   - `config: { temperature: 0.2, maxOutputTokens: 8192, apiKey }`
   - `context: toolContext` (with `confirmed: true` -- auto-confirms all tool actions)

**Critical Issues:**

1. **`confirmed: true` hardcoded** (line 145): The agent auto-confirms all tool operations. This means destructive tools (delete nodes, clear BOM, etc.) execute without user confirmation. The tool confirmation system is explicitly bypassed.

2. **No step limit enforcement** (line 116): `maxSteps` is parsed from the request but never checked against the actual number of steps executed. The loop runs until the Genkit stream terminates, not until `maxSteps` is reached.

3. **No absolute timeout**: Unlike the stream endpoint, there is no `ABSOLUTE_STREAM_TIMEOUT_MS`. The only protection is the SSE heartbeat interval cleaning up. If the Genkit model loops indefinitely with tool calls, the request hangs.

4. **No concurrency guard**: Unlike the stream endpoint, there's no per-session concurrency limit. A user could have multiple agent loops running simultaneously.

5. **User-controlled model string** (line 157): `model: \`googleai/${model}\`` -- the user controls the model name with only a max(200) length constraint. This could potentially be used to select unexpected model variants if the Genkit plugin resolves them.

6. **Tool result events are synthetic** (lines 188-196): The `tool_result` SSE events report `{ success: true, message: 'Done', data: {} }` regardless of actual execution outcome. The UI gets optimistic feedback, not real results.

**Error handling:** `categorizeError()` for user-friendly messages, `redactSecrets()` for logging (line 221). Cleanup in `finally` block clears heartbeat and ends response.

---

### chat-branches.ts (38 lines)

#### Endpoint 10: `POST /api/projects/:id/chat/branches` (lines 14-26)

- **Auth:** `requireProjectOwnership` middleware
- **Validation:** `createBranchSchema` -- `{ parentMessageId: z.number().int().positive() }`
- **Response:** 201 with created branch object
- **Note:** No validation that `parentMessageId` actually belongs to this project. The storage layer may or may not enforce this.

#### Endpoint 11: `GET /api/projects/:id/chat/branches` (lines 29-37)

- **Auth:** `requireProjectOwnership` middleware
- **Response:** `{ data: Branch[], total: number }`

---

## Circuit AI Pipeline Analysis

### index.ts (21 lines)

Barrel file. Registers three route handlers, passing the `storage` parameter via dependency injection (unlike chat routes which import the singleton).

```typescript
export function registerCircuitAIRoutes(app: Express, storage: IStorage): void {
  registerCircuitAiGenerateRoute(app, storage);
  registerCircuitAiReviewRoute(app, storage);
  registerCircuitAiAnalyzeRoute(app, storage);
}
```

### types.ts (8 lines)

Single interface:
```typescript
export interface ThinkingConfig {
  thinking: { type: 'enabled'; budget_tokens: number };
}
```

**Note:** This type is designed for the Anthropic Claude extended thinking API, but the circuit-AI endpoints now use Genkit+Gemini. This type is only consumed by `thinking.ts` and is effectively dead code in the current implementation.

### schemas.ts (22 lines)

Three Zod schemas:

| Schema | Fields | Issues |
|--------|--------|--------|
| `generateSchema` | `description` (1-2000), `apiKey` (min 1, required), `model` (default 'claude-sonnet-4-20250514') | Model default is Anthropic but code forces Gemini |
| `reviewSchema` | `apiKey` (min 1, required), `model` (default 'claude-sonnet-4-20250514') | Model default is Anthropic but code forces Gemini |
| `analyzeSchema` | `question` (1-2000), `apiKey` (min 1, required), `model` (default 'claude-sonnet-4-20250514') | Model default is Anthropic but code forces Gemini |

**Critical:** All three schemas require `apiKey` as mandatory (`z.string().min(1)`), but the actual handlers pass `apiKey || undefined` to the Genkit config, meaning an empty string would fail Zod validation. More importantly, the `model` field defaults to `claude-sonnet-4-20250514` but is **completely ignored** in all three handlers -- they all hardcode `googleAI.model('gemini-3-pro-preview')`.

### thinking.ts (16 lines)

```typescript
const THINKING_BUDGET = parseInt(process.env.THINKING_BUDGET ?? '10000', 10);
const THINKING_DISABLED = process.env.DISABLE_EXTENDED_THINKING === '1';

export function getThinkingConfig(): ThinkingConfig | Record<string, never> {
  if (THINKING_DISABLED) return {};
  return { thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET } };
}
```

**Status:** Dead code. `getThinkingConfig()` is not called by any of the three circuit-AI handlers. It was designed for the Anthropic Claude API's extended thinking feature but was never wired up after the pivot to Genkit+Gemini. The `ThinkingConfig` type from `types.ts` is also unused in practice.

### analyze.ts (151 lines)

**Endpoint 14: `POST /api/circuits/:circuitId/ai/analyze`**

**Auth:** NONE. No auth middleware. No session validation. No ownership check.

**Flow:**
1. Parse `circuitId` from URL params
2. Validate body with `analyzeSchema` (requires question + apiKey)
3. Fetch circuit design by ID
4. Parallel fetch: component parts (by project), instances, nets
5. Build prompt with `buildAnalyzePrompt()`
6. Call `ai.generate()` with `googleAI.model('gemini-3-pro-preview')`
7. Strip markdown fences from response
8. Parse JSON, return or 422 if invalid

**Prompt structure** (lines 17-87): Builds a detailed prompt with:
- Instance list with reference designators, part metadata, properties
- Net list with segments showing from/to connections
- Asks for JSON response: `{ answer, calculations[], affectedComponents[], suggestions[] }`

**Issues:**
- `instances.find()` inside net segment mapping (line 49-50) is O(n*m) -- could be slow for large circuits
- Error logger says "Generation error" for all three endpoints (copy-paste log messages)

### generate.ts (163 lines)

**Endpoint 12: `POST /api/circuits/:circuitId/ai/generate`**

**Auth:** NONE. No auth middleware. No session validation. No ownership check.

**Flow:**
1. Parse `circuitId` from URL params
2. Validate body with `generateSchema` (requires description + apiKey)
3. Fetch circuit design, then component parts
4. Build prompt with `buildGeneratePrompt()`
5. Call `ai.generate()` with `googleAI.model('gemini-3-pro-preview')` -- ignores `model` param (comment on line 83 explicitly says this)
6. Parse JSON response
7. **Create instances sequentially** (lines 111-125): For each generated instance, calls `storage.createCircuitInstance()` one at a time
8. **Create nets and wires sequentially** (lines 127-153): For each net, creates net then creates wires

**Critical Issues:**
1. **No transaction wrapping**: If the AI generates 10 instances and creating the 7th fails, 6 instances are orphaned in the database with no cleanup
2. **Sequential database writes**: Each instance/net/wire is created sequentially -- N+1 pattern for writes
3. **Invalid segment mapping**: `refDesToInstanceId.get(seg.fromInstanceRefDes) ?? 0` uses 0 as fallback (line 133). Instance ID 0 doesn't exist, so this creates invalid segments silently
4. **No IDOR protection**: Any authenticated user can generate into any circuit

### review.ts (155 lines)

**Endpoint 13: `POST /api/circuits/:circuitId/ai/review`**

**Auth:** NONE. No auth middleware. No session validation. No ownership check.

**Flow:**
1. Parse `circuitId` from URL params
2. Validate body with `reviewSchema` (requires apiKey)
3. Fetch circuit, parts, instances, nets
4. Build prompt with `buildReviewPrompt()`
5. Call `ai.generate()`, parse JSON response
6. Return review suggestions

**Prompt features** (lines 17-91):
- Resolves pin names from connectors (has a `resolvePinName` helper with part→connector lookup map)
- Checks for 6 categories: bypass caps, unconnected pins, pull resistors, power connections, signal integrity, best practices
- Expects JSON array of `{ severity, message, suggestion, affectedComponents[] }`

**Read-only:** Unlike generate, this endpoint only reads data and returns AI analysis. No database writes.

---

## Genkit Module Analysis (server/genkit.ts, 169 lines)

### Core Setup (lines 1-9)

```typescript
export const ai = genkit({ plugins: [googleAI()] });
```

Single Genkit instance with Google AI plugin. No API key configured at init time -- keys are passed per-request.

### Tool Bridge (lines 12-26)

Converts all 88+ legacy tools from `toolRegistry` to Genkit tools:

```typescript
export const allGenkitTools = toolRegistry.getAll().map(toolDef =>
  ai.defineTool({
    name: toolDef.name,
    description: toolDef.description,
    inputSchema: toolDef.parameters as any,  // ← type cast
    outputSchema: z.any()                     // ← no output validation
  }, async (input) => {
    const ctx = ai.currentContext() as ToolContext;
    if (!ctx) throw new Error(`Tool ${toolDef.name} executed without context.`);
    return await toolDef.execute(input, ctx);
  })
);
```

**Issues:**
1. `inputSchema: toolDef.parameters as any` -- casts legacy tool parameters to bypass type safety
2. `outputSchema: z.any()` -- no output validation on any tool
3. `ai.currentContext()` -- relies on Genkit's execution context threading, which may not work correctly in all scenarios (especially parallel tool calls)

### Standalone Tools (lines 29-107)

| Tool | Purpose | Auth |
|------|---------|------|
| `queryBomItemsTool` | Fetch BOM items | None -- uses `projectId` from input (default 1!) |
| `pricingLookupTool` | Mock pricing lookup | None -- returns random data |
| `queryNodesTool` | Fetch architecture nodes | None -- uses `projectId` from input (default 1!) |
| `queryEdgesTool` | Fetch architecture edges | None -- uses `projectId` from input (default 1!) |

**Critical:** `queryBomItemsTool`, `queryNodesTool`, `queryEdgesTool` all default to `projectId: 1`. When used as tools by the AI, the model controls the `projectId` parameter. No ownership validation is performed.

### Flows (lines 52-168)

| Flow | Model | Tools | Purpose |
|------|-------|-------|---------|
| `generateArduinoSketchFlow` | `gemini-3-flash-preview` | pricing + BOM | Generate Arduino code |
| `analyzeBomFlow` | `gemini-3-flash-preview` | BOM | Analyze BOM costs |
| `embodiedLayoutAnalysisFlow` | `gemini-robotics-er-1.5-preview` | nodes + edges + BOM | Spatial layout analysis |
| `hardwareCoDebugFlow` | `gemini-3.1-pro-preview-customtools` | nodes + edges + BOM | Hardware + firmware co-debug |

**Security:** All flows use tools that bypass ownership checks. The model can query any project's data by specifying a different `projectId`.

### Genkit Test Route (server/routes.ts:83-91)

```typescript
app.post('/api/genkit-test', async (req, res) => {
  const { generateArduinoSketchFlow } = await import('./genkit');
  const result = await generateArduinoSketchFlow(req.body);
  res.json({ result });
});
```

**Critical Issues:**
1. **No request validation**: `req.body` is passed directly to the flow with zero Zod validation
2. **No auth beyond global middleware**: Only the global session middleware applies (which sets `req.userId` but doesn't check ownership)
3. **Catches `error: any`**: Uses `any` type, violating the project's ESLint `no-explicit-any` rule
4. **No rate limiting**: Beyond the global middleware, no rate limit on this endpoint
5. **Exposes a test endpoint in production**: No `NODE_ENV` guard
6. **The flow calls `pricingLookupTool`**: Which returns random mock data in production

---

## Cross-Cutting Analysis

### Auth Enforcement Completeness

| Endpoint | Auth Mechanism | BOLA Protected | Rating |
|----------|---------------|----------------|--------|
| GET `/api/projects/:id/chat` | `requireProjectOwnership` | Yes | OK |
| POST `/api/projects/:id/chat` | `requireProjectOwnership` | Yes | OK |
| DELETE `/api/projects/:id/chat` | `requireProjectOwnership` | Yes | OK |
| DELETE `/api/projects/:id/chat/:msgId` | `requireProjectOwnership` | Yes | OK |
| POST `/api/chat/ai` | Manual inline | Yes | ADEQUATE (duplicated logic) |
| POST `/api/chat/ai/stream` | Manual inline | Yes | ADEQUATE (duplicated logic) |
| GET `/api/projects/:id/ai-actions` | `requireProjectOwnership` | Yes | OK (redundant project check) |
| GET `/api/ai-actions/by-message/:messageId` | Manual inline | Partial | WEAK (empty result leaks) |
| POST `/api/projects/:id/agent` | `requireProjectOwnership` | Yes | OK |
| POST `/api/projects/:id/chat/branches` | `requireProjectOwnership` | Yes | OK |
| GET `/api/projects/:id/chat/branches` | `requireProjectOwnership` | Yes | OK |
| POST `/api/circuits/:circuitId/ai/generate` | **NONE** | **NO** | **CRITICAL** |
| POST `/api/circuits/:circuitId/ai/review` | **NONE** | **NO** | **CRITICAL** |
| POST `/api/circuits/:circuitId/ai/analyze` | **NONE** | **NO** | **CRITICAL** |
| POST `/api/genkit-test` | Global middleware only | **NO** | **CRITICAL** |

### Streaming Protocol Consistency

| Endpoint | SSE Format | Heartbeat | Timeout | Backpressure | Abort |
|----------|-----------|-----------|---------|--------------|-------|
| `/api/chat/ai/stream` | `data: JSON\n\n` | 15s | 120s activity + 300s absolute | Yes (30s drain) | Yes |
| `/api/projects/:id/agent` | `data: JSON\n\n` | 15s | **NONE** | **NONE** | Partial (close only) |

The agent endpoint is missing absolute timeout, backpressure handling, and activity timeout -- all of which were implemented for the stream endpoint.

### Error Response Format Consistency

| Endpoint | Error Format | Status Codes |
|----------|-------------|-------------|
| Chat CRUD | `{ message: string }` | 400, 404, 204 |
| `/api/chat/ai` | `{ message: string }` | 400, 401, 404, 500 |
| `/api/chat/ai/stream` | SSE `{ type: 'error', message }` | 400, 401, 403, 404, 413, 429 (pre-stream); SSE error events (post-stream) |
| `/api/projects/:id/agent` | SSE `{ step, type: 'error', message }` | 400, 404, 429 (pre-stream); SSE error events (post-stream) |
| Circuit AI | `{ message: string }` | 400, 404, 422, 500 |
| Genkit test | `{ error: string }` | 500 |

**Inconsistency:** Genkit test route uses `{ error: ... }` instead of `{ message: ... }`.

### Rate Limiting Gaps

| Endpoint | Rate Limited | Comment |
|----------|-------------|---------|
| Chat CRUD (4 endpoints) | Global only | No endpoint-specific limits |
| `/api/chat/ai` | Global only | **Missing** -- non-streaming AI is unbounded |
| `/api/chat/ai/stream` | 20/min + concurrency | Well-protected |
| `/api/projects/:id/agent` | 2/min | Well-protected |
| Circuit AI (3 endpoints) | **NONE** | Critical gap -- each call invokes a Gemini API call |
| `/api/genkit-test` | Global only | **Missing** -- invokes Gemini API |

---

## Issues Found

### CRITICAL

| ID | Issue | Location | Description |
|----|-------|----------|-------------|
| AI-RT-01 | **No auth on circuit-AI endpoints** | `circuit-ai/analyze.ts:90`, `generate.ts:57`, `review.ts:93` | All three circuit-AI endpoints have zero authentication or authorization middleware. Any request that passes global middleware can access any circuit. IDOR/BOLA vulnerability. |
| AI-RT-02 | **No auth on genkit-test endpoint** | `server/routes.ts:83` | Test endpoint exposed in production with no input validation and no rate limiting. Directly invokes Gemini API with user-controlled input. |
| AI-RT-03 | **Agent auto-confirms destructive operations** | `server/routes/agent.ts:145` | `confirmed: true` hardcoded bypasses the tool confirmation system. The agent can delete nodes, clear BOM, modify architecture without user consent. |
| AI-RT-04 | **Genkit tools bypass ownership** | `server/genkit.ts:30-107` | `queryBomItemsTool`, `queryNodesTool`, `queryEdgesTool` accept `projectId` as model-controlled input with no ownership validation. AI model can exfiltrate data from any project by requesting different project IDs. |
| AI-RT-05 | **No transaction in circuit generation** | `circuit-ai/generate.ts:111-153` | Instance/net/wire creation is not wrapped in a transaction. Partial failure leaves orphaned data with no cleanup. |

### HIGH

| ID | Issue | Location | Description |
|----|-------|----------|-------------|
| AI-RT-06 | **Unvalidated `googleWorkspaceToken`** | `server/routes/chat.ts:660` | `req.body.googleWorkspaceToken` bypasses Zod schema validation. Raw user input is passed into the tool context and eventually used for Google API calls in export tools. |
| AI-RT-07 | **Agent has no absolute timeout** | `server/routes/agent.ts:147-201` | Unlike the stream endpoint (300s hard cap), the agent endpoint has no maximum duration. A stuck Genkit stream loop could hold a connection indefinitely. |
| AI-RT-08 | **No rate limiting on non-streaming AI** | `server/routes/chat.ts:402` | `/api/chat/ai` (non-streaming) has no endpoint-specific rate limiting. Each call triggers `processAIMessage` which makes an API call to Gemini. |
| AI-RT-09 | **No rate limiting on circuit-AI** | `circuit-ai/*.ts` | All three circuit-AI endpoints invoke Gemini API calls with no rate limiting beyond global middleware. |
| AI-RT-10 | **Invalid segment fallback to 0** | `circuit-ai/generate.ts:133` | When a reference designator isn't found in the mapping, `fromInstanceId` / `toInstanceId` defaults to 0, creating invalid database records. |
| AI-RT-11 | **`maxSteps` not enforced** | `server/routes/agent.ts:116` | User-specified `maxSteps` (default 8, max 15) is parsed but never checked. The actual step count is determined by Genkit's stream termination. |
| AI-RT-12 | **Dead code: thinking.ts + types.ts** | `circuit-ai/thinking.ts`, `circuit-ai/types.ts` | `getThinkingConfig()` is never called. `ThinkingConfig` type is designed for Anthropic API but all endpoints use Gemini. Dead code that confuses maintenance. |

### MEDIUM

| ID | Issue | Location | Description |
|----|-------|----------|-------------|
| AI-RT-13 | **Schema defaults mismatch implementation** | `circuit-ai/schemas.ts:10,15,21` | All schemas default model to `'claude-sonnet-4-20250514'` but all handlers force `googleAI.model('gemini-3-pro-preview')`. Misleading API contract. |
| AI-RT-14 | **Duplicate auth logic in chat endpoints** | `server/routes/chat.ts:412-426,499-513` | `/api/chat/ai` and `/api/chat/ai/stream` both inline session validation + ownership checking instead of using `requireProjectOwnership`. Code duplication risk. |
| AI-RT-15 | **Synthetic tool results in agent** | `server/routes/agent.ts:188-196` | Agent SSE events report all tool results as `{ success: true }` regardless of actual outcome. UI gets misleading feedback. |
| AI-RT-16 | **`total` field misleading in paginated responses** | `server/routes/chat.ts:357` | `total: messages.length` returns the count of the current page, not the total count across all pages. |
| AI-RT-17 | **O(n*m) instance lookup in prompts** | `circuit-ai/analyze.ts:49-50`, `review.ts:52-57` | `instances.find()` inside net segment loops is quadratic. Should use a Map lookup. |
| AI-RT-18 | **No agent concurrency guard** | `server/routes/agent.ts` | Unlike stream endpoint (1 active per session), agent has no per-session concurrency limit. Multiple agent loops can run simultaneously. |
| AI-RT-19 | **Redundant project check** | `server/routes/chat.ts:701-704` | `GET /api/projects/:id/ai-actions` checks project existence after `requireProjectOwnership` middleware already does this. |
| AI-RT-20 | **Mock pricing tool in production** | `server/genkit.ts:40-49` | `pricingLookupTool` returns `Math.random() * 10` and `inStock: true` for every query. Used by `generateArduinoSketchFlow` which is accessible via `/api/genkit-test`. |

### LOW

| ID | Issue | Location | Description |
|----|-------|----------|-------------|
| AI-RT-21 | **Hardcoded project ID defaults** | `server/genkit.ts:32,93,103` | `queryBomItemsTool`, `queryNodesTool`, `queryEdgesTool` default to `projectId: 1`. Legacy from single-project era. |
| AI-RT-22 | **Copy-paste log messages** | `circuit-ai/analyze.ts:146`, `generate.ts:158`, `review.ts:150` | All three log `[circuit-ai] Generation error:` even for analyze and review endpoints. |
| AI-RT-23 | **`error: any` in genkit-test** | `server/routes.ts:88` | Uses `any` type catch, violating project's `@typescript-eslint/no-explicit-any: error` rule. |
| AI-RT-24 | **Empty actions array leaks info** | `server/routes/chat.ts:740` | When no actions found for a messageId, returns empty array without verifying the messageId belongs to the user's project. Confirms message existence/non-existence. |

### INFO

| ID | Issue | Location | Description |
|----|-------|----------|-------------|
| AI-RT-25 | **Provider locked to Gemini** | `server/routes/chat.ts:174` | `aiRequestSchema` restricts provider to `z.enum(['gemini'])`. Anthropic support removed from schema. |
| AI-RT-26 | **Simulation context in AI prompt** | `server/routes/chat.ts:333-342` | BL-0576 implementation provides simulation summaries to AI. Well-structured with per-analysis-type summarizers. |
| AI-RT-27 | **DI vs singleton inconsistency** | `server/routes.ts:38-39` | Chat routes use singleton `storage`, circuit-AI routes receive `storage` via DI parameter. Known tech debt noted in code comments. |
| AI-RT-28 | **Embodied Reasoning model** | `server/genkit.ts:122` | Uses `gemini-robotics-er-1.5-preview`, a highly experimental model. May not be available or stable. |

---

## API Contract Gaps

### Missing Endpoints

| Gap | Description | Priority |
|-----|-------------|----------|
| No circuit-AI streaming | All three circuit-AI endpoints are synchronous. For complex generation, the response time could be 10-30s with no progress feedback. | Medium |
| No circuit-AI batch | Cannot generate/review multiple circuits at once. | Low |
| No agent status/cancel | No way to query running agent status or cancel an in-progress agent loop other than disconnecting the SSE stream. | Medium |
| No agent history | Agent executions aren't persisted. No way to review past agent runs. | Low |
| No model list endpoint | Client must hardcode model names. No API to discover available models. | Low |

### Inconsistent Patterns

| Pattern | Chat Routes | Agent | Circuit-AI | Genkit Test |
|---------|-------------|-------|------------|-------------|
| Auth middleware | Mixed (middleware + inline) | Middleware | None | None |
| Zod validation | Yes | Yes | Yes | None |
| Rate limiting | Custom per-endpoint | Custom per-endpoint | None | None |
| Error format | `{ message }` | SSE `{ step, type, message }` | `{ message }` | `{ error }` |
| Streaming | SSE with full protection | SSE with partial protection | None | None |
| Storage pattern | Singleton import | Singleton import | DI parameter | Lazy import |

---

## Security Assessment

### Threat Model Summary

1. **Unauthenticated Access (CRITICAL):** Circuit-AI endpoints and genkit-test are accessible without proper auth, allowing any authenticated user to access any circuit's data and invoke Gemini API calls at the operator's expense.

2. **Cross-Tenant Data Exfiltration (CRITICAL):** Genkit standalone tools (`queryBomItemsTool`, `queryNodesTool`, `queryEdgesTool`) accept `projectId` as a model-controlled parameter. A prompt injection attack could cause the AI to query other users' projects.

3. **Uncontrolled Resource Consumption:** Missing rate limits on circuit-AI and non-streaming chat could lead to Gemini API cost abuse. Missing timeout on agent could hold connections indefinitely.

4. **Destructive Agent Actions:** Agent endpoint auto-confirms all tool actions with `confirmed: true`, bypassing the safety system designed to prevent accidental data loss.

5. **Data Integrity:** Circuit generation writes to database without transactions. Partial failures corrupt state.

6. **Information Leakage:** Empty action arrays returned without ownership checks reveal whether message IDs exist.

### Positive Security Findings

- Stream endpoint has comprehensive abuse protection (rate limit, concurrency, body size, origin check, timeouts, backpressure)
- Chat CRUD endpoints all use `requireProjectOwnership` middleware correctly
- `redactSecrets()` used consistently for error logging
- `categorizeError()` provides user-friendly error messages without leaking internals
- Agent endpoint properly requires API key before proceeding
- Chat message deletion is scoped by both `msgId` and `projectId`

---

## Recommendations

### P0 (Must Fix)

1. **Add `requireCircuitOwnership` middleware to all circuit-AI endpoints** (AI-RT-01). The middleware already exists in `auth-middleware.ts` -- just wire it up.

2. **Remove or gate `/api/genkit-test` behind `NODE_ENV === 'development'`** (AI-RT-02). This test endpoint should never be accessible in production.

3. **Remove `confirmed: true` from agent tool context** (AI-RT-03). Require explicit user confirmation for destructive operations, or limit the agent's tool set to non-destructive tools only.

4. **Add ownership validation to Genkit standalone tools** (AI-RT-04). Either pass `projectId` from the route context (not from model input), or validate ownership within each tool.

### P1 (Should Fix)

5. **Wrap circuit generation in a database transaction** (AI-RT-05). On failure, roll back all created instances/nets/wires.

6. **Add `googleWorkspaceToken` to Zod schema** (AI-RT-06). Validate it like other fields, or remove the passthrough.

7. **Add absolute timeout to agent endpoint** (AI-RT-07). Reuse the 300s pattern from the stream endpoint.

8. **Add rate limiting to `/api/chat/ai` and all circuit-AI endpoints** (AI-RT-08, AI-RT-09). Even modest limits (10/min, 5/min) would prevent abuse.

9. **Enforce `maxSteps` in agent loop** (AI-RT-11). Check step count and terminate when reached.

### P2 (Nice to Have)

10. **Fix circuit-AI schema model defaults** (AI-RT-13). Change defaults from `claude-sonnet-4-20250514` to `gemini-3-pro-preview` to match actual behavior.

11. **Extract auth logic from chat/ai endpoints into middleware** (AI-RT-14). Remove code duplication.

12. **Remove dead code: thinking.ts + types.ts** (AI-RT-12). Or wire them up if extended thinking is still desired.

13. **Use Map for instance lookups in prompt builders** (AI-RT-17). Replace O(n*m) `find()` with O(1) Map lookups.

14. **Fix `total` in paginated responses** (AI-RT-16). Return actual total count from storage layer.

15. **Add concurrency guard to agent endpoint** (AI-RT-18). Reuse the `activeStreams` pattern.
