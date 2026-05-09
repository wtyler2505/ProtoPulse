---
description: PP-NLM live aliases, tags, manifests, and skills drifted apart during notebook consolidation.
category: drift
status: resolved
observed: 2026-05-09
related_notes:
  - "[[methodology]]"
---

# PP-NLM live aliases, tags, manifests, and skills drifted apart during notebook consolidation

The live NotebookLM aliases now point most ProtoPulse aliases at two consolidated hubs, but the local operator and router skills still describe the older 9 Tier-1 plus Tier-2 feature topology. `~/.claude/state/pp-nlm/notebook-manifest.json` still maps old aliases to old notebook IDs, while live `nlm alias get` resolves those aliases to the new Core and Hardware hubs.

The source manifest is also still keyed by the old aliases and does not contain a `pp-core` entry. This means idempotency checks can no longer be trusted as a faithful reflection of the live NotebookLM topology.

Resolution: Tyler approved the consolidated topology on 2026-05-09. The PP-NLM skills, docs, local notebook manifest, source manifest, safe write helper, health script, logging locks, chat config gate, and consolidation-pack builder were updated in the follow-up implementation pass.
