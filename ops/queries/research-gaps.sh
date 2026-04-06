#!/usr/bin/env bash
# research-gaps.sh — Generate web search queries for gap analysis
# Usage: bash ops/queries/research-gaps.sh
# This script generates search queries — run them with /learn or WebSearch

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Research Queries for Gap Analysis ==="
echo ""
echo "Run these with /arscontexta:learn or WebSearch to find what competitors"
echo "have shipped recently, what the EDA community is asking for, and what"
echo "trends ProtoPulse should be aware of."
echo ""

echo "--- Competitor Feature Tracking ---"
echo ""
echo '  1. "Flux.ai new features 2026" OR "Flux.ai changelog"'
echo '     -> What has Flux shipped since our last competitive analysis?'
echo ""
echo '  2. "KiCad 9 features" OR "KiCad roadmap 2026"'
echo '     -> KiCad is the OSS benchmark — what are they adding?'
echo ""
echo '  3. "Wokwi new features" OR "Wokwi ESP32 simulation"'
echo '     -> Wokwi is the simulation benchmark for makers'
echo ""
echo '  4. "EasyEDA Pro features" OR "JLCEDA features"'
echo '     -> EasyEDA/JLCEDA has JLCPCB integration we lack'
echo ""

echo "--- Community Pain Points ---"
echo ""
echo '  5. "Arduino IDE alternatives 2026" OR "best EDA for beginners"'
echo '     -> What are makers actually searching for?'
echo ""
echo '  6. site:reddit.com/r/PrintedCircuitBoard "wish" OR "missing" OR "frustrating"'
echo '     -> What does the PCB community complain about?'
echo ""
echo '  7. site:reddit.com/r/arduino "design tool" OR "schematic" OR "breadboard"'
echo '     -> What tools do Arduino users want?'
echo ""
echo '  8. "AI circuit design" OR "AI PCB layout" 2025 2026'
echo '     -> Who else is doing AI-assisted EDA? New entrants?'
echo ""

echo "--- Technology Trends ---"
echo ""
echo '  9. "browser EDA" OR "web-based circuit design" 2026'
echo '     -> Is the browser EDA space growing? New players?'
echo ""
echo '  10. "RISC-V development board" OR "ESP32-C6" OR "ESP32-S3" popular 2026'
echo '      -> What boards should our verified board pack support next?'
echo ""
echo '  11. "Tauri v2 EDA" OR "desktop EDA Electron alternative"'
echo '      -> Is anyone else doing native desktop EDA with web tech?'
echo ""

echo "--- Feature Ideas from Adjacent Domains ---"
echo ""
echo '  12. "Figma for hardware" OR "collaborative PCB design"'
echo '      -> What does collaboration look like in hardware design?'
echo ""
echo '  13. "AI code generation for embedded" OR "AI firmware generation"'
echo '      -> How far has AI firmware assistance come?'
echo ""
echo '  14. "visual programming microcontroller" OR "block-based Arduino"'
echo '      -> Alternative programming paradigms for beginners'
echo ""

echo "---"
echo "To research any of these:"
echo "  /arscontexta:learn \"[search query]\""
echo "  or ask me to WebSearch any of the above"
