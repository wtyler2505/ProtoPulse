---
name: Circuit AI selectively enables extended thinking based on operation type not model or prompt size
description: The circuit-ai module (generate.ts, analyze.ts) enables Anthropic extended thinking for generation and analysis but disables it for review — the thinking budget is determined by operation type, not by model capability or prompt complexity, creating a tiered reasoning strategy
type: insight
category: ai-system
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/circuit-ai/thinking.ts:7-8 — THINKING_BUDGET from env (default 10000), DISABLE_EXTENDED_THINKING env toggle
  - server/circuit-ai/generate.ts:85-89 — getThinkingConfig() used for circuit generation, budget added to max_tokens
  - server/circuit-ai/analyze.ts:117-124 — getThinkingConfig() used for circuit analysis
  - server/circuit-ai/review.ts:122-129 — review explicitly does NOT use thinking config (comment: "simple task")
---

# Circuit AI Selectively Enables Extended Thinking Based on Operation Type, Not Model or Prompt Size

The `server/circuit-ai/` module has three AI-powered endpoints (generate, analyze, review) that use the same Anthropic client but differ in whether they enable extended thinking:

| Operation | Extended Thinking | Rationale (from code) |
|-----------|------------------|----------------------|
| Generate schematic | Yes (10K budget) | Complex topology decisions |
| Analyze circuit | Yes (10K budget) | Deep reasoning about behavior |
| Review schematic | No | "Simple task" (line 122 comment) |

**The thinking budget is additive to max_tokens:** Both `generate.ts` and `analyze.ts` compute `max_tokens: 4096 + thinkingConfig.thinking.budget_tokens`. This means the actual token limit is 14,096 (4096 output + 10000 thinking) when thinking is enabled, vs 4096 when it's not. The thinking tokens are invisible to the user — they're internal chain-of-thought that the model discards.

**Environment-based kill switch:** `DISABLE_EXTENDED_THINKING=1` disables thinking globally. `THINKING_BUDGET` (default 10000) controls the budget. This allows operators to reduce cost/latency without code changes. When disabled, `getThinkingConfig()` returns `{}`, which spreads into the API call as a no-op.

**Why review is excluded:** The review prompt asks the AI to check a fixed list of 6 categories (bypass caps, unconnected pins, pull-ups, power, SI, best practices) and return a JSON array. This is pattern-matching, not reasoning — extended thinking would add latency without improving quality. Generation and analysis, by contrast, require multi-step reasoning (topology selection, value calculation, what-if analysis).

**Contrast with the agent loop:** The agentic design agent in `server/routes/agent.ts` does NOT use extended thinking at all — it uses plain `max_tokens: 4096` with tool_use. This is because the agent's reasoning happens across multiple turns (up to 15 steps), not within a single completion. Extended thinking within a tool-use loop would be double-reasoning.

**Contrast with the chat system:** The main AI chat in `server/ai.ts` doesn't use extended thinking either. The circuit-ai module is the only place where extended thinking is used, and only for the two most complex operations.

---

Related:
- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — model routing in the main chat is based on view/phase; circuit-ai thinking is based on operation type. Both encode domain-specific cost/quality trade-offs.
- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — all three circuit-ai operations use anthropicBreaker.execute()
- [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost]] — prompt tiering reduces input tokens, extended thinking controls output reasoning tokens — different cost levers for the same AI pipeline
- [[design-agent-hardcodes-confirmed-true-bypassing-destructive-tool-confirmation-enforcement]] — the agent loop does NOT use extended thinking; multi-turn tool use replaces single-turn deep reasoning
