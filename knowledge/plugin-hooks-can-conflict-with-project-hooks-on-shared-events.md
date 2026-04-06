---
description: Plugins and project settings.json both register hooks for the same lifecycle events with no conflict detection or ordering guarantees
type: insight
source: ".claude/settings.json, SessionStart conflict debugging session"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[claude-code-skills]]"]
related_components: [".claude/settings.json", ".claude/hooks/"]
---

# plugin hooks can conflict with project hooks on shared events

Plugins can register hooks for the same Claude Code lifecycle events (SessionStart, PostToolUse, Stop, etc.) that project-level settings.json already uses. When both systems register for the same event, execution order depends on the internal hook resolution sequence: project hooks fire from settings.json in array order, but plugin hooks are injected at a different layer. There is no conflict detection, no priority system, and no way to guarantee ordering between project hooks and plugin hooks.

This was directly observed during a SessionStart conflict: both a project hook (session-orient.sh) and a plugin's initialization routine attempted to run at session start. The project hook had a syntax bug (concatenated `fiif` on line 51) that caused it to fail silently. Because the plugin's SessionStart behavior ran independently, the failure was masked -- the session appeared to start normally even though session orientation never completed. Without the plugin's successful initialization, the broken project hook would have been more visible.

The broader pattern is that hooks are the "automatic enforcement" layer and plugins are the "skill injection" layer, but they share the lifecycle event bus. A plugin that registers a SessionStart hook to set up context competes with a project SessionStart hook that validates vault state. Neither knows the other exists.

---

Relevant Notes:
- [[session-orient-and-validate-note-have-syntax-bugs]] -- the specific bug this conflict masked
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- same pattern between claudekit and custom hooks
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the dense event pipeline context

Topics:
- [[dev-infrastructure]]
- [[claude-code-skills]]
