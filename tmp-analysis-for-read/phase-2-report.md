# Phase 2: Competitive Gap Analysis -- ProtoPulse

> Generated: 2026-02-28
> Refined: 2026-02-28 (cross-phase calibration)
> Competitors analyzed: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle/Fusion Electronics, OrCAD, Flux.ai

## Executive Summary

ProtoPulse occupies a unique niche as a **browser-based, AI-first EDA platform** focused on system-level architecture design, BOM management, and AI-assisted validation. Its closest competitors in approach are **Flux.ai** (browser-based + AI) and **EasyEDA** (browser-based + manufacturing integration). However, ProtoPulse currently lacks several table-stakes EDA features that competitors offer, most critically: **actual PCB layout with copper routing, a 3D board viewer, production-quality Gerber/ODB++ export, autorouting, and real-time multi-user collaboration**. Its strongest competitive advantages are the **78-action AI chat system with native tool use, dual AI provider support (Claude + Gemini), architecture-first design philosophy, and integrated DRC/ERC/simulation pipeline** -- capabilities that most traditional EDA tools either lack entirely or are just beginning to add.

**Cross-phase refinements applied**: AI tool count corrected to 78 (from 53 in CLAUDE.md; Phase 1 inventory found 25 additional tools from circuit-routes additions). Priority recalibrations for FG-22 (design import, P2->P1) and FG-23 (real supplier APIs, P2->P1) based on Phase 1/3 evidence. Feasibility prerequisites added based on Phase 4 technical debt findings. Flux.ai deep-dive added as primary competitive threat. AI scaling limitations noted from Phase 4 analysis.

---

## Gap Matrix

### Legend
- **Y** = Feature fully present and mature
- **P** = Feature partially implemented or limited
- **N** = Feature absent
- Classification column rates ProtoPulse vs the competitive landscape

### Core EDA Capabilities

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| Schematic capture (symbol placement, wiring) | P (circuit-level via SchematicView) | Y | Y | Y | Y | Y | Y | Y | **Weak** |
| Architecture block diagrams | Y (@xyflow/react with 78 AI actions) | N | N | N | N | N | N | N | **Strong** |
| PCB layout (copper routing, layer stack) | P (PCBLayoutView exists but limited) | Y | Y | Y | P | Y | Y | Y | **Missing** |
| Breadboard view | Y (BreadboardView with grid model) | N | N | N | Y | N | N | N | **Strong** |
| Autorouter | N | P (via FreeRouting) | Y | Y (EasyEDA Pro) | Y (basic) | Y | Y | P | **Missing** |
| Push-and-shove interactive router | N | Y | Y | Y (Pro) | N | N | Y | N | **Missing** |
| Differential pair routing | N | Y | Y | Y (Pro) | N | Y | Y | N | **Missing** |
| Multi-layer PCB support | N | Y (32+ layers) | Y (unlimited) | Y (up to 32) | P (2 layers) | Y | Y | Y | **Missing** |
| Design Rule Check (DRC) | Y (spatial grid + 6 rule types) | Y (comprehensive) | Y (comprehensive) | Y | P | Y | Y | Y | **Partial** |
| Electrical Rule Check (ERC) | Y (pin type classification, net analysis) | Y | Y | Y | N | Y | Y | Y | **Partial** |
| SPICE simulation | Y (client MNA + ngspice server fallback) | Y (ngspice integrated) | Y (built-in) | Y (ngspice) | P (basic simulator) | Y | Y (PSpice) | P | **Partial** |
| 3D board viewer | N | Y (raytracer) | Y (real-time) | Y (Pro) | N | Y (via Fusion) | Y | Y | **Missing** |
| ECAD-MCAD integration | N | P (STEP export) | Y (MCAD CoDesigner) | N | N | Y (Fusion 360) | Y | N | **Missing** |
| Hierarchical schematic sheets | Y (create_sheet, move_to_sheet AI actions) | Y | Y | Y (Pro) | N | Y | Y | Y | **Partial** |

