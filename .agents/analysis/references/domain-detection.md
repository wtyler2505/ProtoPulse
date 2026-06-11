# Domain Detection Reference (Local Copy for ProtoPulse Phase Analysis)

**Source**: Copied/adapted from `~/.agents/skills/product-analysis/references/domain-detection.md` on 2026-05-18 for project-local reference during competitive analysis.

## EDA / Electronic Design Automation (ProtoPulse Domain)

**Detection signals:**
- Dependencies: React + TypeScript, Tauri, three.js / @react-three (3D attempts), react-flow or custom canvas for editors, Drizzle, Express, AI (OpenAI/Gemini)
- Keywords: circuit, PCB, schematic, breadboard, netlist, EDA, simulation, BOM, procurement, inventory, digital twin, Arduino, serial
- File patterns: `*schematic*`, `*breadboard*`, `*pcb*`, `*bom*`, `BoardViewer3D*`, `procurement*`, `validation*`, `simulation*`
- Extensive custom views in ViewRenderer: 30+ ViewModes including schematic, breadboard, pcb, viewer_3d, procurement, validation, simulation, digital_twin, arduino, inventory-related, generative, etc.

**Competitors (as per phase-2 prompt):**
- KiCad (open source, full EDA suite, v10 in 2026 with advanced tuning/variants/3D)
- Altium Designer (professional, PCB-focused, expensive, strong MCAD CoDesigner + Altium 365)
- EasyEDA (browser-based, JLCPCB/LCSC manufacturing integration, WebGPU, collab)
- Fritzing (hobbyist, breadboard-first, education, three-view sync)
- Eagle (retiring 2026, succeeded by Autodesk Fusion Electronics with strong native MCAD)
- OrCAD (enterprise Cadence, high-end simulation/high-speed)
- Flux.ai (AI-assisted, browser-based, agentic copilot + sourcing)

**Personas:**
1. Hobbyist maker — values breadboard realism, Arduino integration, starter circuits, low friction, education (labs)
2. Professional electrical engineer — cares about robust DRC/ERC, simulation fidelity, high-speed tools, reliable exports, MCAD fit checks
3. Hardware startup founder — needs rapid iteration, procurement/supply chain visibility, inventory, collaboration/history, investor demos (3D + docs), one-app workflow from idea to order

**Research URLs (used in this phase):**
- KiCad: https://www.kicad.org/discover/features/ , docs.kicad.org/10.0
- EasyEDA: https://easyeda.com/page/features , prodocs.easyeda.com
- Flux.ai: https://www.flux.ai/features , https://www.flux.ai/p/pricing , blog
- Altium: https://www.altium.com/altium-designer , resources.altium.com (MCAD CoDesigner)
- Fritzing: https://fritzing.org/
- Fusion Electronics (Eagle): Autodesk Fusion blogs 2026 updates, fusion electronics pages
- OrCAD: orcad.com / cadence.com resources

**Domain-specific observations for ProtoPulse (2026-05):**
ProtoPulse is positioned as a **broad integrated Electronics Prototyping Platform** (not pure ECAD). It owns the full maker loop: visual/prototyping (breadboard), graphical editors (schem/pcb), 3D viz (current CSS-limited), simulation, validation/DRC, generative/AI, hardware debug (serial, arduino, digital twin), full procurement + live? supply chain + personal inventory, educational content (labs, starters), design history/audit, community parts.
This gives unique differentiation vs narrow tools, but creates gaps in depth on traditional pro EDA features (advanced 3D/MCAD, high-speed constraints, mature real-time collab, rich ecosystem libraries).

**Screenshots captured during phase:**
- kicad-features.png
- flux-ai-features.png
- easyeda-features.png
- fritzing-home.png
(Stored in ../competitor-screenshots/)

## Notes for Future Agents
This file enables resumability for phase-2 style competitive work. Update with new URLs or findings as competitors evolve (KiCad 10+, Flux agent improvements, Fusion post-Eagle retirement, etc.).
