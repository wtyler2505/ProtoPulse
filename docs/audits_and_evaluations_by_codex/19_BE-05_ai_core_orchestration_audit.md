# BE-05 Audit: AI Core Orchestration

Date: 2026-03-06  
Auditor: Codex  
Section: BE-05 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Core orchestration:
  - `server/ai.ts`
  - `server/circuit-breaker.ts`
- Circuit AI modules:
  - `server/circuit-ai/index.ts`
  - `server/circuit-ai/schemas.ts`
  - `server/circuit-ai/thinking.ts`
  - `server/circuit-ai/generate.ts`
  - `server/circuit-ai/review.ts`
  - `server/circuit-ai/analyze.ts`
- Component AI module:
  - `server/component-ai.ts`
- Route entry points that invoke this orchestration:
  - `server/routes/chat.ts`
  - `server/routes/agent.ts`
  - `server/routes/components.ts`
  - `server/routes.ts`
- Supporting contracts and storage:
  - `server/ai-tools/registry.ts`
  - `server/ai-tools/component.ts`
  - `server/ai-tools/circuit.ts`
  - `server/storage/misc.ts`
  - `shared/schema.ts`
  - `server/index.ts`
  - `server/routes/settings.ts`
- Test surface reviewed:
  - `server/__tests__/ai.test.ts`
  - `server/__tests__/stream-abuse.test.ts`
  - `server/__tests__/agent-route.test.ts`

## AI Route Surface Snapshot (Current)
- AI orchestration endpoints discovered in this section scope: `13`.
- Key endpoint families:
  - Chat AI:
    - `/api/chat/ai`
    - `/api/chat/ai/stream`
  - Design agent:
    - `/api/projects/:id/agent`
  - Circuit AI:
    - `/api/circuits/:circuitId/ai/generate`
    - `/api/circuits/:circuitId/ai/review`
    - `/api/circuits/:circuitId/ai/analyze`
  - Component AI:
    - `/api/projects/:projectId/component-parts/ai/generate`
    - `/api/projects/:projectId/component-parts/:id/ai/modify`
    - `/api/projects/:projectId/component-parts/:id/ai/extract`
    - `/api/projects/:projectId/component-parts/:id/ai/suggest`
    - `/api/projects/:projectId/component-parts/:id/ai/extract-pins`
  - AI action history:
    - `/api/projects/:id/ai-actions`
    - `/api/ai-actions/by-message/:messageId`

## Severity Key
- `P0`: immediate security/data exposure/integrity risk
- `P1`: high-impact reliability/security/contract risk
- `P2`: medium reliability/contract/test-confidence risk
- `P3`: lower-risk debt/cleanup

## Findings

### 1) `P0` AI endpoints trust caller-supplied project/circuit IDs without ownership enforcement
Evidence:
- Chat endpoints accept `projectId` in request body:
  - `server/routes/chat.ts:170-175`
  - `server/routes/chat.ts:377-379`
  - `server/routes/chat.ts:445-447`
- Chat routes are not project-scoped by path (`/api/chat/ai*`), and use body `projectId` to fetch full project state:
  - `server/routes/chat.ts:369`
  - `server/routes/chat.ts:403-410`
  - `server/routes/chat.ts:471-478`
  - `server/routes/chat.ts:201-212`
- Stream route passes caller-supplied `projectId` into tool execution context:
  - `server/routes/chat.ts:586`
- Agent route checks only that project exists, not ownership:
  - `server/routes/agent.ts:126-129`
  - `server/routes/agent.ts:173`
- Circuit AI routes load by `circuitId` and proceed with no ownership guard:
  - `server/circuit-ai/generate.ts:62-76`
  - `server/circuit-ai/review.ts:97-113`
  - `server/circuit-ai/analyze.ts:95-112`
- No ownership middleware usage found in these AI modules:
  - `rg -n "requireProjectOwnership|requireProjectAccess|owner" ...` returned no matches in `chat.ts`, `agent.ts`, `components.ts`, `server/circuit-ai/*.ts`.

What is happening:
- Authenticated users can point AI orchestration at projects/circuits they do not own.

Why this matters:
- High-risk read/write cross-tenant exposure path through AI context building and tool execution.

Fix recommendation:
- Require owner checks before all AI flows touching project/circuit data.
- For chat AI, move to project-scoped routes (`/api/projects/:id/chat/ai*`) and reject body-level project override.
- Add circuit ownership guard for `/api/circuits/:circuitId/ai/*`.

---

### 2) `P0` Global request de-duplication can cross-collide across users/projects
Evidence:
- Global in-memory dedupe map:
  - `server/ai.ts:543`
- Key builder signature implies project identity, but caller passes project name:
  - `server/ai.ts:545-547`
  - `server/ai.ts:1001-1003`

What is happening:
- Concurrent requests sharing provider + same first 100 message chars + same project name can share one in-flight promise.

Why this matters:
- Can return one user/project’s AI result to another request path if names/messages align.

Fix recommendation:
- Key by immutable tenant-safe identifiers (`userId`, `projectId`, `sessionId`, provider, model, message hash).
- Remove project name from dedupe identity.

---

