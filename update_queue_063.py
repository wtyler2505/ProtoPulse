import json
import datetime

with open('ops/queue/queue.json', 'r') as f:
    data = json.load(f)

# Find the task and mark it done
for task in data['tasks']:
    if task.get('id') == '2026-04-18-e2e-bom-templates-meticulous':
        task['status'] = 'done'
        task['completed'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

# Append the new task
new_task = {
    "id": "claim-063",
    "type": "claim",
    "status": "pending",
    "target": "empty BOM template view should provide sample starter templates",
    "classification": "closed",
    "batch": "2026-04-18-e2e-bom-templates-meticulous",
    "file": "2026-04-18-e2e-bom-templates-meticulous-063.md",
    "created": datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    "current_phase": "create",
    "completed_phases": []
}
data['tasks'].append(new_task)

with open('ops/queue/queue.json', 'w') as f:
    json.dump(data, f, indent=2)
