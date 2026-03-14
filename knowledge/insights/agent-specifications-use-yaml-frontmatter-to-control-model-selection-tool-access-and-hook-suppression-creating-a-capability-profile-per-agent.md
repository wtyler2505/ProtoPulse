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

**The constraint insight:** By combining tool restrictions with hook suppression, agent specs create capability profiles that are both safe and efficient. A read-only agent that cannot edit files does not need typecheck hooks. An implementation agent that modifies code needs full [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff|hook coverage across all three layers]]. The YAML frontmatter makes these constraints declarative and auditable rather than buried in code.

The `disableHooks` field is particularly important for agent team performance. Without suppression, a read-only research agent would trigger the [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations|tsc watch]] output read and the full typecheck/lint/test Stop hooks — wasting minutes on checks that can never find issues (the agent cannot edit files). When 4+ agents run in parallel with full hooks enabled, the [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously|OOM risk from concurrent tsc runs]] becomes real. The [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures|SessionStart dependency check]] verifies the tools these hooks need, but agent profiles determine which hooks fire at all.

---

Related:
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — the three-layer hook system that `disableHooks` selectively suppresses
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — read-only agents skip consuming watch output via hook suppression
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — hook suppression on read-only agents reduces the OOM risk from parallel tsc
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — verifies tools that hooks depend on; profiles control which hooks fire
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — another hook gating mechanism (per-repository vs per-agent)
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — skills use `context: fork` for isolation; agent profiles use tool/hook constraints

Areas: [[agent-workflows]]
