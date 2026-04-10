# Implementation Plan: The "Maestro" Skill Architecture Template

## 1. Objective
To extract the groundbreaking architectural patterns we just developed for the `claude-code-maestro` skill and codify them into a reusable, standardized template. This template will be provided to your skill-building agents (like `god-skill-creator` or `codex-skill-builder`) so that every future complex skill you generate can leverage the same god-tier capabilities: zero-latency context injection, active bash automations, auto-healing, and self-updating encyclopedias.

## 2. Key Files & Context
- **Target Template Location:** We will save this template as `.agents/skills/codex-skill-builder/templates/maestro-architecture.md` (or a similar appropriate directory for your skill builder).
- **Format:** A comprehensive Markdown guide defining the directory structure, the CLI command integration, and the behavioral mandates.

## 3. The "Maestro" Architecture Breakdown (What the Template Will Contain)

### Phase 1: The Multi-Directory Ecosystem
Instead of a single `SKILL.md`, future "Maestro-class" skills will be scaffolded with this exact structure:
*   `SKILL.md`: The Router. Contains the persona, strict guardrails, and inter-skill mandates (e.g., QMD semantic search, Smithery registry checks).
*   `references/`: The Brain. Categorized markdown files containing deep technical knowledge.
*   `scripts/`: The Engine. Executable bash scripts for health checks, auto-healing, auto-backups, and web scraping.
*   `templates/`: The Factory. Boilerplate code injected when scaffolding new features.
*   `data/`: The Ledger. A `CHANGELOG.md` updated automatically by the skill's scripts.

### Phase 2: The Zero-Latency Command Injection (`command.toml`)
The template will mandate that the interactive command for the skill uses native Gemini CLI features to eliminate tool-call latency:
*   **Static Injection (`@{}`):** Injecting the `references/` files directly into the system prompt so the AI wakes up already knowing the domain.
*   **Live Pre-Computation (`!{bash}`):** Executing telemetry, doctor scripts, and dependency checks *before* the prompt hits the LLM, presenting the AI with a live dashboard of the system state.

### Phase 3: Accountability & Auto-Healing
The template will enforce that every Maestro-class skill includes:
*   An `auto-backup.sh` script that MUST run before modifying configurations.
*   A `doctor.sh` script that auto-heals missing permissions or broken dependencies.
*   A `log-action.sh` script to maintain a permanent audit trail.

## 4. Implementation Steps
1.  **Draft the Template:** I will write the complete, copy-pasteable template text into `conductor/maestro-template-draft.md`.
2.  **User Review:** You review the template to ensure it captures every paradigm shift we introduced.
3.  **Deployment:** Once approved (exiting plan mode), I will save the template into your primary skill-building tool's asset directory so it can use it as a foundational blueprint forever.

## 5. Verification
- Verify the template is accessible to `god-skill-creator` or `codex-skill-builder`.
- Ask the skill builder to "create a new skill using the Maestro architecture" to prove the template works.
