#!/usr/bin/env python3
"""Offline DESIGN.md linter — implements the 7 canonical rules without
external dependencies.

Rules implemented (severity in parens):
    broken-ref          (error)    Token references that don't resolve
    missing-primary     (warning)  Colors defined, no `primary` token
    contrast-ratio      (warning)  Component bg/text pair below WCAG AA 4.5:1
    orphaned-tokens     (warning)  Color tokens never referenced by a component
    missing-typography  (warning)  Colors defined, no typography tokens
    section-order       (warning)  ## sections appear out of canonical order
    missing-sections    (info)     Optional sections absent when expected
    token-summary       (info)     Count of tokens per category

Usage:
    python3 validate.py DESIGN.md
    python3 validate.py DESIGN.md --format json
    cat DESIGN.md | python3 validate.py -
    cat DESIGN.md | python3 validate.py - --format json

Exit codes:
    0 — zero errors (warnings ok)
    1 — one or more errors
    2 — parse or usage error
"""

from __future__ import annotations

import json
import re
import sys

# ---------------------------------------------------------------------
# Front matter + section parsing
# ---------------------------------------------------------------------

FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def split_frontmatter(content: str) -> tuple[str, str]:
    m = FRONT_MATTER_RE.match(content)
    if not m:
        raise ValueError(
            "No YAML front matter found. DESIGN.md must start with '---' fences."
        )
    return m.group(1), m.group(2)


def parse_yaml(source: str) -> dict:
    """Minimal YAML-subset parser tuned for DESIGN.md front matter.

    Supports:
      - Nested mappings (2 levels: section -> tokens, components -> props)
      - Scalar string values (quoted or unquoted)
      - Integer / float literals
      - Boolean / null literals
      - Comments (# start of line or after a value)

    Does not support:
      - Lists / sequences
      - Multi-line / folded strings (| or >)
      - Anchors / tags
      - Flow-style mappings ({a: 1})
    """
    lines = source.splitlines()
    root: dict = {}
    stack: list[tuple[int, dict]] = [(-1, root)]

    for lineno, raw in enumerate(lines, start=1):
        stripped = raw.rstrip()
        if not stripped or stripped.lstrip().startswith("#"):
            continue

        indent = len(stripped) - len(stripped.lstrip())
        content_line = stripped[indent:]

        # Drop inline comments that aren't inside a quoted string
        if " #" in content_line and not _in_quotes(content_line, content_line.index(" #")):
            content_line = content_line[: content_line.index(" #")].rstrip()

        # Pop stack down to the parent
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if not stack:
            raise ValueError(f"Line {lineno}: indentation error.")
        parent = stack[-1][1]

        if ":" not in content_line:
            raise ValueError(f"Line {lineno}: expected 'key: value' or 'key:'.")

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


def _in_quotes(s: str, pos: int) -> bool:
    single = 0
    double = 0
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
        if any(ch in s for ch in ".eE"):
            return float(s)
        return int(s)
    except ValueError:
        return s


# ---------------------------------------------------------------------
# Section extraction
# ---------------------------------------------------------------------

CANONICAL_SECTIONS = [
    "Overview",
    "Colors",
    "Typography",
    "Layout",
    "Elevation & Depth",
    "Shapes",
    "Components",
    "Do's and Don'ts",
]

SECTION_ALIASES = {
    "Brand & Style": "Overview",
    "Layout & Spacing": "Layout",
    "Elevation": "Elevation & Depth",
    # Apostrophe variants
    "Dos and Don'ts": "Do's and Don'ts",
    "Do's and Donts": "Do's and Don'ts",
    "Dos and Donts": "Do's and Don'ts",
    "Do’s and Don’ts": "Do's and Don'ts",
}


def extract_sections(body: str) -> list[tuple[int, str, str]]:
    """Return [(line_number, raw_heading, canonical_name)] in file order."""
    sections: list[tuple[int, str, str]] = []
    for i, line in enumerate(body.splitlines(), start=1):
        m = re.match(r"^##\s+(.+?)\s*$", line)
        if not m:
            continue
        raw = m.group(1).strip()
        canonical = SECTION_ALIASES.get(raw, raw)
        sections.append((i, raw, canonical))
    return sections


# ---------------------------------------------------------------------
# Rule implementations
# ---------------------------------------------------------------------


