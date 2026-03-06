# AGENTS.md

This file provides guidance to AI coding assistants working in this repository.

**Note:** CLAUDE.md, .clinerules, .cursorrules, .windsurfrules, .replit.md, GEMINI.md, .github/copilot-instructions.md, and .idx/airules.md are symlinks to this AGENTS.md file.

## ProtoPulse

Browser-based AI-assisted EDA (Electronic Design Automation) platform built for makers, learners, and hobbyists who want **one tool that does everything** — from learning basic circuits to designing, wiring, simulating, and programming real hardware. The vision is TinkerCad Circuits + Fritzing + KiCad + Wokwi unified into a single AI-powered experience where you never have to leave the tool.

**Origin story:** The creator is building a rover using Arduino Mega, NodeMCU ESP32, RioRand motor controllers, and salvaged hoverboard wheels — and couldn't find a single tool that covered the full journey from "I don't know electronics" to "here are my Gerbers." ProtoPulse exists to be that tool.

**Current capabilities:** Architecture block diagrams, circuit schematic editor, BOM management, design validation (DRC/ERC), AI chat with 84 AI tools, multi-format export (KiCad, Eagle, SPICE, Gerber, drill, pick-and-place, design report, FMEA, firmware scaffold, PDF), AC analysis, undo/redo, project ownership, design history, backup/restore.

**Where it's heading:** Interactive live simulation (EveryCircuit-style animated current flow), Fritzing-style breadboard wiring view, hardware communication via Web Serial API (talk to Arduino/ESP32 from the browser), camera-based component identification, engineering calculators, Arduino code generation, and a learning path that takes complete beginners through to PCB manufacturing. See `docs/future-features-and-ideas-list.md` for the full feature roadmap.

## Stack

React 19 + TypeScript 5.6 + Vite 7 + Tailwind v4 + shadcn/ui (New York dark theme) + @xyflow/react | Express 5 + PostgreSQL + Drizzle ORM + TanStack React Query | AI: Anthropic Claude + Google Gemini via SSE streaming | Testing: Vitest 4 + happy-dom + @testing-library/react

## Build & Commands

| Task | Command | Notes |
| ---- | ------- | ----- |
| Dev server | `npm run dev` | Express + Vite on port 5000 |
| Dev client only | `npm run dev:client` | Vite dev server on port 5000 |
| Production build | `npm run build` | Vite + esbuild (`tsx script/build.ts`) |
| Start production | `npm start` | Runs pre-built `dist/index.cjs` |
| Type check | `npm run check` | `tsc` — **must pass with zero errors** |
| Run all tests | `npm test` | `vitest run` (server + client projects) |
| Tests (watch) | `npm run test:watch` | `vitest` interactive mode |
| Tests + coverage | `npm run test:coverage` | `vitest run --coverage` (v8 provider) |
| Single test file | `npx vitest run path/to/file.test.ts` | |
| Tests by name | `npx vitest run -t "test name"` | |
| Server tests only | `npx vitest run --project server` | node environment |
| Client tests only | `npx vitest run --project client` | happy-dom environment |
| DB sync | `npm run db:push` | Drizzle schema → PostgreSQL |
| Lint | `npx eslint .` | ESLint strict TypeScript + React |
| Format | `npx prettier --write .` | Prettier formatting |

### Critical Rules

- `npm run check` **must** pass with zero errors after every change — fix ALL TypeScript errors immediately
- `npm test` should pass — verify no regressions after changes
- Never dismiss any error as "pre-existing" or "unrelated"

## Key Files

| File | Purpose |
| ---- | ------- |
| `shared/schema.ts` | ALL database tables (27), Zod insert schemas, TypeScript types |
| `shared/component-types.ts` | Component editor type system (shapes, connectors, buses, DRC rules) |
| `shared/drc-engine.ts` | Design Rule Check engine (shared between server + client) |
| `server/routes.ts` | Barrel — registers 21 domain routers from `server/routes/` |
| `server/circuit-routes.ts` | Barrel — registers 13 circuit routers from `server/circuit-routes/` |
| `server/ai.ts` | AI system: prompts, 84 AI tools, streaming, multi-model routing |
| `server/ai-tools.ts` | Barrel — registers 11 tool modules from `server/ai-tools/` |
| `server/storage.ts` | `IStorage` interface + `DatabaseStorage` (LRU cache, pagination, soft deletes) |
| `server/auth.ts` | Session auth (scrypt), API key encryption (AES-256-GCM) |
| `server/cache.ts` | LRU cache implementation |
| `server/component-export.ts` | FZPZ import/export |
| `server/export/` | 15 modules + types: KiCad, Eagle, SPICE, BOM exporters; Gerber, drill, pick-and-place, netlist generators; design-report, FMEA, firmware-scaffold, PDF, DRC-gate, FZPZ handler |
| `shared/bom-diff.ts` | BOM snapshot comparison engine |
| `shared/arch-diff.ts` | Architecture snapshot diff engine |
| `shared/netlist-diff.ts` | Netlist comparison / ECO engine |
| `client/src/lib/project-context.tsx` | `ProjectProvider`: 40+ state values, React Query mutations |
| `client/src/pages/ProjectWorkspace.tsx` | 3-panel layout: Sidebar \| tabbed views \| ChatPanel |
| `client/src/components/panels/ChatPanel.tsx` | AI chat UI, settings, streaming, action parsing |
| `vitest.config.ts` | Vitest workspace config (server + client projects) |
| `eslint.config.js` | ESLint flat config with strict TypeScript rules |

