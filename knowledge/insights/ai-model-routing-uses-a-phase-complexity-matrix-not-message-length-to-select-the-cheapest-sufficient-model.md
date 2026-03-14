---
name: AI model routing uses a phase-complexity matrix to select the cheapest sufficient model
description: The auto routing strategy combines design phase (architecture/schematic/pcb/validation/export/exploration) with task complexity (simple/moderate/complex) via a 6x3 matrix to select fast/standard/premium model tier — falling back to message-length heuristics only when appState is unavailable
type: insight
---

# AI Model Routing Uses a Phase-Complexity Matrix, Not Message Length, to Select the Cheapest Sufficient Model

The AI system in `server/ai.ts` implements a multi-signal model routing strategy that goes beyond simple message-length heuristics. When `appState` is available (which it always is for project-scoped chat), the router:

1. **Maps the active view to a design phase** via `VIEW_TO_PHASE` (e.g., `breadboard` -> `schematic`, `pcb` -> `pcb`). Unmapped views fall to `exploration`.

2. **Infers task complexity** via `detectTaskComplexity()` using three signals:
   - Regex patterns (`SIMPLE_PATTERNS` for navigational, `COMPLEX_PATTERNS` for generative)
   - Message length (<100 chars = simple-leaning, >500 = moderate-leaning)
   - Cross-referencing against existing component names in BOM/nodes (>=3 mentions = complex, >=2 = moderate)

3. **Looks up the model tier** from `PHASE_COMPLEXITY_MATRIX[phase][complexity]`, a 6x3 table where each cell maps to `fast`, `standard`, or `premium`. Key design choices:
   - PCB is never `fast` — even simple PCB queries use `standard` because PCB layout context is dense
   - Validation caps at `standard` even for complex tasks — it's mostly rule-based
   - Export is aggressive about using `fast` — only complex multi-format exports need `standard`
   - Images always bump up to at least `standard` for vision capability

4. **Falls back to message-length heuristics** only when appState is absent (non-project contexts like admin endpoints).

**Why this matters:** The matrix approach can reduce AI costs significantly by routing 60-70% of requests to fast/cheap models while preserving quality for complex generation tasks. The fallback chain (phase-aware -> message-length -> user-selected) means the system degrades gracefully rather than failing.

**Related:**

- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — a tripped breaker on the selected provider triggers fallback to the alternate provider, bypassing the matrix selection entirely
- [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost]] — the matrix and the prompt tiering are two sides of the same cost optimization: the matrix selects the cheapest model tier, prompt tiering minimizes the tokens sent to it
- [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix]] — deduplication prevents redundant API calls after the matrix has already selected a model tier, making the two optimizations complementary
- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — the job queue's per-type timeouts (5min AI vs 10min export) reflect the same domain-aware differentiation the matrix applies to model selection
