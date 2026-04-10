# Breadboard Workflow Playbook

## Product Standard

Breadboard Lab should feel like one continuous maker workflow:

1. create or open a wiring canvas
2. place a starter part or a project-linked part
3. understand trust/readiness immediately
4. wire and inspect the board
5. get proactive coach help
6. run board health
7. transition cleanly into schematic, validation, or inventory work

## Preferred Implementation Order

### A. Surface before inventing

Before adding a new feature, check whether the capability already exists in:

- a pure lib helper
- a dialog that is mounted but under-signposted
- a child panel that accepts props not currently provided
- tests that already prove the logic exists

### B. Clarify provenance

Users should be able to tell what came from:

- starter shelf
- project shelf
- verified exact board
- generic draft
- coach plan
- schematic sync

### C. Strengthen readiness

Every Breadboard workflow should reinforce “can I build this and trust it?” through:

- stash status
- part trust labels
- board-health issues
- layout quality
- visible warnings on heuristic or risky states

### D. Keep view coherence

Breadboard is not allowed to feel detached from the rest of ProtoPulse.
If the fix changes meaning across views, add or update the handoff cues.

## UX Heuristics

Good Breadboard UI:

- teaches without lecturing
- distinguishes exact from approximate
- helps users recover from risky wiring states
- stays calm under sparse-board and crowded-board conditions
- prioritizes the next practical move

Bad Breadboard UI:

- makes users infer the workflow model
- hides high-value systems like audit or stash truth
- looks realistic but does not improve understanding
- exposes raw issue data without telling the user what to do next

