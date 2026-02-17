# ProtoPulse — replit.md

## Overview
ProtoPulse is an AI-assisted electronics and system design platform aiming to become a full EDA (Electronic Design Automation) tool. It currently features an architecture block diagram editor, BOM management, design validation, and an AI chat assistant with in-app actions. Future plans include a comprehensive Component/Part Editor, circuit schematic capture, breadboard and PCB layout, manufacturing output generation (Gerber, KiCad, BOM CSV), and simulation capabilities. The project is structured into 14 phases (0-13), with detailed planning documents guiding its evolution.

## User Preferences
- Use simple, everyday language.
- Before implementing: give a brief plan (what + where in code).
- If requirements are unclear or risky (data loss / breaking changes), pause and ask.
- When you change behavior, list the affected files and why.
- Prefer clarity over verbosity: short plan, then execution, then summary.
- You are expected to be proactive and explorative.
- After each meaningful change, provide an **Improvements Radar**: 3-7 ideas, each labeled: **Quick Win**, **Medium**, **Big Swing**. For each idea include: *why it matters* + *where in code* + *risk level*.
- Be creative and innovative, but **never ship Big Swing changes silently**.
- You may perform "research spikes" and "codebase reconnaissance" as part of work.
- Keep exploration time bounded and useful: Prefer small discoveries that immediately improve design quality.
- If you find something critical (security, data loss risk), surface it immediately.
- You can implement **Quick Wins** immediately if they are clearly safe and scoped.
- For **Medium** changes: propose + wait for explicit user go-ahead unless user asked for "go all in".
- For **Big Swing** changes: propose as an option, outline plan + rollback, do not implement without explicit approval.
- When you finish a task or propose next steps, format your response like: What changed (1-5 bullets), Files touched (short list), How it was verified (what you ran/checked), Improvements Radar (3-7 suggestions; Quick Win / Medium / Big Swing; with risk + where), Any risks or follow-ups (only if real), Checklist updates (which audit/integration items were marked done).

## System Architecture
The project is built with a monorepo structure. The frontend uses React 18, TypeScript, Vite, Wouter for routing, React Context and TanStack React Query for state management, shadcn/ui (new-york) with Radix primitives and Tailwind CSS v4 for UI, and @xyflow/react (React Flow) for diagram editing. The styling features a dark theme with neon cyan/purple accents, using Rajdhani, JetBrains Mono, and Inter fonts. Path aliases `@/` and `@shared/` are used for client and shared code respectively.

The backend is developed with Node.js, Express, and TypeScript, using tsx for development. It exposes a REST JSON API under `/api/`. Vite's dev middleware is integrated for HMR, and for production, Vite builds the client to `dist/public`, while esbuild bundles the server to `dist/index.cjs`. Express serves the built client and handles SPA routing.

Data persistence is managed using PostgreSQL via `pg` and Drizzle ORM with drizzle-zod. The database schema (`shared/schema.ts`) is shared between the client and server. `drizzle-kit push` is used for schema synchronization during development.

Key architectural patterns include:
- **Vertical Slice Development:** Each feature or phase is implemented top-to-bottom across shared types, database schema, server-side CRUD and API endpoints, and client-side hooks, components, and navigation.
- **Shared Schema:** A single source of truth for database schema and types, ensuring consistency between frontend and backend.
- **API Conventions:** RESTful patterns, Zod validation for inputs, semantic HTTP status codes, and consistent error responses.
- **Database Conventions:** Child tables reference `projects.id` with `onDelete: cascade`.
- **Diagram Editor:** @xyflow/react is central to the architecture view and will be extended for schematic capture, ensuring nodes and edges are persistently stored and synchronized with UI state.
- **AI Action System:** AI actions are explicit, typed, validated, and idempotent. Destructive actions require user confirmation. AI API keys are user-provided and client-side stored, never logged or stored server-side.

UI/UX decisions emphasize a dark theme with neon accents, contributing to a modern and distinct visual identity.

## External Dependencies
- **Anthropic:** Used server-side via `@anthropic-ai/sdk` for AI chat functionalities.
- **Google Gemini:** Used server-side via `@google/generative-ai` for AI chat functionalities.
- **PostgreSQL:** The primary database for data persistence.
- **`pg`:** Node.js client for PostgreSQL.
- **Drizzle ORM:** Used for database interactions.
- **drizzle-zod:** Integration between Drizzle and Zod for schema validation.
- **@xyflow/react (React Flow):** Core library for diagram editing in the UI.
- **shadcn/ui:** UI component library, built on Radix primitives.
- **Radix primitives:** Low-level UI components.
- **Tailwind CSS v4:** Utility-first CSS framework for styling.