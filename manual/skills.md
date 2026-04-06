---
type: manual
generated_from: "arscontexta-1.0.0"
---

# Skills Reference

Every skill (slash command) available for knowledge work in the ProtoPulse vault.

## Core Processing Skills

### /extract
Extract structured knowledge from source material. Takes raw captures from `inbox/` and produces atomic knowledge notes in `knowledge/`. This is where you transform datasheets, articles, and conversations into your own understanding.

**Usage:** `/extract inbox/source-file.md`
**Output:** One or more knowledge notes with proper frontmatter, plus archive of the source.

### /connect
Find connections between notes and update topic maps. Surfaces relationships you might miss by scanning the graph for semantic and structural overlaps.

**Usage:** `/connect` (processes recent unconnected notes)
**Output:** Updated wiki links, topic map additions, new relationship annotations.

### /revisit
The backward pass -- update old notes with new connections. Goes back to existing notes that relate to recently created content and refreshes their links, confidence levels, and topic map memberships.

**Usage:** `/revisit` (targets notes related to recent changes)
**Output:** Updated notes with new links, confidence changes, superseded_by additions.

### /verify
Challenge claims against evidence. Reviews notes with `confidence: experimental` or `confidence: likely` and checks whether accumulated evidence supports upgrading, downgrading, or marking them outdated.

**Usage:** `/verify` (processes notes flagged for verification)
**Output:** Updated confidence fields, superseded_by links where claims are disproven.

## Pipeline Skills

### /seed
Add a source file to the processing queue. Checks for duplicates, creates the archive folder entry, and moves the source from `inbox/` into the queue for extraction.

**Usage:** `/seed inbox/source-file.md`

### /pipeline
End-to-end source processing. Runs seed, extract, connect, and revisit in sequence for a batch of inbox items. The full pipeline for when you have multiple sources to process.

**Usage:** `/pipeline` (processes queued items)

### /ralph
Queue processing with fresh context per phase. Spawns isolated subagents for each processing step to avoid context contamination. Use for large batches.

**Usage:** `/ralph 5` (process 5 queued items)

## Navigation & Discovery

### /next
Surface the most valuable next action. Combines task stack, queue state, inbox pressure, vault health, and goals to recommend what to work on.

**Usage:** `/next`

### /tasks
View and manage the task stack and processing queue. Shows pending work, active tasks, and queue depth.

**Usage:** `/tasks`

### /graph
Interactive knowledge graph analysis. Routes natural language questions to graph analysis scripts.

**Usage:** `/graph "what connects PCB layout to simulation?"`

### /stats
Show vault statistics and knowledge graph metrics. Note counts, connection density, orphan ratio, topic map coverage.

**Usage:** `/stats`

## System Skills

### /validate
Schema validation for notes. Checks against templates, validates required fields, enum values, and structural constraints.

**Usage:** `/validate knowledge/some-note.md` or `/validate` (validates all)

### /status
Show project status -- checklist progress, git state, agent teams, dev server health.

**Usage:** `/status`

### /remember
Capture friction as methodology observations. Three modes -- explicit description, contextual (review recent corrections), or prompted.

**Usage:** `/remember "the extraction step takes too long for large datasheets"`

### /rethink
Challenge system assumptions against accumulated evidence. Triages observations and tensions, detects patterns, and proposes methodology updates.

**Usage:** `/rethink`

## Meta Skills

### /arscontexta:health
Run condition-based vault health diagnostics. Schema compliance, orphan detection, link health, staleness, and more.

### /arscontexta:architect
Research-backed evolution advice. Analyzes health reports and friction patterns to recommend structural changes.

### /arscontexta:reseed
Re-derive the system from first principles when structural drift accumulates.

### /learn
Research a topic and grow the knowledge graph. Investigates via web search, documentation lookup, or deep research.

**Usage:** `/learn "how do thermal vias affect heat dissipation in QFN packages"`

See [[meta-skills]] for full details on system-level operations.

---

Topics:
- [[manual]]
