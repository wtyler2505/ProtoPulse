---
description: AI system quality gaps found in the comprehensive audit — validation vacuum, tool blindspots, architecture anti-patterns, and hallucination vectors
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# ai-system-debt

AI system quality issues identified in the April 2026 comprehensive audit. The meta-finding: ProtoPulse has zero validation at any layer — tool output, schema boundary, or evaluation framework. Fake data flows from mock tools through unvalidated schemas into user-facing output.

## The Validation Vacuum

```
pricingLookupTool returns Math.random() prices
  → outputSchema: z.any() lets anything through
  → risk-analysis reads undefined columns (silently zeroed)
  → no Genkit evals catch the fabrication
  → user confidently designs with out-of-stock parts
```

## Notes

### Validation & Quality
- [[genkit-tools-use-z-any-output-destroying-structured-validation]] -- z.any() defeats structured output guarantees
- [[no-genkit-evaluation-framework-means-ai-quality-is-vibes-only]] -- zero AI eval test coverage
- [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] -- fake prices in production
- [[risk-analysis-tool-references-nonexistent-schema-columns]] -- risk scores silently broken

### Architecture
- [[genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent]] -- context collapse from 125 flat tools
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- zombie Gemini requests on tab close
- [[build-system-prompt-has-on-m-edge-resolution-bottleneck]] -- O(N*M) prompt construction

### Coverage Gaps
- [[ai-toolset-has-major-blindspots-in-history-variables-lifecycle-and-zones]] -- 6 API domains invisible to AI
- [[voice-ai-is-disconnected-from-llm-using-hardcoded-command-matching]] -- voice input never reaches the LLM

## Related
- [[ai-is-the-moat-lean-into-it]] -- the moat has no quality foundation
- [[all-procurement-data-is-ai-fabricated]] -- the symptom of the validation vacuum

---

Topics:
- [[gaps-and-opportunities]]
- [[architecture-decisions]]
