---
name: vault-prefetch
description: Context-aware vault pre-fetch for session starts. Detects the session's working context (cwd subdirectory, recent git activity, staged files) and writes a small Markdown digest of relevant MOCs + top notes to a well-known cache path. The cache is consumed as ambient context — no vault searches mid-session for the first few obvious topics. Ship via a SessionStart hook. Triggers on "/vault-prefetch", "/vault-prefetch status", "refresh vault prefetch", "what vault context does this session have".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Write, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_deep_search, mcp__qmd__qmd_collections
argument-hint: "[--cwd path] [--max-mocs N] [--max-notes N] [--dry-run] [--json]"
---

## EXECUTE NOW

**Mode: $ARGUMENTS**

Parse flags:
- `--cwd <path>` — override detected cwd; useful when invoked from hook with `$CLAUDE_PROJECT_DIR`.
- `--max-mocs <N>` — cap MOCs in digest (default 5).
- `--max-notes <N>` — cap top notes in digest (default 10).
- `--dry-run` — print digest to stdout; don't write cache.
- `--json` — machine-readable output.

**Execute these steps:**

1. **Detect context signal**:
   - `cwd` — path the session opened in; subdirectory under repo.
   - `git log -n 20 --name-only HEAD` — recently touched files.
   - `git diff --name-only` — staged/modified files.
   - `git branch --show-current` — branch name.
2. **Map signals to topics** — see §Signal map.
3. **Query vault** — `qmd_deep_search` for each topic; collect MOCs (frontmatter `type: moc`) and top-scored atomic notes.
4. **Render digest** — compact Markdown block. Bullet list of MOCs with note counts + top-N notes with one-line descriptions.
5. **Write cache** — to `ops/cache/prefetch-<branch>.md` atomically. Session-scoped.
6. **Return summary** — what was prefetched + why.

**Pipeline discipline** — reads vault only. Writes to `ops/cache/` only. Never touches knowledge/ or inbox/.

**START NOW.** Reference below documents signal mapping, cache format, hook installation, and integration.

---

## Signal map (path → topics)

| Path pattern | Topics to pre-fetch |
|---|---|
| `client/src/components/schematic/**` | schematic, net-naming, erc-rules, react-flow |
| `client/src/components/circuit-editor/breadboard*` | breadboard-intelligence, wiring, esp32, attiny85, passives |
| `client/src/components/circuit-editor/PCBLayoutView*` | pcb-fabrication, layer-stack, trace-width, copper |
| `client/src/components/views/ArchitectureView*` | architecture-decisions, mcu-selection, power-systems, communication |
| `client/src/components/views/ComponentEditor*` | component-fields, pin-taxonomy, footprint-standards, ipc-codes |
| `client/src/components/views/ArduinoWorkbenchView*` | arduino-build-pipeline, board-profiles, serial-baud, verify |
| `client/src/components/views/SimulationPanel*` | spice-simulation, dc-operating-point, transient-analysis |
| `client/src/components/views/GenerativeDesignView*` | genetic-algorithms, fitness-functions, design-constraints |
| `server/services/drc/**` | drc-rules, electrical-rule-check, floating-inputs, multi-driver-nets |
| `server/routes/knowledge-vault*` | vault-consumption-layer, ai-context-injection |
| `docs/superpowers/plans/**` | architecture-decisions, maker-ux, process-methodology |
| `inbox/` | gap-processing, extraction-pipeline |
| `knowledge/` | meta — methodology-core only |
| (no match — root or unknown) | methodology-core, architecture-decisions (meta) |

If the session cwd matches MULTIPLE patterns (e.g. working from repo root with recent commits touching both schematic and breadboard), union the topic sets but cap total at `--max-mocs`.

## Cache format

Written to `ops/cache/prefetch-<branch>.md` (branch name sanitized). Example:

