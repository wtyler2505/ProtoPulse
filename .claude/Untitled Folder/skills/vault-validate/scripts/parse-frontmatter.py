#!/usr/bin/env python3
"""
parse-frontmatter.py — Extract YAML frontmatter from a markdown note.

Usage:
  parse-frontmatter.py <file.md>           # emit YAML as JSON to stdout
  parse-frontmatter.py <file.md> --yaml    # emit YAML verbatim
  parse-frontmatter.py --stdin             # read markdown from stdin
  parse-frontmatter.py <file.md> --key NAME  # emit only that key's value

Exit codes:
  0 — parsed successfully
  1 — file not found or no frontmatter detected
  2 — frontmatter present but invalid YAML
  3 — usage error
"""

from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml  # PyYAML
except ImportError:
    sys.stderr.write("ERROR: PyYAML required. Install with: pip install --user pyyaml\n")
    sys.exit(3)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)


def extract_frontmatter(text: str) -> str | None:
    """Return the YAML body between leading --- markers, or None."""
    m = FRONTMATTER_RE.match(text)
    return m.group(1) if m else None


def parse(text: str) -> dict:
    """Extract + parse frontmatter. Raises ValueError on failure."""
    body = extract_frontmatter(text)
    if body is None:
        raise ValueError("no frontmatter block found (expected leading ---)")
    try:
        data = yaml.safe_load(body)
    except yaml.YAMLError as e:
        raise ValueError(f"invalid YAML: {e}") from e
    if not isinstance(data, dict):
        raise ValueError(f"frontmatter must be a mapping, got {type(data).__name__}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", help="Markdown file (omit with --stdin)")
    parser.add_argument("--stdin", action="store_true", help="Read markdown from stdin")
    parser.add_argument("--yaml", action="store_true", help="Emit YAML instead of JSON")
    parser.add_argument("--key", help="Emit only the value of this top-level key")
    args = parser.parse_args()

    if args.stdin:
        text = sys.stdin.read()
    elif args.file:
        p = Path(args.file)
        if not p.exists():
            sys.stderr.write(f"ERROR: file not found: {args.file}\n")
            return 1
        text = p.read_text(encoding="utf-8")
    else:
        parser.print_usage(sys.stderr)
        return 3

    try:
        data = parse(text)
    except ValueError as e:
        sys.stderr.write(f"ERROR: {e}\n")
        return 2 if "invalid YAML" in str(e) else 1

    if args.key:
        if args.key not in data:
            sys.stderr.write(f"ERROR: key '{args.key}' not found\n")
            return 1
        val = data[args.key]
        if args.yaml:
            sys.stdout.write(yaml.safe_dump(val, default_flow_style=False, sort_keys=False))
        else:
            sys.stdout.write(json.dumps(val, indent=2, default=str))
            sys.stdout.write("\n")
        return 0

    if args.yaml:
        sys.stdout.write(yaml.safe_dump(data, default_flow_style=False, sort_keys=False))
    else:
        sys.stdout.write(json.dumps(data, indent=2, default=str))
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
