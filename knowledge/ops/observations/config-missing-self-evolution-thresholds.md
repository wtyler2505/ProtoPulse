---
summary: config.yaml has no self_evolution section despite self-evolution being an active block in the derivation manifest
category: drift
status: implemented
implemented_in: ops/config.yaml
observed: 2026-03-13
related_notes: ["[[derivation-rationale]]", "[[methodology]]"]
---
# config.yaml is missing self_evolution observation and tension thresholds

**Drift type:** coverage-gap
**Methodology note:** derivation-manifest.md (active_blocks includes self-evolution)
**System element:** config.yaml — no self_evolution section
**Discrepancy:** The derivation manifest lists self-evolution as an active block, and the rethink skill references `self_evolution.observation_threshold` and `self_evolution.tension_threshold` in config.yaml. But config.yaml has no such section. The skill falls back to defaults (10 observations, 5 tensions) but the configuration is implicit rather than explicit.

Resolution: add self_evolution section to config.yaml with explicit thresholds
