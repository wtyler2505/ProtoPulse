# Phase 5: Feature Innovation

## Innovation Proposals (Ranked by Impact x Feasibility)

### IN-01: Agentic Auto-Routing & Continuous DRC (Human-Style Routing)
- **What**: An AI-steered auto-router that mimics human reasoning for placement and routing, continuously running Design Rule Checks (DRC) and Electrical Rule Checks (ERC) in the background. It utilizes `@tscircuit/capacity-autorouter` and `@tscircuit/schematic-trace-solver` guided by an LLM agent (like Gemini).
- **Why**: Standard auto-routers produce messy, unoptimized mazes. Designers spend hours cleaning them up. As seen in 2026 EDA trends (e.g., Flux.ai Spring 2026 Update), AI-guided routing that considers power trees and circuit topology is the new standard.
- **How**: Feed `circuit-json` context into the AI agent, allowing it to define routing constraints and execute multi-step placement plans using the existing `@tscircuit` solvers. 
- **Effort**: L
- **Priority**: P0 (game-changer)
- **Competitive moat**: High. Requires deep integration between the React flow canvas, the solver, and an intelligent reasoning engine.
- **Personas served**: Professional electrical engineer, Hardware startup founder

### IN-02: Conversational SPICE Simulation
- **What**: A chat interface where users can type natural language prompts like "Simulate the ripple voltage on this 5V rail under a 2A load" and see immediate graph outputs.
- **Why**: SPICE simulation is notoriously difficult for beginners to configure. Lowering the barrier to entry expands the TAM significantly.
- **How**: Use the existing `circuit-json-to-spice` dependency to generate netlists. Use an LLM to parse the user's intent, configure the SPICE parameters, run the simulation (via a WebAssembly SPICE engine or backend service), and render the results using `recharts` (already in `package.json`).
- **Effort**: M
- **Priority**: P1
- **Competitive moat**: Medium. Competitors are building this, but executing it flawlessly with instant chart rendering is a strong UX win.
- **Personas served**: Hobbyist maker, Professional electrical engineer

### IN-03: Real-Time 3D Digital Twin with Thermal Visualization
- **What**: A live 3D rendering of the PCB that highlights thermal dissipation hotspots and mechanical clearances in real-time as components are placed.
- **Why**: 2026 trends show a "thermal management crisis" and a push towards 3D-ICs. Designers need to see mechanical and thermal effects during layout, not just as a post-layout check.
- **How**: Leverage the installed `three` and `@react-three/fiber` / `@react-three/drei` libraries. Map the 2D layout to 3D STEP models and apply heat-map shaders based on estimated power dissipation of the `circuit-json` components.
- **Effort**: L (Foundation) to XL (Accurate Physics)
- **Priority**: P1
- **Competitive moat**: High. True real-time 3D thermal feedback is rare outside of enterprise tools like Altium.
- **Personas served**: Professional electrical engineer

### IN-04: Git-Style Design Variants & Multi-BOM Management
- **What**: Native support for managing multiple hardware versions (e.g., "Pro", "Lite", "Region-specific") within a single project, similar to Git branches.
- **Why**: Hardware startups struggle to manage variations of a board. KiCad 10.0 recently introduced design variants. We can leapfrog them by making it a core GitOps workflow using our structured JSON data.
- **How**: Utilize the deterministic nature of `circuit-json`. Store changes as diffs in the PostgreSQL database using `drizzle-orm`. Provide a UI to switch branches and merge schematic changes, outputting distinct BOMs.
- **Effort**: M
- **Priority**: P2
- **Competitive moat**: High. Hardware version control is an unsolved problem for most web-based EDA tools.
- **Personas served**: Hardware startup founder, Professional electrical engineer

### IN-05: Whiteboard-to-Schematic Sketching (Tldraw integration)
- **What**: A mode where users can freely draw shapes and text on a canvas, which the AI then converts into strict schematic nodes and wires.
- **Why**: Early-stage hardware design happens on napkins and whiteboards. Bridging the gap between a messy sketch and a strict netlist reduces friction.
- **How**: Integrate the `tldraw` dependency (already in `package.json`) for freeform sketching. Pass the canvas SVG/image to Gemini Vision to interpret the sketch and generate the corresponding `@xyflow/react` nodes and `circuit-json`.
- **Effort**: M
- **Priority**: P2 (nice-to-have)
- **Competitive moat**: Medium.
- **Personas served**: Hobbyist maker, Hardware startup founder

### IN-06: Live Supply Chain & Pricing Nodes
- **What**: Components on the `@xyflow/react` canvas automatically display their current price and stock status (e.g., green for in-stock, red for backordered).
- **Why**: Out-of-stock components ruin manufacturing runs. Flux.ai introduced real-time supply chain visibility in 2026. This is a must-have for modern EDA.
- **How**: Connect component metadata in the `circuit-json` to the Octopart or Mouser API via the `express` backend. If a part goes out of stock, provide an AI-driven "Find Drop-in Replacement" button.
- **Effort**: M
- **Priority**: P1
- **Competitive moat**: Medium.
- **Personas served**: Professional electrical engineer, Hardware startup founder

## Moonshot Section

### Natural Language to Functional PCB (Zero-to-One Generation)
- **Idea**: A prompt input: "I need a USB-C powered ESP32 dev board with an environmental sensor and a 128x64 OLED display." The system outputs the complete schematic, places the components, routes the board, and prepares the Gerber files.
- **Why it matters**: This is the holy grail of EDA. It turns anyone into a hardware creator, expanding the market from engineers to software devs and tinkerers.
- **Approach**: Chain specialized AI agents. Agent 1: Component selection & BOM generation. Agent 2: Netlist wiring. Agent 3: `@tscircuit/capacity-autorouter` constraints.

### "Green Silicon" Carbon & Cost Optimizer
- **Idea**: A real-time dashboard that calculates the lifetime energy footprint and manufacturing cost of the board, suggesting lower-power or cheaper alternatives (e.g., "Swapping this LDO for a buck converter saves 0.5W and reduces carbon footprint by X").
- **Why it matters**: Sustainability is a major 2026 regulatory trend (e.g., EU AI Act, carbon-aware optimization).

## Integration Opportunities

These are high-value, low-effort features enabled by dependencies already present in `package.json`:

1. **Automated Datasheet & Pitch Deck Generation (`pdfkit`)**:
   - You already have `pdfkit` installed. Use it to automatically generate investor-ready or documentation-ready PDFs containing the 3D render, BOM, schematic, and AI-written descriptions of the circuit.
2. **Advanced Layout Interactions (`@dnd-kit/core` & `@xyflow/react`)**:
   - Deeply integrate the drag-and-drop primitives to allow grouping, snapping, and grid-based precise alignment of components, bringing the web UI parity closer to native desktop tools.
3. **Interactive Guided Tours & Tutorials (`@radix-ui/react-popover` & `@radix-ui/react-tooltip`)**:
   - Since `radix-ui` is heavily used, build an interactive onboarding flow for new users, reducing the steep learning curve typical of EDA tools.

## Research Links

- [2026 EDA Trends: Agentic AI, Chiplets, and Co-packaged Optics](https://semiengineering.com/)
- [Flux.ai Spring 2026 Update: Steerable AI & Human-Style Routing](https://www.flux.ai/features)
- [KiCad 10.0 Release Notes: Design Variants & STEP-First Libraries](https://www.kicad.org/discover/features/)
- [Sustainable EDA: FLOPS-per-Watt and Carbon-Aware Optimization](https://www.eetimes.com/)