### Component & Library Management

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| Component library (built-in) | P (componentLibrary table, community) | Y (extensive official) | Y (Manufacturer Content) | Y (millions via LCSC) | P (limited) | Y (1M+) | Y (1.6B via Live BOM) | Y (750K+) | **Weak** |
| Custom part editor | Y (full: shapes, connectors, views) | Y | Y | Y | Y | Y | Y | Y | **Partial** |
| FZPZ import/export | Y (server/component-export.ts) | N | N | N | Y (native) | N | N | N | **Strong** |
| Real-time pricing/stock | P (stock field in BOM, AI pricing_lookup -- **all data is AI-simulated, no real APIs**) | N (via plugins) | Y (Octopart) | Y (LCSC integrated) | N | N | Y (Live BOM) | Y (live pricing + availability) | **Weak** |
| Parametric search | Y (AI parametric_search action) | P (symbol filters) | Y | Y | N | P | Y (extensive) | Y (750K+ filterable) | **Partial** |
| Datasheet linking | Y (datasheetUrl in PartMeta) | Y | Y | Y | P | Y | Y | Y (datasheet-aware AI) | **Strong** |
| Component versioning | Y (version field in componentParts) | P | Y | N | N | N | Y | N | **Partial** |

### BOM & Procurement

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| BOM management | Y (full CRUD, status tracking) | Y (basic export) | Y (ActiveBOM) | Y (JLCPCB BOM) | P | Y | Y (Live BOM) | Y | **Strong** |
| BOM export (CSV) | Y (multiple formats: generic, JLCPCB, Mouser, Digi-Key) | Y | Y | Y | Y | Y | Y | Y | **Strong** |
| Supplier-specific BOM | Y (JLCPCB, Mouser, Digi-Key generators) | N | P | Y (JLCPCB) | N | N | Y | P | **Strong** |
| Lead time tracking | Y (leadTime field, check_lead_times AI action -- **simulated data**) | N | Y | P | N | N | Y | Y (live data) | **Weak** |
| BOM optimization | Y (optimize_bom AI action) | N | P | N | N | N | P | Y (passive consolidation) | **Partial** |
| Alternative part suggestions | Y (suggest_alternatives AI action) | N | Y | N | N | N | Y | Y | **Strong** |

### AI & Automation

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| AI chat assistant | Y (78 action types, SSE streaming) | N | N | N | N | N | N | Y (Copilot, ACU-metered) | **Strong** |
| AI architecture generation | Y (generate_architecture action) | N | N | N | N | N | N | Y (block diagram via Copilot) | **Strong** |
| AI-powered validation | Y (auto_fix_validation, dfm_check, thermal_analysis) | N | P (automated DRC) | N | N | N | P | Y (Find Issues shortcut) | **Strong** |
| Natural language design | Y (78 in-app action types via chat) | N | N | N | N | N | N | Y (text-to-circuit, Copilot Shortcuts) | **Partial** |
| Multi-model routing | Y (Claude + Gemini, 5 routing strategies) | N | N | N | N | N | N | N | **Strong** |
| Native tool use (function calling) | Y (Anthropic + Gemini tool APIs) | N | N | N | N | N | N | Y (Library, Calculator, Code Interpreter tools) | **Strong** |
| AI action audit log | Y (aiActions table) | N | N | N | N | N | N | N | **Strong** |
| Power budget analysis (AI) | Y (power_budget_analysis action) | N | P (PDN Analyzer) | N | N | N | Y (power integrity) | N | **Partial** |
| Voltage domain check (AI) | Y (voltage_domain_check action) | N | P | N | N | N | P | N | **Partial** |
| AI-learned user preferences | N | N | N | N | N | N | N | Y (Copilot Knowledge) | **Missing** |
| AI FMEA report generation | N | N | N | N | N | N | N | Y (Copilot Shortcut) | **Missing** |
| AI test plan generation | N | N | N | N | N | N | N | Y (Copilot Shortcut) | **Missing** |
| AI component comparison tables | N | N | N | N | N | N | N | Y (Copilot Shortcut) | **Missing** |

### Export & Manufacturing

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| Gerber export | P (generator exists but no real PCB data) | Y | Y | Y | Y | Y | Y | Y | **Weak** |
| ODB++ export | N | Y | Y | N | N | N | Y | N | **Missing** |
| IPC-2581 export | N | Y | Y | N | N | N | Y | N | **Missing** |
| KiCad netlist export | Y (kicad-exporter.ts) | Y (native) | Y | Y (import) | N | Y (import) | Y | N | **Partial** |
| SPICE netlist export | Y (spice-exporter.ts) | Y | Y | Y | N | Y | Y (PSpice native) | N | **Strong** |
| Pick-and-place export | Y (pick-place-generator.ts) | Y | Y | Y | N | Y | Y | Y | **Partial** |
| Drill file export | Y (drill-generator.ts) | Y | Y | Y | Y | Y | Y | Y | **Partial** |
| Eagle format export | Y (eagle-exporter.ts) | Y (import) | Y (import) | Y (import) | N | Y (native) | Y (import) | N | **Partial** |
| PDF export | Y (pdf-generator.ts) | Y | Y | Y | Y | Y | Y | Y | **Partial** |
| Design report | Y (generateDesignReportMd) | N | Y | N | N | N | P | N | **Strong** |
| One-click PCB ordering | N | N | N | Y (JLCPCB native) | Y (Fritzing Fab) | N | N | Y | **Missing** |
| **Design import (KiCad/Altium/Eagle)** | **N (FZPZ only)** | Y (native) | Y (import) | Y (multi-format) | Y (FZPZ native) | Y (native) | Y (import) | **Y (KiCad + Altium + Cadence)** | **Missing** |

