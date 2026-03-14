---
name: AI tool registry uses client-side dispatch stubs for tools that cannot execute server-side
description: Many of the 88 registered AI tools (especially Arduino, navigation, and layout tools) use clientAction() which returns a pass-through ToolResult containing the tool name and params — the server validates but never executes, delegating to the client's action executor
type: insight
category: ai-system
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/ai-tools/registry.ts:clientAction() wraps tool name + params into {type, ...params} payload
  - server/ai-tools/arduino.ts:all 5 Arduino tools use clientAction() — compile_sketch, upload_firmware, etc.
  - server/ai-tools/navigation.ts:navigation tools dispatched client-side
---

# AI Tool Registry Uses Client-Side Dispatch Stubs for Tools That Cannot Execute Server-Side

The AI tool system has 88 registered tools, but a significant subset cannot execute on the server because they require client-only APIs (React state, Web Serial, CodeMirror, DOM manipulation). Rather than splitting the tool definitions across client and server, the registry keeps all tool definitions server-side and uses `clientAction()` as a universal escape hatch.

`clientAction(toolName, params)` in `server/ai-tools/registry.ts` produces:
```ts
{ success: true, message: 'Action ${toolName} dispatched to client', data: { type: toolName, ...params } }
```

The server still validates params against the Zod schema (catching AI hallucinations like wrong types or missing required fields) but never touches storage or performs side effects. The `data.type` field becomes the dispatch key on the client side.

**Why this matters:** It creates an asymmetry where the AI model "thinks" it's executing a tool (because the response says `success: true`), but the actual execution happens later, asynchronously, on the client. If the client-side action executor fails or the SSE stream drops, the AI has no way to know the tool didn't actually work. This is a deliberate trade-off: server-side schema validation catches most AI errors, and the latency of a round-trip to the client for confirmation would break the streaming UX.

**The Arduino tools are the most striking example**: `compile_sketch` and `upload_firmware` are registered as AI tools that the model can call during a chat conversation, but they resolve to client-side dispatches that trigger the real ArduinoService job pipeline via separate HTTP calls. The AI never sees compilation errors directly — the user has to relay them.

**Counter-intuitive consequence:** The `requiresConfirmation` flag on tools like `upload_firmware` is enforced server-side in `ToolRegistry.execute()`, but since Arduino tools use `clientAction()`, the confirmation check happens *before* the stub returns — meaning the server blocks a no-op, and the real confirmation happens on the client separately. The flag is effectively checked twice in different systems.

---

**Counter-intuitive consequence:** The `requiresConfirmation` flag on tools like `upload_firmware` is enforced server-side in `ToolRegistry.execute()`, but since Arduino tools use `clientAction()`, the confirmation check happens *before* the stub returns — meaning the server blocks a no-op, and the real confirmation happens on the client separately. The flag is effectively checked twice in different systems. This creates a dangerous exception path: the [[design-agent-hardcodes-confirmed-true-bypassing-destructive-tool-confirmation-enforcement|design agent bypasses confirmation entirely]] by setting `confirmed: true`, meaning client-dispatch stubs from the agent execute with no safety net on either side.

Since [[local-intent-parsing-produces-aiactions-not-direct-mutations-to-unify-offline-and-online-execution-paths|offline local intent parsing also produces AIActions]], the client-side dispatch is actually the convergence point for three different action sources: AI streaming, agent loop, and offline commands.

---

Related:
- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — circuit breaker protects the real AI calls, not the clientAction stubs
- [[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — ai-tools/index.ts composes all 14 registration functions into the singleton registry
- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — model routing determines WHICH model calls the tool; clientAction determines WHERE the tool executes
