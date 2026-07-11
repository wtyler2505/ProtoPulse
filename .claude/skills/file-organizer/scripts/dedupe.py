import os
import hashlib
import json
import argparse
from collections import defaultdict

def get_size(path):
    return os.path.getsize(path)

def get_chunk_hash(path, chunk_size=1024 * 1024):
    hasher = hashlib.md5()
    try:
        with open(path, 'rb') as f:
            chunk = f.read(chunk_size)
            if not chunk: return None
            hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return None

def get_full_hash(path):
    hasher = hashlib.sha256()
    try:
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return None

def find_duplicates(directory, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = {'.git', 'node_modules', 'venv', '__pycache__', '.venv'}
    
    print("Stage 1: Grouping by file size...")
    by_size = defaultdict(list)
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            path = os.path.join(root, f)
            if os.path.islink(path): continue
            try:
                size = get_size(path)
                if size > 0: # Ignore empty files
                    by_size[size].append(path)
            except OSError:
                pass

    potential_dupes = {k: v for k, v in by_size.items() if len(v) > 1}
    
    print(f"Stage 2: Partial hashing {sum(len(v) for v in potential_dupes.values())} files...")
    by_chunk_hash = defaultdict(list)
    for size, paths in potential_dupes.items():
        for path in paths:
            chash = get_chunk_hash(path)
            if chash:
                by_chunk_hash[(size, chash)].append(path)

    potential_dupes = {k: v for k, v in by_chunk_hash.items() if len(v) > 1}
    
    print(f"Stage 3: Full hashing {sum(len(v) for v in potential_dupes.values())} files...")
    exact_dupes = defaultdict(list)
    for (size, chash), paths in potential_dupes.items():
        for path in paths:
            fhash = get_full_hash(path)
            if fhash:
                exact_dupes[fhash].append(path)

    results = [paths for paths in exact_dupes.values() if len(paths) > 1]
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tiered file deduplication.")
    parser.add_argument("directory", help="Directory to scan")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    dupes = find_duplicates(args.directory)
    
    if args.json:
        print(json.dumps(dupes, indent=2))
    else:
        if not dupes:
            print("No duplicates found.")
        for i, group in enumerate(dupes, 1):
            print(f"\\nDuplicate Group {i}:")
            for path in group:
                print(f"  - {path}")