### Collaboration & Platform

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| Browser-based (no install) | Y | N (desktop) | N (desktop) | Y | N (desktop) | N (desktop) | N (desktop) | Y | **Strong** |
| Real-time multi-user editing | N | N | Y (Altium 365) | P | N | N | P (OrCAD X Cloud) | Y (up to 20 editors) | **Missing** |
| Version control / history | Y (historyItems table) | P (Git-friendly files) | Y (Altium 365) | P | N | N | Y (OrCAD X Cloud) | Y | **Partial** |
| Design review / commenting | N | N | Y (Altium 365) | P | N | N | Y | Y | **Missing** |
| Offline mode | N (server-dependent) | Y (native desktop) | Y (native desktop) | Y (Pro only) | Y (native desktop) | Y (native desktop) | Y (native desktop) | N | **Missing** |
| User authentication | Y (session-based, encrypted API keys) | N/A | Y | Y | N/A | Y | Y | Y | **Strong** |
| Project management | Y (projects table, soft deletes) | P (project files) | Y | Y | P | P | Y | Y | **Partial** |
| Multi-project support | N (PROJECT_ID = 1 hardcoded) | Y | Y | Y | Y | Y | Y | Y (unlimited with Pro) | **Missing** |

### Simulation & Analysis

| Feature | ProtoPulse | KiCad | Altium | EasyEDA | Fritzing | Eagle | OrCAD | Flux.ai | Classification |
|---------|-----------|-------|--------|---------|----------|-------|-------|---------|----------------|
| DC operating point | Y (MNA solver) | Y | Y | Y | P | Y | Y | P | **Partial** |
| Transient analysis | Y (Backward Euler RC/RL) | Y | Y | Y | P | Y | Y | N | **Partial** |
| AC analysis | N (SPICE export only) | Y | Y | Y | N | Y | Y (PSpice) | N | **Missing** |
| DC sweep | Y (basic) | Y | Y | Y | N | Y | Y | N | **Partial** |
| Monte Carlo / statistical | N | N | P | N | N | N | Y (PSpice) | N | **Missing** |
| Signal integrity analysis | N | P (plugin) | Y | N | N | P | Y | N | **Missing** |
| Thermal analysis | P (AI-driven, not physics-based) | N | Y (plugin) | N | N | N | Y | N | **Weak** |
| Power integrity / PDN | P (AI power_budget_analysis) | N | Y (PDN Analyzer) | N | N | N | Y | N | **Weak** |

---

## Top 10 Missing Features

