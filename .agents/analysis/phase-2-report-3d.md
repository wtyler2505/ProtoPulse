# Phase 2: Competitive Gap Analysis — 3D PCB Visualization (Scoped)

> Generated: 2026-05-18
> Scope: **Exclusive to 3D PCB board visualization features** (BoardViewer3DView.tsx + board-viewer-3d.ts)
> Competitors analyzed: KiCad 3D Viewer (v9/v10 2025-2026), Altium Designer 3D + MCAD CoDesigner, EasyEDA/JLCPCB browser 3D Preview, Fusion 360 Electronics 3D PCB, Flux.ai browser 3D, Upverter/CircuitMaker references
> Personas: Hobbyist maker (fit check before order), Professional EE (clearance/DRC/mech sign-off), Hardware startup founder (enclosure reviews, DFM, investor demos)
> Evidence basis: Direct code read of active renderer (CSS 3D only), ast-grep confirmation of zero Three.js usage in UI, discovery of completely unused webgl-viewer.ts (1298 LOC), WebSearch + web_fetch on official docs/release notes for competitors (KiCad docs.kicad.org, Altium resources, EasyEDA prodocs, Autodesk Fusion blogs 2025-2026)

## ProtoPulse Current 3D View — Exact Feature Set (from source)

**Active implementation (BoardViewer3DView.tsx 719 LOC + board-viewer-3d.ts 1189 LOC):**
- **Rendering engine**: Pure CSS 3D transforms (`perspective: 800px` fixed, `preserve-3d`, `rotateX/Y` on container). No WebGL, no Three.js, no Canvas, no GPU acceleration in the live view. All elements are absolutely-positioned DOM divs.
- **Camera / Interaction**: Exactly 7 static preset buttons (`top`, `bottom`, `front`, `back`, `left`, `right`, `isometric`) + reset. `VIEW_ROTATIONS` map with hardcoded angles. No mouse drag, no trackball, no scroll zoom, no pan, no touch gestures, no free orbit. Viewport container has no pointer event handlers for rotation. `scale = 2` magic number (px per mm depth). Fixed 800px perspective. No user-adjustable FOV, distance, or pivot.
- **Components**: `ComponentBox` renders colored CSS boxes (top face + one side extrusion) using `PACKAGE_HEIGHTS` lookup (hardcoded ~30 entries, e.g. SOIC-8: 1.75mm, DIP: 5.0mm) + `FootprintLibrary.getFootprint` bounding boxes. RefDes label on top. No 3D meshes, no STEP/WRL, no materials/textures/shadows/lighting variation, no pin geometry beyond flat.
- **Traces / Vias / Board**: Flat CSS-colored segments and circles with Z-offsets for top/bottom. Substrate is a single colored div with thickness translateZ. "Internal" layer exists in model but renders as cosmetic copper color (no real multi-layer stack depth or dielectric visualization).
- **Layers**: 8 toggles (`top-copper`, `bottom-copper`, `top-silk`, `bottom-silk`, `top-mask`, `bottom-mask`, `substrate`, `internal`). Visibility stored in singleton + localStorage. No per-layer thickness control in UI or realistic stackup rendering.
- **Dimensions / Edit**: Live editable Width/Height/Thickness (mm) with NumberInput + Apply; syncs to `useProjectBoard` server source. Basic card display.
- **Measurement**: `measureDistance(from, to)` API exists in model (returns dx/dy/dz + euclidean). **No UI tool** — no point picking, no ruler overlay, no clearance visualization, no live distance on hover/selection in the 3D viewport.
- **Export / Import / Sharing**: `exportScene()` / `importScene(json)` — full internal JSON of board + components + traces + vias + renderOptions (localStorage persisted). Download as `board-3d-scene.json`. No STEP, GLB, STL, OBJ, PNG screenshot with quality, 3D PDF, or AR.
- **2D ↔ 3D Sync**: Dimensions flow via `useProjectBoard`. No selection cross-probe, no highlight of selected component/trace in 3D when clicked in PCB editor, no live push of copper geometry or placement changes.
- **Performance / Scalability**: All geometry is live DOM elements inside CSS 3D context. No LOD, no culling, no instancing, no WebGL fallback. Known to degrade on boards with dozens of parts.
- **Other**: Package model DB in code (15+ entries); unused `CameraState` type with position/target/fov (only returned as data for presets, never drives interactive camera). 

**Critical discovery**: `client/src/lib/pcb/webgl-viewer.ts` (1298 LOC) exists with WebGL engine, layer presets (9), raycasting, materials, package DB, camera control scaffolding. **Zero imports anywhere in the client** (confirmed via ast-grep). The live 3D view deliberately chose the CSS toy path while a more capable engine sits dead.

