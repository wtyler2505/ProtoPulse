# ProtoPulse — replit.md (Agent Instructions v5)

## 0. Non-negotiables
- Working app at all times. Small, safe, incremental changes.
- Never swap core libs (Wouter, Drizzle, shadcn, React Flow) without explicit approval.
- Never delete routes/endpoints/tables without updating all callers.
- Never edit this file unless explicitly asked.
- Never ship Big Swing changes silently.

---

## 1. What this is

An AI-assisted electronics design platform evolving into a full EDA tool. Think: browser-based Fritzing + KiCad with AI superpowers.

**Live today:** Architecture block diagram editor, BOM, validation, AI chat with in-app actions.
**Planned (Phases 0-13):** Component/part editor, circuit schematic capture, breadboard/PCB layout, manufacturing output (Gerber, KiCad), simulation.

---

## 2. The three planning documents

All major work is driven by three docs in `docs/`. They are large. Here's how to not waste time reading them:

### docs/fzpz-integration-plan.md (~2,035 lines)
The master plan. 14 phases. Don't read the whole thing — use these grep patterns:
```bash
grep -n "^### Phase" docs/fzpz-integration-plan.md       # phase headers + line numbers
grep -n "^\- \[ \]" docs/fzpz-integration-plan.md         # all unchecked tasks
grep -n "^\- \[x\]" docs/fzpz-integration-plan.md         # completed tasks
grep "Before Phase N" docs/fzpz-integration-plan.md       # open questions blocking phase N
```
**Section quick-jump:** TOC ~line 9 | Data model ~170 | File map ~846 | AI plan ~960 | Phases ~1262 | Risks ~1660 | Testing ~1711 | Open Qs ~1780 | Checklists ~1859

### docs/backend-audit-checklist.md (~370 lines)
116 findings, 39 fixed, ~79 open. Grouped by server file.
```bash
grep "⬜.*P0" docs/backend-audit-checklist.md    # open critical items (1 remaining: #107 auth)
grep "⬜.*P1" docs/backend-audit-checklist.md    # open high-priority items (~16)
```

### docs/frontend-audit-checklist.md (~332 lines)
113 findings, 1 fixed, ~113 open. Grouped by component.
```bash
grep "⬜.*P0" docs/frontend-audit-checklist.md   # open critical items (16)
grep "⬜.*P1" docs/frontend-audit-checklist.md   # open high-priority items (31)
```

### Updating the docs after work
When you fix something:
1. Change ⬜ to ✅ (or 🔶 for partial) in the relevant checklist
2. Update the Progress Summary table at the top of the checklist
3. If it's an integration plan task (e.g., `1.3`), mark it done in BOTH the phase detail (Section 10) AND the execution checklist (Section 14)

---

## 3. Current state of the codebase (what's actually here)

### File topology (biggest files = most complexity = most risk)
```
2,362 LOC  client/src/components/panels/ChatPanel.tsx     ← THE monolith. AI chat, settings, streaming, actions, all in one file
  831 LOC  client/src/components/layout/Sidebar.tsx        ← navigation + view switching
  711 LOC  client/src/components/views/SchematicView.tsx   ← FAKE. Hardcoded stub, will be replaced
  677 LOC  client/src/components/panels/AssetManager.tsx   ← component library for arch view
  613 LOC  client/src/lib/project-context.tsx              ← GOD CONTEXT. Every consumer re-renders on any change
  575 LOC  server/ai.ts                                   ← AI endpoint logic (Anthropic + Gemini streaming)
  473 LOC  server/routes.ts                               ← all API routes in one file
  353 LOC  client/src/components/views/ArchitectureView.tsx ← React Flow canvas
  353 LOC  client/src/components/views/ProcurementView.tsx  ← BOM table
  264 LOC  client/src/pages/ProjectWorkspace.tsx            ← main layout, view switching
  200 LOC  server/storage.ts                               ← IStorage interface + DatabaseStorage
  151 LOC  server/index.ts                                 ← Express setup
  118 LOC  shared/schema.ts                                ← Drizzle schema (7 tables)
```