| Rank | Feature | Which Competitors Have It | User Impact | Impl. Complexity | Prerequisites (Phase 4) |
|------|---------|---------------------------|-------------|-------------------|------------------------|
| 1 | **Production-quality PCB layout with copper routing** | KiCad, Altium, EasyEDA, Eagle, OrCAD, Flux.ai | Critical -- engineers cannot go from design to manufacturing without this; single biggest reason to choose a competitor | XL (months) | **BLOCKED: PCBLayoutView CCN=135 must be refactored first (TD-01)** |
| 2 | **3D board viewer** | KiCad (raytracer), Altium (real-time), EasyEDA Pro, Eagle (Fusion), OrCAD, Flux.ai | High -- mechanical fit verification, stakeholder review, documentation; expected by all professional users | L (weeks) | Clean -- additive work |
| 3 | **Autorouter / interactive router** | KiCad (FreeRouting), Altium, EasyEDA Pro, Eagle, OrCAD, Flux.ai | High -- manual routing of complex boards is impractical; essential for productivity | XL (months) | Depends on FG-01 (needs real PCB layout first) |
| 4 | **Design import (KiCad/Altium/Eagle)** | All 7 competitors (Flux.ai imports KiCad + Altium + Cadence) | **Critical** -- professional engineers will not adopt a tool they cannot import existing designs into; Phase 3 rated this a "critical dead-end" | L (weeks) | Clean -- existing export infrastructure provides patterns; additive work not blocked by debt |
| 5 | **Real supplier APIs for BOM pricing/stock** | Altium (Octopart), EasyEDA (LCSC), OrCAD (Live BOM 1.6B parts), Flux.ai (live pricing) | **Critical** -- Phase 1 confirmed ALL procurement data is AI-simulated; pricing, stock, lead times shown to users are fabricated; undermines trust in entire procurement feature | M (days) | Clean -- additive API integration work |
| 6 | **Multi-project support** | All 7 competitors | High -- hardcoded PROJECT_ID = 1 blocks any real-world use beyond single-project prototyping | M (days) | Clean -- schema + context changes |
| 7 | **Real-time multi-user collaboration** | Altium 365, Flux.ai (20 editors), OrCAD X Cloud; EasyEDA (partial) | High -- hardware teams are 2-5 people; collaboration is a workflow blocker without it | XL (months) | **BLOCKED: Requires PROJECT_ID=1 removal (TD-02) + DB migrations (TD-03) + context split (TD-07)** |
| 8 | **One-click PCB ordering / fab house integration** | EasyEDA (JLCPCB), Fritzing (Fritzing Fab), Flux.ai | Medium-High -- reduces friction from design to physical board; strong differentiator for hobbyist/startup personas | M (days) | Depends on FG-01 (needs real PCB data to submit) |
| 9 | **ODB++ / IPC-2581 export** | KiCad, Altium, OrCAD | Medium-High -- modern manufacturing requires these; Gerber alone is increasingly insufficient for complex boards | M (days) | **Partially blocked: dual export system (TD-10) should be resolved first** |
| 10 | **Component library with 10K+ parts** | EasyEDA (millions), KiCad (official), OrCAD (1.6B), Flux.ai (750K+) | High -- designers won't manually create every part | L (weeks) | **Partially blocked: ai-tools.ts (1,677 lines, TD-09) must split before adding AI-powered library tools** |

---

## Competitive Advantages

| Advantage | Evidence | Moat Durability | Scaling Caveat (Phase 4) |
|-----------|----------|-----------------|--------------------------|
| **78-action AI chat system with native tool use** | `server/ai.ts`: 78 AIAction types (25 more than documented), `server/ai-tools.ts`: full tool registry with Zod validation, SSE streaming, dual Anthropic+Gemini support | **High** -- Flux.ai has Copilot with ~12 capabilities (Library, Calculator, Code Interpreter, 8 Shortcuts); ProtoPulse has 6x the action breadth with audit logging | AI prompt rebuilds full project state per request -- O(n) scaling. A 100-node project sends ~50KB context per AI call. This will degrade response quality and increase latency/cost as projects grow. Flux.ai likely has the same challenge but has had more time to optimize. |
| **Architecture-first design approach** | `ArchitectureView.tsx` + @xyflow/react block diagrams; unique to ProtoPulse among all analyzed competitors | **High** -- traditional EDA starts at schematic; architecture-first is a novel workflow none replicate. Flux.ai can generate Mermaid block diagrams via Copilot but it's a documentation feature, not a first-class design canvas. | None -- architecturally clean |
| **Multi-model AI routing (5 strategies)** | `ai.ts`: RoutingStrategy = 'user' | 'auto' | 'quality' | 'speed' | 'cost'; MODEL_TIERS for both providers | **Medium** -- first-mover advantage; competitors will eventually add multi-model but ProtoPulse has head start | Effectiveness limited by O(n) prompt size -- model routing savings are offset by large context windows |
| **Dual AI provider (Claude + Gemini)** | `ai.ts` imports both `@anthropic-ai/sdk` and `@google/genai`; full model tier mapping | **Medium** -- vendor diversification; Flux.ai uses ACU-metered AI (likely single provider) | None |
| **Supplier-specific BOM export (4 formats)** | `export-generators.ts`: Generic CSV, JLCPCB, Mouser, Digi-Key specific formats | **Medium** -- OrCAD has Live BOM but not multi-supplier export; unique value for procurement | **Undermined by simulated data**: exports are formatted correctly but the underlying pricing/stock data is AI-generated, not from real APIs. Fixing FG-23 would make this advantage real. |
| **AI action audit log** | `aiActions` table in schema: tracks every tool execution with parameters and results | **Medium** -- compliance/traceability for regulated industries; no competitor has this | None |
| **Browser-native with zero install** | Full SPA with Express backend; competes with EasyEDA and Flux.ai but adds AI capabilities they lack (EasyEDA) or matches (Flux.ai) | **Low** -- EasyEDA and Flux.ai also browser-based; advantage is in combination with AI | None |
| **FZPZ import/export compatibility** | `server/component-export.ts`: importFromFzpz, exportToFzpz; interoperability with Fritzing ecosystem | **Low** -- niche but valuable for Fritzing users migrating to a more capable tool | None |
| **Integrated breadboard + schematic + PCB views** | `BreadboardView.tsx`, `SchematicCanvas.tsx`, `PCBLayoutView.tsx` -- Fritzing-like breadboard + professional schematic | **Medium** -- only Fritzing has breadboard view among competitors; ProtoPulse adds schematic on top | None |

