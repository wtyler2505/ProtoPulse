# Phase 1 — Inventory Gaps Checklist (3D View)

**Purpose:** Turn inventory findings into actionable "holes" (real implementation gaps, not future features). These are things the code claims, wires, or models but that do not deliver user value or are misleading. Each item cites exact evidence. Use this to prevent later phases from treating dead code as shipped or proposing duplicates.

**Status legend:** 
- [ ] Open (confirmed hole)
- [x] Addressed / deferred by Tyler (note date + decision)
- [?] Needs verification (e.g. runtime test)

**Date:** 2026-05-18  
**Based on:** Phase-1-report-3d.md + direct file reads + rg/ast-grep/fd searches.

---

## Critical Holes (User-Facing or Trust-Breaking)

1. **[ ] 3D View shows zero components/traces/vias/drills from any real project board (even 60-part PCBs).**
   - Evidence: `useProjectBoard` sync (`BoardViewer3DView:429-442`) only passes 4 dimension fields. `rg "BoardViewer3D|addComponent|useBoardViewer3D"` + ast-grep structural searches returned **zero** production calls to `add*` methods outside the lib + view (which makes none). `components.length` badge always starts at 0 for real projects.
   - Impact: "mechanical fit check" (sidebar description) is impossible; scene is always empty or manually imported. Import is the only population path.
   - Related: localStorage is global (no projectId key scoping) → cross-project pollution.

2. **[ ] Layer visibility toggles are fully wired in UI + model + persistence but have zero visual effect.**
   - Evidence: `LayerVisibilityPanel:383-388` checkboxes call `toggleLayer` → `BoardViewer3D.getInstance().setLayerVisible:774`. `buildScene:651` populates `visible`. Panel shows them. But viewport render (`599-632`) does unconditional `.map` for traces/vias/components; no `getVisibleLayers()` checks, no opacity/conditional on copper/silk/etc. layers. Substrate + mask overlay always drawn.
   - `LAYER_ORDER` includes 'internal' (stub, no stack entry).
   - Impact: UI lies; toggles feel broken.

3. **[ ] Drill holes are fully modeled (CRUD, persist, import/export, scene) but never rendered or editable.**
   - Evidence: Full `DrillHole3D` type:90, map in class:311, `addDrillHole:606`, `remove*`, `getAll*`, `buildScene:679`, export:849, import:935, clear:961, load/save paths. **Zero** JSX or component for them in `BoardViewer3DView` (unlike vias/traces/components).
   - Impact: "showDrills" renderOption + data model investment is dead.

4. **[ ] Vast majority of RenderOptions are implemented + persisted + exposed in hook but completely unwired from UI and rendering.**
   - Evidence: `DEFAULT_RENDER_OPTIONS:227-242` (13 fields incl. show*, opacity, multiple colors). `setRenderOptions:758`, `get*`. Hook returns them. **Only** background/board/solderMaskColor consumed in JSX (562,580,591). No checkboxes, no calls to setter in the view. ComponentBox hardcodes its own 0.9/0.7 opacities.
   - Impact: "render options" in model is aspirational; user has no control.

5. **[ ] No silkscreen, no per-layer geometry, no component pins, no measurement UI despite types + helpers.**
   - Evidence: Footprints carry `silkscreen[]` (unused in 3D). `Trace3D`/`Via3D`/`Component3D.pins` exist. `measureDistance:796` API + `CameraState` fully built but `getCameraForView` results never drive anything (only CSS rotates used). No UI for measurements.
   - `Via3DElement` has drill visual but no plating or start/end layer semantics used.

6. **[ ] Export omits layerVisibility; Import does not restore it (and never did).**
   - Evidence: `exportScene:844-852` (no layerVisibility). `importScene:942-944` only touches renderOptions (after validation). load/save in class do include it (990,1075).
   - Roundtrip via files is lossy for user layer state.

---

## Navigation / Reachability Holes (Per UI Container Rule)

7. **[ ] 3D View panel itself has no internal scroll/resize/collapse for its own content (right sidebar is the only scroll area).**
   - Evidence: Main return `div.flex.h-full.flex-col.gap-3.p-3` (509). Viewport takes `flex-1`, right is fixed `w-52 ScrollArea`. No resizer on viewport or whole surface. If many manual components added, the absolute scene can overflow viewport without user controls (no pan/zoom).
   - Matches CLAUDE.md "UI Container Rule" — treat as defect.

