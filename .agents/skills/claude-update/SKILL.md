---
name: claude-update
description: >-
  Update CLAUDE.md and skills when introducing new patterns or conventions.
  Triggers: "update claude", "update skills", "new pattern", "add convention".
context: fork
disable-model-invocation: true
---

# Claude Update

Review any feedback, preferences, suggestions or rules that the user provided during task and 
update AI documentation to incorporate them as appropriate.

## When to Update

- New naming conventions or code patterns
- New anti-patterns discovered during implementation
- Changes to component architecture, accessibility, or API design
- New utilities or shared patterns

## Where to Put It

| Type                          | Location             |
| ----------------------------- | -------------------- |
| Cross-cutting (naming, utils) | CLAUDE.md Code Rules |
| Component patterns            | `component` skill    |
| Accessibility                 | `aria` skill         |
| API design / DX               | `api` skill          |
| Documentation                 | `docs` skill   |
| NotebookLM Notesbook updates  | `docs/notebooklm.md` (when created) + `pp-knowledge` skill |
| ProtoPulse skill conventions  | `.claude/skills/pp-knowledge/SKILL.md` |
| Studio archive policy         | `docs/notebooklm.md` §Auto-Download |
| Notebook taxonomy / aliases / tags | `pp-knowledge` skill — Tier map |
| MCP routing / auto-use rules  | `AGENTS.md` §MCP Auto-Routing + `feedback_mcp_auto_routing.md` memory note |
| Tyler hard rules / "automagic" / mandatory directives | MEMORY.md ABSOLUTE RULES + `feedback_<slug>.md` memory note |
| Per-MCP-server triggers (when to fire which tool) | `AGENTS.md` §MCP Auto-Routing trigger table |

**Decision:** Ask "Who needs this?" — if domain-specific, use a skill.

### MCP Routing Rules (special case)

When Tyler asks for MCP servers to be used "automatically" / "automagically" / "without being told":

1. **Update `AGENTS.md` §MCP Auto-Routing.** This is the project's session-loaded routing table. Add or edit the trigger → MCP-tool row. Include WHY the MCP wins over the built-in.
2. **Write a `feedback_mcp_<topic>.md`** in `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/` capturing the directive verbatim, the trigger conditions, and anti-patterns.
3. **Add a one-line entry to `MEMORY.md` ABSOLUTE RULES** linking to the feedback note.
4. **Do NOT** rely on the global `~/.claude/CLAUDE.md` to carry the rule. The project surface is what gets read in every ProtoPulse session — the global is supplementary.

## After Modifying Skills

Check consistency:

1. `.claude/skills/README.md` — Quick Reference, Skills table
2. `CLAUDE.md` — if skill changes affect repo-wide conventions

## Process

1. Identify what changed (pattern, convention, anti-pattern)
2. Route to correct location (table above)
3. Make the update
4. Run consistency checks (if modifying skills)
