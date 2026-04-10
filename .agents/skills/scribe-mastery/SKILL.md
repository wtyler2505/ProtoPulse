# Scribe Mastery (Super Skill)

## Description
The ultimate orchestration engine for the Scribe documentation pipeline. Transforms the static, linear file-generation process of the Scribe extension into a proactive, context-aware, autonomous writing team.

## When to Use This Skill
Use this skill whenever the user is working on documentation, technical writing, blogs, or specs, and mentions Scribe, or asks to "write docs," "create an article," or "synthesize research." This skill activates a proactive documentation manager that handles the entire pipeline autonomously rather than requiring the user to run each `/scribe:***` command manually.

## The Paradigm Shift
The default Scribe commands (`/scribe:research`, `/scribe:plan`, `/scribe:draft`, etc.) are individual tools. The user has to know the pipeline and trigger them one by one. 
**With Scribe Mastery activated**, you become the **Managing Editor**. You own the pipeline. You look at the `scribe/` folder, determine the state of a project, and proactively drive it forward.

## Core Capabilities
1. **Pipeline Inference:** You can instantly deduce a project's state by examining its folder (e.g., `scribe/my-project/`).
   - Has `RESEARCH.md`? Needs `BLUEPRINT.md`.
   - Has `DRAFT.md` and `CRITIQUE.md`? Needs iteration.
   - Has `FINAL.md`? Ready for archive.
2. **Autonomous Progression:** Instead of telling the user "Please run `/scribe:plan`", you say "I see the research is done. I will now create the BLUEPRINT.md for you." and you do it using your file writing tools.
3. **Workspace Context Integration:** Unlike default Scribe (which is isolated from the main project), the Scribe Master can pull context from the broader `Projects/` workspace. If writing a technical doc about ProtoPulse, you can read actual source code or `knowledge/` notes to feed into the `RESEARCH.md` phase.

## The "Scribe Master" Workflow
When invoked to manage or advance a Scribe project:
1. **Audit:** Check the `scribe/<project>/` directory.
2. **Identify Next Step:** Determine what file is missing in the sequence (`RESEARCH.md` -> `BLUEPRINT.md` -> `DRAFT.md` -> `CRITIQUE.md` -> `FINAL.md`).
3. **Execute:** 
   - Write the required file following the strict Scribe formatting rules (80-character line limit, strict markdown).
   - *Crucial:* Do not skip steps. You must create the blueprint before the draft.
4. **Report & Verify:** Present the newly generated content to the user for approval before moving to the next stage.

## Integration with `/scribe:assistant`
If the user runs `/scribe:assistant`, this skill acts as the engine powering that command. You provide a beautiful dashboard of all projects and offer interactive management, jumping directly into the required task.

## Guardrails
- **Never skip steps.** A draft cannot be written without a blueprint.
- **Isolate projects.** Keep all files in their respective `scribe/<project>/` folders.
- **Respect the styleguide.** Always check for `styleguide.md` in the project root before drafting or polishing.
- **Line Length:** Scribe mandates an 80-character limit on all documentation lines (excluding URLs and Code Blocks). Enforce this ruthlessly.
