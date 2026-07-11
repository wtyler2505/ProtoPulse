import os
import json
import argparse
import base64
from pathlib import Path
from google import genai
from google.genai import types

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_image(client, image_path):
    """
    Sends an image to Gemini Vision to identify ALL hardware components.
    Returns a structured classification JSON.
    """
    try:
        mime_type = "image/jpeg"
        if image_path.lower().endswith(".heic"):
            mime_type = "image/heic"
        elif image_path.lower().endswith(".png"):
            mime_type = "image/png"

        with open(image_path, "rb") as f:
            image_data = f.read()

        prompt = """
        You are a senior hardware and robotics engineer. Analyze this photo from a parts list.
        Identify ALL significant electronic or mechanical components.
        
        Rules:
        1. Choose a 'primary_anchor' category (the main subject).
        2. Identify 'ghost_categories' for other secondary objects in the frame.
        3. Identify specific 'part_numbers' or 'specs' visible (e.g. ESP32, 12V 200RPM).
        4. Provide a 'semantic_filename' based on contents (e.g. esp32-wroom-with-l298n-driver).
        
        Return ONLY a JSON object with this structure:
        {
          "primary_anchor": "Microcontrollers",
          "ghost_categories": ["Motor_Drivers", "Wiring"],
          "detected_items": ["ESP32-WROOM", "L298N Driver", "JST-XH Connector"],
          "technical_description": "ESP32 mounted on a breakout board with an L298N H-bridge motor driver.",
          "suggested_filename": "esp32-l298n-breakout"
        }
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
    except Exception as e:
        print(f"Error analyzing {image_path}: {e}")
        return None

def process_directory(directory, api_key):
    client = genai.Client(api_key=api_key)
    results = {}
    
    extensions = ('.jpg', '.jpeg', '.png', '.heic')
    files = [f for f in os.listdir(directory) if f.lower().endswith(extensions)]
    
    print(f"👁️ Starting Hyper-Vision Scan of {len(files)} files...")
    
    for i, filename in enumerate(files):
        path = os.path.join(directory, filename)
        print(f"[{i+1}/{len(files)}] Analyzing {filename}...")
        
        analysis = analyze_image(client, path)
        if analysis:
            results[filename] = analysis
            
    # Save a master analysis log
    with open("semantic_manifest.json", "w") as f:
        json.dump(results, f, indent=2)
        
    print("\n✅ Hyper-Vision Scan Complete. Manifest saved to 'semantic_manifest.json'.")
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hyper-Vision Semantic Hardware Analysis")
    parser.add_argument("directory", help="Target directory")
    parser.add_argument("--key", help="Gemini API Key", default=os.getenv("GEMINI_API_KEY"))
    args = parser.parse_args()
    
    if not args.key:
        print("Error: GEMINI_API_KEY environment variable not set.")
        exit(1)
        
    process_directory(args.directory, args.key)
