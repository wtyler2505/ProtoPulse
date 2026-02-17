# ProtoPulse — replit.md (Agent Instructions v3)

## 0) Prime directive (non-negotiable)
- Maintain a working app at all times. Prefer small, safe, incremental changes.
- Do not “rewrite the stack” or swap major libraries unless explicitly requested.
- Do not delete or rename routes/endpoints/tables used by the UI without updating all callers.
- Do not edit this `replit.md` unless the user explicitly asks you to.
- Always protect user trust: explain changes, avoid surprise behavior shifts.

## 1) What this project is
ProtoPulse is an AI-assisted electronics + system design platform:
- Architecture block diagram editor (node/edge graph)
- BOM management
- Design validation results
- Schematic viewing (present/planned)
- AI chat assistant that can perform in-app actions

## 2) Communication preferences
- Use simple, everyday language.
- Before implementing: give a brief plan (what + where in code).
- If requirements are unclear or risky (data loss / breaking changes), pause and ask.
- When you change behavior, list the affected files and why.
- Prefer clarity over verbosity: short plan, then execution, then summary.

## 2.1 Proactive mode (be curious + helpful by default)
You are expected to be proactive and explorative. That means:
- While doing any task, watch for:
  - bugs, edge cases, and brittle logic
  - missing validation, inconsistent types, unsafe assumptions
  - performance bottlenecks (re-renders, large payloads, chat streaming issues)
  - UX friction (unclear affordances, missing confirmations, confusing flows)
  - missing tests/scripts/guardrails that would prevent future breakage
- After each meaningful change (or when asked to “review”), provide an **Improvements Radar**:
  - 3–7 ideas, each labeled:
    - **Quick Win** (low effort, low risk)
    - **Medium** (some refactor or UI work)
    - **Big Swing** (innovative / structural / experimental)
  - For each idea include: *why it matters* + *where in code* + *risk level*.
- Be creative and innovative, but **never ship Big Swing changes silently**.

## 2.2 Exploration budget (innovate without breaking stuff)
- You may perform “research spikes” and “codebase reconnaissance” as part of work:
  - quick scans: routes, schema, key components, action system, query keys
  - identify “hot paths” and weak spots
- Keep exploration time bounded and useful:
  - Prefer small discoveries that immediately improve design quality.
- If you find something critical (security, data loss risk), surface it immediately.

## 2.3 Approval gates (how to be bold safely)
- You can implement **Quick Wins** immediately if they are clearly safe and scoped.
- For **Medium** changes: propose + wait for explicit user go-ahead unless user asked for “go all in”.
- For **Big Swing** changes:
  - propose as an option
  - outline plan + rollback
  - do not implement without explicit approval

## 3) Tech stack (stable baseline — avoid stack churn)
- Keep the current stack unless there’s a clear benefit.
- Allowed: normal dependency updates, small helper libraries, and refactors that preserve behavior.
- Not allowed without explicit approval: replacing core frameworks/libraries (router, ORM, UI system, diagram engine).
- If you spot a better approach, propose it under “Big Swing” ideas; don’t implement without approval.

Frontend:
- React 18 + TypeScript + Vite
- Routing: Wouter (single main route `/` -> ProjectWorkspace)
- State: React Context (ProjectProvider) + TanStack React Query (server state)
- UI: shadcn/ui (new-york) + Radix primitives + Tailwind CSS v4
- Diagram editor: @xyflow/react (React Flow)
- Styling: dark theme, neon cyan/purple; fonts: Rajdhani, JetBrains Mono, Inter
- Path aliases: `@/` -> `client/src/`, `@shared/` -> `shared/`

Backend:
- Node.js + Express + TypeScript (dev via tsx)
- REST JSON API under `/api/`
- Vite dev middleware integrated into Express for HMR
- Prod: Vite builds client to `dist/public`; esbuild bundles server to `dist/index.cjs`
- Prod static serving: Express serves built client, falls back to `index.html` for SPA routing

Data:
- PostgreSQL via `pg`
- Drizzle ORM + drizzle-zod
- Schema: `shared/schema.ts` shared by client and server
- Dev schema sync: `drizzle-kit push` (no migration files required for dev)

External AI (server-side):
- Anthropic via `@anthropic-ai/sdk`
- Google Gemini via `@google/generative-ai`
- Streaming endpoint: `POST /api/chat/ai/stream` using SSE

## 4) Repo map (where to look first)
- Client app entry + UI: `client/src/`
- Project context provider: `client/src/lib/project-context.tsx`
- Shared DB/types: `shared/schema.ts`
- Server routes: `server/` (Express + `/api`)
- Storage implementation: `server/storage.ts` (IStorage + DatabaseStorage using Drizzle)

