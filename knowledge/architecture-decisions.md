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

---

Topics:
- [[index]]
- [[goals]]
- [[eda-fundamentals]]
