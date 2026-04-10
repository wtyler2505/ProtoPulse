# Agents, Skills, & Plugins Reference

## 1. Agents & Subagents (`.claude/agents/*.md`)
Subagents run in an ISOLATED context window. They are "Domain Experts" covering 5-15 related problems.

### Frontmatter Schema
*   `name`: Unique kebab-case ID (Required).
*   `description`: Crucial for proactive invocation. Include triggers like "Use PROACTIVELY for...".
*   `tools`: If omitted, inherits ALL tools. Empty `tools: ` grants NO tools.
*   `isolation`: Set to `worktree` to run in a separate git worktree.
*   `memory`: Set to `project`, `local`, or `user` to enable subagent-specific auto memory.

### Structure
0.  **Delegation First:** Explicitly delegate to other specialists if out of scope.
1.  **Environment Detection:** Use `Read`, `Grep`, `Glob` before heavy bash commands.
2.  **Problem Analysis:** Categorize the issues.
3.  **Solution Implementation:** Apply best practices.

### Agent Teams
Subagents can collaborate. Use the `SendMessage` tool to ping teammates.

## 2. Skills (`.claude/skills/*/SKILL.md`)
Skills extend Claude with reusable prompt-based workflows.

### Frontmatter Schema
*   `name`, `description`
*   `disable-model-invocation`: If true, only users can call it.
*   `allowed-tools`: e.g., `Bash, Read`.
*   `model`, `effort`
*   `context: fork`: Forces the skill to run in a subagent.
*   `agent`: Associates the skill with a specific subagent.

### Dynamic Context Injection
Run shell commands BEFORE prompt injection. The output is placed directly in the context.
```md
!`npm outdated`
```
Or multi-line:
```md
```!
git log -n 5
```
```

### Substitutions
*   `$ARGUMENTS`: The user's input.
*   `$N`: Nth argument (e.g., `$0`).
*   `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`.

## 3. Plugins & Marketplaces
A plugin packages extensions into a distributable unit.
*   **Structure:** Must contain `.claude-plugin/plugin.json`. Can contain `skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json` (Code Intelligence / Language Servers), `bin/`, and `settings.json`.
*   **userConfig:** Define values prompted at install time in `plugin.json`. Access via `${user_config.KEY}` in skills/hooks.
*   **Namespacing:** Plugin skills/commands are namespaced (e.g., `/my-plugin:hello`).
*   **Marketplaces:** Added via `/plugin marketplace add <source>`.