**Marketing vs reality gap**: Code comments in board-viewer-3d.ts claim "This is the data model ... not the actual Three.js rendering" and reference a non-existent integration. The UI delivers 1990s-era CSS 3D demo fidelity.

## Competitor 3D Capabilities (Evidence from 2025-2026 Docs/Release Notes)

### KiCad 3D Viewer (v9 Feb 2025 / v10 Mar 2026)
- **Interaction**: Virtual trackball (left-drag orbit using trackball.cpp quaternion math), middle-drag pan, wheel zoom. Axis rotate buttons + navigation gizmo (refined v10). Configurable in Preferences → Mouse.
- **Fidelity**: Official libs ship STEP-only (v10). Accurate component bodies + board stackup (copper/soldermask/silkscreen/dielectric from Physical Stackup dialog). OpenGL default + optional high-quality raytracer (Preferences → Raytracing, CLI `kicad-cli pcb render` for shadows/reflections).
- **Tools**: Cross-probe selection with PCB/schematic editor. Visual inspection primary; precise measurement lives in 2D editor but 3D aids fit checks. Grid, status coords.
- **Export**: STEP, GLB, BREP, XAO, PLY, STL, IDF, VRML from viewer or CLI. Raytraced PNG/JPG via CLI with lighting/rotate flags. 3D PDF support.
- **Performance**: Handles real production boards (hundreds of parts) routinely; GPU-accelerated.
- **Sources**: docs.kicad.org/9.0+/10.0/en/pcbnew/pcbnew.html (3D Viewer section), kicad.org blog v9/v10 releases, trackball.h source.

### Altium Designer 3D (Designer 25/2026 releases)
- **Interaction**: True 3D Layout Mode (key `3`). Full free rotate/pan/zoom/fly-through/section views. View Configuration panel for lighting/materials.
- **Fidelity**: Realistic mode (textures, shadows, physical materials). Native STEP + Parasolid/IGES/SAT/SolidWorks import as 3D Bodies. Accurate meshed component geometry (not bounding boxes).
- **Tools**: Component Clearance rule uses real 3D mesh collision (X/Y/Z). New 2026 Z-Axis Clearance + bond wire support. Visual violation highlighting + distance readouts. MCAD CoDesigner: live bidirectional sync with SolidWorks, Inventor, Fusion 360, Creo, NX (board shape, placement, heights, cutouts, rigid-flex, harness).
- **Export**: STEP/Parasolid of full assembly (tracks/pads/silkscreen/3D bodies/bond wires). 3D PDF, high-quality views for Draftsman docs.
- **Performance**: Production boards with dense components + enclosures handled in-tool.
- **Sources**: resources.altium.com (Designer 25 MCAD post), Altium public release notes 2025-2026, documentation on 3D Bodies / View Configuration / MCAD CoDesigner.

### EasyEDA / JLCPCB Browser 3D Preview (2025-2026 Pro updates)
- **Interaction**: Pure browser (WebGL/WebGPU). Free left-drag orbit/rotate, wheel zoom, pan. Preset buttons + fit/adapt + explode view. Toolbar controls.
- **Fidelity**: Binds STEP (preferred) or WRL to footprints via 3D Model Manager (offset/rotate/scale per axis). Realistic PCBA view with board materials (FR4/aluminum), silkscreen, optional 3D Shell/enclosure preview.
- **Tools**: Layer/material toggles, color/background adjust. No dedicated 3D ruler (2D Measure Distance tool exists). Visual fit + shell checks.
- **Export**: STEP (with models), OBJ+MTL, high-res PNG (up to 2160p+), 3D Shell files. iBOM HTML with 3D.
- **Performance**: Hardware accel recommended; handles SMT PCBA previews for ordering flow.
- **Sources**: prodocs.easyeda.com (3D Preview, 3D Model Manager, Export 3D File, update records v2.2+).

### Fusion 360 Electronics / 3D PCB (2025-2026 updates)
- **Interaction**: Push to 3D PCB creates associative solid B-Rep. Full Fusion navigation (orbit, ViewCube, section, 3Dconnexion). Edit-in-place in assembly context.
- **Fidelity**: Attach STEP or existing hub models to components. Full copper/core/3D bodies as solids in mechanical workspace.
- **Tools**: "Show Measurement Details" on edges/faces/components (2025). Interference Analysis, Section Analysis, Measure in assembly context for enclosure/component clearance/fit. Bidirectional sync (board outline, placement, holes → mechanical sketches/assemblies and back).
- **Export**: Full MCAD formats native to Fusion (STEP etc.).
- **Performance**: Unified platform; scales with Fusion's modeling engine.
- **Sources**: Autodesk Fusion "What's New" blogs (Sept 2025, Mar 2026, Year in Review 2025), Electronics ECAD-MCAD posts.

