# Phase 2: Competitive Gap Analysis -- ProtoPulse

> Generated: 2026-05-18
> Competitors analyzed: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle/Fusion Electronics, OrCAD, Flux.ai
> Evidence basis: Direct inspection of ViewRenderer.tsx (30+ ViewModes), FEATURE_MATURITY.md (live verified maturities as of Mar 2026), prior 3D deep-dive (phase-2-report-3d.md + BoardViewer3DView + board-viewer-3d.ts code reads), WebSearch on official sites + 2026 release notes, chrome-devtools navigation + full-page screenshots of feature pages, domain-detection reference, CLAUDE.md, MASTER_BACKLOG.md, and key view source.

## Executive Summary

ProtoPulse is a **broad, modern, integrated Electronics Prototyping & Maker Platform** (React 19 + TypeScript + Tauri desktop + Express + extensive custom tooling). It spans the full maker journey: idea/generative → architecture → schematic/breadboard/PCB/3D → simulation/validation → procurement/supply-chain/inventory → hardware-in-the-loop (serial, Arduino, digital twin) → documentation/audit/community/education.

Unlike traditional ECAD tools focused narrowly on schematic→PCB→output, ProtoPulse owns many adjacent surfaces (inventory, procurement workflows, educational labs, physical hardware debug, generative design, knowledge base). This creates strong differentiation for hobbyists, educators, startups, and integrated hardware teams, but leaves depth gaps in classic professional ECAD strengths (production 3D/MCAD, high-speed constraints, massive community libraries, real-time collab).

## Gap Matrix

| Feature Dimension                  | ProtoPulse                          | KiCad (v10 2026)          | Altium Designer          | EasyEDA (Pro)             | Fritzing                | Fusion Electronics (Eagle successor) | OrCAD                  | Flux.ai                     | Classification |
|------------------------------------|-------------------------------------|---------------------------|--------------------------|---------------------------|-------------------------|--------------------------------------|------------------------|-----------------------------|----------------|
| Breadboard / Visual Prototyping   | Partial (core view exists, maturity Partial per audit) | Basic / external         | Limited (3D focus)      | Good browser preview     | **Strong** (core identity, realistic sync) | Moderate 3D emphasis                | Limited                | Moderate                    | Weak vs Fritzing; Partial overall |
| Schematic Capture (Graphical)     | Production (full editor, push to PCB) | **Strong** (hierarchical, variants, ERC) | **Strong** (enterprise) | **Strong** (Pro scale)   | Functional (sync)      | Strong                              | **Strong**             | Strong + AI assist         | Strong (parity) |
| PCB Layout / Routing / DRC        | Functional (layout, push, validation/DRC exists) | **Strong** (interactive router, time-domain tuning v10, design blocks, custom DRC) | **Industry leader**     | **Strong** (WebGPU, reuse blocks, comparison) | Basic autorouter + pours | Strong (Fusion unified)            | **Strong** (high-end) | Strong + AI auto-route     | Partial / Weak on advanced |
| 3D Visualization & MCAD           | Production view but **Weak** (CSS 3D only; dead 1.3k LOC WebGL; no STEP, no orbit, no realistic materials) | **Strong** (raytrace, STEP models, trackball, export) | **Strongest** (MCAD CoDesigner bidirectional + copper) | Strong (WebGPU + STEP + shell) | Basic                  | **Strong** (native unified MCAD in Fusion) | Strong (via integration) | Moderate browser 3D        | **Missing/Weak** (big gap) |
| Simulation (SPICE / Analysis)     | Functional (DC OP, probes, waveform) | **Strong** (integrated SPICE) | Strong (Ansys etc.)     | **Strong** (LTSpice)     | Limited                | Good (thermal/mech in Fusion)      | **Leader** (Sigrity SI/PI) | Moderate + AI analysis    | Partial |
| Supply Chain / Live BOM / Pricing | Strong surface (procurement, AVL, BOM compare, ordering wizard) | Partial (external plugins/BOM) | Strong (managed + 365)  | **Excellent** (JLCPCB/LCSC direct) | Basic BOM export      | Good (Fusion ecosystem)            | Strong                 | **Strong** (sourcing-aware AI + live data) | Strong vs some; Partial vs EasyEDA/Flux depth |
| Inventory / Personal Parts Mgmt   | **Strong** (storage bins, labels, personal inventory, part usage/alternates) | Missing / external      | Partial (vault/365)     | Partial (cloud libs)     | Missing                | Cloud project libs                 | Enterprise vault       | Partial (project)          | **Strong** (unique) |
| AI / Generative / Copilot         | Strong surface (generative, architecture suggestions, troubleshooter, chat); some Stub/Partial maturity | Growing (Python/scripts) | Moderate (Copilot?)     | Moderate                 | None                   | Moderate (Autodesk AI)             | Limited                | **Leader** (agentic multi-step, steerable) | Strong in vision; Partial in execution vs Flux |
| Real-time Collaboration           | Design history + comments + snapshots (strong versioning) | None native (Git/manual) | Strong (Altium 365)     | **Strong** (real-time team) | Community sharing     | Cloud collab (Fusion)              | Enterprise             | **Strong** (browser collab) | Partial (good async; missing live multi-user) |
| High-Speed / Advanced Constraints | Basic DRC in validation          | **Strong** (v10 time-domain, diff pairs, length tuning) | **Strong** (SI/PI, constraints) | Strong (Pro)            | None                   | Good for Fusion                     | **Leader**             | Good AI assist             | **Missing** for pros |
| Multi-board / Harness / System    | Limited (architecture view helps) | Partial (v10 blocks)    | **Strong** (multi-board + harness) | Strong (Pro)           | None                   | Moderate (assemblies)              | Strong                 | Limited                    | **Missing** |
| Educational / Beginner Ramp       | **Excellent** (labs, starter circuits, Arduino workbench, breadboard, knowledge) | Good docs/community     | Steep                    | Good (Std tier)          | **Excellent** (breadboard teaching) | Good (maker-friendly)             | Steep                  | Good for AI-assisted start | **Strong** (differentiator) |
| Desktop + Modern UX + Extensibility | **Strong** (Tauri desktop, React 19, many views, page skills) | Good (native Qt, Python plugins) | Legacy Windows-heavy    | Strong (browser + desktop client) | Good (native)         | Cloud + desktop Fusion             | Legacy enterprise      | **Strong** (modern browser) | **Strong** (modern moat) |
| Exports / Manufacturing Readiness | Strong (output panel, Gerber implied, STEP attempts, PCB ordering flow) | **Strong** (mature)     | **Industry standard**   | **Excellent** (one-click JLC) | Good (Gerber + Fab)   | Strong (ODB++)                      | Strong                 | Strong (standard outputs)  | Parity / Strong |

