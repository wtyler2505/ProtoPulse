import json
import os
from datetime import datetime

timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
source_basename = "2026-04-18-e2e-dashboard-meticulous"
source_file = "ops/queue/archive/2026-04-18-2026-04-18-e2e-dashboard-meticulous/2026-04-18-e2e-dashboard-meticulous.md"

claims = [
    {
        "id": "081",
        "title": "Dashboard Architecture card navigation functions correctly with authentic DevTools click events",
        "type": "claim",
        "classification": "closed",
        "rationale": "Validates that the navigation fix (E2E-018) works under real testing conditions."
    },
    {
        "id": "082",
        "title": "Instantaneous tab navigation without visual transitions fails to orient users to context changes",
        "type": "claim",
        "classification": "closed",
        "rationale": "Captures the UX friction (E2E-202) where instant state changes without animation cause disorientation."
    },
    {
        "id": "083",
        "title": "Icon-only buttons with proper aria-labels remain inaccessible to sighted users without on-hover tooltips",
        "type": "claim",
        "classification": "closed",
        "rationale": "Highlights the gap between screen-reader accessibility and visual accessibility (E2E-203)."
    },
    {
        "id": "084",
        "title": "Displaying the same asset in Favorites Recently Used and main lists creates excessive visual clutter",
        "type": "claim",
        "classification": "closed",
        "rationale": "Identifies the tension between quick access and interface noise (E2E-204, E2E-207)."
    },
    {
        "id": "085",
        "title": "Favorite toggle buttons require explicit visual state indicators to convey current status",
        "type": "claim",
        "classification": "closed",
        "rationale": "Captures a fundamental UX requirement for stateful toggles (E2E-205)."
    },
    {
        "id": "086",
        "title": "Asset Library favorites section correctly persists and updates dynamically",
        "type": "claim",
        "classification": "closed",
        "rationale": "Validates the real-time functionality of the favorites list (E2E-206)."
    },
    {
        "id": "087",
        "title": "Toggle button aria-labels must dynamically reflect their current state for screen-reader accessibility",
        "type": "claim",
        "classification": "closed",
        "rationale": "Addresses the a11y bug (E2E-208) where static aria-labels on stateful buttons cause confusion."
    },
    {
        "id": "088",
        "title": "Implementing a toggle to hide already-favorited items from the main list reduces asset library duplication",
        "type": "claim",
        "classification": "closed",
        "rationale": "Implementation idea to resolve the visual clutter tension (E2E-209)."
    },
    {
        "id": "089",
        "title": "Search filters that ignore Favorites and Recents sections create confusing UX inconsistencies",
        "type": "claim",
        "classification": "closed",
        "rationale": "Documents the bug (E2E-210) where partial filtering breaks the user's mental model of search."
    },
    {
        "id": "090",
        "title": "Search inputs without result count indicators create silent confusion when yielding empty results",
        "type": "claim",
        "classification": "closed",
        "rationale": "Captures the UX friction of ambiguous search states (E2E-211)."
    },
    {
        "id": "091",
        "title": "Search fields without dedicated clear buttons force awkward text selection workflows",
        "type": "claim",
        "classification": "closed",
        "rationale": "Identifies a missing standard UI control that degrades usability (E2E-212)."
    },
    {
        "id": "092",
        "title": "Automated text clearing on React-controlled inputs requires explicit Backspace sequences for reliable E2E testing",
        "type": "claim",
        "classification": "closed",
        "rationale": "Methodology learning for Playwright testing against React state (E2E-213)."
    },
    {
        "id": "093",
        "title": "Combining category filters with active text search creates visual ambiguity without explicit intersection logic",
        "type": "claim",
        "classification": "closed",
        "rationale": "Documents the UX issue of unpredictable multi-filter states (E2E-214)."
    },
    {
        "id": "094",
        "title": "Category filter buttons should display numeric count badges to set user expectations before interaction",
        "type": "claim",
        "classification": "closed",
        "rationale": "Implementation idea for improving filter discoverability (E2E-215)."
    },
    {
        "id": "095",
        "title": "Active filters require persistent visual distinctiveness beyond transient keyboard focus styles",
        "type": "claim",
        "classification": "closed",
        "rationale": "UX requirement to ensure state visibility across all interaction modes (E2E-216)."
    }
]

# Create files
for c in claims:
    filename = f"ops/queue/{source_basename}-{c['id']}.md"
    content = f"""---
claim: "{c['title']}"
classification: {c['classification']}
source_task: {source_basename}
semantic_neighbor: null
---

# Claim {c['id']}: {c['title']}

Source: [[{os.path.basename(source_file)}]]

## Reduce Notes

Extracted from {source_basename}. This is a {c['classification'].upper()} claim.

Rationale: {c['rationale']}

Semantic neighbor: null

---

## Create
(to be filled by create phase)

## connect
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
"""
    with open(filename, 'w') as f:
        f.write(content)

# Update queue.json
with open('ops/queue/queue.json', 'r') as f:
    queue = json.load(f)

# Mark source task as done
for task in queue['tasks']:
    if task['id'] == source_basename:
        task['status'] = 'done'
        task['completed'] = timestamp

# Add new tasks
for c in claims:
    queue['tasks'].append({
        "id": f"claim-{c['id']}",
        "type": "claim",
        "status": "pending",
        "target": c['title'],
        "classification": c['classification'],
        "batch": source_basename,
        "file": f"{source_basename}-{c['id']}.md",
        "created": timestamp,
        "current_phase": "create",
        "completed_phases": []
    })

with open('ops/queue/queue.json', 'w') as f:
    json.dump(queue, f, indent=2)

print("Generated files and updated queue.json")
