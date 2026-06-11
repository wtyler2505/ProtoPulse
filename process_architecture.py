import json
import os
from datetime import datetime

source_basename = "2026-04-18-e2e-architecture-tab-tested"
queue_path = "ops/queue/queue.json"

claims = [
    ("loading-state-panel-skeleton-shows-empty-text-before-content-appears", "Loading state panel-skeleton shows empty text before content appears", "E2E-019: Loading state showed panel-skeleton with empty text for ~3 seconds before content appeared. No loading spinner or 'Loading…' label was visible."),
    ("asset-library-flat-list-requires-category-dividers-for-12-plus-items", "Asset Library flat list requires category dividers for 12+ items", "E2E-020: Asset Library has 12 parts in categories but appear in a flat list with no dividers."),
    ("asset-library-category-numeric-badges-are-opaque-without-labels", "Asset Library category numeric badges are opaque without labels", "E2E-021: Asset Library shows numeric badges next to category icons but no labels until hover. Top reads 'A-Z 12 2 3 2 3 2'."),
    ("global-recent-assets-confuse-users-expecting-project-scoped-recents", "Global recent assets confuse users expecting project-scoped recents", "E2E-022: Recently Used (3) appears even on a fresh blank project - those are global recents not project recents."),
    ("generate-architecture-button-requires-api-key-state-awareness", "Generate Architecture button requires API key state awareness", "E2E-023: Generate Architecture button is the empty-state CTA but clicking will fail without API key. Should be disabled with hint."),
    ("test-ids-using-integer-ids-are-fragile-and-should-use-part-name-slugs", "Test IDs using integer IDs are fragile and should use part name slugs", "E2E-024: asset-item-11 testids by integer ID are fragile for tests. Prefer testid by part name slug."),
    ("asset-search-correctly-filters-across-mcu-sensor-and-power-categories-with-debounce", "Asset search correctly filters across MCU, sensor, and power categories with debounce", "E2E-076: Asset search 'esp' -> 4 results (correctly filters across MCU + sensor + power). Search debounce works."),
    ("tool-analyze-button-silently-fails-when-clicked-with-node-on-canvas", "Tool-analyze button silently fails when clicked with node on canvas", "E2E-078: tool-analyze button (Analyze design) does NOTHING visible when clicked with a node on canvas. No dialog, no panel update, no toast, no console error."),
    ("toolbar-mode-buttons-require-aria-pressed-state-for-screen-reader-accessibility", "Toolbar mode buttons require aria-pressed state for screen reader accessibility", "E2E-079: Tool buttons have aria-labels but no aria-pressed state - users with screen readers can't tell which mode is active (Select vs Pan)."),
    ("generate-architecture-empty-state-cta-lacks-follow-up-after-first-node-addition", "Generate Architecture empty state CTA lacks follow-up after first node addition", "E2E-080: Generate Architecture button disappears once you add the first node. No 'Generate from current state' follow-up."),
    ("node-labels-concatenating-category-and-name-without-separators-are-hard-to-read", "Node labels concatenating category and name without separators are hard to read", "E2E-081: Node label reads 'sensorBME280' - concatenated category+name with no separator. Should be 'BME280 (sensor)' or 'BME280'."),
    ("node-inspector-panel-provides-comprehensive-editing-for-labels-types-description-position-connections", "Node inspector panel provides comprehensive editing for labels, types, description, position, connections", "E2E-082: Node click opens node-inspector-panel with Label input, Type select, Description textarea, X/Y position inputs, Connections count, Delete button."),
    ("node-context-menu-offers-extensive-actions-like-validation-schematic-generation-and-json-export", "Node context menu offers extensive actions like validation, schematic generation, and JSON export", "E2E-083: Right-click on node opens context menu with Add Node / Paste / Select All / Zoom to Fit / Toggle Grid / Run Validation / Copy Summary / Copy JSON / Edit Component / Create Schematic Instance."),
    ("context-menu-leaves-shadow-dom-mount-with-empty-items", "Context menu leaves shadow DOM mount with empty items", "E2E-084: First context menu detected (6 empty items) shadow menu present in DOM but with no labels. Suggests duplicated menu/portal mount."),
    ("node-type-recategorization-requires-downstream-rule-validation", "Node type recategorization requires downstream rule validation", "E2E-085: 'Type: Sensor' select in inspector allows recategorization. If wrong category breaks downstream rules, validate at change."),
    ("numeric-x-y-position-inputs-should-support-unit-toggling-for-power-users", "Numeric X-Y position inputs should support unit toggling for power users", "E2E-086: X/Y position editable as number inputs. Add unit toggle (px/mm/grid)."),
    ("node-inspector-type-button-requires-aria-labels-for-screen-reader-accessibility", "Node inspector type button requires aria-labels for screen reader accessibility", "E2E-087: node-inspector-type button has no aria-label and value='' looks like a popover trigger but content opaque to screen reader."),
    ("context-menu-actions-require-real-pointer-events-for-e2e-testing-instead-of-synthetic-clicks", "Context menu actions require real pointer events for e2e testing instead of synthetic clicks", "E2E-088: Context menu Run Validation tested with synthetic click(); likely needs real pointer events.")
]

with open(queue_path, "r") as f:
    queue_data = json.load(f)

# Find the task to get next_claim_start
task = next(t for t in queue_data["tasks"] if t["id"] == source_basename)
claim_start = task.get("next_claim_start", 63)

task["status"] = "done"
task["completed"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

new_tasks = []
current_claim_idx = claim_start

for slug, title, desc in claims:
    claim_id = f"claim-{current_claim_idx:03d}"
    file_name = f"{source_basename}-{current_claim_idx:03d}.md"
    
    # Write the markdown file
    md_content = f"""---
claim: "{title}"
classification: closed
source_task: {source_basename}
semantic_neighbor: null
---

# Claim {current_claim_idx:03d}: {title}

Source: [[{source_basename}]]

## Reduce Notes

Extracted from {source_basename}. This is a CLOSED claim.

Rationale: {desc}

---

## Create

## connect

## revisit

## verify
"""
    with open(f"ops/queue/{file_name}", "w") as f_md:
        f_md.write(md_content)
        
    # Add to queue
    new_tasks.append({
        "id": claim_id,
        "type": "claim",
        "status": "pending",
        "target": title,
        "classification": "closed",
        "batch": source_basename,
        "file": file_name,
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "current_phase": "create",
        "completed_phases": []
    })
    
    current_claim_idx += 1

queue_data["tasks"].extend(new_tasks)

with open(queue_path, "w") as f:
    json.dump(queue_data, f, indent=2)

print(f"Created {len(claims)} claim files starting at {claim_start}.")
