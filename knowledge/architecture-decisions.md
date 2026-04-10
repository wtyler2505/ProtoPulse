---
description: Why ProtoPulse is built the way it is — trade-offs, constraints, and key architectural choices
type: moc
topics:
  - "[[index]]"
  - "[[goals]]"
  - "[[eda-fundamentals]]"
---

# architecture-decisions

Recorded decisions about ProtoPulse's technical architecture. See `docs/adr/` for formal ADRs.

## Knowledge Notes
- [[no-other-eda-tool-starts-from-architecture-diagrams]] -- architecture-first is unique
- [[ai-is-the-moat-lean-into-it]] -- lean into AI over traditional EDA catch-up
- [[architecture-first-bridges-intent-to-implementation]] -- why architecture-first matters
- [[god-files-create-feature-paralysis-through-complexity]] -- 12 god files blocked feature domains
- [[dual-export-system-is-a-maintenance-trap]] -- parallel implementations require double fixes
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- O(N) system prompt cost
- [[monolithic-context-causes-quadratic-render-complexity]] -- ProjectProvider re-render cascade
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- codebase scale quantified
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- highest-severity security finding
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- no SSR needed for tool apps
- [[react-query-eliminates-the-need-for-client-state-libraries]] -- server-derived state only
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- schema-to-type-to-validation chain
- [[dual-ai-providers-prevent-single-vendor-lock-in]] -- Claude + Gemini with circuit breaker
- [[project-provider-monolith-is-the-biggest-remaining-frontend-debt]] -- 40+ values, re-render cascade
- [[hardcoded-project-id-blocked-multi-project-until-wave-39]] -- implicit assumptions become structural
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- Tauri resolved browser sandbox limits
- [[cross-tool-coherence-is-harder-than-building-features]] -- data ownership between views
- [[all-p0-and-p1-items-resolved-proves-security-first-discipline]] -- zero P0/P1 remain
- [[backlog-completion-at-501-items-reveals-systematic-execution]] -- wave-based delivery
- [[c5-items-are-programs-not-features]] -- 24 C5 items need ADRs not sprints
- [[six-epics-organize-the-remaining-strategic-work]] -- A-F strategic layers
- [[codex-audit-produced-the-structural-skeleton-for-all-subsequent-waves]] -- 293 findings became 154 waves

### Comprehensive Audit Synthesis
- [[comprehensive-audit-reveals-zero-validation-at-any-layer]] -- the audit's meta-finding across all 40 sections
- [[security-debt]] -- attack chain cluster (5 notes)
- [[performance-debt]] -- main-thread blocking cluster (6 notes)
- [[ai-system-debt]] -- validation vacuum cluster (9 notes)

### Comprehensive Audit Findings (2026-04-05)
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- unhandled abort = zombie Gemini requests
- [[genkit-tools-use-z-any-output-destroying-structured-validation]] -- z.any() defeats structured output
- [[genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent]] -- 125 flat tools cause context collapse
- [[no-genkit-evaluation-framework-means-ai-quality-is-vibes-only]] -- zero AI eval test coverage
- [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] -- Math.random() prices in production
- [[build-system-prompt-has-on-m-edge-resolution-bottleneck]] -- O(N*M) array scans per AI request
- [[ai-toolset-has-major-blindspots-in-history-variables-lifecycle-and-zones]] -- 6 API domains invisible to AI
- [[risk-analysis-tool-references-nonexistent-schema-columns]] -- broken risk scores from missing columns
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] -- O(N) stringify per render cycle
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- MNA/NR/Gauss all sync main thread
- [[jsonb-columns-lack-gin-indexes-forcing-sequential-scans]] -- no GIN indexes on JSONB columns
- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- XSS → RCE via disabled CSP + global API
- [[eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack]] -- eval + localStorage = full hijack
- [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] -- desktop app needs Node.js installed
- [[scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter]] -- 10 requests = 640MB OOM
- [[websocket-sessions-are-never-revalidated-after-initial-handshake]] -- revoked users keep access
- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] -- dangling intervals leak memory
- [[execsync-in-arduino-service-blocks-entire-express-event-loop]] -- sync shell calls freeze API
- [[custom-lww-sync-should-be-replaced-with-yjs-crdts]] -- LWW causes destructive merges
- [[voice-ai-is-disconnected-from-llm-using-hardcoded-command-matching]] -- voice is fake AI
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] -- WCAG AA keyboard focus broken
- [[vite-manual-chunks-defeats-dynamic-import-and-tree-shaking]] -- bloated initial JS payload
- [[asynchandler-wrapper-is-redundant-in-express-v5]] -- legacy wrapper, Express v5 handles async natively

