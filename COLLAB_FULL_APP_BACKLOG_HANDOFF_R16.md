## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R16.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R16_CODEX.md
- Claimed files: vite.config.ts, scripts/build.ts, COLLAB_FULL_APP_BACKLOG_HANDOFF_R16.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R16_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R16

## Scope For This Round

Resolve the R15 verification critique that `npm run build` exits 0 but still prints warning-like bundle output.

## Evidence Before Edits

- `npm run build` exits 0.
- Vite prints the default large chunk warning because several intentional app/workbench chunks exceed 500 kB uncompressed.
- esbuild prints an informational server output line with `dist/index.cjs 2.8mb` and a warning glyph when `logLevel: "info"` is enabled.
- Context7 checked Vite `/vitejs/vite`: `build.chunkSizeWarningLimit` is the documented way to set the warning threshold, and Vite recommends `manualChunks` or dynamic imports when large chunks are unintentional.
- The app already lazy-loads views through `client/src/pages/workspace/lazy-imports.ts`, and the oversized chunks are heavy domain/runtime surfaces such as Schematic/tldraw, Three/R3F, CodeMirror, and React DOM.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: production build warning output needs to be made warning-clean without hiding real build failures
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add a documented build warning budget and keep esbuild actual warnings visible while suppressing informational size glyph output.
---
