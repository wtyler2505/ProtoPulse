# Phase 5: Feature Innovation

## Innovation Proposals (Ranked by Impact x Feasibility)

### IN-01: Generative "Circuits-as-Code" (TypeScript EDA)
- **What**: Expose the underlying `@tscircuit` infrastructure to allow engineers to define schematics, components, and layouts using declarative TypeScript (React-like) syntax alongside the visual canvas.
- **Why**: Hardware engineers increasingly write scripts to automate layout. Software engineers entering hardware prefer code. This bridges the gap, allowing AI to directly write and refactor circuit code that instantly updates the visual canvas.
- **How**: Surface an integrated code editor (Monaco) next to the Architecture/Schematic views. AI assistant generates `@tscircuit` React code instead of just manipulating JSON nodes. 
- **Effort**: M
- **Priority**: P0 (game-changer)
- **Competitive moat**: Extremely high. No major competitor (including Flux.ai) has a first-class declarative code representation for the entire board that syncs two-way with the visual canvas.
- **Personas served**: Professional electrical engineer, Hardware startup founder

### IN-02: Multimodal Datasheet Ingestion Agent
- **What**: Allow users to drag-and-drop a manufacturer's PDF datasheet into the chat to instantly generate a standard component symbol, footprint, and SPICE model.
- **Why**: ProtoPulse lacks a massive 10K+ component library (a critical gap identified in Phase 2). Manually creating components is tedious. 
- **How**: Utilize Gemini 2.5 Vision / Document Processing capabilities to parse the PDF, extract pinout tables, physical dimensions, and electrical characteristics, and output a validated component JSON.
- **Effort**: M
- **Priority**: P0 (game-changer)
- **Competitive moat**: High. Solves the "cold start" library problem that plagues new EDA tools through cutting-edge multimodal AI, bypassing the need for a manually curated 1.6B part database.
- **Personas served**: All personas

### IN-03: Supply Chain-Aware AI Architecture Generation
- **What**: The AI architecture generator checks live stock and pricing via Octopart/Mouser/LCSC APIs *before* recommending parts for a block diagram.
- **Why**: Currently, pricing/stock data is AI-simulated (fabricated). Startups waste weeks designing around chips that are out of stock.
- **How**: Integrate real supplier APIs. When the AI proposes an architecture, it injects API data to ensure the BOM is cost-optimized and highly available.
- **Effort**: M
- **Priority**: P1
- **Competitive moat**: Medium. Flux.ai has live pricing, but linking it directly to the *initial AI architecture generation phase* ensures the design is inherently manufacturable.
- **Personas served**: Hardware startup founder, Professional electrical engineer

### IN-04: Natural Language Design Rule Constraints (DRC)
- **What**: Let users define complex spatial and electrical constraints in plain English. e.g., "Keep the USB 2.0 differential pair matched to 90 ohms and away from the switching regulator."
- **Why**: Traditional DRC interfaces are complex tables. AI can translate intent into strict mathematical boundaries for the PCB Layout view.
- **How**: Use the AI to parse natural language into a JSON array of DRC rules (clearance, length matching, impedance) that the spatial grid engine enforces.
- **Effort**: M
- **Priority**: P1
- **Competitive moat**: High. Lowering the barrier to advanced PCB constraints makes professional features accessible to makers and startups.
- **Personas served**: Hobbyist maker, Hardware startup founder

### IN-05: Real-time, Local-First Multiplayer Collaboration (CRDTs)
- **What**: Implement real-time multi-user editing for schematics and architecture diagrams that works even offline, syncing when reconnected.
- **Why**: Hardware design is a team sport. ProtoPulse currently is single-user. Flux.ai supports 20 editors but requires the cloud.
- **How**: Integrate Yjs or Automerge CRDTs (Conflict-free Replicated Data Types) with `@xyflow/react` and local IndexedDB state.
- **Effort**: XL
- **Priority**: P1
- **Competitive moat**: Very High. True offline-capable, local-first collaboration beats Flux.ai's cloud-dependent model and appeals to IP-sensitive professionals.
- **Personas served**: Professional electrical engineer, Hardware startup founder

### IN-06: 3D Digital Twin Viewer with AR Export
- **What**: A fully interactive 3D board viewer that can export to GLTF/USDZ for viewing the PCB in Augmented Reality on a smartphone.
- **Why**: Essential for mechanical fit testing. AR export allows makers to visualize how the board fits into a 3D-printed enclosure on their actual desk.
- **How**: Use React Three Fiber to render the PCB stackup and component STEP files in 3D. Add a button to generate a QR code for mobile AR view.
- **Effort**: L
- **Priority**: P2
- **Competitive moat**: Medium. Standard 3D viewers are table-stakes, but AR export is a highly shareable, viral feature that competitors lack.
- **Personas served**: Hobbyist maker, Hardware startup founder

