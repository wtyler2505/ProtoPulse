import os
import json
import time
import argparse
import sys
import subprocess
import re
from google import genai
from google.genai import types

# Import our existing forensic and manager logic
sys.path.append("/home/wtyler/.gemini/skills/file-organizer/scripts")
from pipeline_manager import get_next_task, update_task
from deep_inventory_engine import analyze_with_retry
from datasheet_fetcher import find_datasheet_url, download_pdf

def get_normalized_metadata(metadata):
    """Fuzzy-matches keys to ensure we get the data regardless of AI casing/spacing."""
    if isinstance(metadata, list) and len(metadata) > 0:
        metadata = metadata[0]
    
    if not isinstance(metadata, dict):
        return {}

    # Lowercase all keys for easier matching
    lowered = {str(k).lower().replace("_", " ").replace("-", " ").strip(): v for k, v in metadata.items()}
    
    def find_val(keywords):
        for k, v in lowered.items():
            # Standard loop to avoid scoping issues with any() in some environments
            for kw in keywords:
                if kw in k:
                    return v
        return None

    norm = {
        "part_number": find_val(["part number", "model", "mfr part", "manufacturer part", "partno", "part"]) or "unknown",
        "category": find_val(["category", "class", "type", "primary category"]) or "Uncategorized",
        "specs": find_val(["specs", "technical", "description", "details"]) or "No specs found",
        "qty": find_val(["quantity", "qty", "count"]) or 1
    }
    
    # Final cleanup of category for filesystem safety
    norm["category"] = str(norm["category"]).replace(" ", "_").replace("/", "-")
    return norm

def trigger_post_reduce_hooks(directory, task, client):
    """Reflexes that fire immediately after a part is identified."""
    norm = get_normalized_metadata(task.get("metadata", {}))
    part = str(norm["part_number"])
    
    if not part or part.lower() == "unknown":
        return

    print(f"   🎣 Hook: Insta-Reference (Hunting for {part} datasheet...)")
    ds_dir = os.path.join(directory, "10_Atlas/Datasheets")
    os.makedirs(ds_dir, exist_ok=True)
    safe_name = "".join([c if c.isalnum() else "-" for c in part]).lower()
    dest_path = os.path.join(ds_dir, f"{safe_name}.pdf")
    
    if not os.path.exists(dest_path) and not os.path.exists(dest_path.replace(".pdf", ".txt")):
        url = find_datasheet_url(client, part)
        if url:
            download_pdf(url, dest_path)
            print(f"      ✨ Doc Processed.")

    # Safety Tripwire Logic
    if any(k in part.lower() for k in ["esp", "nano", "mega", "raspberry"]):
        print(f"   🎣 Hook: Safety Tripwire (Voltage Check)")
        with open(os.path.join(directory, "20_Ops/URGENT_ALERTS.md"), "a") as f:
            f.write(f"- ⚠️ **{part}** detected. Verified Specs: {norm['specs']}\n")

def trigger_post_reflect_hooks(directory, task):
    """Reflexes that fire after a file is moved and renamed."""
    queue_path = os.path.join(directory, "20_Ops/queue.json")
    try:
        with open(queue_path, "r") as f:
            queue = json.load(f)
        done_count = sum(1 for t in queue if t["phase"] == "DONE")
        
        if done_count > 0 and done_count % 5 == 0:
            print(f"   🎣 Hook: Visual Pulse (Updating Gallery...)")
            gallery_path = os.path.join(directory, "20_Ops/GALLERY_PREVIEW.jpg")
            done_files = [t["final_path"] for t in queue if t["phase"] == "DONE" and "final_path" in t][-16:]
            if done_files:
                subprocess.run(['montage'] + done_files + ['-tile', '4x4', '-geometry', '200x200+2+2', gallery_path], check=True)
    except Exception as e:
        print(f"Hook Error (Visual Pulse): {e}")

def process_phase_reduce(directory, client, task):
    print(f"🕵️ REDUCING: {task['filename']}")
    mime = "image/heic" if task['filename'].lower().endswith(".heic") else "image/jpeg"
    try:
        with open(task['source_path'], "rb") as f:
            parts = [types.Part.from_bytes(data=f.read(), mime_type=mime)]
        
        result = analyze_with_retry(client, parts, [], "/tmp")
        if result:
            task["metadata"] = result
            task["phase"] = "REFLECT"
            task["attempts"] = 0
            update_task(directory, task)
            trigger_post_reduce_hooks(directory, task, client)
        else:
            task["attempts"] += 1
            update_task(directory, task)
    except Exception as e:
        print(f"Reduction error: {e}")
        task["attempts"] += 1
        update_task(directory, task)
    return task

def process_phase_reflect(directory, task):
    print(f"🗺️ REFLECTING: {task['filename']}")
    norm = get_normalized_metadata(task.get("metadata", {}))
    
    category = norm["category"]
    dest_dir = os.path.join(directory, "10_Notes", category)
    os.makedirs(dest_dir, exist_ok=True)
    
    part_no = norm["part_number"]
    safe_name = "".join([c if c.isalnum() else "-" for c in str(part_no)]).lower()
    ext = os.path.splitext(task['filename'])[1].lower()
    
    final_path = os.path.join(dest_dir, f"{safe_name}{ext}")
    counter = 1
    while os.path.exists(final_path):
        final_path = os.path.join(dest_dir, f"{safe_name}-{counter:02d}{ext}")
        counter += 1
        
    try:
        os.rename(task['source_path'], final_path)
        task["final_path"] = final_path
        task["phase"] = "DONE"
        update_task(directory, task)
        trigger_post_reflect_hooks(directory, task)
    except Exception as e:
        print(f"Reflection error: {e}")
    return task

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    parser.add_argument("--loop", action="store_true")
    args = parser.parse_args()
    
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    while True:
        task = get_next_task(args.directory, "RECORD")
        if not task:
            task = get_next_task(args.directory, "REDUCE")
            
        if task:
            if task["phase"] == "RECORD":
                task["phase"] = "REDUCE"
                update_task(args.directory, task)
            process_phase_reduce(args.directory, client, task)
            continue
            
        task = get_next_task(args.directory, "REFLECT")
        if task:
            process_phase_reflect(args.directory, task)
            continue
            
        if not args.loop: break
        time.sleep(2)

if __name__ == "__main__":
    main()