def _finding(rule: str, severity: str, message: str, location: str = "") -> dict:
    return {
        "rule": rule,
        "severity": severity,
        "message": message,
        "location": location,
    }


def rule_broken_ref(doc: dict) -> list[dict]:
    out: list[dict] = []
    components = doc.get("components", {})
    if not isinstance(components, dict):
        return out
    for comp_name, comp in components.items():
        if not isinstance(comp, dict):
            continue
        for prop, val in comp.items():
            if not (isinstance(val, str) and val.startswith("{") and val.endswith("}")):
                continue
            path = val[1:-1]
            parts = path.split(".")
            node: object = doc
            ok = True
            for part in parts:
                if not isinstance(node, dict) or part not in node:
                    ok = False
                    break
                node = node[part]
            if not ok:
                out.append(
                    _finding(
                        "broken-ref",
                        "error",
                        f"`{val}` does not resolve.",
                        f"components.{comp_name}.{prop}",
                    )
                )
    return out


def rule_missing_primary(doc: dict) -> list[dict]:
    colors = doc.get("colors", {})
    if isinstance(colors, dict) and colors and "primary" not in colors:
        return [
            _finding(
                "missing-primary",
                "warning",
                "Colors defined but no `primary` token. Agents will auto-generate one.",
                "colors",
            )
        ]
    return []


def rule_missing_typography(doc: dict) -> list[dict]:
    colors = doc.get("colors", {})
    typography = doc.get("typography", {})
    if isinstance(colors, dict) and colors and not (isinstance(typography, dict) and typography):
        return [
            _finding(
                "missing-typography",
                "warning",
                "Colors defined but no typography tokens. Agents will use default fonts.",
                "typography",
            )
        ]
    return []


def rule_section_order(sections: list[tuple[int, str, str]]) -> list[dict]:
    out: list[dict] = []
    last_index = -1
    seen_canonical: set[str] = set()
    for lineno, raw, canonical in sections:
        if canonical in seen_canonical:
            out.append(
                _finding(
                    "duplicate-section",
                    "error",
                    f"Section `## {raw}` appears more than once (canonicalizes to `{canonical}`).",
                    f"line {lineno}",
                )
            )
            continue
        seen_canonical.add(canonical)
        if canonical not in CANONICAL_SECTIONS:
            continue
        index = CANONICAL_SECTIONS.index(canonical)
        if index < last_index:
            out.append(
                _finding(
                    "section-order",
                    "warning",
                    f"Section `## {raw}` is out of canonical order.",
                    f"line {lineno}",
                )
            )
        else:
            last_index = index
    return out


def rule_orphaned_tokens(doc: dict) -> list[dict]:
    colors = doc.get("colors", {})
    components = doc.get("components", {})
    if not (isinstance(colors, dict) and colors and isinstance(components, dict)):
        return []
    used: set[str] = set()
    for comp in components.values():
        if not isinstance(comp, dict):
            continue
        for val in comp.values():
            if isinstance(val, str) and val.startswith("{") and val.endswith("}"):
                path = val[1:-1]
                if path.startswith("colors."):
                    used.add(path.split(".", 1)[1])
    return [
        _finding(
            "orphaned-tokens",
            "warning",
            f"Color token `{name}` is defined but never referenced by any component.",
            f"colors.{name}",
        )
        for name in sorted(colors.keys())
        if name not in used
    ]


# Contrast math (duplicated from contrast.py to keep this script self-contained)


def _parse_hex_to_rgb(value: str) -> tuple[float, float, float] | None:
    s = value.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        return None
    try:
        r = int(s[0:2], 16) / 255.0
        g = int(s[2:4], 16) / 255.0
        b = int(s[4:6], 16) / 255.0
    except ValueError:
        return None
    return r, g, b


def _linearize(c: float) -> float:
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def _contrast_ratio(fg: str, bg: str) -> float | None:
    a = _parse_hex_to_rgb(fg)
    b = _parse_hex_to_rgb(bg)
    if a is None or b is None:
        return None
    la = sum(coef * _linearize(ch) for coef, ch in zip((0.2126, 0.7152, 0.0722), a))
    lb = sum(coef * _linearize(ch) for coef, ch in zip((0.2126, 0.7152, 0.0722), b))
    lighter, darker = (la, lb) if la > lb else (lb, la)
    return (lighter + 0.05) / (darker + 0.05)