## Top 10 Most Impactful Gaps (ranked by churn / user value risk)

| Rank | Gap / Missing Capability                  | Which Competitors Excel                          | User Impact (Personas)          | ProtoPulse Evidence / Status                  | Est. Effort |
|------|-------------------------------------------|--------------------------------------------------|---------------------------------|-----------------------------------------------|-------------|
| 1    | Production 3D + MCAD co-design (real GPU, STEP import, realistic render, collision, enclosure sync, high-quality exports) | KiCad, Altium (CoDesigner), EasyEDA, Fusion | High (all personas: fit checks, DFM, investor demos, mech sign-off) | CSS 3D only; dead webgl-viewer.ts; no STEP binding; no MCAD sync | XL |
| 2    | Deep, trustworthy real-time/advanced DRC/ERC + visual violation resolution + high-speed rules | KiCad v10, Altium, EasyEDA Pro, OrCAD | High (pro EE; startup DFM)     | Validation view + custom DRC exists (Production per audit) but depth/automation lags pro tools | L–XL |
| 3    | Seamless live part pricing, stock, sourcing-aware design inside editors | EasyEDA (JLC), Flux (AI sourcing), Altium | High (all; especially startups) | Procurement + BOM tools strong, but not as embedded/live as competitors during layout | M–L |
| 4    | High-speed design (length/timing tuning, controlled impedance, advanced diff pairs, SI tools) | KiCad 10, Altium, OrCAD, EasyEDA Pro | High for professional / high-reliability | Basic support; no dedicated time-domain or advanced constraint UI | XL |
| 5    | Real-time multi-user live collaboration (cursors, simultaneous edits, project locking) | EasyEDA, Flux, Altium 365, Fusion | High (teams, startups)         | Excellent async (history, snapshots, comments, audit trail); no live CRDT/multiplayer | L–XL |
| 6    | Rich, community-contributed component library with high-quality 3D models + easy contribution | KiCad (huge + STEP), EasyEDA, Fritzing (FZPZ) | High (speed of design for all) | Custom + community views exist; scale and 3D model coverage likely smaller | L–XL (ecosystem) |
| 7    | Mature AI agentic workflows (reliable multi-step schematic/layout generation, self-correction at pro complexity) | Flux.ai (leader 2026)                           | Medium-High (startups, rapid iteration) | Strong surface + architecture suggestions; generative currently Stub (client heuristics in some paths) | L |
| 8    | Multi-board / system-level / harness design | Altium (strongest), EasyEDA Pro, OrCAD         | Medium (complex products)      | Architecture view + some support; not first-class | XL |
| 9    | Breadboard view fidelity + robust bidirectional sync with other editors | Fritzing (best-in-class for teaching)          | High for hobbyist/education    | Exists but Partial maturity; sync issues noted in audits | M–L |
| 10   | Advanced simulation depth + in-design analysis (thermal, SI/PI, full waveform with probing) | KiCad, OrCAD (Sigrity), Altium, EasyEDA (LTSpice) | Medium (validation personas)   | Functional simulation surface; not as deep/mature | L–XL |

