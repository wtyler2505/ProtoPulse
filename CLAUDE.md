# VOID (ProtoPulse)

Browser-based AI-assisted EDA platform. Architecture block diagrams, BOM management, design validation, AI chat with 53 in-app action types (add nodes, generate architectures, manage BOM, run DRC, export). Built for electronics engineers.

## Stack

React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (New York dark theme) + @xyflow/react | Express 5 + PostgreSQL + Drizzle ORM + TanStack React Query | AI: Anthropic Claude + Google Gemini via SSE streaming

## Commands

```bash
npm run dev        # Dev server on port 5000
npm run build      # Production build (Vite + esbuild)
npm run check      # TypeScript type check
npm run db:push    # Sync Drizzle schema → PostgreSQL
```

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | ALL database tables (11), Zod insert schemas, TypeScript types |
| `shared/component-types.ts` | Component editor type system (shapes, connectors, buses) |
| `server/routes.ts` | ALL 50+ REST endpoints with Zod validation |
| `server/ai.ts` | AI system: prompts, 53 action types, streaming, error handling |
| `server/storage.ts` | `IStorage` interface + `DatabaseStorage` (cache, pagination, soft deletes) |
| `server/auth.ts` | Session auth (scrypt), API key encryption (AES-256-GCM) |
| `client/src/lib/project-context.tsx` | `ProjectProvider`: 40+ state values, React Query mutations |
| `client/src/pages/ProjectWorkspace.tsx` | 3-panel layout: Sidebar \| tabbed views \| ChatPanel |
| `client/src/components/panels/ChatPanel.tsx` | AI chat UI, settings, streaming, action parsing |

## Architecture

```
client/src/
  pages/ProjectWorkspace.tsx       → 3-panel layout, lazy views, ErrorBoundary per view
  components/views/                → Architecture, ComponentEditor, Procurement, Validation, Output, Schematic
  components/panels/ChatPanel.tsx  → AI chat + settings
  components/layout/Sidebar.tsx    → Nav, component library, history
  components/ui/                   → 40+ shadcn/ui primitives
  lib/project-context.tsx          → ProjectProvider (monolithic context, known debt)

server/
  routes.ts  → /api/* endpoints, Zod validation, asyncHandler wrapper
  ai.ts      → Anthropic + Gemini streaming, system prompt builder, action parser
  storage.ts → IStorage interface, DatabaseStorage with in-memory cache
  auth.ts    → Session-based auth (X-Session-Id header), encrypted API keys

shared/
  schema.ts  → Drizzle schema: projects, architecture_nodes, architecture_edges,
               bom_items, validation_issues, chat_messages, history_items,
               users, sessions, api_keys, component_parts
```

## Development Pattern

**Vertical slice** — always implement top-to-bottom:

1. Types/schema in `shared/schema.ts` (with Zod insert schema + inferred types)
2. Storage methods in `server/storage.ts` (implement `IStorage` interface)
3. API routes in `server/routes.ts` (Zod validation, asyncHandler)
4. React Query hooks in `client/src/lib/project-context.tsx`
5. UI components in `client/src/components/`
6. Add `data-testid` to every interactive and display element

## Guardrails

- Never swap Wouter, Drizzle, shadcn/ui, @xyflow/react, or TanStack Query; these are core
- Never add Redux/Zustand/MobX; use React Query + context
- Never silently change API response shapes; update all callers
- Never delete routes/tables without updating all references
- Never change ID column types (serial ↔ varchar); breaks migrations
- Never expose or log secrets/API keys
- Never edit `replit.md` unless explicitly asked
- Keep the app working at all times — small, incremental changes only

## Gotchas

- **Soft deletes**: `projects`, `architecture_nodes`, `architecture_edges`, `bom_items` use `deletedAt` — always filter with `isNull(deletedAt)` in queries
- **PROJECT_ID = 1** is hardcoded in `project-context.tsx` — blocks multi-project (known debt)
- **Auth uses header**: `X-Session-Id`, not cookies
- **AI system prompt** rebuilds full project state (all nodes, edges, BOM, validation, chat) on every request — expensive for large projects
- **Cache invalidation** uses prefix matching: invalidating `"nodes:1"` clears all keys starting with `"nodes:1"`
- **Node IDs**: Use `crypto.randomUUID()`, not `Date.now()`
- **BOM totalPrice**: Computed server-side from `quantity * unitPrice`
- **Deprecated endpoints**: `/api/bom/:id` and `/api/validation/:id` still exist — prefer `/api/projects/:id/bom/:bomId`

## Detailed Documentation

For deep dives, read these files (don't read upfront — only when relevant):

- `docs/DEVELOPER.md` — Full API reference, database schema, auth flow, AI action types, middleware stack, security model
- `docs/AI_AGENT_GUIDE.md` — All conventions, audit status (113 items), phase roadmap, complete action type list, checklists
- `docs/USER_GUIDE.md` — End-user feature documentation, UI behavior, keyboard shortcuts
- `docs/frontend-audit-checklist.md` — Open technical debt items with priorities