---

## Flux.ai Deep Dive -- Primary Competitive Threat

### Why Flux.ai Is the #1 Threat

Flux.ai occupies the **exact same niche** as ProtoPulse: browser-based, AI-first, targeting modern hardware teams. It is the only competitor that matches ProtoPulse on both the "browser-native" and "AI-powered" axes. Every other competitor is either desktop-only (KiCad, Altium, Eagle, OrCAD, Fritzing) or browser-based without AI (EasyEDA).

### Head-to-Head Comparison

| Dimension | ProtoPulse | Flux.ai | Winner |
|-----------|-----------|---------|--------|
| **AI action breadth** | 78 action types covering architecture, BOM, validation, export, simulation | ~12 capabilities (Library, Calculator, Code Interpreter, 8 Copilot Shortcuts) | **ProtoPulse** (6x more actions) |
| **AI architecture** | Dual-provider (Claude + Gemini), 5 routing strategies, audit log | Single-provider (likely Anthropic based on ACU naming), ACU-metered | **ProtoPulse** (more flexible) |
| **AI context awareness** | Full project state rebuilt per request (O(n) scaling) | Full project context including datasheets, design rules, user preferences (Copilot Knowledge) | **Flux.ai** (more mature context, learns preferences) |
| **Component library** | Small (user-created + community) | 750K+ parts with datasheets and specs | **Flux.ai** (750x larger) |
| **PCB layout maturity** | Stub (PCBLayoutView exists but minimal) | Full PCB design with AI-assisted routing, curved elbows, DRC | **Flux.ai** (production-ready) |
| **Design import** | FZPZ only | KiCad, Altium, Cadence project import | **Flux.ai** (professional formats) |
| **Collaboration** | None (single-user, PROJECT_ID=1) | Real-time multi-user (up to 20 editors on Pro) | **Flux.ai** (production-ready) |
| **Architecture diagrams** | First-class @xyflow/react canvas with AI generation | Mermaid block diagram generation (documentation, not design) | **ProtoPulse** (unique differentiator) |
| **Breadboard view** | Full breadboard with grid model | None | **ProtoPulse** (unique) |
| **BOM export formats** | 4 supplier-specific formats (JLCPCB, Mouser, Digi-Key, generic) | Standard export | **ProtoPulse** |
| **Pricing data** | AI-simulated (fabricated) | Live pricing and availability from real APIs | **Flux.ai** (real data) |
| **Simulation** | MNA solver + ngspice fallback (DC, transient, DC sweep) | Minimal (Calculator tool for budgets) | **ProtoPulse** |
| **SPICE export** | Yes (spice-exporter.ts) | No | **ProtoPulse** |
| **Pricing** | Self-hosted (free to run) | $20-$158/month per editor; ACU credits for AI | **ProtoPulse** (cost advantage) |
| **FMEA / test planning** | Not implemented | Copilot Shortcuts for FMEA and test plans | **Flux.ai** |
| **User preference learning** | Not implemented | Copilot Knowledge (learns design principles, part preferences, style guidelines) | **Flux.ai** |

### Strategic Assessment

**Where ProtoPulse leads:**
- AI action breadth (78 vs ~12) with audit trail
- Architecture-first workflow (unique, no competitor has this)
- Multi-model AI (Claude + Gemini with routing strategies)
- Simulation capabilities (MNA, ngspice, SPICE export)
- Breadboard view (only Fritzing otherwise has this)
- Self-hosted/free (Flux charges $20-$158/month per editor)
- BOM export diversity (4 supplier formats)

**Where Flux.ai leads:**
- PCB design maturity (full routing vs stub)
- Component library (750K+ vs small)
- Real-time collaboration (20 editors vs single-user)
- Design import (KiCad/Altium/Cadence vs FZPZ only)
- Real supplier data (live pricing vs simulated)
- User preference learning (Copilot Knowledge)
- FMEA and test plan generation
- Platform maturity (funded startup with dedicated team)

