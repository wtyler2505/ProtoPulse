import os
import json
import argparse
from pathlib import Path

QUEUE_FILE = "20_Ops/queue.json"

def init_queue(directory):
    queue_path = os.path.join(directory, QUEUE_FILE)
    if os.path.exists(queue_path):
        return
        
    # Find all media files that need processing
    extensions = ('.jpg', '.jpeg', '.png', '.heic')
    files = []
    # Recursively find all images in the entire project directory
    for root, dirs, filenames in os.walk(directory):
        if any(no_go in root for no_go in [".git", "node_modules", "20_Ops", "99_Meta"]):
            continue
        for f in filenames:
            if f.lower().endswith(extensions):
                files.append({
                    "filename": f,
                    "source_path": os.path.join(root, f),
                    "phase": "RECORD",
                    "attempts": 0,
                    "error_log": []
                })
                
    # Ensure Ops directory exists
    os.makedirs(os.path.dirname(queue_path), exist_ok=True)
    with open(queue_path, 'w') as f:
        json.dump(files, f, indent=2)
    print(f"✅ Initialized queue with {len(files)} items in Phase: RECORD.")

def get_next_task(directory, target_phase):
    queue_path = os.path.join(directory, QUEUE_FILE)
    with open(queue_path, 'r') as f:
        queue = json.load(f)
        
    for task in queue:
        if task["phase"] == target_phase and task["attempts"] < 3:
            return task
    return None

def update_task(directory, updated_task):
    queue_path = os.path.join(directory, QUEUE_FILE)
    with open(queue_path, 'r') as f:
        queue = json.load(f)
        
    for i, task in enumerate(queue):
        if task["filename"] == updated_task["filename"]:
            queue[i] = updated_task
            break
            
    # Ensure Ops directory exists
    os.makedirs(os.path.dirname(queue_path), exist_ok=True)
    with open(queue_path, 'w') as f:
        json.dump(queue, f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    parser.add_argument("--init", action="store_true")
    args = parser.parse_args()
    
    if args.init:
        init_queue(args.directory)
