# Integration Guide

How to wire a finished DESIGN.md into every AI coding surface. Load
this when the user has a DESIGN.md in hand and wants consistent UI
generation across their tooling, or when they ask how Claude Code /
Cursor / Windsurf / Stitch / Copilot pick it up.

## Contents

- The Universal Rule
- Claude Code
- Cursor
- Windsurf
- Google Stitch
- GitHub Copilot (VS Code)
- Kiro
- Cline
- Replit
- Firebase Studio
- Gemini CLI / Codex CLI
- AGENTS.md Consolidation Pattern
- CI / Pre-commit Hooks
- Multi-Package Monorepos

## The Universal Rule

Every modern AI coding agent reads at least one root-level markdown
file at session start. The reliable pattern is:

1. Put `DESIGN.md` at the repository root (not in a subdirectory).
2. In the agent's canonical config file (usually `CLAUDE.md`,
   `AGENTS.md`, `.cursorrules`, or similar), add a one-line pointer:
   ```
   ## Design System
   See [DESIGN.md](./DESIGN.md) for the canonical design tokens and
   component styles. Use token references in generated UI.
   ```
3. Keep the DESIGN.md itself authoritative — do not duplicate tokens
   into the agent config. Pointers only.

The reason pointers beat duplication: agents that parse DESIGN.md
natively (Stitch, recent Claude Code, Cursor) short-circuit the
markdown prose and act on the YAML directly. Duplication creates
drift.

## Claude Code

**Primary config:** `CLAUDE.md` (or `AGENTS.md` if you've migrated to
the open standard).

**Recommended CLAUDE.md section:**

```markdown
## Design System

Authoritative design tokens and component styles live in
[DESIGN.md](./DESIGN.md). When generating UI:

- Reference tokens with `{colors.primary}` syntax from the YAML
  front matter rather than hex literals.
- Follow the section guidance (Overview, Typography, Components) for
  rationale when a specific token isn't available.
- Run `npx @google/design.md lint DESIGN.md` or
  `python3 .claude/skills/crafting-design-md/scripts/validate.py DESIGN.md`
  before committing changes to DESIGN.md.
```

**Optional hook** (`.claude/settings.json`) to re-validate after any
edit to DESIGN.md:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "[ \"$CLAUDE_FILE_PATH\" = \"DESIGN.md\" ] && python3 scripts/validate-design.py DESIGN.md || true"
          }
        ]
      }
    ]
  }
}
```

## Cursor

**Config location:** `.cursor/rules/` directory (flat files) or legacy
`.cursorrules` at repo root.

**Modern (`.cursor/rules/design-system.mdc`):**

```markdown
---
description: Design tokens and component styles — always reference
globs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css"]
alwaysApply: true
---

# Design System

The authoritative design tokens live in [DESIGN.md](../../DESIGN.md).

When generating components:
- Use `{colors.primary}` style references, not literal hex values.
- Follow the canonical component entries (button-primary, input-default,
  card-default) as a contract.
- Honor contrast (WCAG AA 4.5:1) and the shape posture described in
  `## Shapes`.
```

**Legacy (`.cursorrules`):**

```
See DESIGN.md for design tokens and component contracts. Prefer
token references over literal values. Maintain WCAG AA contrast on
all component color pairs.
```

## Windsurf

**Config location:** `global_rules.md` at the repo root.

Append a section:

```markdown
## Design System

Use [DESIGN.md](./DESIGN.md) as the source of truth for colors,
typography, spacing, and component styles. Generate UI that references
tokens rather than hard-coding values.
```

Windsurf's Cascade reads `global_rules.md` into system context every
session, so the DESIGN.md tokens become part of Cascade's planning
automatically.

## Google Stitch

**Native support.** Stitch reads `DESIGN.md` directly — the spec was
authored there.

**Integration:**

1. Open Stitch, create or open a project.
2. Design System panel → Import → select `DESIGN.md` from disk (or
   paste contents).
3. Subsequent generations use the imported tokens automatically.

Stitch's linter is the reference implementation — any warning surfaced
here will also be surfaced by `npx @google/design.md lint`.

**Re-syncing:** After editing `DESIGN.md` externally, re-import in
Stitch. There is no watch mode as of alpha; syncs are explicit.

## GitHub Copilot (VS Code)

Copilot does not natively parse DESIGN.md tokens, but it does pick up
markdown comments in adjacent files and repo-root docs during its
context window sampling.

**Pattern that works:**

1. Keep `DESIGN.md` at repo root.
2. In `.github/copilot-instructions.md` (new standard) or in VS Code
   `settings.json` under `github.copilot.chat.codeGeneration.instructions`:

```markdown
# Copilot Instructions

