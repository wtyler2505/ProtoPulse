---
name: Design agent hardcodes confirmed=true bypassing destructive tool confirmation enforcement
description: The agentic AI loop in server/routes/agent.ts sets confirmed=true in the ToolContext, allowing all 88 tools (including destructive ones like clear_bom, delete_node) to execute without user confirmation — the agent is trusted to make engineering decisions autonomously
type: insight
category: security
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/routes/agent.ts:175 — const toolContext = { projectId, storage, confirmed: true }
  - server/ai-tools/registry.ts:144 — if (tool.requiresConfirmation && ctx.confirmed !== true) reject
  - server/ai-tools/registry.ts:87-91 — getDestructiveTools() returns tools with requiresConfirmation=true
---

# Design Agent Hardcodes confirmed=true, Bypassing Destructive Tool Confirmation Enforcement

The `ToolRegistry.execute()` method in `server/ai-tools/registry.ts` has a server-side safety gate: if a tool has `requiresConfirmation: true` and the context doesn't have `confirmed: true`, execution is rejected with a message telling the client to re-submit after user approval.

However, the agentic AI loop in `server/routes/agent.ts` (line 175) constructs its `ToolContext` with `confirmed: true` hardcoded:

```ts
const toolContext: ToolContext = { projectId, storage, confirmed: true };
```

This means every tool the AI agent calls — including destructive operations like clearing BOM items, deleting nodes, or resetting validation — executes without any user confirmation prompt. The agent's system prompt instructs it to "make reasonable engineering decisions and explain them" and "do not ask for clarification."

**Why this is intentional but risky:** The agent is designed to autonomously build complete circuit designs in 1-15 steps. Requiring confirmation for each destructive tool call would break the autonomous loop (the SSE stream is one-directional — the server can't ask the user for input mid-loop). But it means a confused AI model could delete existing architecture before replacing it, with no undo gate.

**Mitigating factor:** The agent endpoint has strict rate limiting (2 requests/min per IP), authentication via `requireProjectOwnership`, and a 15-step cap. But within those bounds, the agent has full unconfirmed access to all 88 tools.

**Contrast with chat:** In the normal chat flow, destructive tools surface a confirmation dialog on the client. The agent flow is the only path where `confirmed: true` is set server-side without user interaction.

---

Related:
- [[ai-tool-registry-uses-client-side-dispatch-stubs-for-tools-that-cannot-execute-server-side]] — chat tools use client-side dispatch; agent tools execute server-side with full confirmation bypass
- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — agent.ts uses requireProjectOwnership but the tool calls operate on projectId without per-tool ownership re-validation
- [[circuit-ai-selectively-enables-extended-thinking-based-on-operation-type-not-model-or-prompt-size]] — the agent loop does NOT use extended thinking (multi-turn reasoning replaces single-turn deep thinking), but it does bypass confirmation
