---
description: Source manifest for the 40-section comprehensive codebase audit — tracks all 25 extracted knowledge notes
type: source
source: "conductor/comprehensive-audit.md"
processed: 2026-04-06
---

# Comprehensive Audit Source (April 5, 2026)

**Source file:** `conductor/comprehensive-audit.md`
**Sections:** 40 (30 audit passes + 10 feature/enhancement sections)
**Notes extracted:** 25 atomic knowledge notes + 1 synthesis note + 3 sub-topic maps

## Extraction Manifest

### Security Cluster (5 notes) → [[security-debt]]
1. `tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce` — §5, §16, §20
2. `eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack` — §15
3. `scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter` — §9
4. `websocket-sessions-are-never-revalidated-after-initial-handshake` — §18
5. `setinterval-never-cleared-creates-memory-ratchet-in-server-routes` — §13

### AI Quality Cluster (9 notes) → [[ai-system-debt]]
6. `genkit-abort-signal-creates-zombie-streams-that-leak-api-quota` — §1
7. `genkit-tools-use-z-any-output-destroying-structured-validation` — §1
8. `genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent` — §24
9. `no-genkit-evaluation-framework-means-ai-quality-is-vibes-only` — §32, §37
10. `production-mock-data-in-pricing-tool-causes-hallucinated-prices` — §27
11. `build-system-prompt-has-on-m-edge-resolution-bottleneck` — §27
12. `ai-toolset-has-major-blindspots-in-history-variables-lifecycle-and-zones` — §29, §31, §33
13. `risk-analysis-tool-references-nonexistent-schema-columns` — §30
14. `voice-ai-is-disconnected-from-llm-using-hardcoded-command-matching` — §38

### Performance Cluster (6 notes) → [[performance-debt]]
15. `reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes` — §2
16. `simulation-engine-blocks-main-thread-with-no-webworker-or-wasm` — §3
17. `jsonb-columns-lack-gin-indexes-forcing-sequential-scans` — §4
18. `vite-manual-chunks-defeats-dynamic-import-and-tree-shaking` — §16
19. `execsync-in-arduino-service-blocks-entire-express-event-loop` — §9
20. `erc-pin-classification-uses-fragile-regex-that-fails-on-nonstandard-names` — §8

### Desktop/EDA Cluster (3 notes)
21. `tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node` — §5
22. `kicad-exporter-deterministic-uuid-guarantees-collisions-in-large-projects` — §6
23. `custom-lww-sync-should-be-replaced-with-yjs-crdts` — §7, §26

### Web/UX Cluster (2 notes)
24. `focus-outline-none-strips-keyboard-indicators-wcag-violation` — §25
25. `asynchandler-wrapper-is-redundant-in-express-v5` — §9

### Synthesis
26. `comprehensive-audit-reveals-zero-validation-at-any-layer` — cross-cutting meta-finding

## Sections NOT Extracted (low signal or already covered)

- §10 (AI tools data coupling) — covered by genkit-tools-z-any and risk-analysis notes
- §11 (React 19 Activity API memory leak) — specific to base64 in ChatPanel, lower priority
- §12 (route flat architecture) — covered by asynchandler note
- §14 (Math.random IDs) — mentioned in existing AGENTS.md crypto.randomUUID() rule
- §17 (feature gaps) — already in MASTER_BACKLOG.md
- §19 (DSL sandbox escape) — covered by eval-in-circuit-code-view note
- §34-40 (voice, speech, settings, E2E, Google Sheets, observability) — lower priority or already partially covered

---

Topics:
- [[methodology]]