## Architecture

```text
client/src/
  pages/ProjectWorkspace.tsx       → 3-panel layout, lazy views, ErrorBoundary per view
  components/views/                → Architecture, ComponentEditor, Procurement, Validation, Output, Schematic, BomDiff, Dashboard
  components/panels/ChatPanel.tsx  → AI chat + settings
  components/panels/ExportPanel.tsx → Multi-format export UI
  components/layout/Sidebar.tsx    → Nav, component library, history
  components/circuit-editor/       → Schematic canvas, breadboard, ERC panel, net class panel, toolbar
  components/ui/                   → 40+ shadcn/ui primitives
  lib/project-context.tsx          → ProjectProvider (monolithic context, known debt)
  lib/circuit-editor/              → Wire router, breadboard model, ERC engine
  lib/simulation/                  → SPICE generator, circuit solver, frequency analysis
  lib/component-editor/            → Constraint solver, diff engine, snap engine

server/
  routes.ts           → Barrel — imports 21 domain routers from server/routes/
  routes/             → auth, projects, architecture, bom, validation, chat, history,
                         components, settings, admin, seed, batch, bom-snapshots,
                         chat-branches, design-preferences, spice-models, component-lifecycle,
                         project-io, design-history, comments, backup, utils
  circuit-routes.ts   → Barrel — imports 13 circuit routers from server/circuit-routes/
  circuit-routes/     → designs, instances, nets, wires, netlist, exports, simulations,
                         hierarchy, imports, autoroute, expansion, utils, index
  ai.ts               → Anthropic + Gemini streaming, system prompt builder, action parser
  ai-tools.ts         → Barrel — imports 11 tool modules from server/ai-tools/
  ai-tools/           → types, registry, navigation, architecture, circuit, component,
                         bom, validation, export, project, index
  storage.ts          → IStorage interface, DatabaseStorage with LRU cache
  cache.ts            → LRU cache (evicts least recently used)
  auth.ts             → Session-based auth (X-Session-Id header), encrypted API keys
  export/             → KiCad, Eagle, SPICE, BOM exporters; Gerber, drill, pick-and-place,
                         netlist generators; design-report, firmware-scaffold, FMEA, types

shared/
  schema.ts           → Drizzle schema (27 tables): projects, architecture_nodes/edges,
                         bom_items, validation_issues, chat_messages, history_items,
                         users, sessions, api_keys, component_parts, component_library,
                         user_chat_settings, circuit_designs, hierarchical_ports,
                         circuit_instances, circuit_nets, circuit_wires, simulation_results,
                         ai_actions, design_preferences, bom_snapshots, spice_models,
                         component_lifecycle, design_snapshots, design_comments
  component-types.ts  → Component editor type system (shapes, connectors, buses)
  drc-engine.ts       → Design rule checking engine
  bom-diff.ts         → BOM comparison engine (snapshot vs current)
  arch-diff.ts        → Architecture snapshot diff engine
  netlist-diff.ts     → Netlist comparison / ECO engine
```

## Code Style

### Formatting (Prettier — `.prettierrc`)

- Semicolons: always
- Quotes: single
- Tab width: 2 spaces
- Trailing commas: all
- Print width: 120
- Bracket spacing: true
- Arrow parens: always

### ESLint (`eslint.config.js` — flat config)

