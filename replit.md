# ProtoPulse

## Overview

ProtoPulse is an AI-assisted electronics design platform, aiming to evolve into a full Electronic Design Automation (EDA) tool. It combines features similar to Fritzing and KiCad within a browser-based environment, enhanced with AI capabilities.

Currently, the platform offers an architecture block diagram editor, Bill of Materials (BOM) generation, design validation, and an AI chat interface with in-app actions. Future phases include a component/part editor, circuit schematic capture, breadboard/PCB layout, manufacturing output (Gerber, KiCad), and circuit simulation. The project's vision is to streamline the electronics design workflow from concept to manufacturing.

## User Preferences

- Simple, everyday language
- Before implementing: brief plan (what + where)
- If unclear or risky: pause and ask
- List affected files when changing behavior
- Short plan → execution → summary
- After meaningful changes, provide **Improvements Radar** (3-7 ideas: Quick Win / Medium / Big Swing with why + where + risk)
- Working app at all times. Small, safe, incremental changes.
- Never swap core libs (Wouter, Drizzle, shadcn, React Flow) without explicit approval.
- Never delete routes/endpoints/tables without updating all callers.
- Never edit this file unless explicitly asked.
- Never ship Big Swing changes silently.

## Agent Behavior & Mindset

**Be proactive, curious, and communicative.** Don't just execute tasks — think like a senior engineer who cares about the product.

### Proactive Improvements
- After completing any task, **actively look for** related improvements, optimizations, or issues nearby in the code you touched.
- Surface ideas unprompted. If you notice something that could be better — performance, UX, accessibility, security, code quality — mention it.
- Don't wait to be asked. If something looks off, fragile, or could be done better, say so.

### Improvements Radar (Required After Meaningful Changes)
After every meaningful change, provide an **Improvements Radar** with 3-7 ideas, categorized as:
- **Quick Win** — Small effort, clear value, low risk. Could be done right now.
- **Medium** — Moderate effort, solid value, manageable risk. Good next step.
- **Big Swing** — Significant effort, high potential impact, higher risk. Needs discussion first.

For each idea, briefly explain: **what** it is, **why** it matters, **where** in the codebase, and **risk level**.

### Curiosity & Exploration
- When working on a feature area, explore the surrounding code. Understand how it connects to the broader system.
- Ask "what if" questions. Consider edge cases, failure modes, and user experience implications.
- Research modern patterns and best practices relevant to what you're building. Suggest upgrades when they'd genuinely help.
- When multiple approaches exist, briefly explain the tradeoffs and recommend one with reasoning.

### Creativity & Innovation
- Don't just fix what exists — think about what the product **could** be. ProtoPulse is evolving into a full EDA tool; keep that vision in mind.
- Suggest novel features, UX patterns, or architectural approaches the user hasn't asked for. Frame them as possibilities, not demands.
- Draw inspiration from best-in-class tools (KiCad, Altium, Figma, VS Code) and modern web patterns. If something from those worlds would elevate ProtoPulse, say so.
- When building something new, consider: "What would make an electronics engineer's jaw drop?" Push beyond the minimum viable solution.
- Challenge existing approaches when you see a better way. Don't just maintain the status quo — question it.
- Think about the end-user (electronics engineers, hardware startups, embedded developers) — what would genuinely make their workflow faster, smoother, or more enjoyable?

### Communication Style
- Be direct and opinionated — share your professional judgment, not just options.
- When you see technical debt, quantify the impact if possible (performance, maintainability, user experience).
- Flag potential issues early rather than waiting for them to become problems.
- Celebrate progress — acknowledge when something is working well or when a change meaningfully improves the codebase.
- When suggesting changes, frame them in terms of user impact, not just code cleanliness.
- Do NOT replace Wouter, Drizzle, shadcn, or @xyflow/react
- Do NOT add Redux/Zustand/etc.
- Do NOT silently change existing API response shapes
- Do NOT skip Phase 0 prerequisites
- Do NOT implement a later phase without dependencies complete
- Do NOT auto-edit this file

## Documentation Maintenance (CRITICAL)

**All documentation must be kept accurate and up-to-date as work progresses. This is a non-negotiable requirement.**

After any meaningful code change, review and update the following files if affected:
- `replit.md` — Project architecture, preferences, system overview (update when explicitly asked OR when architecture changes)
- `CLAUDE.md` — Key files, gotchas, guardrails (update when architecture, key files, or conventions change)
- `README.md` — Features, tech stack, roadmap (update when user-facing features or roadmap status change)
- `docs/DEVELOPER.md` — API reference, schema, AI system, security (update when endpoints, tables, auth, or AI actions change)
- `docs/USER_GUIDE.md` — Feature walkthroughs, shortcuts, UI behavior (update when UI features or user-facing behavior change)
- `docs/AI_AGENT_GUIDE.md` — Conventions, audit status, phase roadmap, checklists (update when conventions, audit items, or phase status change)
- `docs/frontend-audit-checklist.md` — Audit item status (update when fixing audit items)

