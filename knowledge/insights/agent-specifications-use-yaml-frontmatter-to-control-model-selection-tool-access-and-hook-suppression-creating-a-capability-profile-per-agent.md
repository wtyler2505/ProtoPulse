---
summary: Agent definitions in .claude/agents/ use YAML frontmatter fields (model, tools, disableHooks, color, category) to create constrained capability profiles — read-only agents get fewer tools and skip expensive hooks
category: architecture
areas:
  - agent-workflows
---

# Agent specifications use YAML frontmatter to control model selection, tool access, and hook suppression, creating a capability profile per agent

The `.claude/agents/` directory contains 30+ agent definitions that follow a consistent YAML frontmatter schema for constraining agent behavior:

```yaml
---
name: code-search
tools: Read, Grep, Glob, LS
model: sonnet
color: purple
category: tools
disableHooks: ['typecheck-project', 'lint-project', 'test-project', 'self-review']
---
```

**Key capability dimensions:**

1. **Tool restriction (`tools:`)** — Agents declare which tools they can access. The `code-search` agent gets only `Read, Grep, Glob, LS` — no Write or Edit, making it inherently safe for parallel use. The `eda-domain-reviewer` gets `Read, Grep, Glob, Bash` — it can execute commands but not edit files. This is a least-privilege model where agents can only do what their role requires.

2. **Model selection (`model:`)** — Cost-sensitive routing. Read-only research agents use `sonnet` (faster, cheaper). Implementation agents that need complex reasoning get `opus` (implied default). The `pipeline` skill explicitly sets `model: sonnet` because its orchestration logic is formulaic.

3. **Hook suppression (`disableHooks:`)** — The code-search agent disables `typecheck-project`, `lint-project`, `test-project`, and `self-review` hooks. These hooks are expensive (full project scans) and meaningless for read-only agents. Without this, a simple file search would trigger minutes of unnecessary checking.

4. **Visual identity (`color:`, `displayName:`)** — Each agent has a terminal color and display name for the team UI, making it easy to distinguish parallel agents.

5. **Category tagging (`category:`)** — Agents are categorized (tools, general) for organizational purposes.

**The constraint insight:** By combining tool restrictions with hook suppression, agent specs create capability profiles that are both safe and efficient. A read-only agent that cannot edit files does not need typecheck hooks. An implementation agent that modifies code needs full hook coverage. The YAML frontmatter makes these constraints declarative and auditable rather than buried in code.

Areas: [[agent-workflows]]