**The critical gap:** Flux.ai is a **complete EDA tool** that also has AI. ProtoPulse is an **AI-first tool** that lacks essential EDA features. For ProtoPulse to compete, it must close the EDA feature gaps (PCB layout, component library, design import) while maintaining its AI advantage. If ProtoPulse only improves AI while neglecting core EDA, Flux.ai will eventually match or exceed the AI capabilities while already having the EDA foundation.

**The strategic opportunity:** Flux.ai charges $20-$158/month per editor, with AI metered by ACU credits. ProtoPulse is self-hosted and free. If ProtoPulse can reach "good enough" EDA parity (not matching Altium, but matching the Flux.ai tier), the pricing advantage becomes decisive for cost-sensitive teams, indie hardware makers, and educational institutions.

---

## Market Positioning

### Differentiation Opportunities

These are areas where ProtoPulse can carve out unique positioning that no competitor currently occupies:

1. **AI-Native EDA Platform** -- Position as the first EDA tool where AI is not a bolt-on feature but the primary interaction model. The 78-action system, multi-model routing, and architecture generation are genuinely novel. Flux.ai is the closest competitor but its Copilot has ~12 capabilities vs ProtoPulse's 78. **Caveat**: this advantage erodes over time as Flux.ai expands Copilot. The window to establish dominance is finite.

2. **Architecture-to-Board Workflow** -- No competitor starts from system-level architecture block diagrams. This is a genuine gap in the market. Hardware startups typically use draw.io or Figma for architecture, then manually re-enter into EDA. ProtoPulse can own the "architecture-first" workflow. Flux.ai can generate Mermaid diagrams but they are documentation artifacts, not interactive design canvases.

3. **AI-Powered Procurement Intelligence** -- The combination of AI BOM optimization, alternative part suggestions, supplier-specific export, and lead time checking is stronger than any competitor in breadth. **However**: this advantage is currently hollow because all procurement data is AI-simulated. Connecting to real supplier APIs (FG-23) would transform this from a demo feature to a genuine competitive advantage.

4. **Regulated Industry Compliance via AI Audit Trail** -- The aiActions table creates a complete audit trail of every AI-driven design change. For aerospace, medical, and automotive electronics (where traceability is mandated by IEC 62304, DO-254, etc.), this is a unique selling point no competitor offers.

5. **Education & Maker Bridge** -- The breadboard view + AI assistant creates a unique "learning to professional" bridge. Fritzing is the education tool but lacks AI and professional features. KiCad is professional but intimidating for beginners. ProtoPulse can be both. The self-hosted/free model makes it accessible to educational institutions that cannot afford Flux.ai's per-seat pricing.

### Parity Requirements

These are table-stakes features where ProtoPulse **must** match competitors to avoid churn:

| Requirement | Why It's Table-Stakes | Nearest Competitor Benchmark | Prerequisites (Phase 4) |
|-------------|----------------------|------------------------------|-------------------------|
| Production-quality PCB layout | Cannot manufacture boards without it | KiCad (free), EasyEDA (free) | TD-01: Refactor PCBLayoutView (CCN=135) |
| Design import (KiCad/Altium/Eagle) | Engineers won't re-enter existing designs from scratch | Flux.ai (KiCad + Altium + Cadence import) | None -- additive work |
| Real supplier APIs for pricing/stock | Simulated data destroys user trust | Flux.ai (live), OrCAD (1.6B parts), EasyEDA (LCSC) | None -- additive API work |
| Multi-project support | Single-project is a demo, not a tool | All competitors | None -- schema + context changes |
| 3D board viewer | Expected by every professional user | KiCad (free, raytracing) | None -- additive work |
| Component library with 10K+ parts | Designers won't manually create every part | Flux.ai (750K+), EasyEDA (millions), KiCad (official library) | TD-09: Split ai-tools.ts (1,677 lines) |
| Gerber export from real PCB data | Current generator has no actual board data to export | All competitors | Depends on FG-01 (PCB layout) |

---

## Competitor Profiles

### KiCad
- **Strengths**: Free and open-source; full PCB design flow (schematic -> PCB -> Gerber/ODB++/IPC-2581); 3D viewer with raytracer; SPICE simulation (ngspice); huge community; Git-friendly file formats; KiCad 9 adds Zone Manager, embedded elements, via tenting control; v10 RC1 released Feb 2026
- **Weaknesses**: Desktop-only (no browser); no AI assistance; no real-time collaboration; steep learning curve for beginners; no built-in autorouter (FreeRouting external); no native BOM management; community-dependent support
- **Pricing model**: Completely free (open-source, GPL)
- **Target audience**: Professional engineers, advanced hobbyists, education
- **Key differentiator**: The gold standard for free, professional-grade PCB design

