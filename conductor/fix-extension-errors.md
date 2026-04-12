# Objective
Resolve all skill conflicts, command conflicts, and extension integrity errors reported by Gemini CLI to restore a clean, error-free extension environment.

# Key Files & Context
- Corrupted extensions: `context7` and `chrome-devtools-mcp`.
- Conflicting skills:
  - `~/.agents/skills/context7-mcp/SKILL.md` vs extension
  - `/home/wtyler/Projects/ProtoPulse/.agents/skills/claude-automation-recommender/SKILL.md` vs global
- Conflicting commands:
  - `/home/wtyler/Projects/ProtoPulse/.gemini/commands/scribe/` vs `scribe` extension
  - `~/.gemini/extensions/nanobanana/commands/restore.toml` vs built-in command

# Implementation Steps

1.  **Reinstall Corrupted Extensions:**
    - Run `gemini extensions uninstall context7` and `gemini extensions uninstall chrome-devtools-mcp`.
    - Run `gemini extensions install https://github.com/upstash/context7`.
    - Run `gemini extensions install https://github.com/ChromeDevTools/chrome-devtools-mcp`.

2.  **Resolve Skill Conflicts:**
    - Delete the redundant manual copy of the context7-mcp skill: `rm -rf ~/.agents/skills/context7-mcp/`.
    - Delete the redundant workspace copy of the claude-automation-recommender skill: `rm -rf /home/wtyler/Projects/ProtoPulse/.agents/skills/claude-automation-recommender/`.

3.  **Resolve Command Conflicts:**
    - Delete the duplicate workspace scribe commands to rely entirely on the global scribe extension: `rm -rf /home/wtyler/Projects/ProtoPulse/.gemini/commands/scribe/`.
    - Fix the nanobanana built-in conflict by renaming its command file to properly namespace it:
      - `mkdir -p ~/.gemini/extensions/nanobanana/commands/nanobanana`
      - `mv ~/.gemini/extensions/nanobanana/commands/restore.toml ~/.gemini/extensions/nanobanana/commands/nanobanana/restore.toml`

# Verification & Testing
1.  Run `gemini extensions list` and verify that the `chrome-devtools-mcp` and `context7` extensions load successfully without integrity errors.
2.  Verify that no skill conflict warnings appear for `context7-mcp` or `claude-automation-recommender`.
3.  Verify that no command conflict warnings appear for `/scribe:status` or `/nanobanana:restore`.