- Base: `strictTypeChecked` + `stylisticTypeChecked` from typescript-eslint
- `@typescript-eslint/no-explicit-any`: **error** (off in test files)
- `@typescript-eslint/consistent-type-imports`: **error** — `import type { ... }` enforced
- `@typescript-eslint/no-unused-vars`: **error** — `_` prefix allowed
- `prefer-const`: **error**
- `eqeqeq`: always (no `==`)
- `curly`: always (no braceless blocks)
- `no-console`: warn (off in `server/` and test files)
- Import ordering enforced via `eslint-plugin-import-x`: builtin → external → internal → parent → sibling → index → type
- `import-x/no-duplicates`: **error**
- `import-x/consistent-type-specifier-style`: **error** — prefer top-level
- Prettier handles all formatting (eslint-config-prettier disables formatting rules)

### TypeScript

- **Strict mode** — `strict: true` in tsconfig.json, no exceptions
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **No `as any`** — Use proper type narrowing, generics, or discriminated unions
- **Zod for validation** — Runtime validation on API boundaries, schema inference for types
- **Type imports**: `import type { ... }` for type-only imports (ESLint enforced)
- **Module**: ESNext with bundler resolution

### React Patterns

- **React 19** — Functional components only, hooks-based, JSX runtime (no React import needed)
- **State**: TanStack React Query for server state, React context for client state
- **No Redux/Zustand/MobX** — Only React Query + context
- **`data-testid`** on every interactive and display element
- **Node IDs**: `crypto.randomUUID()`, never `Date.now()`
- **Exhaustive switches** on discriminated unions — extract shared base properties before the switch to avoid `never` type issues in default cases
- **Styling**: shadcn/ui components + `cn()` utility for Tailwind classes. Theme is Dark with Neon Cyan (`#00F0FF`)

### Naming Conventions

- React components: PascalCase (`ArchitectureView.tsx`)
- Hooks: `use` prefix (`useProject`, `useMobile`)
- Event handlers: `handle` prefix in components (`handleClick`), `on` prefix for props (`onClick`)
- Constants: UPPER_SNAKE_CASE for module-level, camelCase for scoped
- Files: PascalCase for components, camelCase for utilities
- Test IDs: `{action}-{target}` pattern (e.g., `button-submit`)

### Import Order (ESLint enforced)

1. React/framework imports
2. Third-party library imports
3. Internal path-aliased imports (`@/`, `@shared/`)
4. Relative imports
5. Type imports last (via `import type`)

### Error Handling

- **Server**: `asyncHandler` wrapper + `HttpError` class with status codes + `StorageError` class
- **Client**: React Query global `onError` with toast notifications (sonner)
- **ErrorBoundary** around each view in ProjectWorkspace
- **Zod**: `fromZodError()` for user-friendly validation messages

## Development Pattern

**Vertical slice** — always implement top-to-bottom:

1. Types/schema in `shared/schema.ts` (with Zod insert schema + inferred types)
2. Storage methods in `server/storage.ts` (implement `IStorage` interface)
3. API routes in `server/routes.ts` (Zod validation, asyncHandler)
4. React Query hooks in `client/src/lib/project-context.tsx`
5. UI components in `client/src/components/`
6. Add `data-testid` to every interactive and display element

## Testing

### Framework & Configuration

- **Framework**: Vitest 4 with workspace projects
- **Client tests**: `happy-dom` environment, `@testing-library/react`, setup file `client/src/test-setup.ts`
- **Server tests**: `node` environment
- **Coverage**: `@vitest/coverage-v8` — reports to `coverage/` directory
- **Legacy**: `server/__tests__/api.test.ts` uses `node:test` runner (excluded from Vitest config)

### Test File Locations (147 test files, ~7054 tests)

```text
server/__tests__/                          → API, auth, storage, exporters, generators, DRC, LRU cache, metrics, audit-log, circuit-breaker, stream-abuse, auth-regression, storage-transactions (30 files)
client/src/lib/__tests__/                  → Utility tests
client/src/lib/contexts/__tests__/         → React context tests (architecture, BOM, chat, history)
client/src/lib/circuit-editor/__tests__/   → Wire router, breadboard model, ERC engine
client/src/lib/simulation/__tests__/       → SPICE generator, circuit solver
client/src/lib/component-editor/__tests__/ → Constraint solver, diff engine, snap engine
client/src/components/panels/__tests__/    → ChatPanel tests
client/src/components/layout/__tests__/    → Sidebar tests
client/src/components/views/__tests__/     → Architecture, Procurement, Validation view tests
shared/__tests__/                          → Schema validation, DRC engine tests
```

### Running Tests

```bash
npm test                                    # All tests (server + client)
npm run test:watch                          # Interactive watch mode
npm run test:coverage                       # With v8 coverage report
npx vitest run --project server             # Server tests only
npx vitest run --project client             # Client tests only
npx vitest run path/to/file.test.ts         # Single file
npx vitest run -t "test name"              # By test name
```