**Rules:**
- Never document features that don't exist yet as if they're available
- Never leave stale information after refactors
- When fixing audit items, mark them in the checklist
- When adding/removing API endpoints, update DEVELOPER.md
- When changing UI behavior, update USER_GUIDE.md
- When changing conventions or guardrails, update AI_AGENT_GUIDE.md and CLAUDE.md

## System Architecture

The application is structured into a frontend, backend, and shared components.

**Frontend:**
- Built with React 19, TypeScript, and Vite.
- Uses Wouter for routing, TanStack React Query for server state management, and shadcn/ui (New York theme) with Radix and Tailwind v4 for UI components.
- The `ArchitectureView.tsx` uses `@xyflow/react` for the interactive canvas, a technology planned for reuse in schematic capture.
- `ProjectWorkspace.tsx` manages view switching based on `ViewMode` states ('project_explorer', 'output', 'architecture', 'schematic', 'procurement', 'validation').
- The main layout is designed with a dark theme, using neon cyan (#00F0FF) and purple accents. Fonts are Rajdhani, JetBrains Mono, and Inter.
- Key components include `ChatPanel.tsx` (AI chat, settings, streaming), `Sidebar.tsx` (navigation), `AssetManager.tsx` (component library), and `ProcurementView.tsx` (BOM table).
- There is a known "God context" (`project-context.tsx`) that causes re-renders for all consumers on any state change, and a hardcoded `PROJECT_ID = 1` blocking multi-project functionality, both identified for refactoring.
- The `SchematicView.tsx` is currently a hardcoded stub and will be replaced by the Component Editor in future phases.

**Backend:**
- Implemented with Node.js and Express 5, using TypeScript (via `tsx` for development).
- Exposes a REST JSON API under `/api/`.
- `server/routes.ts` defines all API endpoints, with `server/ai.ts` handling AI endpoint logic (Anthropic and Gemini streaming).
- `server/storage.ts` defines the `IStorage` interface and `DatabaseStorage` class for data persistence.
- Session-based authentication is implemented with routes for registration, login, logout, and user details. Most `/api` routes are protected, except for authentication, health, documentation, metrics, and seed endpoints.
- AI keys are stored server-side encrypted (AES-256-GCM) via `/api/settings/api-keys`, with a fallback for per-request keys.
- Structured logging is handled by `server/logger.ts` and metrics by `server/metrics.ts`.
- Soft deletes are used for critical tables (`projects`, `architecture_nodes`, `architecture_edges`, `bom_items`) by setting a `deleted_at` timestamp.

**Data:**
- PostgreSQL is used as the database, accessed via `pg` and Drizzle ORM.
- `shared/schema.ts` defines the Drizzle schema, including tables for `projects`, `architecture_nodes`, `architecture_edges`, `bom_items`, `validation_issues`, `chat_messages`, `history_items`, `users`, `sessions`, and `api_keys`.
- `drizzle-kit push` is used for schema synchronization in development; no versioned migrations are currently in place.
- An in-memory cache (`server/cache.ts`) is used for frequently accessed project data, invalidated on writes.

**Key Design Decisions:**
- **Vertical Slice Development:** New features are implemented top-to-bottom: shared types/schema → database changes → storage methods → API routes → client hooks → UI components → navigation → full slice testing.
- **API Design:** RESTful patterns, Zod validation, semantic HTTP status codes, no secret leakage in error responses.
- **Database Design:** Child tables reference `projects.id` with `onDelete: cascade`. Soft deletes are used for data retention.
- **Frontend Development:** Functional components, React Query for server state, Tailwind for styling, `data-testid` for interactive elements.
- **AI Actions:** Explicit, typed, validated, idempotent, with confirmation UI for destructive actions. AI keys are user-provided and handled securely.
- **File Organization:** Clear guidelines for placing new database tables, API endpoints, storage methods, shared types, React components, utilities, and views.

## External Dependencies

- **Database:** PostgreSQL (`pg`)
- **ORM:** Drizzle ORM (`drizzle-kit`, `drizzle-zod`)
- **Frontend Framework:** React 19
- **Routing:** Wouter
- **State Management:** TanStack React Query
- **UI Component Library:** shadcn/ui (based on Radix UI)
- **Styling:** Tailwind CSS v4
- **Diagramming Library:** `@xyflow/react` (for React Flow)
- **AI Providers:** Anthropic (`@anthropic-ai/sdk`), Google Gemini (`@google/generative-ai`)
- **Server Framework:** Express 5
- **TypeScript Runtime:** `tsx`
- **Build Tool:** Vite (for client), Esbuild (for server)
- **Utilities:** `nanoid` (identified as partial item in backend audit)