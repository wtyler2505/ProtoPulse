---
summary: parseLocalIntent returns AIAction[] instead of directly mutating state, ensuring offline (no API key) commands flow through the same executeAIActions pipeline as AI-generated actions
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — the action executor that processes both online AI actions and offline intent actions uses the same mutable accumulator pattern"
  - "[[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — offline intent handlers are only useful if they produce actions the executor can process"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches.md
  - the-gap-between-feature-exists-and-feature-is-wired.md
---

The `parseLocalIntent` system (`client/src/components/panels/chat/parseLocalIntent.ts` + `intent-handlers/`) converts typed user commands (e.g., "add a resistor", "switch to schematic") into `AIAction[]` objects. The critical design decision is that these handlers **never** call mutation functions directly. Instead, they produce the same `AIAction` discriminated-union objects that the AI streaming system generates from Claude/Gemini tool calls.

This matters because:

1. **Single execution path**: Both online AI responses and offline local commands flow through `executeAIActions` in ChatPanel. This means action logging, undo snapshots, history entries, and optimistic cache updates all work identically regardless of whether the action came from an LLM or from local text parsing.

2. **Priority-ordered handler chain**: `intent-handlers/index.ts` defines handlers in a strict priority order — the first handler whose `match()` returns true wins. This mirrors how regex-based NLP dispatchers work but with structured TypeScript types. The ordering is critical: specific patterns ("add to bom") must precede broad ones ("add node") to avoid misparsing.

3. **Fallthrough semantics**: A handler can match broadly but return `{ actions: [], response: null }` to signal "I matched the pattern but couldn't extract the necessary parameters." The loop then continues to the next handler, enabling graceful degradation without throwing errors.

4. **Domain-specific fallback handlers**: At the bottom of the priority chain, six domain-specific "fallback" handlers match any mention of component/BOM/memory/power/antenna/sensor keywords and return canned informational responses. These ensure no domain-relevant query falls through to the generic "type help" response.

The intent system means ProtoPulse has meaningful offline functionality (navigation, simple architecture edits, BOM management) without any AI API key configured.

---

Related:
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — the action executor that processes both online AI actions and offline intent actions uses the same mutable accumulator pattern
- [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — offline intent handlers are only useful if they produce actions the executor can process
- [[ai-tool-registry-uses-client-side-dispatch-stubs-for-tools-that-cannot-execute-server-side]] — clientAction stubs, AI tool results, and local intents all converge on the same AIAction executor
- [[circuit-dsl-worker-splits-transpilation-from-evaluation-because-sucrase-is-safe-on-main-thread-but-eval-is-not]] — another offline computation path, but the DSL runs arbitrary JS while intent parsing uses safe pattern matching

## Topics

- [[index]]