## Core Stack Decisions

### Express 5 (not Next.js)
SPA with separate API. No SSR needed for a tool app. Express 5 gives async error handling natively.

### React Query over Redux
Server state only. No client-only global state needed. Mutations invalidate cache automatically.

### Dual AI Providers (Claude + Gemini)
Claude for complex multi-step tool-use and reasoning. Gemini as fallback and for vision tasks. Multi-model routing in `server/ai.ts`.

### Drizzle ORM + PostgreSQL
Type-safe queries with Zod schema integration. Soft deletes on core tables (deletedAt). LRU cache in front of DB.

### shadcn/ui (New York dark theme, Neon Cyan #00F0FF)
Copy-paste components, full control, consistent dark theme. No vendor lock-in.

### Vitest over Jest
Native Vite integration. Workspace projects for server/client separation.

## Key Architectural Constraints

### `ProjectProvider` Monolith (known debt TD-01)
Monolithic context with 40+ state values. Works for single project. Multi-project requires splitting.

### Hardcoded PROJECT_ID (resolved in Wave 39)
Was `PROJECT_ID = 1` in project-context.tsx. Fixed: ProjectPickerPage.tsx, wouter routing, ProjectIdContext.

### Soft Deletes
`projects`, `architecture_nodes`, `architecture_edges`, `bom_items` use `deletedAt`. Always filter with `isNull(deletedAt)`.

### Auth via Header (not cookies)
`X-Session-Id` header. No cookie-based auth. API keys encrypted with AES-256-GCM.

### O(N) AI System Prompt (known debt GA-DB-01)
Rebuilds full project state on every AI request. Sequential DB queries. Performance bottleneck at scale.

## Security Architecture
- CORS allowlist (Wave E)
- IDOR/BOLA guards on 30+ routes (Wave A)
- XSS: protocol validation on AI markdown links
- ZIP bomb protection on FZPZ import
- Rate limiting via express-rate-limit

## Module Decomposition Progress
- `server/routes.ts` → barrel → 22 domain routers in `server/routes/`
- `server/ai-tools.ts` → barrel → 17 tool modules in `server/ai-tools/`
- `server/circuit-routes.ts` → barrel → 13 files in `server/circuit-routes/`
- `server/storage.ts` → 1915→162 lines → 13 domain modules in `server/storage/`
- `ProcurementView.tsx` → 1713→335 lines → 15 sub-components
- `PCBLayoutView.tsx` → decomposed (Wave 27)
- `ShapeCanvas.tsx` → decomposed 1275→755 lines (Wave 26)

## Tensions

- [[ai-is-the-moat-lean-into-it]] depends on AI reliability, but [[genkit-tools-use-z-any-output-destroying-structured-validation]], [[no-genkit-evaluation-framework-means-ai-quality-is-vibes-only]], and [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] reveal the moat has no quality foundation
- [[native-desktop-pivot-unblocked-three-c5-programs]] gained hardware access but introduced [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] and [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] — the pivot created risks that didn't exist in browser mode

---

Agent Notes:
- 2026-04-06: comprehensive audit notes cluster into 5 tight groups: (1) AI quality chain (z.any → no evals → mock data → fabricated output), (2) security attack chain (eval XSS → localStorage → Tauri RCE), (3) main-thread blocking (sim + canvas + prompt + execSync), (4) resource leaks (zombie streams + setInterval + scrypt burst), (5) desktop pivot risks (CSP + sidecar + execSync). Navigation between groups via shared consequences: groups 1+6 share "fake data flowing through", groups 2+4 share "OOM/crash vectors", groups 3+5 share "offload to worker/native".

Topics:
- [[index]]
- [[goals]]
- [[eda-fundamentals]]