### Altium Designer
- **Strengths**: Industry-leading interactive router (push-and-shove, any-angle); ECAD-MCAD CoDesigner with SOLIDWORKS/Creo/Inventor/NX; Altium 365 cloud collaboration; ActiveBOM with Octopart integration; comprehensive DRC/ERC; signal integrity; PDN Analyzer; reusable design blocks; SPICE simulation
- **Weaknesses**: Very expensive ($1,495-$4,500/year); Windows-only; steep learning curve; vendor lock-in; no free tier
- **Pricing model**: Subscription $1,495-$4,500/year; perpetual license available with ~$1,750-$1,995/year maintenance
- **Target audience**: Professional engineering teams, enterprise, aerospace/defense/automotive
- **Key differentiator**: The most complete professional EDA suite with best-in-class routing and MCAD integration

### EasyEDA
- **Strengths**: Browser-based (Standard) with WebGL Pro version; tight JLCPCB/LCSC integration; millions of components; free to use; one-click PCB ordering; ngspice simulation; import from Altium/KiCad/Eagle/LTspice; supports 5,000+ components and 10,000+ pads; offline mode (Pro)
- **Weaknesses**: Standard version uses legacy SVG engine (laggy on large boards); component library biased toward LCSC stock; limited simulation compared to OrCAD/Altium; no AI assistance; vendor lock-in to JLCPCB ecosystem; limited collaboration beyond sharing
- **Pricing model**: Free (Standard); Free to try (Pro); JLCPCB monetizes through PCB orders
- **Target audience**: Hobbyists, students, cost-sensitive professionals, anyone using JLCPCB
- **Key differentiator**: Seamless browser-to-PCB-fabrication pipeline with JLCPCB

### Fritzing
- **Strengths**: Iconic breadboard view for prototyping/documentation; beginner-friendly; Arduino/maker ecosystem; open-source; breadboard -> schematic -> PCB flow; basic simulator (v1.0.0+); community part libraries (Adafruit, DFRobot)
- **Weaknesses**: Very limited for professional use; small built-in library; no advanced routing; 2-layer PCB only; no SPICE simulation; slow development pace; limited export formats; no collaboration; desktop-only
- **Pricing model**: ~$9 (one-time download); open-source
- **Target audience**: Beginners, Arduino/maker community, educators
- **Key differentiator**: The de facto tool for documenting breadboard prototypes

### Eagle / Fusion Electronics
- **Strengths**: 1M+ component library; SPICE simulator; modular design blocks; real-time schematic-PCB sync; Fusion 360 3D integration; DRC; autorouter; well-documented; large legacy user base
- **Weaknesses**: Being discontinued by Autodesk after June 2026; migrating to Fusion Electronics; uncertain long-term future; requires Fusion subscription; no free standalone tier anymore; no AI features
- **Pricing model**: Included with Autodesk Fusion subscription ($70-$165/month); no standalone option
- **Target audience**: Professional engineers already in Autodesk ecosystem; legacy Eagle users
- **Key differentiator**: Tight MCAD integration via Fusion 360 (but sunset creates uncertainty)

### OrCAD
- **Strengths**: Industry-proven PSpice simulator (DC, AC, transient, Monte Carlo, worst-case, noise); OrCAD X modernization with cloud features; Live BOM with 1.6B parts from 3,600 suppliers; constraint-driven routing; signal integrity; rigid-flex support; OrCAD X Presto for quick-turn; Cadence ecosystem (upgrade path to Allegro)
- **Weaknesses**: Expensive (~$1,280+/year); complex licensing; steep learning curve; Windows-centric; no AI features; no browser access; intimidating for beginners
- **Pricing model**: Subscription starting ~$1,280/year; perpetual licenses available with maintenance fees
- **Target audience**: Professional engineers, enterprises needing PSpice and signal integrity
- **Key differentiator**: Best-in-class mixed-signal simulation (PSpice) and component sourcing (Live BOM)