### 3) `P0` Prompt cache keying is coarse and not project/session scoped despite comments
Evidence:
- Comment says cache key is composite with project/session isolation:
  - `server/ai.ts:430-433`
- Actual hash includes only name/desc + counts + selected/view fields (not node/edge content, not user/project ID):
  - `server/ai.ts:436-448`
- Cache uses only that hash:
  - `server/ai.ts:987-993`
  - `server/ai.ts:1105-1111`

What is happening:
- Different states can map to same cache key (same counts/name/desc), producing stale or wrong prompt reuse.

Why this matters:
- Can inject incorrect project context into AI generation; in worst case can leak other state text through cache collisions.

Fix recommendation:
- Include `projectId` and a deterministic content hash over relevant state slices (labels, connections, BOM identity, validation identity).
- Add TTL and invalidate on any material state mutation.

---

### 4) `P1` Destructive-tool confirmation flags are not enforced in server-executed tool loops
Evidence:
- `DESTRUCTIVE_TOOLS` is imported in AI core but unused:
  - `server/ai.ts:5`
- Stream and agent loops execute tools directly:
  - `server/ai.ts:1327`
  - `server/ai.ts:1445`
  - `server/ai.ts:1495`
  - `server/routes/agent.ts:239`
- Registry execute path does not check `requiresConfirmation`:
  - `server/ai-tools/registry.ts:133-141`
- Destructive server-side tools are marked `requiresConfirmation: true`, e.g.:
  - `server/ai-tools/component.ts:170-173` (`delete_component_part`)
  - `server/ai-tools/circuit.ts:211-214` (`remove_net`)
  - `server/ai-tools/circuit.ts:149-152` (`remove_component_instance`)

What is happening:
- Models can invoke destructive tools and the server executes them immediately.

Why this matters:
- Deletes/mutations can happen without explicit human confirmation.

Fix recommendation:
- Enforce a server-side confirmation gate for `requiresConfirmation` tools.
- For streaming, emit a `needs_confirmation` event and pause execution until client acknowledges.

---

### 5) `P1` Multimodal payload contracts conflict with global body parser limits
Evidence:
- Chat schema and route contract allow large image payloads:
  - `server/routes/chat.ts:186-187` (`imageBase64` up to 10,000,000 chars)
  - `server/routes/chat.ts:370`
  - `server/routes/chat.ts:435`
- Component AI routes also advertise larger payloads:
  - `server/routes/components.ts:347`
  - `server/routes/components.ts:421`
  - `server/routes/components.ts:471`
- Global parser limits are stricter:
  - `server/index.ts:144` (`express.json` 1mb)
  - `server/index.ts:148` (`express.raw` 5mb)

What is happening:
- Requests can fail at global parsing before route-level limits/validation.

Why this matters:
- Image/datasheet AI flows behave unpredictably and fail “too early.”

Fix recommendation:
- Align global and route limits by endpoint class.
- For large media, move to multipart or object storage upload flow with pointer passing.

---

### 6) `P1` AI action history endpoint allows message-scoped reads without project scoping
Evidence:
- Public AI action lookup route is only message ID based:
  - `server/routes/chat.ts:634-641`
- Storage lookup also only filters by `chatMessageId`:
  - `server/storage/misc.ts:60-65`

What is happening:
- AI action retrieval is not constrained by project ownership at query level.

Why this matters:
- Action data may be exposed across projects if message IDs become known.

Fix recommendation:
- Change contract to `/api/projects/:id/ai-actions/by-message/:messageId` and query by both fields.
- Apply ownership checks before returning action logs.

---

### 7) `P1` Circuit AI generation writes are non-transactional and can leave partial state
Evidence:
- Instance + net creation in separate loops with no transaction boundary:
  - `server/circuit-ai/generate.ts:130-148`
  - `server/circuit-ai/generate.ts:150-175`

What is happening:
- Mid-route failure can create some instances/nets but not a complete generated schematic.

Why this matters:
- Inconsistent circuit state and manual cleanup burden.

Fix recommendation:
- Wrap generation write pipeline in one DB transaction with rollback on failure.
- Return structured per-step diagnostics if generation partially fails validation.

---

### 8) `P1` Agent orchestration path skips resilience controls used in core AI flow
Evidence:
- Agent route uses direct Anthropic call per step:
  - `server/routes/agent.ts:191-197`
- No breaker/fallback wrapper in this path (contrast with `server/ai.ts` breaker usage):
  - `server/ai.ts:871-881`
  - `server/ai.ts:940-942`
  - `server/ai.ts:1282-1291`
  - `server/ai.ts:1402-1405`

What is happening:
- Agent flow does not inherit the same provider-failure protections as chat flow.

Why this matters:
- Higher failure blast radius and degraded UX under provider instability.

Fix recommendation:
- Route agent calls through shared resilient execution utilities (breaker + categorized errors + optional fallback).
- Add per-step timeout/abort handling in the agent loop.

---

### 9) `P2` Component AI endpoint contracts are too permissive and path semantics drift
Evidence:
- `z.any()` inputs for AI-sensitive payloads:
  - `server/routes/components.ts:374` (`currentPart`)
  - `server/routes/components.ts:440` (`meta`)
  - `server/routes/components.ts:466` (`existingMeta`)
