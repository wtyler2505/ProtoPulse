#!/usr/bin/env python3
"""Offline DESIGN.md exporter — convert tokens to Tailwind, DTCG, or CSS.

Supported formats:
    tailwind   Tailwind v3 theme config (JSON; drop into tailwind.config.js theme.extend)
    dtcg       W3C Design Tokens Community Group format (JSON)
    css        CSS custom properties (:root { --... })

Usage:
    python3 export.py DESIGN.md --format tailwind
    python3 export.py DESIGN.md --format dtcg    --output design_tokens.json
    python3 export.py DESIGN.md --format css     --output tokens.css
    cat DESIGN.md | python3 export.py - --format tailwind

Exit codes:
    0 — export succeeded
    1 — parse error
    2 — usage error
"""

from __future__ import annotations

import json
import re
import sys

# ---------------------------------------------------------------------
# Parser (self-contained subset — same shape as validate.py)
# ---------------------------------------------------------------------

FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def _split_frontmatter(content: str) -> tuple[str, str]:
    m = FRONT_MATTER_RE.match(content)
    if not m:
        raise ValueError("No YAML front matter found.")
    return m.group(1), m.group(2)


def _in_quotes(s: str, pos: int) -> bool:
    single = double = 0
    for i, c in enumerate(s):
        if i >= pos:
            break
        if c == '"' and single == 0:
            double = 1 - double
        elif c == "'" and double == 0:
            single = 1 - single
    return bool(single or double)


def _parse_scalar(s: str):
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    if s == "true":
        return True
    if s == "false":
        return False
    if s in {"null", "~", ""}:
        return None
    try:
        return float(s) if any(ch in s for ch in ".eE") else int(s)
    except ValueError:
        return s


def _parse_yaml(source: str) -> dict:
    lines = source.splitlines()
    root: dict = {}
    stack: list[tuple[int, dict]] = [(-1, root)]

    for lineno, raw in enumerate(lines, start=1):
        stripped = raw.rstrip()
        if not stripped or stripped.lstrip().startswith("#"):
            continue
        indent = len(stripped) - len(stripped.lstrip())
        content_line = stripped[indent:]
        if " #" in content_line and not _in_quotes(content_line, content_line.index(" #")):
            content_line = content_line[: content_line.index(" #")].rstrip()
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if not stack:
            raise ValueError(f"Line {lineno}: indentation error.")
        parent = stack[-1][1]
        if ":" not in content_line:
            raise ValueError(f"Line {lineno}: expected 'key:' or 'key: value'.")
        key, _, value = content_line.partition(":")
        key = key.strip()
        value = value.strip()
        if value == "":
            new_map: dict = {}
            parent[key] = new_map
            stack.append((indent, new_map))
        else:
            parent[key] = _parse_scalar(value)
    return root


# ---------------------------------------------------------------------
# Token resolution
# ---------------------------------------------------------------------


def _resolve(doc: dict, value):
    """Resolve a token reference to its primitive; leave literals alone."""
    if not (isinstance(value, str) and value.startswith("{") and value.endswith("}")):
        return value
    path = value[1:-1]
    node = doc
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return value
        node = node[part]
    return node


# ---------------------------------------------------------------------
# Tailwind export
# ---------------------------------------------------------------------


def export_tailwind(doc: dict) -> dict:
    out: dict = {}
    colors = doc.get("colors") or {}
    if colors:
        out["colors"] = {k: v for k, v in colors.items() if isinstance(v, str)}

    typography = doc.get("typography") or {}
    if typography:
        font_families: dict[str, list[str]] = {}
        font_sizes: dict[str, list] = {}
        line_heights: dict[str, float | str] = {}
        letter_spacing: dict[str, str] = {}
        font_weights: dict[str, int] = {}
        for name, props in typography.items():
            if not isinstance(props, dict):
                continue
            ff = props.get("fontFamily")
            if isinstance(ff, str) and ff not in (v[0] for v in font_families.values()):
                family_key = name.split("-")[0]
                font_families.setdefault(family_key, [ff])
            fs = props.get("fontSize")
            lh = props.get("lineHeight")
            ls = props.get("letterSpacing")
            fw = props.get("fontWeight")
            if fs is not None:
                extras: dict = {}
                if lh is not None:
                    extras["lineHeight"] = lh
                if ls is not None:
                    extras["letterSpacing"] = ls
                if fw is not None:
                    extras["fontWeight"] = fw
                font_sizes[name] = [fs, extras] if extras else [fs]
            if lh is not None:
                line_heights[name] = lh
            if ls is not None and isinstance(ls, str):
                letter_spacing[name] = ls
            if fw is not None and isinstance(fw, (int, str)):
                font_weights[name] = fw
        if font_families:
            out["fontFamily"] = font_families
        if font_sizes:
            out["fontSize"] = font_sizes
        if line_heights:
            out["lineHeight"] = line_heights
        if letter_spacing:
            out["letterSpacing"] = letter_spacing
        if font_weights:
            out["fontWeight"] = font_weights

    rounded = doc.get("rounded") or {}
    if rounded:
        out["borderRadius"] = {k: v for k, v in rounded.items()}

    spacing = doc.get("spacing") or {}
    if spacing:
        out["spacing"] = {k: (v if isinstance(v, str) else str(v)) for k, v in spacing.items()}

    return {"extend": out}


