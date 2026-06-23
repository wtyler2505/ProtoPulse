import os
import json
import shutil
import argparse
from datetime import datetime

UNDO_FILE = ".organizer-undo.json"

def record_move(source, destination, root_dir="."):
    undo_path = os.path.join(root_dir, UNDO_FILE)
    log = []
    if os.path.exists(undo_path):
        with open(undo_path, 'r') as f:
            try:
                log = json.load(f)
            except json.JSONDecodeError:
                pass
    
    log.append({
        "timestamp": datetime.now().isoformat(),
        "original_path": os.path.abspath(source),
        "new_path": os.path.abspath(destination)
    })
    
    with open(undo_path, 'w') as f:
        json.dump(log, f, indent=2)

def execute_rollback(root_dir="."):
    undo_path = os.path.join(root_dir, UNDO_FILE)
    if not os.path.exists(undo_path):
        print("No undo log found.")
        return
        
    with open(undo_path, 'r') as f:
        log = json.load(f)
        
    if not log:
        print("Undo log is empty.")
        return
        
    print(f"Rolling back {len(log)} file movements...")
    # Rollback in reverse order to handle chained moves gracefully
    for entry in reversed(log):
        original = entry["original_path"]
        current = entry["new_path"]
        
        if os.path.exists(current):
            os.makedirs(os.path.dirname(original), exist_ok=True)
            shutil.move(current, original)
            print(f"Reverted: {os.path.basename(current)} -> {os.path.dirname(original)}")
        else:
            print(f"Warning: Could not find {current} to revert.")
            
    # Clear the log after successful rollback
    os.remove(undo_path)
    print("Rollback complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage file organization state and rollbacks.")
    parser.add_argument("--rollback", action="store_true", help="Execute rollback based on undo log")
    parser.add_argument("--dir", default=".", help="Root directory containing the undo log")
    args = parser.parse_args()
    
    if args.rollback:
        execute_rollback(args.dir)
    else:
        print("Use --rollback to revert changes.")