### Testing Philosophy

**When tests fail, fix the code, not the test.**

- Tests should be meaningful — avoid tests that always pass regardless of behavior
- Test actual functionality — call the functions being tested
- Failing tests are valuable — they reveal bugs or missing features
- Fix the root cause — when a test fails, fix the underlying issue
- Test edge cases — tests that reveal limitations help improve the code

## Security

- **Auth**: Session-based via `X-Session-Id` header (not cookies)
- **API keys**: AES-256-GCM encryption at rest, scrypt for password hashing
- **CSP**: Content-Security-Policy via Helmet middleware
- **Rate limiting**: `express-rate-limit` on API endpoints
- **Security headers**: `helmet` middleware on Express
- **Soft deletes**: Data preservation — `deletedAt` timestamp, never hard delete
- **Never expose/log secrets or API keys**
- **All `window.open()` calls**: Include `noopener,noreferrer`

### Known Security Findings (from product analysis)

See `docs/product-analysis-checklist.md` for full security findings (CAPX-SEC-*). Key P0 items:

- CORS dynamic origin reflection — needs allowlist
- XSS via `javascript:` URIs in AI markdown — needs protocol validation
- ZIP bomb vulnerability in FZPZ import — needs decompressed size check
- Missing `process.on('uncaughtException')` handler

## Configuration

