---
description: "Zero AI evaluation test coverage — no golden datasets, no LLM-as-a-judge, no regression detection for prompt or model changes"
type: debt-note
source: "conductor/comprehensive-audit.md §32, §37"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/ai.ts", "server/genkit.ts"]
---

# No Genkit evaluation framework means AI quality is assessed by vibes only

The application has absolutely no AI evaluation test coverage. Genkit's Evaluation capabilities (`genkit eval:run`) allow testing LLM responses against golden datasets to mathematically prove that model updates or prompt tweaks don't cause regressions. ProtoPulse relies entirely on manual "vibe checks" in production.

Missing pieces:
- No deterministic tests for core circuit generation flows
- No LLM-as-a-judge evaluators for faithfulness, relevancy, and safety
- No Genkit Developer UI integration (`npx genkit start`) for trace visualization and prompt debugging
- No OpenTelemetry traces for prompt latency, token costs, or tool-call success rates
- No middleware guardrails sanitizing user input before it hits the LLM or validating output schema before returning to client

The E2E Playwright tests also only check "did the UI crash" — if the AI hallucinates a wrong schematic but renders it without an HTTP 500, the tests pass.

---

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] -- no evals means fabricated data goes undetected
- [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] -- pricing hallucinations are the symptom of missing evals
- [[genkit-tools-use-z-any-output-destroying-structured-validation]] -- z.any() at compile time + no eval at runtime = zero validation at any layer
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- no telemetry means zombie streams also go unmeasured
- [[genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent]] -- eval framework is a prerequisite for validating multi-agent migration

Topics:
- [[architecture-decisions]]
