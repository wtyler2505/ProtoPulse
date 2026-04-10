# Breadboard Workflow Playbook

## Product Standard

Breadboard Lab should feel like one continuous maker workflow:

1. create or open a wiring canvas
2. place a starter part or a project-linked part
3. understand trust and readiness immediately
4. wire and inspect the board
5. get proactive coach help
6. run board health
7. transition cleanly into schematic, validation, or inventory work

## Preferred Implementation Order

### Surface before inventing

Before adding a new feature, check whether the capability already exists in:

- a pure library helper
- a mounted but under-signposted dialog or panel
- a child component that already accepts the prop you need
- tests that prove the logic already exists

### Clarify provenance

Users should be able to tell what came from:

- starter shelf
- project shelf
- verified exact part
- generic draft
- coach plan
- schematic sync

### Strengthen readiness

Every Breadboard workflow should reinforce “can I build this and trust it?” through:

- stash status
- part trust labels
- board-health issues
- layout quality
- visible warnings on heuristic or risky states

### Keep cross-view coherence

Breadboard cannot feel detached from ProtoPulse.
If the fix changes meaning across views, add or update handoff cues.