### Required Environment Variables

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_KEY_ENCRYPTION_KEY` | Yes | AES-256-GCM key for stored API keys |
| `PORT` | No | Server port (default 5000) |
| `LOG_LEVEL` | No | Winston logger level |
| `NODE_ENV` | No | development/production |

### TypeScript Config

- `strict: true`, `noEmit: true` (check only, Vite handles emit)
- `module: ESNext`, `moduleResolution: bundler`
- `jsx: preserve` (React 19 auto JSX transform)
- Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- Includes: `client/src/**/*`, `shared/**/*`, `server/**/*`

## Guardrails

- Never swap Wouter, Drizzle, shadcn/ui, @xyflow/react, or TanStack Query; these are core
- Never add Redux/Zustand/MobX; use React Query + context
- Never silently change API response shapes; update all callers
- Never delete routes/tables without updating all references
- Never change ID column types (serial ↔ varchar); breaks migrations
- Never expose or log secrets/API keys
- Never bypass the `IStorage` interface (`server/storage.ts`)
- Keep the app working at all times — small, incremental changes only

## Gotchas

- **Soft deletes**: `projects`, `architecture_nodes`, `architecture_edges`, `bom_items` use `deletedAt` — always filter with `isNull(deletedAt)` in queries
- **PROJECT_ID = 1** is hardcoded in `project-context.tsx` — blocks multi-project (known debt)
- **Auth uses header**: `X-Session-Id`, not cookies
- **AI system prompt** rebuilds full project state (all nodes, edges, BOM, validation, chat) on every request — O(N) sequential queries (known performance debt GA-DB-01)
- **Cache**: LRU eviction policy. Invalidation uses prefix matching: invalidating `"nodes:1"` clears all keys starting with `"nodes:1"`
- **Node IDs**: Use `crypto.randomUUID()`, not `Date.now()`
- **BOM totalPrice**: Computed server-side from `quantity * unitPrice`
- **Deprecated endpoints**: `/api/bom/:id` and `/api/validation/:id` still exist — prefer `/api/projects/:id/bom/:bomId`
- **Response envelope inconsistency**: DELETEs return 204 in routes.ts but `{ success: true }` in circuit-routes.ts (GA-API-03)
- **No API versioning**: All routes at `/api/*` with no version prefix
- **Legacy test**: `server/__tests__/api.test.ts` uses `node:test` (not Vitest) — excluded from `npm test`

## Agent Mindset

**Be proactive, curious, creative, and communicative.** Think like a senior engineer building a tool for someone who's learning electronics and building real hardware projects.

- **The user is the target user.** He's learning electronics while building a rover. Every feature should be evaluated through the lens of: "Would this help a maker who doesn't have a formal EE background?"
- **Accessibility over complexity.** Prefer intuitive, visual, interactive implementations over technically impressive but opaque ones. If a feature requires the user to already understand electronics to use it, it's not done yet — add AI guidance, tooltips, or a learning mode.
- **One tool, zero context-switching.** The core value prop is never having to leave ProtoPulse. If a workflow currently requires an external tool (calculator, datasheet lookup, code editor, serial monitor), that's a gap worth closing.
- Draw inspiration from **TinkerCad Circuits, Fritzing, EveryCircuit, Falstad, Wokwi** (learning/maker tools) as much as from KiCad, Altium, Figma, VS Code (pro tools)
- After every task, actively look for related improvements nearby in the code you touched
- After meaningful changes, provide an **Improvements Radar** (3-7 ideas: Quick Win / Medium / Big Swing)
- Be direct and opinionated. Quantify technical debt impact. Flag issues early.
- Always check audit checklists before starting work — kill two birds with one stone

## Available AI Subagents (`.claude/agents/`)

| Domain | Agents |
| ------ | ------ |
| **React/Frontend** | react-expert, react-performance-expert, css-styling-expert, accessibility-expert, accessibility-auditor |
| **TypeScript** | typescript/ directory (multiple experts) |
| **Backend/Node** | nodejs-expert, nestjs-expert, loopback-expert |
| **Database** | database-expert, postgres-expert, mongodb-expert |
| **Build Tools** | vite-expert, webpack-expert |
| **Testing** | testing/ directory, playwright-expert |
| **DevOps** | devops-expert, docker-expert, github-actions-expert |
| **Code Quality** | linting-expert, code-review-expert, refactoring-expert |
| **EDA Domain** | eda-domain-reviewer |
| **Git** | git-expert |
| **Research** | research-expert, oracle, triage-expert, code-search, ai-sdk-expert, cli-expert |
| **Documentation** | documentation-expert |

**Always delegate to specialists when available. Default to parallel execution.**

## Directory Structure

```text
ProtoPulse/
├── client/src/             # React SPA
│   ├── components/         # UI components (views, panels, layout, ui)
│   ├── lib/                # Contexts, hooks, utilities, circuit/simulation logic
│   └── pages/              # Route pages
├── server/                 # Express API
│   ├── __tests__/          # Server test files (30 files)
│   ├── routes.ts           # Barrel — 21 domain routers
│   ├── routes/             # Domain route modules (auth, bom, chat, etc.)
│   ├── circuit-routes.ts   # Barrel — 13 circuit routers
│   ├── circuit-routes/     # Circuit route modules (nets, wires, exports, etc.)
│   ├── ai-tools.ts         # Barrel — 11 AI tool modules
│   ├── ai-tools/           # AI tool definitions (architecture, circuit, bom, etc.)
│   ├── export/             # Export generators (KiCad, Eagle, Gerber, etc.)
│   ├── storage.ts          # Data access layer (IStorage + DatabaseStorage)
│   └── ai.ts               # AI integration (prompts, streaming, multi-model)
├── shared/                 # Shared types, schema, engines
│   ├── __tests__/          # Shared module tests
│   ├── schema.ts           # 27 Drizzle tables + Zod schemas
│   ├── bom-diff.ts         # BOM comparison engine
│   ├── arch-diff.ts        # Architecture snapshot diff engine
│   └── netlist-diff.ts     # Netlist comparison / ECO engine
├── docs/                   # Project documentation
├── reports/                # Generated analysis reports
├── coverage/               # Test coverage output (gitignored)
└── .claude/agents/         # AI subagent definitions
```

## Documentation

Read these only when relevant — don't read upfront:

| Document | Purpose |
| -------- | ------- |
| `docs/DEVELOPER.md` | Full API reference, database schema, auth flow, AI action types, middleware, security |
| `docs/AI_AGENT_GUIDE.md` | Conventions, audit status, phase roadmap, action type list |
| `docs/USER_GUIDE.md` | End-user feature documentation, UI behavior, shortcuts |
| `docs/product-analysis-report.md` | Comprehensive 5-phase product analysis with 240 tracked items |
| `docs/product-analysis-checklist.md` | Actionable checklist from product analysis (P0-P3 priorities, 8 execution waves) |
| `docs/frontend-audit-checklist.md` | Frontend technical debt items with priorities |
| `docs/app-audit-checklist.md` | Application-wide audit findings |
| `docs/audit-v2-checklist.md` | Second-pass audit findings |
| `docs/backend-audit-checklist.md` | Backend-specific audit findings |
| `docs/arduino-ide-integration-spec.md` | Arduino IDE integration specification |
| `docs/arduino-ide-api-contracts.md` | Arduino IDE API contract definitions |
| `docs/fzpz-integration-plan.md` | FZPZ component format integration plan |
| `docs/future-features-and-ideas-list.md` | Complete feature roadmap: backports from older projects + competitive analysis + market vision |

## Project Reference

@.ref/project-dna.md
