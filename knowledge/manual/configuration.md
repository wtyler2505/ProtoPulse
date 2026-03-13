---
summary: How to adjust your system via config.yaml and /architect
type: manual
generated_from: "arscontexta-1.0.0"
---

# Configuration

## config.yaml

Edit `knowledge/ops/config.yaml` to adjust system behavior. Changes take effect next session.

### Key Settings

**Processing depth** (`processing.depth`):
- `deep` — full pipeline, maximum quality gates. For important decisions.
- `standard` — balanced attention. Regular processing. (default)
- `quick` — compressed pipeline. High volume catch-up.

**Pipeline chaining** (`processing.chaining`):
- `manual` — you decide when to run the next phase
- `suggested` — next step added to task queue (default)
- `automatic` — phases chain automatically

**Extraction categories** (`processing.extraction.categories`):
The 8 categories your insights are classified into. Add or remove as needed.

### Dimension Overrides

The 8 dimensions (granularity, organization, linking, processing, navigation, maintenance, schema, automation) can be adjusted in config.yaml. See `knowledge/ops/derivation.md` for why each was chosen.

## Using /architect

`/arscontexta:architect` provides research-backed advice for system changes. It reads your derivation rationale, current config, and accumulated observations to recommend adjustments.

Use it when:
- Friction patterns accumulate despite manual fixes
- You want to add semantic search (qmd)
- Schema feels too heavy or too light
- Processing depth needs adjustment

## Feature Toggling

| Feature | config.yaml key | Default |
|---------|----------------|---------|
| Semantic search | `features.semantic-search` | false |
| Processing pipeline | `features.processing-pipeline` | true |
| Personality | `personality.enabled` | true |

See [[meta-skills]] for /architect details.
See [[troubleshooting]] for configuration issues.