### Flux.ai
- **Strengths**: Browser-based with real-time collaboration (up to 20 editors on Pro); AI Copilot with Library Tool (750K+ parts), Calculator Tool, Code Interpreter, and 8 Copilot Shortcuts (FMEA, test plans, component comparison, issue finder, block diagrams, passive consolidation, pin listing, onboarding); Copilot Knowledge learns user preferences (design principles, part selection, style guidelines); natural language circuit design (text-to-circuit); live pricing and availability data; KiCad + Altium + Cadence project import; curved trace elbows with per-net control; version control; modern UX; growing fast; backed by significant funding
- **Weaknesses**: Relatively new (less mature than KiCad/Altium); expensive ($20-$158/month per editor); AI metered by ACU credits (can be limiting); smaller component library than EasyEDA/OrCAD (750K vs millions/billions); less proven for complex/high-speed designs; no SPICE simulation; no architecture-first workflow; no breadboard view; no multi-model AI routing
- **Pricing model**: Free trial (14 days); Starter $20/month ($16/month annual); Pro $142/month ($112/month annual) per editor; Teams $158/month ($120/month annual) per editor; Enterprise custom
- **Target audience**: Modern hardware teams, startups, engineers wanting AI assistance
- **Key differentiator**: The most mature AI-integrated PCB design tool with real-time collaboration and live supply chain data

---

## Competitive Landscape Summary

### Market Segments

| Segment | Leader | ProtoPulse Position |
|---------|--------|-------------------|
| Enterprise / high-reliability | Altium, OrCAD | Not competitive (missing PCB layout, signal integrity) |
| Professional / mid-market | KiCad, Altium | Not competitive yet (missing PCB layout, 3D viewer) |
| Browser-based / cloud | EasyEDA, Flux.ai | Competitive on AI; weak on PCB features and design import |
| Education / maker | Fritzing, KiCad | Strong potential (breadboard + AI assistant + free) |
| AI-assisted design | Flux.ai | Direct competitor; stronger on action breadth and simulation, weaker on PCB maturity and component library |
| Architecture-first design | **Nobody** | **Uncontested leader** |

### Threat Assessment

| Competitor | Threat Level | Rationale |
|------------|-------------|-----------|
| Flux.ai | **Critical** | Same niche (browser + AI); more mature PCB features; 750K+ component library; real-time collab for 20 editors; live supplier data; KiCad/Altium/Cadence import; growing fast with funding; direct feature overlap on every dimension except architecture diagrams and simulation |
| EasyEDA | **Medium** | Free browser-based PCB with JLCPCB integration; massive user base; could add AI |
| KiCad | **Medium** | Free and comprehensive; dominant in open-source; no AI but community plugins could emerge |
| Altium | **Low** | Different market segment (enterprise, $$$); unlikely to compete on price/accessibility |
| OrCAD | **Low** | Enterprise tool; no browser/AI; different market |
| Fritzing | **Low** | Stagnating; limited features; ProtoPulse breadboard view is already competitive |
| Eagle | **Low** | Being sunset in 2026; declining relevance |

---

## Research Methodology

- **Primary research**: WebSearch for each competitor's feature pages, pricing, changelogs, and reviews (2025-2026); Flux.ai deep-dive via blog posts, pricing page, and Copilot documentation
- **Codebase evidence**: Direct examination of ProtoPulse source files (schema.ts, ai.ts, routes.ts, component-types.ts, circuit-types.ts, simulation.ts, export-generators.ts, all view components) to verify feature classifications
- **Cross-phase validation**: Phase 1 (current state inventory), Phase 3 (UX friction), Phase 4 (technical debt/complexity metrics) used to calibrate priorities and add feasibility context
- **Classification rigor**: Every "Strong" or "Missing" classification is backed by either codebase evidence (for ProtoPulse) or verified competitor documentation. Features marked "unverified" are noted.
- **Date of research**: 2026-02-28

### Sources

- [Flux.ai - Design PCBs with AI](https://www.flux.ai/)
- [Flux Copilot: Under the Hood](https://www.flux.ai/p/blog/flux-copilot-under-the-hood)
- [Flux Pricing](https://www.flux.ai/p/pricing)
- [8 New AI Capabilities for Faster PCB Design](https://www.flux.ai/p/blog/8-new-ai-capabilities-for-faster-pcb-design)
- [Design Circuits with Natural Language: Copilot Upgrade](https://www.flux.ai/p/blog/design-circuits-with-natural-language-copilot-upgrade)
- [Flux Upgrade Graduates AI Assistant to AI Circuit Co-Designer](https://www.allaboutcircuits.com/news/flux-upgrade-graduates-ai-assistant-ai-circuit-co-designer/)
- [AI Assistance Inside Every ECAD Tool: What PCB Designers Can Do in 2026](https://www.flux.ai/p/blog/ai-assistance-inside-every-ecad-tools)
- [FluxAI Review 2026](https://aichief.com/ai-business-tools/fluxai/)