## Competitive Advantages ProtoPulse Already Has

| Advantage                              | Evidence (Code + Research)                                                                 | Moat Durability | Who It Beats |
|----------------------------------------|--------------------------------------------------------------------------------------------|-----------------|--------------|
| **Unmatched Workflow Breadth**        | 30 ViewModes in ViewRenderer (schematic to procurement to Arduino to labs to digital twin in one app); FEATURE_MATURITY shows most at Production/Functional | High (hard for legacy tools to bolt on) | All traditional ECAD; closest is Fusion but narrower electronics focus |
| **Modern Desktop + Web UX**           | Tauri + React 19 + Tailwind + extensive lazy views + page-skill system; superior to aging Qt (KiCad) or legacy UIs | Medium-High (Flux/EasyEDA also modern) | KiCad, Altium (Windows legacy), OrCAD |
| **Hobbyist / Education / Ramp Strength** | Dedicated labs, starter circuits, Arduino workbench, breadboard, knowledge base, community | High (Fritzing is closest but narrow) | Most pro tools; matches or exceeds Fritzing in integrated education |
| **Hardware Close-the-Loop**           | SerialMonitor, DigitalTwin, Arduino integration, audit trail of physical changes | High (rare in pure ECAD) | Almost everyone |
| **Procurement + Inventory Integration** | Full procurement wizard, personal inventory/storage, BOM templates, alternates, lifecycle, supply chain alerts | High (EasyEDA wins on fab direct; ProtoPulse wins on personal + workflow) | KiCad, Fritzing, most others |
| **Local-First + Desktop Control (Tauri)** | Full offline-capable desktop app with local server; user owns data | High (vs pure SaaS like Flux) | Flux, parts of EasyEDA |
| **Design History + Audit + Compliance Surfaces** | Production design_history, audit_trail, comments, snapshots with diff/compare | Medium-High | Strong vs open-source; competitive with enterprise |

## Market Positioning

### Differentiation Opportunities (Where ProtoPulse Should Lean In)
- **The Complete Maker OS**: Own the "idea → breadboard → schematic → PCB → 3D fit → order parts → program hardware → document → share" loop better than anyone. Market this as the single app a hardware team or serious maker never has to leave.
- **Education + Rapid Ramp**: Labs + starters + Arduino + breadboard realism + inventory for classrooms and self-learners. Partner with universities/makerspaces.
- **Hardware-in-the-Loop + Digital Twin**: Unique for debugging real devices against the digital model.
- **AI as Accelerator, Not Replacement**: Combine the broad surfaces with improving agentic AI (address the Stub maturity in generative) to let users describe intent and get working multi-view projects.
- **Tauri Desktop + Self-Hosted Freedom**: Emphasize privacy, offline, no recurring SaaS fees for core use (contrast Flux/Altium).

### Parity Requirements (Table Stakes to Avoid Churn)
- **3D/MCAD must reach production quality** — without believable mechanical fit and STEP workflows, pros and startups doing enclosures will defect to KiCad or Fusion.
- **DRC/ERC trust & high-speed basics** — pros will not ship boards they can't confidently rule-check in-tool.
- **Live part data during design** — friction of switching to browser/supplier sites kills flow.
- **Reliable manufacturing exports and one-click paths** (even if not as tight as EasyEDA-JLC).
- **Component ecosystem scale** — users expect to find (and contribute) parts quickly with good 3D.

## Competitor Profiles (2026 Snapshot)

### KiCad (Free, Open Source, v10.0)
- **Strengths**: Explosive feature velocity (design variants, time-domain tuning, PCB blocks, raytracing 3D, Python, huge STEP library). Professional grade at $0. Massive community.
- **Weaknesses**: UI still Qt-native (improving but not modern web polish); library management can be file-heavy.
- **Pricing**: Free.
- **Target**: Hobbyists through budget-conscious professionals.
- **Key differentiator**: "Everything a pro needs, zero cost, rapid open development."
- **Screenshot**: kicad-features.png captured.

