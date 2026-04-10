# The "Maestro-Class" Super Skill Architecture

## 1. The Paradigm Shift
A standard AI skill is a single `SKILL.md` file containing a prompt. A **Maestro-Class Super Skill** is a living, multi-directory ecosystem. It transforms an AI from a reactive text generator into an autonomous, context-aware, self-healing, and self-updating orchestrator.

This template defines the directory structure, the zero-latency command injection syntax, and the mandatory behavioral scripts required to build a Maestro-Class skill.

## 2. Directory Structure Blueprint
When scaffolding a new Maestro-Class skill (e.g., `my-super-skill`), you MUST create the following directory structure:

```text
.agents/skills/my-super-skill/
├── SKILL.md                 # The Router: Persona, guardrails, and inter-skill routing.
├── references/              # The Brain: Categorized Markdown knowledge base.
│   ├── core-concepts.md     # Specific domain knowledge chunk 1.
│   ├── advanced-mechanics.md# Specific domain knowledge chunk 2.
│   └── raw_docs/            # The Encyclopedia: Raw official documentation downloaded via script.
├── scripts/                 # The Engine: Executable bash scripts for active automations.
│   ├── doctor.sh            # Runs health checks, validates JSON/configs, and auto-heals permissions.
│   ├── auto-backup.sh       # Takes a snapshot of the target environment before any edits.
│   ├── telemetry.sh         # Analyzes token footprint, log sizes, and system state.
│   └── fetch_docs.sh        # Re-downloads the latest official documentation to raw_docs/.
├── templates/               # The Factory: Boilerplate code/YAML/JSON for scaffolding.
│   └── boilerplate.md       # Pre-written templates the skill can use to generate files perfectly.
└── data/                    # The Ledger: Permanent storage for autonomous actions.
    └── CHANGELOG.md         # Updated automatically by a logging script.
```

## 3. The `SKILL.md` (The Router)
The main `SKILL.md` file must be lean. It should NOT contain the entire knowledge base. It must contain:

1. **The Persona & Mandate:** "You are the Ultimate Architect for [Domain]."
2. **Reference Pointers:** Explicit instructions telling the AI to consult its injected `references/` folder before acting.
3. **The Encyclopedia Directive:** "If the answer is not in the summaries, you MUST search your `raw_docs/` folder."
4. **Inter-Skill Routing (CRITICAL):**
   - *Semantic Search:* "If you cannot find the answer, use the `qmd` skill to vector-search your `raw_docs/`."
   - *Global Registries:* "Before building from scratch, use the `smithery` (or equivalent) skill to search the community."
   - *Web Scouting:* "If you encounter an undocumented error, you MUST proactively use `google_web_search` to scour GitHub and Reddit."
5. **The Active Toolkit:** A list of the `!bash scripts/` the AI is mandated to run for validation, backups, and logging.

## 4. The Interactive Command (`assistant.toml`)
The true power of the Maestro architecture is **Zero-Latency Context Injection**. The user-facing command (e.g., `.gemini/commands/my-domain/assistant.toml`) MUST use native Gemini CLI syntax to bypass slow tool calls.

### The Template Command Structure:
```toml
description = "Your dedicated Maestro assistant for [Domain]. Audits, auto-heals, and orchestrates."
prompt = """
# [Domain] Maestro Assistant

You are the **[Domain] Maestro**, a hyper-intelligent, context-aware assistant.

## Your Injected Brain
You already possess the complete, advanced mechanics of [Domain] directly injected into your context.
@{./.agents/skills/my-super-skill/references/core-concepts.md}
@{./.agents/skills/my-super-skill/references/advanced-mechanics.md}

## Live System Audit & Auto-Healing (Pre-computed)
The following is the live, real-time health and telemetry data of the user's environment, pre-computed for you:

### Health Report:
!{bash ./.agents/skills/my-super-skill/scripts/doctor.sh}

### Telemetry:
!{bash ./.agents/skills/my-super-skill/scripts/telemetry.sh}

## Your Toolkit
You have pre-built executable scripts. **You MUST use them:**
*   **The Safety Net (CRITICAL):** Run `bash ./.agents/skills/my-super-skill/scripts/auto-backup.sh` **EVERY TIME** before you modify core files.
*   **Changelog (CRITICAL):** Run `bash ./.agents/skills/my-super-skill/scripts/log-action.sh "Action" "Details"` **every time** you make a change.

## Interactive Execution
*   **Respond to `{{args}}`**: Read your injected references. Run `auto-backup.sh`. Apply the fix. Run `log-action.sh`.
*   **Proactive Dashboard**: If no args are provided, present a beautifully formatted "Maestro Dashboard" based on the **Live System Audit** data above.

---
*User Request: {{args}}*
"""
```

## 5. The Mandatory Bash Scripts (The Engine)
Every Maestro-Class skill MUST include these three core scripts in its `scripts/` folder:

1.  **`doctor.sh` (The Auto-Healer):**
    *   Validates the syntax of target configuration files (using `jq` or `yq`).
    *   Ensures required CLI dependencies exist (e.g., `command -v jq`).
    *   Finds bash scripts and auto-heals missing execute permissions (`chmod +x`).
2.  **`auto-backup.sh` (The Safety Net):**
    *   Takes a timestamped `.tar.gz` snapshot of the target domain's configuration folder before the AI is allowed to edit anything.
3.  **`log-action.sh` (The Ledger):**
    *   Appends a timestamp, action title, and details to `data/CHANGELOG.md` to guarantee the AI remains accountable for its autonomous actions.