- Unsafe casts from those payloads:
  - `server/routes/components.ts:392`
  - `server/routes/components.ts:457`
  - `server/routes/components.ts:483`
- Path IDs parsed but unused in multiple AI endpoints:
  - `server/routes/components.ts:424`
  - `server/routes/components.ts:448`
  - `server/routes/components.ts:474`

What is happening:
- Endpoint shape suggests strict part-specific mutation/extraction, but contract allows arbitrary untyped objects and ignores some path identifiers.

Why this matters:
- Runtime errors and API contract confusion increase.

Fix recommendation:
- Replace `z.any()` with explicit schemas for `PartState`, `PartMeta`, and extraction context.
- Enforce `:id` semantics or remove unused path params from those routes.

---

### 10) `P2` BE-05 test coverage misses high-risk orchestration paths
Evidence:
- No direct tests found for `server/component-ai.ts` exports in `server/__tests__/*.ts`.
- No direct tests found for `server/circuit-ai/*` routes in `server/__tests__/*.ts`.
- Existing `ai.test.ts` focuses helper-level functions:
  - `server/__tests__/ai.test.ts:2`
- `stream-abuse.test.ts` mocks AI core instead of exercising real orchestration:
  - `server/__tests__/stream-abuse.test.ts:28-33`

What is happening:
- Critical flows (prompt cache correctness, dedupe isolation, stream tool execution semantics, circuit/component AI contracts) are largely untested.

Why this matters:
- Regressions in security and reliability can slip through CI.

Fix recommendation:
- Add integration tests for:
  - `/api/chat/ai*` with ownership and project-scoping assertions
  - Tool execution confirmation behavior
  - Prompt cache/dedupe isolation (cross-project)
  - Circuit/component AI happy-path + malformed-model-output paths

## What Is Already Good
- AI core has reusable error categorization + secret redaction:
  - `server/ai.ts:473-493`
  - `server/ai.ts:469-471`
- Circuit breakers are implemented and wired for main provider paths:
  - `server/circuit-breaker.ts:39-96`
  - `server/ai.ts:871-881`
  - `server/ai.ts:940-942`
- Stream endpoint includes meaningful abuse controls (rate, concurrency, origin, heartbeat, inactivity + absolute timeout, backpressure handling):
  - `server/routes/chat.ts:51-63`
  - `server/routes/chat.ts:69-93`
  - `server/routes/chat.ts:118-158`
  - `server/routes/chat.ts:501-573`
- Context-history trimming is token-aware (better than fixed-count slicing):
  - `server/ai.ts:390-416`

## Test Coverage Assessment (BE-05)
- Good:
  - Helper coverage for parsing/error logic in `ai.ts`:
    - `server/__tests__/ai.test.ts`
  - Stream abuse guard checks:
    - `server/__tests__/stream-abuse.test.ts`
  - Agent SSE behavior and loop tests:
    - `server/__tests__/agent-route.test.ts`
- Gaps:
  - No direct tests found for `server/component-ai.ts` function contracts.
  - No direct tests found for `server/circuit-ai/*` endpoint behavior.
  - No tests found for prompt-cache key correctness, dedupe isolation, or destructive-tool confirmation enforcement.
  - Ownership/scoping behavior for AI routes is not covered in this section’s test surface.

## Improvements and Enhancements (Open-Minded)
1. Unify AI execution policy in one shared executor:
   - ownership guard
   - request identity keying
   - breaker/fallback/timeout policy
   - confirmation gate for destructive tools
2. Introduce `AIRequestContext` with immutable `userId`, `projectId`, `sessionId`, request UUID.
3. Move large image payloads to upload-token workflow instead of raw base64 JSON for chat/component AI.
4. Add explicit tool execution audit fields:
   - `requiresConfirmation`
   - `confirmedByUserId`
   - `executionMode` (`client_action` | `server_side`)
5. Normalize model defaults across chat, circuit AI, component AI, and settings.

## Decision Questions Before BE-06
1. Should server-side tool execution be allowed for destructive tools at all, or always require explicit user ack?
2. Do we want to keep body-level `projectId` for chat AI, or move fully to path-scoped project routes now?
3. Should AI action history remain queryable by opaque message/group ID, or require project-scoped access only?
4. Should component/circuit AI endpoints accept raw API keys per request, or use stored key references only?

## Suggested Fix Order
1. Close security holes first (`P0`): ownership enforcement + dedupe isolation + prompt cache key correctness.
2. Add safety gate (`P1`): enforce destructive-tool confirmation server-side.
3. Stabilize contracts (`P1`): payload-limit alignment + scoped AI action retrieval + transactional circuit generation.
4. Raise confidence (`P2`): tests for cache/dedupe/AI route scoping and component/circuit AI paths.

## Bottom Line
BE-05 has strong building blocks (breaker, stream protections, token-aware history), but there are serious scoping/isolation risks in how project identity, dedupe, and prompt caching are handled. Fixing ownership + keying/isolation first will remove most high-risk exposure in the AI orchestration layer.