### Altium Designer
- **Strengths**: Gold standard for complex, high-reliability, multi-board work. Best-in-class bidirectional MCAD CoDesigner (SolidWorks, Onshape real-time, copper geometry). Altium 365 collab.
- **Weaknesses**: Very expensive; legacy Windows-heavy feel.
- **Pricing**: ~$2k–$5k+/seat/year (Develop/Pro tiers).
- **Target**: Professional EEs in enterprise / high-stakes products.
- **Key differentiator**: ECAD-MCAD co-design + constraints at scale.

### EasyEDA (JLCPCB/LCSC)
- **Strengths**: Excellent browser performance (WebGPU), tight manufacturing loop (one-click fab/assembly), strong Pro features (reuse blocks, PCB compare, collab), affordable.
- **Weaknesses**: Some vendor lock-in perception; less dominant in ultra-high-speed vs Altium/OrCAD.
- **Pricing**: Free Std; paid Pro tiers.
- **Target**: Hobbyists, startups, rapid prototype teams wanting fast Asian manufacturing.
- **Key differentiator**: "Design here, order there seamlessly."
- **Screenshot**: easyeda-features.png captured.

### Flux.ai
- **Strengths**: Most advanced agentic AI copilot in 2026 (multi-step execution, sourcing-aware, self-correcting). Modern browser collab + live parts data.
- **Weaknesses**: Usage-based AI metering can get expensive; best for moderate complexity; newer platform.
- **Pricing**: Starter ~$20; Pro ~$142/editor/mo + ACUs.
- **Target**: Modern hardware startups and AI-curious teams.
- **Key differentiator**: "AI that actually designs with you."
- **Screenshot**: flux-ai-features.png captured.

### Fritzing
- **Strengths**: Best-in-class realistic breadboard view with perfect three-way sync (breadboard ↔ schematic ↔ PCB). Extremely approachable for teaching and quick visual docs. Parts editor + community.
- **Weaknesses**: Limited depth for complex or high-speed boards; smaller pro adoption.
- **Pricing**: Donation / paid download for support.
- **Target**: Educators, hobbyists, Arduino/RPi makers, beginners.
- **Key differentiator**: "What you see on the bench is what you get in the tool."
- **Screenshot**: fritzing-home.png captured.

### Autodesk Fusion Electronics (Eagle successor)
- **Strengths**: Native unified 3D + MCAD in one cloud environment (outstanding co-design). Good maker-to-pro path. EAGLE users migrating here (standalone Eagle retiring June 2026).
- **Weaknesses**: Cloud dependency for full power; subscription.
- **Pricing**: Part of Fusion 360 subscription.
- **Target**: Makers scaling to professional mechanical+electrical products.
- **Key differentiator**: "One model for electronics and mechanics."

### OrCAD (Cadence)
- **Strengths**: Deep high-speed / SI/PI analysis (Sigrity integration), sophisticated constraint management, enterprise workflows.
- **Weaknesses**: Expensive, complex, steep curve.
- **Pricing**: Enterprise subscription.
- **Target**: High-end professional teams doing complex, regulated, or high-speed designs.
- **Key differentiator**: In-design signal/power integrity at the highest level.

## Screenshots & Artifacts

Captured via chrome-devtools during this pass (full-page where possible):
- `.agents/analysis/competitor-screenshots/kicad-features.png`
- `.agents/analysis/competitor-screenshots/flux-ai-features.png`
- `.agents/analysis/competitor-screenshots/easyeda-features.png`
- `.agents/analysis/competitor-screenshots/fritzing-home.png`

Additional 3D-specific competitive evidence lives in `phase-2-report-3d.md`.

## Cross-Phase Connections
- 3D weakness (detailed in phase-2-3d + phase-3 UX) will appear as major friction in any mechanical review workflow (Phase 3 UX).
- Lack of live sourcing + high-speed will surface as "pro user" drop-off in Phase 1 inventory / Phase 4 debt if not addressed.
- Strong breadth is an innovation opportunity (Phase 5): double down on the "complete loop" rather than chasing pure-ECAD parity everywhere.
- Many FG items below overlap with prior 3D and UX audits.

## Sources & Methodology
- Code: ViewRenderer, FEATURE_MATURITY.md, board-viewer-3d.ts analysis, prior phase reports.
- Research: Official sites + 2026 release notes via WebSearch + direct page visits + chrome screenshots.
- Local reference: `.agents/analysis/references/domain-detection.md` (created this pass).
- Resumability: Future agents should re-run targeted WebSearch/chrome on competitor update pages and re-verify ProtoPulse view maturities against latest audits.

---

**Next step recommendation**: Prioritize FG-01 (3D productionization) and FG-02 (DRC depth) for the largest immediate competitive risk reduction. Leverage existing procurement/inventory/education surfaces as the primary moat while closing the classic ECAD depth gaps.
