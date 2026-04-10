# Implementation Plan: Claude Code Maestro & Assistant

## 1. Objective
To create a "Super Skill" (`claude-code-maestro`) and an orchestrator command (`/claude:assistant`) that transforms Gemini into a dedicated Claude Code CLI engineer. The assistant will possess deep, undocumented knowledge of the Claude Code ecosystem and the ability to proactively research community workarounds.

## 2. Key Files & Context
- **Skill File:** `.agents/skills/claude-code-maestro/SKILL.md` (Will define the deep knowledge base and community research mandate).
- **Command File:** `.gemini/commands/claude/assistant.toml` (Will act as the interactive dashboard and orchestrator).
- **Source Material:** Official Claude Code documentation (fetched and digested) + non-official community sources (enabled via tools).

## 3. Implementation Steps
1. **Create the Skill File:**
   - Copy the finalized `claude-code-maestro-SKILL.md` from the `conductor/` directory into the active `.agents/skills/claude-code-maestro/SKILL.md` path.
   - The skill will include explicit instructions on advanced mechanics (Plugins, Agent SDK, Hooks, Sandboxing) and a strict mandate to use `google_web_search`, `web_fetch`, and Context7 for deep community research when official docs fall short.
2. **Create the Command File:**
   - Copy the finalized `claude-assistant-command.toml` from the `conductor/` directory into the active `.gemini/commands/claude/assistant.toml` path.
   - The command will be configured to autonomously audit the user's `.claude/` directory, provide a dashboard, and proactively build extensions or debug issues.

## 4. Verification & Testing
- Run `/claude:assistant` to verify the dashboard loads and accurately reflects the current `.claude/` workspace.
- Test the community research mandate by asking the assistant an obscure question about a Claude Code bug to ensure it triggers a `google_web_search`.
- Verify the skill shows up in the active skills list.