# Ars Contexta: Ultimate Hardware Knowledge & Agent Enforcement Plan

## Background & Motivation
To ensure ProtoPulse maintains absolute real-world fidelity, we are upgrading the hardware data model to include exhaustive, verified specifications (precise mm dimensions, colors, header spacing, current/voltage limits, and pinouts). This information must not only exist in code but must be deeply embedded into the **Ars Contexta** knowledge vault. 

To enforce this without causing developer friction, we are adopting the **"Dual-Write Pipeline"** architecture. This ensures that any update to a TypeScript component definition automatically syncs to a detailed markdown note in the vault, and the AI agents are structurally forced to query this vault before writing any hardware-related code.

## Phase 1: Process Remaining Inbox
- Run the Ars Contexta `/pipeline` manually on `inbox/historical-session-friction.md`. Since it contains 0 actionable claims, the pipeline will cleanly archive the file, closing out the current queue loop.

## Phase 2: Comprehensive Hardware Research (The "EVERYTHING" Pass)
- **Identify Targets:** Audit `shared/standard-library.ts` and `shared/verified-boards/` to collect a complete list of all currently supported components (resistors, ICs, MCUs, sensors, motor drivers, displays, etc.).
- **Deep Research:** Utilize `web_fetch`, `context7`, and web search to uncover the exact physical specifications for every part. This includes:
  - Exact package dimensions (L x W x H in mm)
  - Pin pitch (e.g., 2.54mm, 1.27mm)
  - Authentic visual characteristics (PCB colors, silkscreen styles)
  - Electrical thresholds (max voltage, continuous/peak current, I/O tolerances)
- **Code Application:** Update the `VerifiedBoardDefinition` and `StandardComponentDef` objects across the codebase with the newly researched, hyper-accurate data.

## Phase 3: Building the Dual-Write Pipeline
- **Sync Tooling:** Create a script (`scripts/sync-hardware-vault.ts`) that iterates through all definitions in `verified-boards/` and `standard-library.ts`. For each part, it will programmatically generate/update a structured markdown file in `knowledge/` (e.g., `knowledge/l298n-dual-motor-driver-specifications.md`).
- **In-App Part Creator AI Update:** Update the `server/ai.ts` system prompt and frontend component creation wizard to enforce a strict workflow:
  1. AI asks the user for the exact component part number.
  2. AI autonomously researches the specs online via its tools.
  3. AI presents the findings to the user for validation.
  4. AI creates the TypeScript definition *and* invokes the dual-write sync tool.

## Phase 4: Agent Enforcement & Context Utilization
To ensure Gemini CLI and Claude Code CLI actually *use* this newly mined knowledge:
- **Pre-Execution Hooks:** Implement a `.gemini/hooks/` and `.claude/hooks/` pre-tool hook that intercepts commands related to hardware creation, wiring, or logic. The hook will enforce a mandatory `qmd` or `grep` semantic search across the `knowledge/` vault to inject the hardware specs directly into the active context window.
- **Global Context Updates:** Update the root `GEMINI.md` and `CLAUDE.md` instructions with the "Verification Before Completion" protocol, mandating that agents cross-reference the Ars Contexta vault for pinouts and dimensions before returning code.

## Phase 5: Vault Deepening & Maintenance
- Run the `/health` skill on the Ars Contexta vault to identify any broken links or orphan notes created by the massive influx of hardware data.
- Run the `/graph` and `/architect` skills to analyze the updated topology. We will likely need to split the `hardware-components` topic map into distinct MOCs (e.g., `mcus.md`, `sensors.md`, `breakouts.md`) to prevent MOC Sprawl.
- Run `/revisit` passes to aggressively backlink existing architecture decision notes to the newly generated hardware specs.

## Execution Strategy
This plan will be executed iteratively. We will begin with Phase 1 and 2, ensuring our baseline definitions are perfect before writing the automation scripts in Phase 3. Phase 4 will serve as the final lock-in, guaranteeing future-proof compliance.