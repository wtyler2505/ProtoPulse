---
description: Focus entire session on a specific area of any codebase for deep work - comprehensive audit, architecture analysis, quality assessment, and optional visual forensics
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, mcp__chrome-devtools__*, mcp__desktop-commander__*, mcp__memory__*, mcp__context7__*, mcp__clear-thought__*, WebSearch
argument-hint: "<area>"
---
# Deep Focus Mode
**Target**: $ARGUMENTS

## Methodology
Based on Cal Newport's Deep Work principles: "Professional activities performed in a state of distraction-free concentration that push your cognitive capabilities to their limit."

This command invokes the `deep-focus` skill for comprehensive multi-phase analysis of any codebase target   frontend components, backend services, APIs, libraries, CLI tools, pipelines, infrastructure, or anything in between.

## Pre-Session Setup

### Environment Check
- Notifications silenced
- Single objective defined
- Expected duration: 60-120 minutes
- "Done" criteria clear

### Session Intent
Before diving deep, answer:
1. What specific aspect of `$ARGUMENTS` needs focus?
2. What does success look like for this session?
3. What's the single most important outcome?

## Load Deep Focus Skill
Use the `Skill` tool to load: **deep-focus**

This skill provides:
- **Target classification**   auto-detects UI, API, CLI, library targets
- **17 CLI tools** for code intelligence
- **Architecture & quality analysis** for any language
- **Conditional visual forensics** via Chrome DevTools (only when target has UI)
- **Adaptive reporting**   report and menu adjust to target type

## When to Use
- Deep audit of any feature, module, service, or component
- Comprehensive analysis of an API, library, or CLI tool
- Systematic improvement of a codebase area
- Architecture review of a subsystem
- Quality assessment before a major refactor

## When NOT to Use
- **Quick fix or single file**   overkill for small changes
- **Time-sensitive hotfix**   full audit takes significant time
- **Research-only task**   use research skills instead

## Session End Protocol
At end of deep focus session, document:
1. What was accomplished
2. Current obstacle (if any)
3. Next 1-3 actions for follow-up
This preserves context for future sessions (Newport's "shutdown complete" ritual).

## Related Skills
- `systematic-debugging`   For issues discovered during focus
- `thorough-verification`   Verify fixes after deep focus session

## Sources
- Cal Newport, "Deep Work" (2016)   Core methodology
- Newport, "Slow Productivity" (2024)   Modern application
- deep-focus skill v2.0.0   Technical implementation