### Flux.ai (Modern Browser Competitor)
- **Interaction**: Dedicated 3D PCB view (Alt+3 toggle 2D/3D camera). Free rotate/pan/zoom via WebGL.
- **Fidelity**: Realistic component + via/pour visualization. Photorealistic render generation + shareable links.
- **Tools**: Component collision detection in 3D. Layer visibility (switch to 2D for deep editing).
- **Export**: STEP, photoreal images.
- **Performance**: Claims good scaling for large projects in browser.
- **Sources**: flux.ai/docs and blog comparisons.

## Gap Matrix — 3D Visualization Capabilities

| Capability                  | ProtoPulse Status                  | Best Competitor(s)          | Gap Severity (Hobbyist / Pro / Founder) | Evidence |
|-----------------------------|------------------------------------|-----------------------------|-----------------------------------------|----------|
| Free interactive camera (orbit/trackball + mouse drag/zoom/pan) | None — only 7 static CSS rotate presets + fixed 800px perspective | All (KiCad trackball, Altium free 3D, EasyEDA/Flux WebGL drag, Fusion ViewCube) | Low / Critical / Critical | BoardViewer3DView.tsx:544 (buttons only); no pointer handlers on viewport; VIEW_ROTATIONS static |
| Component representation fidelity (real 3D meshes/STEP + materials/textures) | Basic — flat colored CSS box extrusions + static PACKAGE_HEIGHTS | KiCad/Altium/Fusion (STEP native + accurate meshes), EasyEDA/Flux (bindable STEP) | Medium / Critical / High | ComponentBox.tsx:140-168 (top+side divs only); no 3D model loader |
| Measurement & inspection tools (3D ruler, point-to-point, live clearance) | Partial — model API only; no UI | Altium (3D mesh clearance + distances), Fusion (Measure Details + Interference), KiCad (visual + 2D cross) | Low / Critical / High | measureDistance exists in board-viewer-3d.ts:796 but never called from View; no picker |
| Realistic rendering (materials, lighting, shadows, raytrace option) | None — flat CSS colors, no lights/shadows | KiCad (OpenGL + raytracer toggle + CLI), Altium Realistic mode, Flux photoreal | Low / High / High | No lighting model; pure CSS opacity/transform |
| 3D export quality (STEP/GLB/OBJ + images/PDF) | Basic — internal JSON scene only | KiCad (STEP/GLB + raytraced PNG/CLI), Altium (STEP+CoDesigner), EasyEDA (STEP/OBJ/PNG), Fusion native | Low / Critical / Critical | exportScene:843 returns JSON; no geometry exporter |
| 2D ↔ 3D sync & cross-selection / live update | Partial — dims only via hook | KiCad (cross-probe selection), Altium (unified 3D mode), Fusion (associative) | Medium / High / High | useProjectBoard sync only for board size; no component/trace selection bridge |
| Performance on real 500+ part boards | Weak — DOM CSS 3D | All GPU/WebGL competitors claim production boards | High / Critical / High | No culling/LOD/WebGL path active; 1000s of positioned divs |
| Layer stackup / internal copper / real thickness viz | Basic — 8 toggles, 'internal' cosmetic | KiCad/Altium/Fusion (stackup-driven dielectric/copper thickness, multi-layer) | Low / Medium / Medium | DEFAULT_LAYER_STACK hard-coded; internal = copper color alias |
| Enclosure / MCAD fit / collision detection in 3D | None | Altium CoDesigner + clearance, Fusion interference, EasyEDA 3D Shell, KiCad export-to-MCAD | High / Critical / Critical | No import of external 3D bodies, no raycast/collision |
| Dead code / tech debt | High — full WebGL engine (webgl-viewer.ts 1298 LOC + raycast) unused | N/A | — | ast-grep: zero imports of webgl-viewer anywhere |

## Top Concrete Gaps (5–8 "Why It Feels Toy-Like")

