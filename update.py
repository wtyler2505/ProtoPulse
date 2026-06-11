import json
from datetime import datetime, timezone

with open("ops/queue/queue.json", "r") as f:
    data = json.load(f)

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

for task in data["tasks"]:
    if task.get("id") == "2026-04-18-e2e-comments-design-review-meticulous":
        task["status"] = "done"
        task["completed"] = timestamp

data["tasks"].append({
    "id": "claim-081",
    "type": "claim",
    "status": "pending",
    "target": "anchoring comments to specific design objects prevents context loss during design review",
    "classification": "closed",
    "batch": "2026-04-18-e2e-comments-design-review-meticulous",
    "file": "2026-04-18-e2e-comments-design-review-meticulous-081.md",
    "created": timestamp,
    "current_phase": "create",
    "completed_phases": []
})

with open("ops/queue/queue.json", "w") as f:
    json.dump(data, f, indent=2)
