---
name: brainstorming
description: Interactive idea refinement using Socratic method to develop fully-formed designs - use when partner describes any feature or project idea, before writing code or implementation plans
allowed-tools: Read, Glob, Task, AskUserQuestion
version: 2.4.0
---

# Brainstorming Ideas Into Designs

## Overview

Transform rough ideas into fully-formed designs through structured questioning and alternative exploration.

**Core principle:** Ask questions to understand, explore alternatives, present design incrementally for validation.

**Announce at start:** "I'm using the Brainstorming skill to refine your idea into a design."

## When NOT to Use

Do NOT use this skill when:
- **Requirements already clear** → Skip to `writing-plans` directly
- **Bug fix with known cause** → Use `systematic-debugging` instead
- **Quick question or info request** → Answer directly without design process
- **User says "just do it"** → Respect the directive, skip design phase
- **Following existing specification** → Use `executing-plans` with the spec

## The Process

### Phase 1: Understanding
- Check current project state in working directory
- Ask ONE question at a time to refine the idea
- Prefer multiple choice when possible
- Gather: Purpose, constraints, success criteria

### Phase 2: Exploration
- Propose 2-3 different approaches
- For each: Core architecture, trade-offs, complexity assessment
- Ask which approach resonates

### Phase 3: Design Presentation
- Present in 200-300 word sections
- Cover: Architecture, components, data flow, error handling, testing
- Ask after each section: "Does this look right so far?"

### Phase 4: Planning Handoff
When design is approved:
- Ask: "Ready to create the implementation plan?"
- On confirmation → Use writing-plans skill

## When to Revisit Earlier Phases

**Go backward when:**
- Partner reveals new constraint → Return to Phase 1
- Partner questions approach → Return to Phase 2
- Something doesn't make sense → Go back and clarify

**Don't force forward linearly** when going backward would give better results.

## Remember

- One question per message during Phase 1
- Apply YAGNI ruthlessly
- Explore 2-3 alternatives before settling
- Present incrementally, validate as you go
- Go backward when needed - flexibility > rigid progression
- Announce skill usage at start

## Related Skills

- `writing-plans` - Next step after design is approved
- `research-and-development` - When exploration of unknowns is needed first
- `collision-zone-thinking` - For breakthrough innovation on stuck problems
- `inversion-exercise` - Alternative ideation through "opposite" thinking
- `project-genesis` - For Claude Project setup specifically

## Changelog

- v2.4.0 (2025-01): Added "When NOT to Use" section, related skills, changelog
- v2.3.0 (2024-12): Added "When to Revisit Earlier Phases" guidance
- v2.2.0 (2024-11): Simplified process to 4 clear phases
- v2.1.0 (2024-10): Added multiple choice preference in questioning
- v2.0.0 (2024-09): Restructured with Socratic method focus
