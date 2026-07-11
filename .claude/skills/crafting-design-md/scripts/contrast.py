#!/usr/bin/env python3
"""Offline WCAG 2.x contrast checker for DESIGN.md component color pairs.

Usage:
    python contrast.py <hex1> <hex2>
    python contrast.py "#1A1C1E" "#F7F5F2"
    python contrast.py 1A1C1E F7F5F2

Exit code 0 if the pair passes WCAG AA for normal text (>= 4.5:1),
exit code 1 otherwise. Prints the contrast ratio plus AA/AAA results
for normal and large text.
"""

from __future__ import annotations

import sys


def parse_hex(value: str) -> tuple[float, float, float]:
    """Parse a hex color string into sRGB (0..1) channel floats."""
    s = value.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    if len(s) != 6:
        raise ValueError(
            f"'{value}' is not a valid hex color. "
            f"Expected #RGB or #RRGGBB (with or without the leading #)."
        )
    try:
        r = int(s[0:2], 16) / 255.0
        g = int(s[2:4], 16) / 255.0
        b = int(s[4:6], 16) / 255.0
    except ValueError as exc:
        raise ValueError(f"'{value}' contains non-hex characters.") from exc
    return r, g, b


def linearize(channel: float) -> float:
    """sRGB -> linear-light per WCAG 2.x."""
    if channel <= 0.03928:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (linearize(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg: str, bg: str) -> float:
    l_fg = relative_luminance(parse_hex(fg))
    l_bg = relative_luminance(parse_hex(bg))
    lighter, darker = (l_fg, l_bg) if l_fg > l_bg else (l_bg, l_fg)
    return (lighter + 0.05) / (darker + 0.05)


def grade(ratio: float) -> dict[str, str]:
    """Return pass/fail against the four WCAG thresholds."""
    return {
        "AA_normal": "PASS" if ratio >= 4.5 else "FAIL",
        "AA_large": "PASS" if ratio >= 3.0 else "FAIL",
        "AAA_normal": "PASS" if ratio >= 7.0 else "FAIL",
        "AAA_large": "PASS" if ratio >= 4.5 else "FAIL",
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2

    fg, bg = argv[1], argv[2]
    try:
        ratio = contrast_ratio(fg, bg)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    results = grade(ratio)

    print(f"Contrast ratio: {ratio:.2f} : 1")
    print(f"  {fg} vs {bg}")
    print()
    print(f"  WCAG AA  normal text (>= 4.5 : 1)   {results['AA_normal']}")
    print(f"  WCAG AA  large text  (>= 3.0 : 1)   {results['AA_large']}")
    print(f"  WCAG AAA normal text (>= 7.0 : 1)   {results['AAA_normal']}")
    print(f"  WCAG AAA large text  (>= 4.5 : 1)   {results['AAA_large']}")

    return 0 if results["AA_normal"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
