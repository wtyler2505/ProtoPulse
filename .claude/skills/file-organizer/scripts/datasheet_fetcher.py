import os
import json
import requests
import argparse
import time
import re
from google import genai
from google.genai import types

def find_datasheet_url(client, part_number):
    """Uses Gemini Search to find the best documentation link for a part."""
    prompt = f"""
    Research the electronic component: {part_number}.
    Find the official manufacturer datasheet or technical product page.
    
    CRITICAL: 
    1. Prefer a direct PDF link.
    2. If no direct PDF is found, provide the official manufacturer product landing page.
    3. Return your final choice at the very end of your response between [URL] and [/URL] tags.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
            )
        )
        
        # Extract URL between tags
        match = re.search(r'\[URL\]\s*(.*?)\s*\[/URL\]', response.text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        # Fallback to general regex if tags missing
        urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', response.text)
        return urls[0] if urls else None
    except Exception as e:
        print(f"Error finding URL for {part_number}: {e}")
        return None

def download_pdf(url, dest_path):
    try:
        # Don't download if it's not a PDF (just save the URL in a text file)
        if not url.lower().endswith('.pdf'):
            with open(dest_path.replace('.pdf', '.txt'), 'w') as f:
                f.write(f"Product Page: {url}")
            return True
            
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=15, stream=True)
        if response.status_code == 200:
            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
    except Exception:
        pass
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    parser.add_argument("output_dir")
    args = parser.parse_args()
    
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    with open(args.manifest, 'r') as f:
        manifest = json.load(f)
        
    parts = set()
    for data in manifest.values():
        if isinstance(data, list): data = data[0]
        part = data.get("manufacturer_part_number")
        if part and part.lower() != "unknown" and len(part) > 2:
            parts.add(part)
            
    print(f"📂 Hunting docs for {len(parts)} unique parts...")
    os.makedirs(args.output_dir, exist_ok=True)
    
    for part in sorted(parts):
        safe_name = "".join([c if c.isalnum() else "-" for c in part]).lower()
        dest_path = os.path.join(args.output_dir, f"{safe_name}.pdf")
        
        if os.path.exists(dest_path) or os.path.exists(dest_path.replace('.pdf', '.txt')):
            continue
            
        print(f"🔍 Researching: {part}...")
        url = find_datasheet_url(client, part)
        
        if url:
            print(f"   => Found: {url}")
            if download_pdf(url, dest_path):
                print(f"   ✨ Doc Saved.")
            else:
                print(f"   ❌ Download Failed.")
        else:
            print(f"   🤷 No link found.")
            
        time.sleep(1)

if __name__ == "__main__":
    main()