```markdown
---
name: "Vault prefetch — main — 2026-04-18T23:00:00Z"
description: "Session-start pre-fetch based on cwd=client/src/components/schematic + recent git."
generated_at: 2026-04-18T23:00:00Z
branch: main
signals:
  cwd: client/src/components/schematic
  recent_paths:
    - client/src/components/schematic/PinHoverCard.tsx
    - client/src/components/schematic/NetNameCombobox.tsx
topics_queried:
  - schematic
  - net-naming
  - erc-rules
---

## Vault context for this session

### Relevant topic maps (MOCs)

- **eda-fundamentals** (68 notes) — core EDA patterns, net naming, symbol conventions
- **architecture-decisions** (34 notes) — schematic↔PCB crossref decisions
- **maker-ux** (22 notes) — hover-card patterns, tooltip conventions

### Top notes this session may need

- `esp32-gpio12-must-be-low-at-boot-...` — strapping-pin semantics
- `floating-inputs-act-as-antennas-for-noise` — ERC floating-input rule source
- `power-net-naming-conventions-vcc-vdd-vbat-vin` — net-name autocomplete source data
- ... (up to --max-notes)

### Usage

When writing schematic code, consume via:
- `<VaultHoverCard slug="esp32-gpio12-...">` — pin tooltip
- `useVaultNote("power-net-naming-conventions-...")` — autocomplete dataset
- Consult full list: `/vault-prefetch status`

Cache expires on next session start. Re-run `/vault-prefetch` mid-session if you pivot to a new area.
```

## Hook installation

### Claude Code `SessionStart` hook

In `.claude/settings.json` (or per-project `.claude/settings.local.json`):

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/vault-prefetch.sh",
        "async": true,
        "timeout": 30,
        "statusMessage": "Prefetching relevant vault context…"
      }]
    }]
  }
}
```

Hook script at `.claude/hooks/vault-prefetch.sh`:

```bash
#!/usr/bin/env bash
# vault-prefetch.sh — SessionStart hook
set -euo pipefail
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 .claude/skills/vault-prefetch/scripts/prefetch.py 2>&1 | head -5
```

Async + 30s timeout = doesn't block session start even if qmd is slow. Cache from previous session still works until refreshed.

### Manual refresh mid-session

```
/vault-prefetch
```

Re-runs the detection + query, overwrites the cache.

## Reading the cache (by Claude)

The SessionStart flow deposits the cache file at `ops/cache/prefetch-<branch>.md`. To consume:
1. A lazy-load helper in `/resume` skill (or inline in SessionStart prompt) reads the file.
2. The digest block is included in system prompt as "Relevant vault context for this session: …".
3. When Claude needs deeper detail, it still calls `qmd_deep_search`, but now armed with precise slugs to cite.

## Branch sanitization

Branch names can contain `/` (e.g. `feat/schematic-fixes`). Sanitize for filename:
- `/` → `--`
- Disallow `..`, leading `-`, trailing whitespace.
- Cap at 80 chars.

## Integration points

- **T3 `/vault-index`** — can cross-reference prefetch cache with backlinks to score relevance.
- **T7 `/vault-health`** — weekly report includes "most-prefetched topics" as a demand signal.
- **T5 `/vault-suggest-for-plan`** — shares topic-mapping logic (consolidate into one helper module).
- **MEMORY.md** — `/resume` skill can reference the cache on session resume, making context reattach durable.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|---|---|---|
| Block session start on vault query | Bad UX; slow qmd = slow session | `async: true` hook; cache is best-effort |
| Always run, even when cache is fresh | Wastes qmd quota | Check cache mtime; skip if <1h old unless `--force` |
| Inject full note bodies into system prompt | Context bloat | Inject slugs + 1-line summaries only; fetch bodies on demand |
| Run prefetch inside subagents | Subagent's cwd may differ; creates noise | Session-level only |
| Write to `knowledge/` | Violates pipeline | Cache only goes to `ops/cache/` |

## Version history

- **1.0 (2026-04-18)** — initial ship. Hook installs via SessionStart. Async + cached. Consumes T3 index if available.