1. **FG-3D-01: No free orbit/trackball camera** — Users expect to grab and spin the board naturally (left-drag). 7 buttons only + slow CSS transition. Every competitor since ~2016 has this. Destroys "I can inspect from any angle" credibility instantly.
2. **FG-3D-02: Components are flat CSS boxes, not real 3D models** — No STEP binding, no pin geometry, no package-specific 3D detail, no textures. Looks like a 2005 PowerPoint demo next to KiCad STEP or Altium Realistic.
3. **FG-3D-03: No 3D measurement or clearance tools** — Visual inspection only. Pro users need quantitative "is this 2.3 mm clearance to enclosure?" or "component-to-component Z distance". API exists, UI does not.
4. **FG-3D-04: No industry 3D export (STEP/GLB) or photo render** — JSON is useless for MCAD handoff, 3D printing, or customer review. Competitors let you hand a real model to mechanical engineers.
5. **FG-3D-05: Unused WebGL engine while shipping CSS toy** — 1298 LOC of raycasting + materials + camera scaffolding sits idle. Signals "we started something real then abandoned it for the quick CSS path."
6. **FG-3D-06: No live 2D↔3D cross-probe or selection sync** — Clicking a part in PCB editor does nothing visible in 3D (and vice-versa). KiCad/Altium/Fusion treat them as one workspace.
7. **FG-3D-07: Brittle performance & no scalability path** — CSS 3D with per-component DOM elements will choke on realistic boards long before competitors' GPU renderers.
8. **FG-3D-08: Weak internal layer / stackup visualization** — "Internal" toggle is a color hack. Real boards have 4–16 layers with actual dielectric and inner copper geometry visible in competitors.

## Impact by Persona

- **Hobbyist**: Can roughly check "do tall caps fit the box?" with presets and manual height DB. Tolerable for simple boards, frustrating for anything with orientation changes or dense placement.
- **Professional EE**: Unusable for sign-off. Cannot measure clearances, cannot import enclosure STEP for fit, cannot generate deliverables mechanical team will accept. High churn risk.
- **Hardware Founder**: 3D view cannot be shown in investor/customer/mech reviews or sent to factory for DFM feedback. Forces export to external tools immediately, breaking the "all-in-one" promise.

## The 2–3 Gaps That Most Damage Professional Credibility

1. **Lack of free interactive camera + toy CSS component boxes** (FG-3D-01 + FG-3D-02 combined) — This is the immediate "this is not a real tool" reaction. Every modern EDA (even free browser ones like EasyEDA/Flux) gives natural mouse orbit and at least semi-realistic parts. Static buttons + colored blocks = demo, not product.

2. **Complete absence of 3D measurement / clearance / enclosure fit** (FG-3D-03 + FG-3D-08) — Professional work is 50% "will it physically fit and meet clearance rules in 3D?" Altium and Fusion sell entire workflows on this. Without it, the 3D view is marketing eye-candy, not a verification surface.

3. **JSON-only export + dead WebGL code** (FG-3D-04 + FG-3D-05) — Signals both missing core value (real MCAD handoff) and poor engineering execution (why build a WebGL engine then ship CSS?). Founders and pros notice abandoned tech debt immediately.

## Recommendations (High-Level)

- Wire or replace the CSS renderer with the existing (or a modern @react-three/fiber) WebGL path as the default for BoardViewer3DView — unlock the dead code investment.
- Add pointer-drag orbit (trackball math or OrbitControls), wheel zoom, and pan immediately (lowest effort, highest perceived quality lift).
- Implement at minimum a 3D ruler + simple bounding-box clearance overlay using existing measurement API.
- Add STEP import for components/enclosures + basic GLB/STEP export (even if via existing three.js GLTFExporter + csg or external lib).
- Enable real layer stackup thickness + internal copper visualization driven by board stackup data.
- Add cross-selection bridge between PCBLayoutView and 3D view.

These 5-8 gaps explain exactly why the current 3D View "feels toy-like" and blocks professional adoption, even if the rest of ProtoPulse (schematic, programmatic design, Tauri desktop, procurement) is strong.

---

**Files referenced in this analysis**:
- `/home/wtyler/Projects/ProtoPulse/client/src/components/views/BoardViewer3DView.tsx`
- `/home/wtyler/Projects/ProtoPulse/client/src/lib/board-viewer-3d.ts`
- `/home/wtyler/Projects/ProtoPulse/client/src/lib/pcb/webgl-viewer.ts` (unused)
- `.agents/skills/pp-view-3d/references/*` and inspect script output
- Competitor docs: docs.kicad.org, resources.altium.com, prodocs.easyeda.com, Autodesk Fusion 2025-2026 blogs

**Next steps for implementation**: See companion `phase-2-checklist-3d.md` for prioritized FG-3D-* action items with effort/priority.