### Known landmines (things that WILL bite you)
1. **PROJECT_ID = 1 hardcoded** (`project-context.tsx:6`) — every query uses `const PROJECT_ID = 1`. Multi-project is blocked. Frontend audit #19.
2. **God context** (`project-context.tsx`) — single `useProject()` hook exposes ~40 values. Any state change re-renders every consumer. Frontend audit #11.
3. **SchematicView is fake** (`SchematicView.tsx`, 711 lines) — hardcoded components, no real editing. Will be fully replaced by Component Editor (Phase 1+).
4. **No auth whatsoever** — backend audit #107 (the last remaining P0). Any client can read/write any project.
5. **AI keys in localStorage** — `ChatPanel.tsx:126-142` stores provider, model, API key, temperature, system prompt in localStorage. Sent per-request to server. Never logged server-side, but fragile.
6. **React 19** — `package.json` has `"react": "^19.2.0"`. The integration plan mentions React 19→18 downgrade as a risk, but ProtoPulse is already on 19. FZPZ Studio was also React 19. No downgrade needed.
7. **Express 5** — `"express": "^5.0.1"`. Some middleware patterns differ from Express 4 docs online.
8. **No migration files** — uses `drizzle-kit push` for dev. No versioned migrations. Fine for now, risky for production.

### View system
`ProjectWorkspace.tsx` switches views based on `activeView` state from `useProject()`:
```
ViewMode = 'project_explorer' | 'output' | 'architecture' | 'schematic' | 'procurement' | 'validation'
```
Adding a new view: add to `ViewMode` type → add component import in `ProjectWorkspace.tsx` → add tab in `Sidebar.tsx`.

### API surface (all routes in server/routes.ts)
```
GET/POST         /api/projects
GET/PATCH        /api/projects/:id
GET/POST/PUT     /api/projects/:id/nodes
GET/POST/PUT     /api/projects/:id/edges
GET/POST         /api/projects/:id/bom
PATCH/DELETE     /api/bom/:id
GET/POST/PUT/DEL /api/projects/:id/validation
GET/POST         /api/projects/:id/chat
GET/POST         /api/projects/:id/history
POST             /api/seed
POST             /api/chat/ai
POST             /api/chat/ai/stream
```

### Database tables (shared/schema.ts)
`projects`, `architecture_nodes`, `architecture_edges`, `bom_items`, `validation_issues`, `chat_messages`, `history_items`
All child tables cascade on `projects.id`. Architecture edges already have `signalType`, `voltage`, `busWidth`, `netName` — these bridge to circuit-level features later.

### NPM scripts
```
dev          → NODE_ENV=development tsx server/index.ts (runs everything)
build        → tsx script/build.ts
start        → NODE_ENV=production node dist/index.cjs
check        → tsc
```

---

## 4. Decision trees

### "Where do I put this new thing?"
```
New database table?     → shared/schema.ts (+ drizzle-kit push)
New API endpoint?       → server/routes.ts (or new file if it's a whole domain like circuit-routes.ts)
New storage method?     → server/storage.ts (add to IStorage interface + DatabaseStorage class)
New shared type?        → shared/schema.ts (if DB-backed) or new shared/*.ts (if pure types)
New React component?    → client/src/components/views/ (views) or components/panels/ (side panels)
New utility/hook?       → client/src/lib/ (utilities) or client/src/hooks/ (hooks)
New view in the app?    → ViewMode type + ProjectWorkspace.tsx + Sidebar.tsx
```

### "Which audit items should I fix first?"
```
Phase 0 blockers (must fix before integration):
  → Backend #107 (no auth) — the last P0
  → Frontend #11 (god context re-renders) — split ProjectProvider
  → Frontend #19 (PROJECT_ID = 1 hardcoded) — parameterize
  → Frontend #72 (ErrorBoundary only at top level) — add per-view boundaries

Then prioritize: P0 > P1 > P2 > P3, within each priority fix what's closest to your current work.
```

### "How do I implement a new phase?"
Always vertical slices, top-to-bottom:
```
1. shared/ types + schema      ← source of truth, do this FIRST
2. drizzle-kit push            ← create tables
3. server/storage.ts           ← CRUD methods on IStorage
4. server/routes.ts            ← thin API handlers that call storage
5. client hooks                ← TanStack Query wrappers
6. client components           ← UI that uses the hooks
7. navigation                  ← wire into Sidebar + ProjectWorkspace
8. test the full slice         ← verify API + UI + persistence
```

