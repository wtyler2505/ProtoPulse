import os
import json
import argparse
from google import genai
from google.genai import types

def analyze_inventory(client, image_path):
    try:
        mime_type = "image/jpeg"
        if image_path.lower().endswith(".heic"):
            mime_type = "image/heic"
        elif image_path.lower().endswith(".png"):
            mime_type = "image/png"

        with open(image_path, "rb") as f:
            image_data = f.read()

        prompt = """
        You are a senior hardware auditor. Create a professional INVENTORY entry for this photo.
        Identify:
        1. 'manufacturer_part_number': (e.g. Songle SRD-05VDC-SL-C)
        2. 'primary_category': (Actuators, Sensing, Connectivity, Logic_Control, Power, Mechanical)
        3. 'technical_specs': (e.g. 5V Relay, 10A 250VAC)
        4. 'quantity_estimate': (How many units are visible?)
        5. 'condition': (New, Used, Prototype, Damaged)
        6. 'ghost_categories': (Secondary categories if multiple objects exist)

        Return ONLY a JSON object.
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                prompt,
                types.Part.from_bytes(data=image_data, mime_type=mime_type)
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        return json.loads(response.text)
    except Exception:
        return None

def process_all(directory, api_key):
    client = genai.Client(api_key=api_key)
    manifest = {}
    extensions = ('.jpg', '.jpeg', '.png', '.heic')
    files = [f for f in os.listdir(directory) if f.lower().endswith(extensions)]
    
    total = len(files)
    print(f"📦 Starting Inventory Audit of {total} files...")
    
    for i, filename in enumerate(files):
        path = os.path.join(directory, filename)
        result = analyze_inventory(client, path)
        if result:
            manifest[filename] = result
        
        # Progress reporting
        if (i + 1) % 10 == 0 or (i + 1) == total:
            percent = int(((i + 1) / total) * 100)
            print(f"📊 Progress: {percent}% ({i+1}/{total} files audited)")
            # Intermediate save to prevent data loss
            with open("inventory_manifest.json", "w") as f:
                json.dump(manifest, f, indent=2)

    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dir")
    args = parser.parse_args()
    process_all(args.dir, os.getenv("GEMINI_API_KEY"))
