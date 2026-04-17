# The Ultimate Ars Contexta Optimization & Expansion Master Plan

This plan represents an exhaustive, unrestricted audit of the entire Ars Contexta knowledge system (`knowledge/`, `ops/`, `self/`, `inbox/`). It identifies every structural, operational, and methodological improvement that can be made to harden the vault, automate the pipeline, and enforce absolute utilization by AI agents.

## Category 1: Graph Topology & Structural Integrity
The graph has centralized heavily around several massive "god-notes" and contains an enormous backlog of un-synthesized connections (26,215 open triangles detected during the last full sweep).

### High Priority: Decompose the Black Holes (God-Notes)
Several topic maps and foundational notes have become black holes for links, diluting semantic search value.
- **Task 1.1:** Split `eda-fundamentals` (229 incoming links) into highly specific sub-domains (`eda-schematic-capture`, `eda-pcb-routing`, `eda-simulation-engines`).
- **Task 1.2:** Split `hardware-components` (124 incoming) by package type, operating voltage, or communication protocol.
- **Task 1.3:** Decompose `power-systems` (106 incoming) and `actuators` (87 outgoing).

### Medium Priority: Execute Deep Synthesis Passes (Close the Triangles)
- **Task 1.4:** Write a dedicated `ops/scripts/graph/close-triangles.ts` script to programmatically iterate through the top 500 open triangles. 
- **Task 1.5:** Deploy the `/reflect` skill in batch mode to autonomously generate connecting insights (e.g., synthesizing the missing insight between `fritzing-parts-use-svg-layers`, `kicad-exporter-deterministic-uuid`, and `erc-pin-classification-uses-fragile-regex` which all share `eda-pcb-design` as a parent but lack sibling links).

### Low Priority: Strengthen Load-Bearing Bridges
- **Task 1.6:** Identify the top 20 structural bridge notes (e.g., `cytron-md25hv...` which uniquely bridges power systems and motor controls). Expand their content to ensure they provide high-confidence, multi-hop semantic traversal paths for `qmd`.

---

## Category 2: Content Quality & Atomicity Strictness
While bare-link hygiene is perfect (0 found), the principle of atomicity is failing at the extremes.

### High Priority: Decompose Over-long Notes
Three notes blatantly violate the atomic principle (>1000 words) and must be run through `/extract`.
- **Task 2.1:** Run `/extract` on `knowledge/actuators.md` (1439 words).
- **Task 2.2:** Run `/extract` on `knowledge/power-systems.md` (1109 words).
- **Task 2.3:** Run `/extract` on `knowledge/wiring-integration.md` (1005 words).

### Medium Priority: Expand Stubs
- **Task 2.4:** Expand `knowledge/eda-hardware-components.md` (currently 44 words). It needs to be rewritten to form a complete, testable claim or merged into a larger MOC.
- **Task 2.5:** Run a custom script to find all `knowledge/*.md` files under 100 words and queue them for the `/enrich` pipeline.

---

## Category 3: Methodology Coverage & Coherence
There is a disconnect between the vault's internal methodology and the broader workspace's operational reality.

### High Priority: Document the "Dual-Write Pipeline"
- **Task 3.1:** `GEMINI.md` explicitly dictates that `Inventory/parts/` acts as the source of truth for PartScout and ProtoPulse via `npm run sync`. However, `ops/methodology.md` and `ops/config.yaml` completely ignore this. The methodology must be updated to define exactly how the Ars Contexta pipeline (Inbox -> Extract -> Connect) integrates with the dual-write sync protocol.

### Medium Priority: Sync Configuration with Reality
- **Task 3.2:** Update `ops/config.yaml`. It currently has `processing_pipeline: true` but lacks any thresholds or settings for hardware component synchronization, codebase context limits, or the newly instituted CLI hardware hooks.

---

## Category 4: Pipeline & Automation Upgrades
The extraction queue is bloated and bottlenecked. The manual steps in the pipeline need to be automated away.

### High Priority: Clear the Queue Bloat
- **Task 4.1:** `ops/queue/` contains over 80 unextracted raw markdown splits (e.g., 16 parts of `wiring-36v-battery-power-distribution-4-tier-system`, 11 parts of `wiring-hall-sensors-to-esp32`). Run `/ralph 80 --parallel` to process this massive backlog into atomic knowledge using sub-agent swarms.

### Medium Priority: Automate Bi-Directional Sync
- **Task 4.2:** Instead of relying on the manual `npx tsx scripts/sync-hardware-vault.ts` script, implement a Vite plugin or Git hook (`pre-commit` or `post-checkout`) that watches `knowledge/` and `shared/verified-boards/` for changes. If a markdown spec changes, it automatically updates the TypeScript definition. If the TypeScript changes, it updates the markdown.

---

## Category 5: Agent Integration & Tooling (The Final Frontier)
Agents are not learning from previous sessions due to a broken feedback loop, and CLI integration could be dramatically tighter.

### Critical Priority: Fix the Session Mining Pipeline
- **Task 5.1:** As documented in `ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md`, the `/remember --mine-sessions` skill has silently failed. There are currently over 231 unprocessed session stubs. Diagnose and repair the `session-mining-pipeline` so the system resumes autonomous learning.

### High Priority: Build an Ars Contexta MCP Server
- **Task 5.2:** Relying on CLI skills (`/graph`, `/health`, `/next`) is slow. Build a dedicated **Ars Contexta MCP Server** (Model Context Protocol). This server will expose the vault's SQLite/vector database directly to Claude and Gemini, enabling instantaneous semantic search, topology querying, and pipeline triggering natively without running bash scripts.

### Medium Priority: Deepen `qmd` Integration
- **Task 5.3:** The `qmd` local search CLI is available as a skill but isn't actively being utilized in the extraction or connection phases to auto-suggest links. Modify the `/connect` skill prompt to forcefully execute `qmd search` to find highly relevant semantic matches before it proposes links.

---

## Category 6: Operational Hygiene
The operational directories are cluttered with stale artifacts and unresolved tensions.

### High Priority: Resolve Active Bugs
- **Task 6.1:** Address the `2026-04-11-capture-hook-session-id-bug.md` observation note (if it has regressed), which is likely contributing to the broken session mining loop.

### Medium Priority: Archive Stale Sessions
- **Task 6.2:** `ops/sessions/` is polluted with hundreds of raw `.json` files and massive `compact-*.json` dumps. Implement a log rotation script (`ops/scripts/rotate-logs.sh`) to compress and move sessions older than 7 days into `archive/sessions/`.