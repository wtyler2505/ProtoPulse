import os
import json
import argparse
from google import genai
from google.genai import types

def generate_boilerplate(client, parts_list, project_idea, lang="cpp"):
    """
    Generates C++ (Arduino) or MicroPython boilerplate code.
    It maps the specific parts provided to logical pins.
    """
    prompt = f"""
    You are an expert embedded systems engineer.
    The user wants to build: {project_idea}
    
    They have the following specific parts in their inventory:
    {json.dumps(parts_list, indent=2)}
    
    CRITICAL INSTRUCTIONS:
    1. Write a complete, compiling boilerplate script in {'C++ (Arduino)' if lang=='cpp' else 'MicroPython'}.
    2. Define all pins logically based on the parts provided (e.g., if ESP32, use GPIO numbers like 12, 13; if Arduino Uno, use D2, D3).
    3. Include setup() and loop() structures (or while True: for Python).
    4. Include comments explaining WHY those pins were chosen.
    5. Return ONLY the code inside ```{'cpp' if lang=='cpp' else 'python'} tags. No conversational text.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2
            )
        )
        import re
        match = re.search(r'```(?:cpp|python)\s*(.*?)\s*```', response.text, re.DOTALL)
        return match.group(1).strip() if match else response.text
    except Exception as e:
        print(f"Error generating code: {e}")
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    parser.add_argument("project")
    parser.add_argument("--lang", choices=['cpp', 'python'], default="cpp")
    parser.add_argument("--output", default="START_HERE.ino")
    args = parser.parse_args()
    
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    with open(args.manifest, 'r') as f:
        manifest = json.load(f)
        
    print(f"🧩 Scaffolding '{args.project}' using inventory parts...")
    
    # In a real scenario, this would filter for ONLY the parts needed for the project.
    # For now, we pass the top 5 most relevant items to avoid token limits.
    # We'll just grab controllers and actuators for scaffolding.
    
    relevant_parts = []
    for data in manifest.values():
        cat = data.get("primary_category", "")
        if cat in ["Logic_Control", "Actuators", "Sensing"]:
            relevant_parts.append({
                "part": data.get("manufacturer_part_number"),
                "specs": data.get("technical_specs")
            })
            if len(relevant_parts) >= 6: break
            
    code = generate_boilerplate(client, relevant_parts, args.project, args.lang)
    
    if code:
        with open(args.output, 'w') as f:
            f.write(code)
        print(f"✨ Scaffolded code saved to {args.output}")
    else:
        print("❌ Failed to generate code.")

if __name__ == "__main__":
    main()
