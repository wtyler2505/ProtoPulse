---
type: manual
generated_from: "arscontexta-1.0.0"
---

# Configuration

Vault structure, config settings, hooks, and feature flags.

## Directory Structure

```
ProtoPulse/
  .arscontexta              -- Vault marker (hooks only run when this exists)
  knowledge/                -- Knowledge notes (atomic claims, decisions, concepts)
    index.md                -- Hub topic map linking all domain areas
  inbox/                    -- Raw source material awaiting extraction
  archive/                  -- Processed and archived sources
  self/                     -- Agent identity, methodology, goals
    identity.md             -- Who the knowledge agent is
    methodology.md          -- How the system works
    goals.md                -- Active threads and priorities
    memory/                 -- Session memory artifacts
  ops/                      -- System operations
    config.yaml             -- Master configuration
    derivation.md           -- How this system was derived (dimension positions)
    derivation-manifest.md  -- Machine-readable vocabulary and mappings
    reminders.md            -- Scheduled review reminders
    tasks.md                -- Task stack and queue state
    methodology/            -- Methodology notes and rationale
    observations/           -- Friction signals and surprises
    sessions/               -- Session capture JSON files
    queue/                  -- Processing queue
      archive/              -- Completed queue items
    tensions/               -- Unresolved tensions in the system
    queries/                -- Saved graph queries
  templates/                -- Note templates
    knowledge-note.md       -- For knowledge/ notes
    topic-map.md            -- For topic maps (MOCs)
    source-capture.md       -- For inbox/ captures
    observation.md          -- For ops/observations/ signals
  manual/                   -- This documentation
```

## .arscontexta Vault Marker

The vault marker file at the project root controls hook behavior:

```yaml
git: true              # Auto-commit knowledge changes
session_capture: true  # Save session metadata on stop
```

Hooks check for this file before running. Delete it to disable all vault hooks without modifying settings.json.

## ops/config.yaml

Master configuration for all vault behaviors:

- **dimensions**: Position settings for granularity, organization, linking, etc.
- **features**: Toggle blocks like schema validation, semantic search, graph analysis
- **processing**: Extraction categories, pipeline settings, queue limits
- **personality**: Warmth, opinionatedness, formality, emotional awareness
- **maintenance**: Condition thresholds for orphans, staleness, inbox pressure

## Hooks

Four hooks are registered in `.claude/settings.json`:

### session-orient.sh (SessionStart)
Reads vault state at session start. Reports note counts, checks condition thresholds (inbox overflow, observation backlog, tension accumulation), and flags due reminders.

### validate-note.sh (PostToolUse on Write)
Validates notes written to `knowledge/` or `inbox/`. Checks for YAML frontmatter and required schema fields. Emits warnings, does not block.

### auto-commit-vault.sh (PostToolUse on Write, async)
Auto-commits changes to knowledge vault files. Only triggers for files inside `knowledge/`, `inbox/`, `self/`, `ops/`, or `templates/`. Runs asynchronously to avoid blocking.

### session-capture.sh (Stop)
Saves session metadata to `ops/sessions/` as JSON. Records timestamp, notes touched, and a `mined` flag for post-session analysis.

## Feature Flags

All features from derivation.md are active:
- **wiki-links**: Always included (kernel feature)
- **atomic-notes**: One idea per note, prose-as-title
- **mocs**: 3-tier navigation (index -> domain topic maps -> notes)
- **processing-pipeline**: Extract/connect/revisit/verify cycle
- **schema**: Dense frontmatter with validation
- **maintenance**: Condition-based triggers
- **self-evolution**: Agent identity and methodology tracking
- **self-space**: Persistent agent identity in self/
- **semantic-search**: Both explicit wiki links and implicit semantic discovery
- **graph-analysis**: Graph queries and structural analysis
- **personality**: Warm, opinionated, casual, task-focused

---

Topics:
- [[manual]]
