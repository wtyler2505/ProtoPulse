---
trigger: always_on
description: ProtoPulse stack — React 19 + TypeScript 5.6 + Vite, Radix UI + Tailwind + shadcn patterns, CodeMirror (editor), dnd-kit (schematic/BOM), Genkit + Google Gemini, Express backend, Drizzle ORM, Vitest (1,553 tests passing), Playwright E2E.
---

# Stack

ProtoPulse is an all-in-one browser-based electronics design tool —
schematic capture, breadboard layout, firmware editor, SPICE-lite
simulation, BOM, DRC, Gerber export. The AI has **82 tool actions**
that act on the canvas: place components, wire connections, run DRC,
populate BOM, export files.

## Layers

| Layer | Stack |
|-------|-------|
| **Client** | React 19 · TypeScript 5.6 · Vite · Radix UI (30+ primitives) · Tailwind + shadcn/ui patterns · CodeMirror (C++/JS/MD editors) · dnd-kit (schematic + BOM interactions) |
| **Server** | Express (TypeScript, `server/index.ts`, bundled to `dist/index.cjs` via esbuild) |
| **AI** | Genkit + Google GenAI (Gemini) · `@genkit-ai/google-genai` · 82 tool actions |
| **DB / Persistence** | Drizzle ORM (`drizzle.config.ts` at repo root) |
| **Testing** | Vitest (1,553 tests passing — treat broken tests as regressions) · Playwright E2E |
| **Port** | 5000 (dev: `vite dev --port 5000`; prod: `node dist/index.cjs`) |

## Commands (authoritative)

```bash
npm run dev           # Express (tsx) — NODE_ENV=development
npm run dev:client    # Vite client only, port 5000
npm run genkit:dev    # Genkit start wrapping dev
npm run build         # tsx scripts/build.ts
npm start             # node dist/index.cjs (production)
npm run check         # tsc (16GB heap — the tree is large)
npm run test          # vitest run (8GB heap)
npm run test:watch    # vitest watch (8GB heap)
```

## Hardware verification protocol (MANDATORY)

Before generating, modifying, or suggesting code for hardware
components (parts library, board defs, pin layouts):

1. Search `knowledge/` (the Ars Contexta vault) using `qmd` or `grep`
   to find the part's exact physical dimensions, pinout, colors.
2. If the part does not exist in the vault, use web search to find
   the **exact** real-world specs (dimensions in mm, footprint,
   header spacing).
3. **Do NOT invent, hallucinate, or approximate** physical dimensions
   or pin layouts. The vault is the absolute source of truth.
4. Any new hardware knowledge must be routed through the `inbox/`
   pipeline.

AGENTS.md (root) enforces this. Cascade should too.

## DESIGN.md authority

ProtoPulse has its own `DESIGN.md` (21 KB) at repo root. Reference
visual tokens from there — don't hard-code hex values in generated
components. Load `.windsurf/rules/design-tokens.md` (model_decision)
when working on UI.

## Do NOT

- Replace CodeMirror with Monaco.
- Replace dnd-kit with react-dnd.
- Replace Radix primitives with Headless UI.
- Replace Vitest with Jest.
- Write files inside `dist/` or `client/dist/`.
- Touch `.claude/hooks/*` without understanding the enforcement chain
  (hardware-enforcement, protected-files, file-freshness).
- Disable tests to "make them pass." 1,553 passing is a load-bearing
  number.

## Key directories

```
client/src/          # React app
  App.tsx
  components/        # Domain components
  hooks/             # Shared hooks
  pages/             # Top-level views
  lib/               # Utilities
  __tests__/         # Vitest specs
  test-setup.ts, test-utils/
  vendor/            # Third-party code held locally
server/              # Express backend (bundled to dist/)
shared/              # Cross-boundary types / schemas
data/                # Static data (parts library, etc.)
docs/                # Project documentation
e2e/                 # Playwright suite
knowledge/           # Ars Contexta vault (hardware specs source of truth)
```

## Ars Contexta context

ProtoPulse's repo root is ALSO an Ars Contexta knowledge vault. The
AGENTS.md there enforces "discovery-first design" + the inbox→extract
pipeline. When touching `knowledge/` content, follow that pipeline —
never write directly to `knowledge/`.
