---
description: "The comprehensive audit's meta-finding: ProtoPulse has no validation at the tool output, schema boundary, or evaluation layer — fake data flows unchecked to users"
type: insight
source: "conductor/comprehensive-audit.md (synthesis of 40 sections)"
confidence: proven
topics: ["[[architecture-decisions]]", "[[gaps-and-opportunities]]"]
related_components: ["server/ai.ts", "server/genkit.ts", "server/ai-tools/risk-analysis.ts"]
---

# The comprehensive audit reveals zero validation at any layer from LLM output to user-facing data

Three cross-cutting patterns emerge from the 40-section, 30-pass audit:

## 1. The Validation Vacuum

Fake data flows unchecked through three layers:
- **Tool output**: `pricingLookupTool` returns `Math.random() * 10` in production ([[production-mock-data-in-pricing-tool-causes-hallucinated-prices]])
- **Schema boundary**: All Genkit tools use `outputSchema: z.any()`, defeating structured validation ([[genkit-tools-use-z-any-output-destroying-structured-validation]])
- **Evaluation**: Zero AI eval coverage — no golden datasets, no LLM-as-a-judge, no regression detection ([[no-genkit-evaluation-framework-means-ai-quality-is-vibes-only]])
- **Downstream**: Risk analysis reads undefined columns, silently zeroing scores ([[risk-analysis-tool-references-nonexistent-schema-columns]])

No layer catches the fabrication. The AI confidently reports fake data and the user has no way to know.

## 2. The Desktop Pivot Security Trade-off

The native desktop pivot solved hardware access but introduced OS-level attack surface:
- Browser mode had XSS risk limited to session scope
- Tauri mode with `csp: null` + `withGlobalTauri: true` escalates XSS to arbitrary OS code execution ([[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]])
- Combined with `eval()` in CircuitCodeView ([[eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack]]), a shared project with malicious code achieves full RCE

## 3. The Synchronous Computation Bottleneck

Every heavy computation runs synchronously on the main thread:
- Simulation: O(N³) Gaussian elimination ([[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]])
- Canvas: O(N) JSON.stringify per render ([[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]])
- AI prompt: O(N*M) array scans ([[build-system-prompt-has-on-m-edge-resolution-bottleneck]])
- Hardware: execSync blocks entire event loop ([[execsync-in-arduino-service-blocks-entire-express-event-loop]])

The universal fix is "offload everything" — Web Workers, WebAssembly, native Rust Tauri plugins.

## Strategic Implication

The audit shifts the gap profile from **features** to **quality/reliability**. The backlog is 98% complete. The next strategic phase should be hardening: validation at every layer, security boundary enforcement, and offloading computation. The AI moat ([[ai-is-the-moat-lean-into-it]]) has no foundation if the AI's output is unvalidated.

---

Relevant Notes:
- [[ai-system-debt]] -- AI validation vacuum cluster
- [[security-debt]] -- security attack chain cluster
- [[performance-debt]] -- synchronous bottleneck cluster
- [[ai-is-the-moat-lean-into-it]] -- the moat depends on AI quality, which this audit shows is absent
- [[all-p0-and-p1-items-resolved-proves-security-first-discipline]] -- the audit reveals NEW P0 items not in the original analysis

Topics:
- [[architecture-decisions]]
- [[gaps-and-opportunities]]
