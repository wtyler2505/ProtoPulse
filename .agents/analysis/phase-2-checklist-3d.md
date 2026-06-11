# Phase 2 Checklist — 3D PCB Visualization Gaps (FG-3D-)

> Scope: **Exclusive to 3D board visualization** (BoardViewer3DView + board-viewer-3d + unused webgl-viewer)
> Priority: P0 (blocks professional use) → P3 (polish)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)
> Source evidence: Direct reads of BoardViewer3DView.tsx (719 LOC, CSS-only), board-viewer-3d.ts (1189 LOC), ast-grep zero imports of webgl-viewer.ts (1298 LOC dead), competitor research (KiCad trackball+STEP+raytrace, Altium MCAD+clearance, EasyEDA/Flux browser WebGL orbit, Fusion associative 3D)

## Critical Camera & Interaction (P0 — Immediate Credibility Killers)

- [ ] **FG-3D-01 | Add free orbit/trackball camera with mouse/touch drag + wheel zoom + pan** | Currently only 7 static preset buttons (top/bottom/front/back/left/right/isometric) with hardcoded CSS rotateX/Y and fixed 800px perspective + scale=2. Every competitor (KiCad trackball.cpp since 2016, Altium 3D Layout Mode, EasyEDA/Flux WebGL drag, Fusion ViewCube) gives natural grab-and-spin. Viewport has zero pointer handlers. | Effort: M | Priority: P0 | Personas: All | Evidence: BoardViewer3DView.tsx:532-556 (VIEW_ANGLES + buttons only), 562 (perspective:800px), 571 (static transform), no mousedown/mousemove/wheel listeners; board-viewer-3d.ts:714 (getCameraForView returns data only)

- [ ] **FG-3D-02 | Implement mouse/touch gesture handlers + smooth camera state (OrbitControls or equivalent)** | No free rotation, no inertia, no pivot point, no user-adjustable distance/FOV. CSS transitions on button click only. | Effort: M | Priority: P0 | Related to FG-3D-01

## Component & Rendering Fidelity (P0/P1 — "Feels Toy-Like")

- [ ] **FG-3D-03 | Replace or augment CSS box extrusions with real 3D component models (STEP import + GLTF/WebGL render path)** | Components are flat colored divs (top face + single side extrusion) using static PACKAGE_HEIGHTS + FootprintLibrary bboxes. No pins, no textures, no materials, no shadows. No STEP/WRL loader. | Effort: L | Priority: P0 | Evidence: BoardViewer3DView.tsx:107-170 (ComponentBox), 118 (PACKAGE_HEIGHTS lookup), 140-168 (pure CSS faces); board-viewer-3d.ts:265-287 (BUILTIN_PACKAGES, no geometry); webgl-viewer.ts exists but unused

- [ ] **FG-3D-04 | Add realistic materials, lighting, shadows, and optional raytrace / high-quality render mode** | Pure flat CSS colors + opacity. No lights, no PBR, no reflections. Competitors offer OpenGL + raytracer (KiCad), Realistic mode (Altium), photoreal exports (Flux). | Effort: L | Priority: P1 | Evidence: No lighting model anywhere in active renderer

## Measurement, Clearance & Verification (P0 for Pros/Founders)

- [ ] **FG-3D-05 | Build 3D measurement UI (point picker, live ruler, clearance overlay) on top of existing measureDistance API** | `measureDistance` exists (returns dx/dy/dz) but no picker, no overlay, no component-to-component or enclosure clearance viz in viewport. | Effort: M | Priority: P0 | Evidence: board-viewer-3d.ts:795-810 (API only); BoardViewer3DView.tsx has zero measurement UI or event wiring; no raycast/selection in CSS path

- [ ] **FG-3D-06 | Add enclosure/STEP body import + basic 3D collision / height clearance visualization** | No external 3D body import, no MCAD co-design, no interference detection. | Effort: L | Priority: P0 | Evidence: No 3D body types in scene model beyond board + comps/traces/vias

## Export, Sharing & MCAD Handoff (P0/P1)

- [ ] **FG-3D-07 | Implement real 3D exports (STEP, GLB/GLTF, OBJ) + high-quality image/PDF render from the 3D view** | Only internal JSON scene export (board-3d-scene.json). No geometry conversion, no STEP assembly, no screenshot with lighting, no 3D PDF. | Effort: L | Priority: P0 | Evidence: BoardViewer3DView.tsx:480-506 (handleExport/Import only JSON); board-viewer-3d.ts:842-852 (exportScene JSON only)

## 2D↔3D Integration & Live Sync (P1)

- [ ] **FG-3D-08 | Add bidirectional cross-selection / highlight between 3D view and PCB/Schematic editors + live placement updates** | Only board dimensions sync via useProjectBoard. Clicking a component in PCB editor does nothing in 3D (and reverse). No net highlight, no selection bridge. | Effort: M | Priority: P1 | Evidence: useEffect only watches board dims (BoardViewer3DView.tsx:429-442); no component id or selection context passed to 3D

## Performance, Scalability & Tech Debt (P1/P2)

- [ ] **FG-3D-09 | Wire the existing webgl-viewer.ts (or migrate to @react-three/fiber) as the primary renderer; deprecate or remove CSS 3D path** | 1298 LOC WebGL engine (layer presets, raycasting, materials, camera scaffolding) has **zero imports**. Active view ships slow DOM CSS 3D. | Effort: L | Priority: P1 | Evidence: ast-grep confirmed no `from .../webgl-viewer` anywhere; context json explicitly calls it "completely unused"

- [ ] **FG-3D-10 | Add LOD, culling, instancing or GPU path + performance benchmarks on 200/500/1000+ part boards** | Current CSS approach creates thousands of positioned divs. No scalability story. | Effort: M | Priority: P2 | Blocked by FG-3D-09

## Layer Stackup & Internal Geometry (P2)

- [ ] **FG-3D-11 | Drive real multi-layer stackup visualization (dielectric thickness, internal copper pours) from board stackup data** | 'internal' layer is cosmetic alias; thickness is uniform substrate translateZ only. | Effort: M | Priority: P2 | Evidence: DEFAULT_LAYER_STACK in board-viewer-3d.ts:245-259 (hardcoded zOffsets); LAYER_LABELS include internal but no real geometry

## Checklist Summary (Prioritized for 3D View Credibility)

**Must-fix for any professional claim (P0)**: FG-3D-01, FG-3D-03, FG-3D-05, FG-3D-07, FG-3D-06
**High perceived quality / quick wins (P0/P1)**: FG-3D-02 (with 01), FG-3D-04, FG-3D-08
**Tech debt cleanup (P1)**: FG-3D-09 (unlocks 03/04/07)
**Polish / scale (P2)**: FG-3D-10, FG-3D-11

**Warning policy reminder (per CLAUDE.md)**: Any runtime or test warnings discovered while implementing these must be fixed in the same pass. Do not close 3D work while warnings remain.

**References for implementers**:
- Run `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs` before/after changes
- Read `.agents/skills/pp-view-3d/references/ux-contract.md`, `gotchas.md`, `page-map.md`
- Primary sources: BoardViewer3DView.tsx, board-viewer-3d.ts, webgl-viewer.ts (for migration)
- See phase-2-report-3d.md for full competitor evidence and gap matrix

These items directly address the 5-8 concrete gaps that make the current 3D View feel like a toy rather than a production EDA tool.