## 5) Agent work protocol (how to implement changes)
For any feature/bugfix:
1) Locate the current behavior in code first (search + read before writing).
2) Identify the single source of truth (schema, shared types, storage, API route, client query).
3) Implement the smallest safe change that preserves compatibility.
4) Update both sides (server + client) if types or API responses change.
5) Verify:
   - TypeScript compiles (no type regressions)
   - UI still loads and core flows still function
   - API endpoints return valid JSON and proper status codes

If uncertain about commands/scripts, inspect `package.json` and use existing scripts.

## 6) API conventions (keep consistent)
- All endpoints use `/api/...`
- Prefer RESTful patterns, predictable resources
- Validate inputs with Zod (via drizzle-zod schemas where applicable)
- Return semantic HTTP status codes
- Error responses must be consistent:
  - Do not leak secrets/keys in errors
  - Include enough context for debugging (message + safe details)

Key resources:
- Projects
- Architecture Nodes / Edges
- BOM Items
- Validation Issues
- Chat Messages
- History Items

## 7) Database conventions (Drizzle + Postgres)
Tables:
- `projects`
- `architecture_nodes`
- `architecture_edges`
- `bom_items`
- `validation_issues`
- `chat_messages`
- `history_items`

Rules:
- Child tables reference `projects.id` with `onDelete: cascade`
- Schema changes happen in `shared/schema.ts`
- When adding/changing tables:
  - update schema
  - update Zod validation
  - update storage layer queries (`server/storage.ts`)
  - update API handlers
  - update client queries + cache invalidation

## 8) Frontend conventions (React + Query + shadcn)
- Prefer functional components + hooks
- Avoid introducing new state management libraries
- Use React Query for server state; invalidate queries after mutations
- Keep UI consistent with the existing dark neon theme
- Avoid inline styles; use Tailwind + existing component patterns
- Proactively reduce re-render churn around the graph editor and chat panel.

## 9) Diagram editor conventions (@xyflow/react)
- Nodes/edges are persisted in DB tables and must remain in sync with UI state
- Any new node/edge fields must be:
  - stored in DB (if persistent)
  - represented in shared types
  - handled in create/update flows

## 10) AI action system (critical rules)
- The AI endpoint streams SSE and may return structured “action commands”.
- Actions must be:
  - explicit, typed, and validated
  - idempotent when possible (safe replays)
  - guarded for destructive operations (require confirmation UI)
- Never perform destructive actions automatically (clear canvas, bulk delete, etc.)

API keys:
- User-provided via ChatPanel settings
- Stored client-side (localStorage) and sent per request
- Do NOT log keys
- Do NOT store keys server-side unless explicitly requested + implemented securely

Fallback behavior:
- If no API key: use local keyword-matching command system (do not break this path)

## 10.1 Innovation lane (creative features, safely)
You should actively suggest and design innovative features such as:
- smarter canvas behaviors (auto-layout presets, alignment helpers, smart placement)
- template subcircuits (power, MCU + sensors, motor driver blocks)
- validation upgrades (power domain checks, voltage compatibility warnings)
- BOM intelligence (alt parts, param search, lead-time warnings)
- export improvements (CSV polish, report generation, KiCad/SPICE prep paths)
But do not implement “innovation lane” items without the approval gates in §2.3.

## 11) Research rules (web search)
- Use web search for:
  - current best practices (security, performance)
  - library compatibility issues
  - API/SDK changes
  - data model patterns for graph editors / BOM tools / SSE streaming
- When suggesting a new library:
  - confirm it fits the stack
  - prefer minimal dependencies
  - don’t introduce a framework shift

## 12) Quality + reliability expectations
- Keep ResizeObserver loop error suppression (intentional)
- Preserve ErrorBoundary behavior and recovery UI
- Keep chat UX features intact (copy/regenerate/retry, action chips, cancel streaming)
- Proactively improve:
  - input validation coverage
  - consistent error shapes
  - query invalidation correctness
  - safe defaults (no silent destructive actions)

## 13) “Do NOT do this” list
- Don’t replace Wouter with React Router.
- Don’t replace Drizzle with Prisma (or anything else).
- Don’t replace shadcn/ui with another component library.
- Don’t add a second global state library (Redux/Zustand/etc.) unless asked.
- Don’t silently change response shapes for existing endpoints.
- Don’t auto-edit this `replit.md` unless asked.

## 14) Standard response format (be more communicative)
When you finish a task or propose next steps, format your response like:
- ✅ What changed (1–5 bullets)
- 📁 Files touched (short list)
- 🧪 How it was verified (what you ran/checked)
- 🔭 Improvements Radar (3–7 suggestions; Quick Win / Medium / Big Swing; with risk + where)
- ⚠️ Any risks or follow-ups (only if real)