### "Should I implement this Quick Win / Medium / Big Swing?"
```
Quick Win (low effort, low risk, clearly scoped) → Just do it
Medium (refactor / significant UI work)          → Propose, wait for "go ahead" or "go all in"
Big Swing (structural / experimental)            → Propose with plan + rollback, never implement silently
```

---

## 5. Phase dependency chain
```
Phase 0 ──→ Phase 1 ──→ Phases 2-6 ──→ Phase 7
  (audit       (types,      (editor        (layers,
  prereqs)     schema,      features)      bezier,
               CRUD,                       history)
               skeleton)         ↓
                            Phase 8 (DRC, constraints)
                                 ↓
                            Phase 9 (component library)
                                 ↓
                            Phase 10 (schematic capture)
                                 ↓
                            Phase 11 (breadboard + PCB)
                                 ↓
                            Phase 12 (Gerber, KiCad, BOM export)
                                 ↓
                            Phase 13 (simulation + SPICE)
```

### Key architectural bridges
- `architecture_edges.signalType/voltage/busWidth/netName` → seeds `circuit_nets` (Phase 10.15)
- React Flow (@xyflow/react) powers architecture view → reuse for schematic canvas (Phase 10.7)
- Component Editor SVG canvas (Phases 1-9) creates part views → these become "stamps" in circuit views (Phases 10-11)
- AI chat streams via `server/ai.ts` → circuit AI features extend same pattern

### FZPZ source reference
Original code in `attached_assets/fzpz-studio_1771351619709.zip`:
- `App.tsx` (1,103 lines) — monolith to decompose
- `types.ts` (183 lines) — Fritzing data types
- `utils.ts` (293 lines) — SVG generation, validation, FZPZ export
- `generators.ts` (871 lines) — parametric generators (DIP, SOIC, QFP, etc.)

---

## 6. Tech stack

**Frontend:** React 19, TypeScript, Vite, Wouter, TanStack React Query, shadcn/ui (new-york) + Radix + Tailwind v4, @xyflow/react
**Backend:** Node.js, Express 5, TypeScript (tsx for dev), REST JSON API under `/api/`
**Data:** PostgreSQL via `pg`, Drizzle ORM + drizzle-zod, `drizzle-kit push` for dev sync
**AI:** Anthropic (`@anthropic-ai/sdk`), Google Gemini (`@google/generative-ai`), SSE streaming
**Styling:** Dark theme, neon cyan (#00F0FF) / purple accents, fonts: Rajdhani, JetBrains Mono, Inter
**Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`
**Build:** Vite builds client → `dist/public`, esbuild bundles server → `dist/index.cjs`

---

## 7. Conventions

### API
- All endpoints under `/api/`
- RESTful patterns, Zod validation via drizzle-zod
- Semantic HTTP status codes
- Never leak secrets in error responses

### Database
- Child tables reference `projects.id` with `onDelete: cascade`
- Schema changes in `shared/schema.ts` → then update: Zod schemas → storage methods → routes → client hooks → client components

### Frontend
- Functional components + hooks only
- React Query for server state, invalidate after mutations
- Dark neon theme consistency
- Tailwind classes, no inline styles
- `data-testid` on all interactive and data-display elements

### AI actions
- Explicit, typed, validated, idempotent
- Destructive actions require confirmation UI
- AI keys: user-provided, localStorage, sent per-request, never logged/stored server-side
- No API key → falls back to local keyword command system

---

## 8. Communication preferences
- Simple, everyday language
- Before implementing: brief plan (what + where)
- If unclear or risky: pause and ask
- List affected files when changing behavior
- Short plan → execution → summary
- After meaningful changes, provide **Improvements Radar** (3-7 ideas: Quick Win / Medium / Big Swing with why + where + risk)

---

## 9. Do NOT
- Replace Wouter, Drizzle, shadcn, or @xyflow/react
- Add Redux/Zustand/etc.
- Silently change existing API response shapes
- Skip Phase 0 prerequisites
- Implement a later phase without dependencies complete
- Auto-edit this file