# ---------------------------------------------------------------------
# DTCG export
# ---------------------------------------------------------------------


def _dtcg_color(value: str) -> dict:
    return {"$value": value, "$type": "color"}


def _dtcg_dimension(value) -> dict:
    return {"$value": value if isinstance(value, str) else str(value), "$type": "dimension"}


def export_dtcg(doc: dict) -> dict:
    out: dict = {}

    colors = doc.get("colors") or {}
    if colors:
        out["color"] = {
            k: _dtcg_color(v) for k, v in colors.items() if isinstance(v, str) and v.startswith("#")
        }

    typography = doc.get("typography") or {}
    if typography:
        typo_group: dict = {}
        for name, props in typography.items():
            if not isinstance(props, dict):
                continue
            value: dict = {}
            for k in ("fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"):
                v = props.get(k)
                if v is not None:
                    value[k] = v
            typo_group[name] = {"$value": value, "$type": "typography"}
        if typo_group:
            out["typography"] = typo_group

    rounded = doc.get("rounded") or {}
    if rounded:
        out["radius"] = {k: _dtcg_dimension(v) for k, v in rounded.items()}

    spacing = doc.get("spacing") or {}
    if spacing:
        out["spacing"] = {k: _dtcg_dimension(v) for k, v in spacing.items()}

    return out


# ---------------------------------------------------------------------
# CSS custom properties export
# ---------------------------------------------------------------------


def export_css(doc: dict) -> str:
    lines: list[str] = [":root {"]

    colors = doc.get("colors") or {}
    if colors:
        lines.append("  /* Colors */")
        for k, v in colors.items():
            if isinstance(v, str):
                lines.append(f"  --color-{k}: {v};")

    rounded = doc.get("rounded") or {}
    if rounded:
        lines.append("")
        lines.append("  /* Rounded */")
        for k, v in rounded.items():
            lines.append(f"  --radius-{k}: {v};")

    spacing = doc.get("spacing") or {}
    if spacing:
        lines.append("")
        lines.append("  /* Spacing */")
        for k, v in spacing.items():
            lines.append(f"  --space-{k}: {v};")

    typography = doc.get("typography") or {}
    if typography:
        lines.append("")
        lines.append("  /* Typography */")
        for name, props in typography.items():
            if not isinstance(props, dict):
                continue
            for prop_key, css_key in (
                ("fontFamily", "font-family"),
                ("fontSize", "font-size"),
                ("fontWeight", "font-weight"),
                ("lineHeight", "line-height"),
                ("letterSpacing", "letter-spacing"),
            ):
                val = props.get(prop_key)
                if val is not None:
                    lines.append(f"  --text-{name}-{css_key}: {val};")

    lines.append("}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------


def main(argv: list[str]) -> int:
    args = argv[1:]
    path = None
    fmt = None
    output = None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--format":
            i += 1
            fmt = args[i] if i < len(args) else None
        elif a == "--output":
            i += 1
            output = args[i] if i < len(args) else None
        else:
            path = a
        i += 1

    if path is None or fmt is None:
        print(__doc__, file=sys.stderr)
        return 2
    if fmt not in {"tailwind", "dtcg", "css"}:
        print(f"ERROR: unknown --format '{fmt}'. Valid: tailwind, dtcg, css", file=sys.stderr)
        return 2

    try:
        if path == "-":
            content = sys.stdin.read()
        else:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
    except OSError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    try:
        front_matter, _ = _split_frontmatter(content)
        doc = _parse_yaml(front_matter)
    except ValueError as exc:
        print(f"PARSE ERROR: {exc}", file=sys.stderr)
        return 1

    if fmt == "tailwind":
        result = json.dumps(export_tailwind(doc), indent=2)
    elif fmt == "dtcg":
        result = json.dumps(export_dtcg(doc), indent=2)
    else:
        result = export_css(doc)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(result)
            if not result.endswith("\n"):
                f.write("\n")
    else:
        print(result)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
