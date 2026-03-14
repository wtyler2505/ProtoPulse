---
name: View-aware prompt tiering sends full data for the active view and summaries for everything else to reduce token cost
description: The AI system prompt builder in server/ai.ts detects which view the user is on (architecture, schematic, procurement, validation) and includes full entity data only for that domain — other domains get aggregated summaries (counts, category breakdowns) with instructions to use tools for details
type: insight
---

# View-Aware Prompt Tiering Sends Full Data for the Active View and Summaries for Everything Else to Reduce Token Cost

`buildSystemPrompt()` in `server/ai.ts` implements a context-aware prompt construction strategy that significantly reduces system prompt size for projects with many entities.

**The tiering logic:**
- Architecture nodes/edges: Full detail when on architecture/breadboard views, OR when <=10 items; summary otherwise
- BOM items: Full detail on procurement view, OR when <=5 items; summary otherwise
- Validation issues: Full detail on validation view, OR when <=5 items; summary otherwise
- Schematic sheets: Full detail on schematic/PCB views, OR when <=5 items; summary otherwise
- Component parts: 3-tier — full detail when <=20 items, category breakdown when <=100, count-only when >100
- Circuit designs: 2-tier — full detail when <=20, aggregated counts when >20

**Summary formats use counts and category breakdowns** rather than item listings:
- Nodes: `"23 components: 5 mcu, 8 sensor, 10 passive (use tools to query details)"`
- BOM: `"47 items (use tools to query details)"`
- Validation: `"12 issues: 3 error, 7 warning, 2 info"`

**Why this matters for cost and quality:**
- A project with 50 nodes, 80 edges, 40 BOM items, and 20 validation issues could generate 3000+ tokens of context in the system prompt. With tiering, the same project generates ~200 tokens when the user is on the validation view.
- The summaries include "(use tools to query details)" which nudges the AI to call tools for specific data rather than hallucinating from incomplete context.
- The threshold values (10 nodes, 5 BOM items, etc.) are tuned so that small projects always get full context — the tiering only kicks in for larger designs where the AI wouldn't meaningfully use all the data anyway.

**Prompt caching:** `hashAppState()` creates a cache key from entity counts, view, and selection state. If the state hasn't changed between chat turns, the cached prompt is reused (via an LRU cache of size 20, keyed by userId to prevent cross-user prompt sharing).

**Related:**

- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — prompt tiering and model routing are complementary cost optimizations: tiering minimizes tokens, routing selects the cheapest sufficient model for those tokens
- [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix]] — prompt caching (`hashAppState()`) avoids rebuilding the prompt, dedup avoids sending it twice — both prevent redundant work at different stages of the AI pipeline
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — tiered prompts with summaries nudge the AI to use tools for details rather than hallucinating; the action executor is what processes the resulting tool-use actions
