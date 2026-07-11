import os
import json
import time
import subprocess
import argparse
import re
import sys
from datetime import datetime
from google import genai
from google.genai import types

# Industrial-grade logging
def log(msg):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}")
    sys.stdout.flush()

def get_all_exif_times(directory):
    extensions = ('.jpg', '.jpeg', '.png', '.heic')
    files = [os.path.join(directory, f) for f in os.listdir(directory) if f.lower().endswith(extensions)]
    times = {}
    try:
        cmd = ['exiftool', '-DateTimeOriginal', '-s3', '-T'] + files
        res = subprocess.run(cmd, capture_output=True, text=True)
        lines = res.stdout.strip().split('\n')
        for i, line in enumerate(lines):
            if i < len(files):
                fname = os.path.basename(files[i])
                if line.strip() and line != '-':
                    try:
                        times[fname] = datetime.strptime(line.strip(), '%Y:%m:%d %H:%M:%S').timestamp()
                    except: times[fname] = os.path.getmtime(files[i])
                else: times[fname] = os.path.getmtime(files[i])
    except:
        for f in files: times[os.path.basename(f)] = os.path.getmtime(f)
    return times

def analyze_with_retry(client, parts, context_history, temp_dir, model_name="gemini-2.5-pro"):
    """Implements exponential backoff and tiered model fallback."""
    recent_items = ", ".join(context_history[-5:]) if context_history else "None"
    prompt = f"""
    FORENSIC HARDWARE AUDIT.
    Identify: Manufacturer, Part Number, Category, Specs.
    Context: Last found items: [{recent_items}].
    If unknown, use Google Search tool to verify. 
    Return JSON in ```json ``` tags.
    """
    
    payload = [prompt] + parts
    
    for attempt in range(3): # 3 Retries per cluster
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=payload,
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}] if "pro" in model_name else [],
                    temperature=0.1
                )
            )
            match = re.search(r'```json\s*(.*?)\s*```', response.text, re.DOTALL)
            result = json.loads(match.group(1)) if match else json.loads(re.search(r'\{.*\}', response.text, re.DOTALL).group(0))
            # Direct robustness fix in the engine
            if isinstance(result, list) and len(result) > 0:
                result = result[0]
            return result
        except Exception as e:
            wait = (attempt + 1) * 5
            log(f"⚠️ Attempt {attempt+1} failed ({model_name}): {e}. Retrying in {wait}s...")
            time.sleep(wait)
            
    # Fallback to Flash if Pro is failing
    if model_name == "gemini-2.5-pro":
        log(f"📉 Pro failing. Falling back to Fast Vision (Flash)...")
        return analyze_with_retry(client, parts, context_history, temp_dir, model_name="gemini-2.0-flash")
    
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    args = parser.parse_args()
    
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    meta_dir = os.path.join(args.directory, "99_Meta")
    manifest_path = os.path.join(meta_dir, "deep_inventory_manifest.json")
    blacklist_path = os.path.join(meta_dir, ".scan_blacklist")
    temp_dir = os.path.join(args.directory, ".temp_vision")
    os.makedirs(temp_dir, exist_ok=True)
    os.makedirs(meta_dir, exist_ok=True)

    # Load State
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as f: manifest = json.load(f)
    
    blacklist = set()
    if os.path.exists(blacklist_path):
        with open(blacklist_path, 'r') as f: blacklist = set(f.read().splitlines())

    log(f"🚀 RELENTLESS ENGINE START. Progress: {len(manifest)}/212 files.")
    
    all_times = get_all_exif_times(args.directory)
    file_times = sorted([(n, os.path.join(args.directory, n), t) for n, t in all_times.items()], key=lambda x: x[2])
    
    # Grouping
    groups = []
    curr = []
    for f, p, t in file_times:
        if not curr or t - curr[-1][2] <= 60: curr.append((f, p, t))
        else: groups.append(curr); curr = [(f, p, t)]
    if curr: groups.append(curr)

    context_history = [v.get("primary_category", "Unknown") for v in manifest.values()]

    for i, group in enumerate(groups):
        filenames = [g[0] for g in group]
        if all(f in manifest or f in blacklist for f in filenames): continue
        
        log(f"🔍 Analyzing Cluster {i+1}/{len(groups)}: {', '.join(filenames)}")
        
        parts = []
        for f, p, t in group:
            try:
                mime = "image/heic" if f.lower().endswith(".heic") else "image/jpeg"
                with open(p, "rb") as img_file:
                    parts.append(types.Part.from_bytes(data=img_file.read(), mime_type=mime))
            except: continue

        result = analyze_with_retry(client, parts, context_history, temp_dir)
        
        if result:
            log(f"   ✅ Verified: {result.get('manufacturer_part_number')}")
            for f in filenames: manifest[f] = result
            context_history.append(result.get("primary_category", "Unknown"))
        else:
            log(f"   ❌ Cluster {i+1} failed all retries. Blacklisting.")
            for f in filenames: blacklist.add(f)
            with open(blacklist_path, 'a') as f: f.write("\n".join(filenames) + "\n")

        # Atomic Save
        with open(manifest_path, 'w') as f: json.dump(manifest, f, indent=2)
        time.sleep(1)

    log("🏁 RELENTLESS ENGINE FINISHED.")

if __name__ == "__main__":
    main()
