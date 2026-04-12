# Porting Agentic Note-Taking (Ars Contexta) to Gemini CLI

## Objective
Carefully and comprehensively port the Claude Code `agenticnotetaking` (Ars Contexta) plugin to natively operate as a Gemini CLI extension. The port will respect and integrate seamlessly with the user's existing rich knowledge vault (`/home/wtyler/Projects/ProtoPulse/knowledge/`).

## Background & Motivation
The user has a sophisticated, agent-native knowledge system derived from the `agenticnotetaking` Claude Code plugin (evident by the extensive `knowledge/` directory filled with atomic notes, topic maps, and `ops/` structures). To make the Gemini CLI a true "Maestro" of this environment, it must adopt the same cognitive architecture. This requires porting the plugin's derivation engine, skills, hooks, and context generators to the Gemini CLI ecosystem.

## Scope & Impact
- **Extension Scaffolding:** Creating a native `gemini-extension.json` wrapper.
- **Platform Adaptation:** Shifting file generation from `CLAUDE.md` and `.claude/hooks/` to `GEMINI.md` and `.gemini/hooks/` (or `.agents/skills/` depending on workspace standards).
- **Skill Translation:** Migrating the `SKILL.md` definitions and updating the `setup` skill to detect Gemini CLI.
- **Command Routing:** Creating `.toml` command definitions for slash commands (e.g., `/arscontexta:setup`).
- **Existing Vault Integration:** Ensuring the setup engine detects the existing `knowledge/` directory, reads `ops/derivation-manifest.md`, and adopts the existing vocabulary and schema rather than aggressively overwriting it.

## Proposed Solution & Implementation Steps

### Phase 1: Native Gemini CLI Extension Scaffolding
1. **Create Directory Structure:** Create `~/.gemini/extensions/agenticnotetaking/`.
2. **Manifest Creation:** Write `gemini-extension.json`:
   ```json
   {
     "name": "arscontexta",
     "version": "0.8.0",
     "description": "Conversational derivation engine ported for Gemini CLI",
     "contextFileName": "arscontexta.md",
     "mcpServers": []
   }
   ```
3. **Asset Migration:** Copy `reference/`, `skill-sources/`, `presets/`, and `generators/` from the Claude plugin to the Gemini extension directory.

### Phase 2: Platform Generators & Hooks Adaptation
1. **Context File Generator:** Duplicate `generators/claude-md.md` to `generators/gemini-md.md`. Modify it to output `GEMINI.md` as the primary context file for the Gemini CLI.
2. **Hooks Translation:** 
   - Translate `.claude/hooks/` scripts (like `session-orient.sh`, `validate-note.sh`, `auto-commit.sh`) to target `.gemini/hooks/` or integrate them into the workspace's existing `.claude/hooks/` directory (which Gemini CLI currently shares).
   - Ensure hook triggers match Gemini CLI's event lifecycle (`SessionStart`, `PostToolUse`, `Stop`).

### Phase 3: Skill Engine & Setup Porting
1. **Port the Setup Skill:**
   - Update `skills/setup/SKILL.md`.
   - **Crucial:** Modify Phase 1 (Platform Detection) to detect `gemini-cli` instead of `claude-code`.
   - **Crucial:** Modify the setup logic to actively look for an existing `knowledge/ops/derivation-manifest.md` or `ops/config.yaml`. If found, bypass the conversational derivation phase and directly build `GEMINI.md`, skills, and hooks using the *existing* vocabulary and dimension configuration.
2. **Skill Deployment:** Update the setup script to write generated skills to `.gemini/skills/` or the existing `.agents/skills/` directory, ensuring Gemini CLI can index and route them (e.g., `/reduce`, `/reflect`, `/reweave`).

### Phase 4: Slash Commands via TOML
1. Unlike Claude Code which registers commands dynamically, Gemini CLI uses `.toml` files for commands.
2. Create a `commands/` directory in the extension containing:
   - `arscontexta/setup.toml`
   - `arscontexta/health.toml`
   - `arscontexta/reseed.toml`
   - `arscontexta/help.toml`
3. Map these `.toml` commands to invoke the corresponding ported skills or scripts with the `{{args}}` injection.

### Phase 5: Semantic Search (MCP) Integration
1. The Claude plugin configures `qmd` in `.mcp.json`. 
2. The Gemini CLI port will append the `qmd` semantic search MCP server configuration either globally in `~/.gemini/mcp.json` or at the workspace level `.mcp.json`, ensuring the Gemini CLI can query the existing `knowledge/` graph using tools like `mcp__qmd__deep_search`.

## Alternatives Considered
- **Running Claude Code via Subagent:** Instead of porting, we could run the `claude-code` CLI under the hood. *Rejected* because it breaks native context integration; Gemini CLI needs to natively read `GEMINI.md` and execute the `.gemini/hooks/` to be a true "thinking partner".

## Verification
- **Installation:** Verify `gemini extensions list` shows `arscontexta`.
- **Integration:** Run `/arscontexta:setup` and ensure it detects the existing `knowledge/` vault.
- **Context:** Verify `GEMINI.md` is successfully generated and incorporates the existing domain vocabulary.
- **Skills:** Verify that `/reduce`, `/reflect`, etc., are available to the Gemini CLI.