#!/usr/bin/env python3
"""Convert #00F0FF literals to var(--color-editor-accent) in owned .tsx paths.

Rules:
  1. Tailwind arbitrary `[#00F0FF]` → `[var(--color-editor-accent)]`
     (preserves any opacity suffix on the outer class, e.g. `/30`)
  2. `var(--accent-primary, #00F0FF)` / `var(--accent-primary,#00F0FF)` → `var(--color-editor-accent)`
  3. Raw JS string literal `'#00F0FF'` / `"#00F0FF"` → `'var(--color-editor-accent)'`
     (only applied to .tsx — not to lib/.ts files, see team-lead message)
  4. Leaves `rgba(0, 240, 255, ...)` alone.
  5. Leaves comments (lines whose stripped content starts with //, *, /*) alone.
  6. Skips __tests__/.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "client" / "src"

OWNED_DIRS = [
    ROOT / "components" / "panels",
    ROOT / "pages",
    ROOT / "components" / "layout",
    ROOT / "components" / "dialogs",
    ROOT / "hooks",
    ROOT / "components" / "ui",
    ROOT / "components" / "arduino",
    ROOT / "components" / "simulation",
]
# Top-level components/ files (not subdirs — those split by ownership)
TOP_LEVEL_COMPONENT_FILES = [
    ROOT / "components" / "CommandPalette.tsx",
]
# Root client/src files (non-lib)
ROOT_LEVEL_DIRS: list[Path] = []

# Only .tsx files in this phase (lib/.ts held pending team-lead guidance)
EXTENSIONS = {".tsx"}

# Pattern 1: Tailwind arbitrary value - [#00F0FF] (case-insensitive)
PAT_TAILWIND = re.compile(r"\[#00[fF]0[fF][fF]\]")

# Pattern 2: var(--accent-primary, #00F0FF) with optional whitespace
PAT_ACCENT_FALLBACK = re.compile(
    r"var\(\s*--accent-primary\s*,\s*#00[fF]0[fF][fF]\s*\)"
)

# Pattern 3: quoted raw hex - '#00F0FF' or "#00F0FF"
PAT_QUOTED = re.compile(r"(['\"])#00[fF]0[fF][fF]\1")

COMMENT_STARTS = ("//", "*", "/*")


def is_comment_line(line: str) -> bool:
    stripped = line.lstrip()
    return any(stripped.startswith(s) for s in COMMENT_STARTS)


def convert_line(line: str) -> tuple[str, int]:
    if is_comment_line(line):
        return line, 0
    count = 0
    new = line
    new, n = PAT_TAILWIND.subn("[var(--color-editor-accent)]", new)
    count += n
    new, n = PAT_ACCENT_FALLBACK.subn("var(--color-editor-accent)", new)
    count += n
    new, n = PAT_QUOTED.subn(r"\1var(--color-editor-accent)\1", new)
    count += n
    return new, count


def process_file(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    total = 0
    new_lines = []
    for line in lines:
        new_line, n = convert_line(line)
        new_lines.append(new_line)
        total += n
    if total > 0:
        path.write_text("".join(new_lines), encoding="utf-8")
    return total


def main() -> int:
    grand_total = 0
    files_changed = 0
    def handle(path: Path) -> None:
        nonlocal grand_total, files_changed
        if path.suffix not in EXTENSIONS:
            return
        if "__tests__" in path.parts:
            return
        n = process_file(path)
        if n > 0:
            rel = path.relative_to(ROOT.parent.parent)
            print(f"{rel}: {n} replacement(s)")
            grand_total += n
            files_changed += 1

    for base in OWNED_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            handle(path)
    for path in TOP_LEVEL_COMPONENT_FILES:
        if path.exists():
            handle(path)
    print(f"\nTotal: {grand_total} replacements across {files_changed} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