### IN-07: AI FMEA & Compliance Report Generator
- **What**: A one-click generation of Failure Mode and Effects Analysis (FMEA) and test plan documentation based on the current architecture and components.
- **Why**: Startups and pros spend weeks writing compliance docs. Flux.ai offers this via Copilot Shortcuts.
- **How**: Pass the entire project state and component metadata to Claude/Gemini with a prompt to identify single points of failure, thermal risks, and recommended test points.
- **Effort**: S
- **Priority**: P2
- **Competitive moat**: Low to replicate, but extremely high business value for users.
- **Personas served**: Hardware startup founder, Professional electrical engineer

### IN-08: "Shift-Left" Background Thermal/SI Heuristics
- **What**: A background AI agent that periodically analyzes the architecture and schematic to flag potential thermal hotspots or signal integrity issues *before* layout begins.
- **Why**: Typically, these analyses happen post-layout, which is too late and causes expensive rework.
- **How**: Use the AI to review high-power nets and high-speed components, highlighting problematic nodes in red on the `@xyflow/react` canvas.
- **Effort**: M
- **Priority**: P2
- **Competitive moat**: High. Proactive, architecture-level heuristic analysis doesn't exist in traditional tools.
- **Personas served**: Professional electrical engineer

### IN-09: Smart Breadboard-to-PCB Autorouter
- **What**: An educational workflow that automatically translates a breadboard prototype directly into a beginner-friendly PCB layout (thick traces, 1 or 2 layers, large clearances).
- **Why**: Bridges the gap for hobbyists moving from Arduino breadboards to their first manufactured PCB.
- **How**: Use the existing BreadboardView netlist to seed a simplified autorouter optimized for home etching or CNC milling (e.g., Voronoi routing).
- **Effort**: L
- **Priority**: P3 (nice-to-have)
- **Competitive moat**: Medium. Fritzing does this poorly; doing it well with AI assistance would capture the entire educational market.
- **Personas served**: Hobbyist maker

### IN-10: Command Palette (Keyboard-First EDA)
- **What**: A global, context-aware command palette (accessible via `Cmd+K`) for rapid navigation, tool switching, net assignment, and AI prompting.
- **Why**: Phase 3 found zero native forms and an imperative UI. Power users demand keyboard-driven workflows.
- **How**: Integrate `cmdk` (often bundled with shadcn/ui). Connect it to the 78 existing AI actions and view-switching logic.
- **Effort**: S
- **Priority**: P1
- **Competitive moat**: Medium. Modernizes the UX dramatically, making it feel like Linear or VS Code for hardware.
- **Personas served**: Professional electrical engineer

## Moonshot Section

### Zero-Shot Board Generation
"I need a flight controller for a quadcopter" -> Full architecture, schematic, and proposed PCB layout generated in 5 minutes. The ultimate manifestation of the AI-first philosophy, eliminating the blank canvas problem entirely.

### Auto-Fabrication Pipeline (Zero-Touch Manufacturing)
Direct API integration with JLCPCB/PCBWay where clicking "Manufacture" auto-generates all Gerber, Drill, and Pick & Place files, runs an AI-powered DFM pre-check to automatically fix overlapping silkscreens or trace widths, and places the order directly.

### Hardware-in-the-Loop Simulation Sync
Integration with a desktop oscilloscope/logic analyzer (via WebUSB or a local companion app) to compare real-world hardware readings against the browser's SPICE simulation in real-time, highlighting discrepancies.

## Integration Opportunities

- **`@tscircuit` ecosystem**: Already listed in `package.json` (`@tscircuit/schematic-match-adapt`, etc.). This is a massive "cheap innovation" opportunity. Exposing this allows for "Circuits-as-Code" (IN-01) with almost zero foundation building required.
- **`@xyflow/react` (React Flow)**: Highly extensible. Can be easily augmented to support collaborative cursors (IN-05) and real-time visual heuristic warnings (IN-08).
- **React 19 Server Actions & Concurrent Features**: Can be leveraged to run heavy SPICE simulations or Octopart API searches asynchronously without blocking the UI, significantly improving perceived performance (alleviating the sluggishness noted in Phase 3).
- **Gemini Multimodal / Vision**: Using the existing Gemini SDK integration to parse screenshots of schematics or PDF datasheets (IN-02) is a very low-effort, high-impact innovation that requires no new external dependencies.

## Research Links

- WebSearch query on EDA trends (2025/2026): Highlighted the shift from "drawing tools" to "intelligent design environments", Cloud-native collaboration (Google Docs-ification), and Shift-Left simulation.
- Altium Designer Trends: Focus on AI constraints and deep MCAD/simulation integration.
- Flux.ai Features: Copilot assistant, community-driven parts, and live pricing. ProtoPulse can leapfrog by integrating API pricing directly into the generative phase, rather than just as a post-design check.
- EasyEDA Evolution: Direct manufacturing feedback from JLCPCB. ProtoPulse's "Auto-Fabrication Pipeline" moonshot builds on this concept.
- `@tscircuit` Documentation: Explored via package.json inspection, leading to the IN-01 proposal.
