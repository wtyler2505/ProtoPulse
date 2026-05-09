---
description: PP-NLM live aliases, tags, manifests, and skills drifted apart during notebook consolidation.
category: drift
status: pending
observed: 2026-05-09
related_notes:
  - "[[methodology]]"
---

# PP-NLM live aliases, tags, manifests, and skills drifted apart during notebook consolidation

The live NotebookLM aliases now point most ProtoPulse aliases at two consolidated hubs, but the local operator and router skills still describe the older 9 Tier-1 plus Tier-2 feature topology. `~/.claude/state/pp-nlm/notebook-manifest.json` still maps old aliases to old notebook IDs, while live `nlm alias get` resolves those aliases to the new Core and Hardware hubs.

The source manifest is also still keyed by the old aliases and does not contain a `pp-core` entry. This means idempotency checks can no longer be trusted as a faithful reflection of the live NotebookLM topology.

Resolution: update the PP-NLM skills, manifests, and write helpers after Tyler approves the consolidated two-hub topology. Treat this as a system drift finding, not a completed fix.