8. **[ ] "View in 3D" button from PCB is a tiny low-contrast affordance with no reciprocal "back to PCB" or context.**
   - Evidence: `PCBLayoutView:141-153` (h-6 text-[10px] muted). From 3D there is no "edit in PCB" button; user must use global sidebar. Prefetch knows the link (`viewer_3d` → pcb priority 8) but no UI surface.

---

## Data Model / Contract Holes

9. **[ ] 3D scene data is global singleton + localStorage with no project association; dims are force-overwritten but other data is not.**
   - Evidence: Singleton ctor + load always; `useEffect` only overrides dims (429). `STORAGE_KEY` fixed. When switching projects, leftover components/traces from prior board remain until manual clear/import.
   - `importScene` / `clear` are the only resets.

10. **[ ] FootprintLibrary + PACKAGE_HEIGHTS + BUILTIN_PACKAGES are three overlapping but non-identical sources of truth (25 vs ~15-20 entries, different depth values).**
    - Evidence: `BoardViewer3DView:36-46` (PACKAGE_HEIGHTS), `board-viewer-3d.ts:265-287` (BUILTIN), `footprint-library.ts:64-108` (db with ~20, some missing from heights like certain QFNs). `ComponentBox:114-118` prefers footprint for w/h, PACKAGE for depth, component fallback.
    - No verification step (per CLAUDE.md hardware protocol) recorded.

11. **[ ] WebGL "full engine" (1.3k LOC + 960 tests) is completely unreachable dead code, yet comments claim it is the layer "beneath" the CSS viewer.**
    - Evidence: phase-0 + `rg` zero refs outside its tests. `webgl-viewer.ts:1-20` header. Never imported, never instantiated.
    - Wasted investment + confusing comments.

12. **[ ] `getCameraForView` + full `CameraState` + `measureDistance` are public API but have no consumers in the shipped UI surface.**
    - Evidence: lib:715,796; hook exposes; `BoardViewer3DView` never calls them. Only local `viewAngle` + CSS.

---

## Minor / Polish Holes (Still Defects per Policy)

13. **[ ] Trace segments use per-render inline style objects + atan2 in render path (performance churn noted in phase-0).**
    - Evidence: `Trace3DElement:206-238` (map creates styles every parent render; even with memo on element).

14. **[ ] "Internal" layer and 4+ layer board support are stubs only (no stack definition, no data, no visuals).**
    - Evidence: `DEFAULT_LAYER_STACK:244` (exactly 7 entries, no internal), `LAYER_ORDER:84` includes it, `getLayerColor:705` treats as copper.

15. **[ ] No empty state, no "how to populate" guidance, no "import example" in the view when components.length === 0.**
    - Evidence: Header badge just says "0 components"; viewport shows blank colored rect + edge label. No call to action.

16. **[ ] handleImport silently swallows read errors; no user feedback on import failure (beyond validation errors which are also discarded in the caller).**
    - Evidence: `BoardViewer3DView:500-502` `.catch(() => { /* ignore */ })`; importScene returns errors but caller ignores the result object.

---

## Test / Verification Holes

17. **[ ] No recorded test glob in pp-view-3d skill; tests exist but coverage of "dead but wired" paths (layers, renderOptions, drills, import layer loss) unknown.**
    - Evidence: `testing.md:7` "No dedicated test glob..."; `BoardViewer3DView.test.tsx` + model tests exist but per policy, warnings + incomplete sections must be treated as defects.

18. **[ ] No runtime/browser verification step in the documented skill workflow for visible 3D elements (e.g. do layer toggles or show* ever do anything?).**
    - Per `gotchas.md` + testing.md: browser checks are manual and required before "clean".

---

## Quick Cross-Check (from Phase 0 + Inventory)

- All CCN hotspots (addComponent 23, hook 20, etc.) remain unaddressed.
- Inline styles + DOM node count risks (400+ for busy scene) still present.
- "Nonblank rendering" (per skill scope) is technically true (colored rect + labels) but empty for real designs.

---

**Next actions for later phases:** 
- Do **not** propose "add layer toggle support" or "add drill rendering" or "sync components from PCB" as new features — they are modeled/wired as holes.
- Treat the entire component/traces/vias population surface and the layer/renderOptions surfaces as incomplete implementation, not missing requirements.
- Any perf work must address the CSS transform churn first (current path).

**End of checklist.** Update with dates/decisions when addressed. Warnings and these holes count as defects per CLAUDE.md policy — do not close work while they exist in the 3D lane.
