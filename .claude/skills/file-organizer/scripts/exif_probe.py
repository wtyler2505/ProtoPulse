import os
import sys
import json
import subprocess
import argparse

def get_exif_date(file_path):
    # Relies on exiftool if available, otherwise falls back to basic stat
    try:
        # Try exiftool first (needs to be installed on system)
        result = subprocess.run(
            ['exiftool', '-DateTimeOriginal', '-CreateDate', '-s', '-s', '-s', file_path],
            capture_output=True, text=True, timeout=5
        )
        dates = [d for d in result.stdout.split('\n') if d.strip()]
        if dates:
            # Parse typical EXIF format: YYYY:MM:DD HH:MM:SS
            date_str = dates[0].split(' ')[0]
            return date_str.replace(':', '-')
    except Exception:
        pass
    
    # Fallback to OS modification time
    try:
        mtime = os.path.getmtime(file_path)
        from datetime import datetime
        return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
    except Exception as e:
        return "Unknown_Date"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract accurate creation dates from media.")
    parser.add_argument("file", help="File to analyze")
    args = parser.parse_args()
    
    print(get_exif_date(args.file))