def _resolve(doc: dict, value: str) -> str:
    """Resolve a token reference to a primitive string. Returns input if
    already a literal or if the reference doesn't resolve."""
    if not (isinstance(value, str) and value.startswith("{") and value.endswith("}")):
        return value
    path = value[1:-1]
    node: object = doc
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return value
        node = node[part]
    if isinstance(node, str):
        return node
    return value


def rule_contrast_ratio(doc: dict) -> list[dict]:
    out: list[dict] = []
    components = doc.get("components", {})
    if not isinstance(components, dict):
        return out
    for comp_name, comp in components.items():
        if not isinstance(comp, dict):
            continue
        bg_val = comp.get("backgroundColor")
        fg_val = comp.get("textColor")
        if not (isinstance(bg_val, str) and isinstance(fg_val, str)):
            continue
        bg = _resolve(doc, bg_val)
        fg = _resolve(doc, fg_val)
        ratio = _contrast_ratio(fg, bg)
        if ratio is None:
            continue
        if ratio < 4.5:
            out.append(
                _finding(
                    "contrast-ratio",
                    "warning",
                    f"Contrast ratio {ratio:.2f}:1 is below WCAG AA (4.5:1) for normal text.",
                    f"components.{comp_name}",
                )
            )
    return out


def rule_token_summary(doc: dict) -> list[dict]:
    out: list[dict] = []
    for key in ("colors", "typography", "rounded", "spacing", "components"):
        section = doc.get(key, {})
        count = len(section) if isinstance(section, dict) else 0
        out.append(
            _finding(
                "token-summary",
                "info",
                f"{key}: {count} token(s).",
                key,
            )
        )
    return out


def rule_missing_sections(doc: dict, sections: list[tuple[int, str, str]]) -> list[dict]:
    present = {canonical for _, _, canonical in sections}
    out: list[dict] = []
    has_tokens = any(
        isinstance(doc.get(k), dict) and doc.get(k) for k in ("colors", "typography", "components")
    )
    if not has_tokens:
        return out
    for sec in CANONICAL_SECTIONS:
        if sec not in present:
            out.append(
                _finding(
                    "missing-sections",
                    "info",
                    f"Canonical section `## {sec}` is not present.",
                    "body",
                )
            )
    return out


# ---------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------


def lint(content: str) -> dict:
    front_matter, body = split_frontmatter(content)
    doc = parse_yaml(front_matter)
    sections = extract_sections(body)

    findings: list[dict] = []
    findings.extend(rule_broken_ref(doc))
    findings.extend(rule_missing_primary(doc))
    findings.extend(rule_missing_typography(doc))
    findings.extend(rule_contrast_ratio(doc))
    findings.extend(rule_orphaned_tokens(doc))
    findings.extend(rule_section_order(sections))
    findings.extend(rule_missing_sections(doc, sections))
    findings.extend(rule_token_summary(doc))

    summary = {
        "errors": sum(1 for f in findings if f["severity"] == "error"),
        "warnings": sum(1 for f in findings if f["severity"] == "warning"),
        "info": sum(1 for f in findings if f["severity"] == "info"),
    }

    return {"findings": findings, "summary": summary, "designSystem": doc}


def _render_text(report: dict) -> str:
    lines: list[str] = []
    by_sev = {"error": [], "warning": [], "info": []}
    for f in report["findings"]:
        by_sev[f["severity"]].append(f)
    for sev in ("error", "warning", "info"):
        group = by_sev[sev]
        if not group:
            continue
        lines.append(f"\n{sev.upper()} ({len(group)}):")
        for f in group:
            loc = f" [{f['location']}]" if f.get("location") else ""
            lines.append(f"  {f['rule']}{loc}: {f['message']}")
    s = report["summary"]
    lines.append("")
    lines.append(
        f"Summary: {s['errors']} error(s), {s['warnings']} warning(s), {s['info']} info"
    )
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    args = argv[1:]
    output_format = "text"
    path = None
    for a in args:
        if a == "--format":
            continue
        if a in {"text", "json"}:
            output_format = a
            continue
        path = a

    if path is None:
        print(__doc__, file=sys.stderr)
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
        report = lint(content)
    except ValueError as exc:
        print(f"PARSE ERROR: {exc}", file=sys.stderr)
        return 2

    if output_format == "json":
        print(json.dumps(report, indent=2, default=str))
    else:
        print(_render_text(report))

    return 1 if report["summary"]["errors"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