The repository uses a DESIGN.md file (root-level) as the source of
truth for colors, typography, spacing, and UI components. When you
generate or modify UI code:

1. Open DESIGN.md if you have not already.
2. Use token references from its YAML front matter, e.g.
   `colors.primary`, `typography.body-md`.
3. Do not invent new colors or type scales. If a token is missing,
   prefer `neutral` or `surface` rather than guessing.
```

Copilot will read `copilot-instructions.md` on every session.

## Kiro

**Config location:** `.kiro/steering/` directory.

```markdown
# .kiro/steering/design-system.md

Design tokens are defined in [DESIGN.md](../../DESIGN.md). Reference
them in generated code using the `{colors.primary}` syntax. Honor the
canonical component definitions and the do's/don'ts section.
```

## Cline

Cline reads `.clinerules` at repo root. This can be a symlink to
`AGENTS.md` (the recommended pattern).

```
ln -s AGENTS.md .clinerules
```

Inside `AGENTS.md` (or directly in `.clinerules`):

```markdown
## Design System

[DESIGN.md](./DESIGN.md) is the canonical source. Use token
references and follow component contracts.
```

## Replit

**Config location:** `.replit.md` at repo root (or symlink to
`AGENTS.md`).

Same pattern — reference `DESIGN.md` by relative path.

## Firebase Studio

**Config location:** `.idx/airules.md` (historically `.idx/ai_rules.md`;
the new convention is `airules.md`).

Same pattern as Kiro / Cursor — a markdown file that links to the
root-level `DESIGN.md`.

## Gemini CLI / Codex CLI

Both read `AGENTS.md` at repo root as the canonical config. Symlink
it to DESIGN.md's sibling or include a section linking to DESIGN.md
exactly as in the Claude Code example above.

## AGENTS.md Consolidation Pattern

If the user maintains configs for multiple AI tools, the cleanest
setup is a single `AGENTS.md` at repo root with every tool-specific
file as a symlink pointing to it:

```
AGENTS.md                        ← real file (source of truth)
CLAUDE.md                        → AGENTS.md
.cursorrules                     → AGENTS.md
.windsurfrules                   → AGENTS.md
.clinerules                      → AGENTS.md
.replit.md                       → AGENTS.md
GEMINI.md                        → AGENTS.md
.github/copilot-instructions.md  → ../AGENTS.md
.idx/airules.md                  → ../AGENTS.md
```

Inside `AGENTS.md`, a single Design System section pointing at
`DESIGN.md` covers every tool. This is the recommended pattern.

## CI / Pre-commit Hooks

**Pre-commit validation** (via `pre-commit` hook framework):

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: design-md-lint
        name: Lint DESIGN.md
        entry: python3 .claude/skills/crafting-design-md/scripts/validate.py
        language: system
        files: ^DESIGN\.md$
```

**GitHub Actions** (blocks PRs that break DESIGN.md):

```yaml
# .github/workflows/design-md.yml
name: DESIGN.md
on:
  pull_request:
    paths:
      - 'DESIGN.md'
      - '.claude/skills/crafting-design-md/scripts/**'
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python3 .claude/skills/crafting-design-md/scripts/validate.py DESIGN.md
```

Blocking on `error`-level findings only (the script exits 1 on those)
keeps the gate narrow.

## Multi-Package Monorepos

When multiple packages share a design system:

1. **Canonical location:** `packages/design-system/DESIGN.md` (or
   `apps/web/DESIGN.md` if web is the primary consumer).
2. **Root-level symlink** so agents that expect `./DESIGN.md` find
   it:
   ```
   ln -s packages/design-system/DESIGN.md DESIGN.md
   ```
3. **Per-package overrides** (rare — prefer one canonical system).
   If a package needs a truly separate identity, put a full DESIGN.md
   at that package's root and scope its agent config to that package:
   ```
   apps/
     marketing/
       DESIGN.md              # marketing-specific identity
       .cursor/rules/…        # marketing-scoped rules
     app/
       DESIGN.md              # product app identity
       .cursor/rules/…
   ```

## Sanity Check After Wiring

After integrating a DESIGN.md into any tool:

1. Open a new session in the tool.
2. Prompt: *"Build me a primary button component per our design
   system."*
3. Verify the output references tokens rather than hard-coded hex
   values and matches the shape posture in `## Shapes`.
4. If the agent silently hard-codes values, the pointer didn't land
   — tighten the wording in the config file or move DESIGN.md's
   location closer to the agent's root scan path.
