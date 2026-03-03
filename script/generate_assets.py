#!/usr/bin/env python3
import os
import sys
import argparse
from google import genai

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--n", type=int, default=1)
    parser.add_argument("--aspect_ratio", default="1:1")
    parser.add_argument("--name", default="asset")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set")
        sys.exit(1)

    try:
        client = genai.Client(api_key=api_key)
        print(f"Generating {args.n} image(s) for: '{args.name}'...")
        
        result = client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=args.prompt,
            config=dict(
                number_of_images=args.n,
                output_mime_type="image/png",
                aspect_ratio=args.aspect_ratio
            )
        )
        
        os.makedirs(args.out, exist_ok=True)
        
        for i, generated_image in enumerate(result.generated_images):
            file_path = os.path.join(args.out, f"{args.name}_{i+1}.png")
            with open(file_path, "wb") as f:
                f.write(generated_image.image.image_bytes)
            print(f"Saved: {file_path}")
            
    except Exception as e:
        print(f"Failed to generate: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
