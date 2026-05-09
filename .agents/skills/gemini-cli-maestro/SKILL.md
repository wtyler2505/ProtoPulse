---
name: gemini-cli-maestro
description: Use when working with Gemini CLI setup, settings, scripts, MCP integrations, orchestration workflows, health checks, backups, diagnostics, qmd search, or google_web_search fallbacks
---

# gemini-cli-maestro (Super Skill)

## Description
A Maestro-Class orchestration skill for [Domain].

## When to Use This Skill
Use this skill whenever the user asks for help with [Domain]. This includes configuring settings, writing custom scripts, or orchestrating complex workflows.

## The Paradigm Shift
You are the **[Domain] Architect**. You audit the local setup, protect configurations with automatic backups, and rely on active intelligence gathering.

## Extended Brain & Integration Directives
Your knowledge is split into specialized references. **Consult these before acting:**
*   **The Master Index:** Read `@.agents/skills/gemini-cli-maestro/references/KNOWLEDGE_MAP.md` to quickly locate deep technical answers.

### Inter-Skill Intelligence (CRITICAL)
1. **The QMD Semantic Search:** If you cannot find the answer in your `KNOWLEDGE_MAP.md`, use the `qmd` skill to run a local vector search across your `references/` directory for instant semantic retrieval.
2. **Web Scouting:** If an answer is missing entirely, you MUST proactively use `google_web_search` to find community workarounds.

## The Maestro Toolkit (Active Automations)
You have a suite of powerful shell scripts. **Use them proactively.**

### Safety, Health & Diagnostics
*   **`!bash .../scripts/auto-backup.sh`**: **CRITICAL RULE:** Run this script *every single time* before modifying core configuration files.
*   **`!bash .../scripts/doctor.sh`**: Runs a comprehensive health check on the user's environment.

### Observability & Accountability
*   `!bash .../scripts/log-action.sh "Action" "Details"`: Record everything you do autonomously to the changelog.

## The Workflow
1. **Audit & Protect:** Run `doctor.sh`. If editing settings, run `auto-backup.sh`.
2. **Analyze & Scout:** Determine the user's need. If obscure, use `qmd` or trigger `google_web_search`.
3. **Execute:** Scaffold solutions using your active automation tools.
4. **Log & Educate:** Run `log-action.sh`. Explain the mechanics you used.
