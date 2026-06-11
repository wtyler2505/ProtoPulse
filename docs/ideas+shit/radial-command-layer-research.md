# ProtoPulse Radial Command Layer Research

Date: 2026-06-03

## Thesis

The custom radial menu should become a first-class ProtoPulse interaction layer, not a decorative context menu.

The strongest direction is a **Radial Command Layer** with a user-facing **Action Wheel**:

- Novices right-click, read the wheel, and select a labeled action.
- Returning users start to remember where actions live.
- Expert users use directional "marking" gestures without waiting for the whole menu.
- Keyboard and screen-reader users get the same command registry through a linear accessible menu and command palette.

## Sources Checked

- Callahan, Hopkins, Weiser, Shneiderman, "An empirical comparison of pie vs. linear menus", CHI 1988: https://www.cs.umd.edu/users/ben/papers/Callahan1988empirical.pdf
- Kurtenbach, Sellen, Buxton, "An empirical evaluation of some articulatory and cognitive aspects of marking menus", HCI 1993: https://damassets.autodesk.net/content/dam/autodesk/research/publications-assets/pdf/an-empirical-evaluation-of.pdf
- Microsoft Research summary of marking menus: https://www.microsoft.com/en-us/research/publication/an-empirical-evaluation-of-marking-menus/
- Don Hopkins, "The Design and Implementation of Pie Menus", Dr. Dobb's Journal, 1991: https://www.donhopkins.com/home/catalog/piemenus/ddj/piemenus.html
- Autodesk Maya Hotbox and marking menus: https://help.autodesk.com/cloudhelp/2022/ENU/Maya-Basics/files/GUID-06174D85-0B39-4EAD-B814-D1E06C3344AE.htm
- Autodesk Fusion marking menu reference: https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-6514ABC1-CB75-4F0B-AB0E-316FAD36BA93.htm
- Blender manual, pie menus: https://docs.blender.org/manual/en/latest/interface/controls/buttons/menus.html
- Onshape context menus: https://cad.onshape.com/help/Content/Home/context_menus.htm
- Adobe Photoshop Contextual Task Bar: https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/boost-workflows-with-the-contextual-task-bar.html
- Figma Actions menu: https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design
- Radix Context Menu docs: https://www.radix-ui.com/primitives/docs/components/context-menu
- WAI ARIA Menu Button Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
- MDN ARIA menu role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role
- WCAG 2.2 Target Size Minimum: https://www.w3.org/TR/WCAG22/#target-size-minimum

## Research Takeaways

### 1. The killer feature is not the circle. It is muscle memory.

Pie menus reduce selection effort because each target is close to the cursor and wedge-shaped. The CHI 1988 paper frames the advantage through lower seek time, lower error rates, and larger effective target size.

For ProtoPulse: the wheel must keep important actions in stable directions. Current behavior distributes actions based on item count, which means directions change when a view has 3 actions versus 6 actions. That prevents muscle memory.

### 2. The best version is a marking menu.

Marking menus let a novice wait for the visible menu, while an expert makes the same directional motion without waiting. Kurtenbach/Sellen/Buxton call this out as the novice-to-expert bridge: visible pop-up first, memorized mark later.

For ProtoPulse: right-click opens the visible wheel, but right mouse down plus drag plus release should execute a stable slot once confidence is high. The visible wheel trains the gesture.

### 3. Keep menu sizes small.

Hopkins, Blender, Fusion, and the research papers all converge on the same practical limit: 4 to 8 top-level actions. Eight works well because compass directions are memorable.

For ProtoPulse: top-level wheel gets the 4 to 8 most common actions. Everything else goes into subrings, a linear overflow menu, or Cmd/Ctrl+K search.

### 4. Stable spatial meaning matters.

Hopkins explicitly warns that moving commands around breaks mark-ahead use. Fusion keeps frequent commands in a first-level radial, deeper sketch actions in a second-level radial, and a normal context list below it.

For ProtoPulse: each slot should mean the same kind of action across Architecture, Schematic, PCB, Breadboard, BOM, Simulation, and 3D.

### 5. Context sensitivity is the CAD pattern.

Onshape changes context menus based on entity, blank canvas, feature list, and drawing area. Fusion changes the marking menu by workspace, tab, contextual environment, and active command.

For ProtoPulse: the wheel should depend on view, selected item, hover target, active mode, and project state. "Right click wire", "right click blank breadboard", and "right click BOM row" should feel related but not identical.

### 6. The wheel should not be the only path.

Radix, WAI ARIA, MDN, and WCAG point to the accessibility shape: focusable menu items, keyboard interaction, Escape to close, accessible names, and minimum target size. Figma's action menu also shows why search still matters for long-tail actions.

For ProtoPulse: radial is the fast canvas-native path. Linear menu and command palette remain the complete accessible/searchable path, fed by the same command registry.

## Local ProtoPulse Findings

- `client/src/components/ui/RadialMenu.tsx` already has the SVG wheel, clamped viewport positioning, `role="menu"`, menuitem labels, keyboard cycling, Escape close, and 3-8 item guidance.
- `client/src/lib/radial-menu-actions.ts` already has per-view actions for Architecture, Schematic, PCB, Breadboard, and BOM.
- `client/src/pages/ProjectWorkspace.tsx` already maps active view to radial context, detects targets from DOM data attributes, opens the wheel on `contextmenu`, and renders the menu.
- `handleRadialSelect` currently only shows a toast, so the menu is not yet a real command surface.
- `ArchitectureView.tsx` still has a richer Radix linear context menu with real actions. This should not fight the radial menu. It should be folded into the same command registry and used as the accessible linear fallback.
- Current radial labels are hover-only. This likely makes the wheel feel visually empty when it first opens.

## Slot Vocabulary

Use fixed slots even when a command is absent. Missing slots can be hidden, dimmed, or replaced by a context hint, but the surviving commands should not rotate into new meanings.

| Slot |  Direction | Meaning           | Examples                                       |
| ---- | ---------: | ----------------- | ---------------------------------------------- |
| 0    |      North | Add / create      | Add node, add component, add via, add probe    |
| 1    | North-east | Transform         | Rotate, flip side, change type, move           |
| 2    |       East | Connect / route   | Connect, add wire, route trace, net label      |
| 3    | South-east | Inspect / measure | Datasheet, measure, probe, part details        |
| 4    |      South | Run / validate    | Analyze, ERC, DRC, simulate, validate          |
| 5    | South-west | Delete / remove   | Delete node, remove BOM row, clear trace       |
| 6    |       West | Edit / properties | Edit component, properties, pin config         |
| 7    | North-west | Duplicate / reuse | Duplicate, paste, starter template, add to BOM |

## How To Use It Throughout ProtoPulse

### Architecture

Canvas wheel:

- North: Add node
- East: Connect selected nodes
- South: Analyze architecture
- West: Select / inspect
- North-west: Paste or generate from AI

Node wheel:

- West: Edit component
- East: Connect
- North-east: Change type
- South-east: Add to BOM / inspect hardware
- South: Run architecture validation
- South-west: Delete
- North-west: Duplicate

Enhancement: hover "Connect" should preview possible connection targets and highlight compatible ports.

### Schematic

Canvas wheel:

- North: Add part
- East: Add wire
- South: Run ERC
- South-east: Probe / measure
- North-west: Paste

Part wheel:

- North-east: Rotate / mirror
- East: Wire from pin
- South-east: Datasheet / pinout
- West: Properties
- South: Validate part/net
- South-west: Delete

Enhancement: hovering a wire action could show a ghost wire from the nearest pin.

### PCB

Canvas wheel:

- North: Add via
- East: Route trace
- South: Run DRC
- South-east: Measure
- North-east: Layer / side controls

Pad/trace wheel:

- East: Route from pad
- South-east: Measure clearance
- West: Edit pad/trace
- South: DRC here
- South-west: Remove trace/via

Enhancement: hover DRC shows local clearance/constraint badges before running the full check.

### Breadboard

Canvas wheel:

- North: Add part
- East: Add jumper
- South: Validate wiring
- South-east: Show rail/pin info
- North-west: Starter circuit

Part/wire wheel:

- East: Wire from pin
- South-east: Datasheet / pin map
- North-east: Move / rotate
- West: Properties
- South-west: Delete

Enhancement: hovering power/ground actions should light rail continuity and warn on rail breaks.

### BOM / Procurement

Row wheel:

- South-east: Datasheet
- East: Find alternates
- North-west: Add to inventory / reorder
- West: Edit quantity
- South: Risk / availability check
- South-west: Remove

Enhancement: use color-coded risk chips in the center: stock, price jump, lifecycle, unknown source.

### Simulation

Canvas wheel:

- North: Add probe
- East: Run
- South-east: Compare waveform
- South: Sweep
- West: Settings
- North-west: Export results

Enhancement: hover "Probe" shows voltage/current preview on eligible nets.

### Validation / Diagnostics

Issue wheel:

- West: Explain
- East: Jump to source
- North: Auto-fix where safe
- South: Re-run validation
- North-west: Create task
- South-west: Suppress with reason

Enhancement: center area explains why an action is disabled, such as "No fix available without selecting a net."

### 3D / Digital Twin

Object wheel:

- South-east: Measure
- North-east: Explode / isolate
- East: Cross-highlight schematic/PCB
- South: Run fit check
- North-west: Screenshot / export
- West: Properties

Enhancement: hover a wheel segment highlights the related geometry before committing.

### Serial Monitor / Bench

Stream wheel:

- East: Pause / resume
- South-east: Mark event
- South: Decode / analyze
- North-west: Export log
- West: Filter
- South-west: Clear

Enhancement: selected log text can open a wheel for "create observation", "link to component", or "send to AI".

## UI Enhancements

1. Show labels immediately.
   - Keep icons, but show short labels around the ring or show a strong center label by default.
   - Current hover-only labels make the menu look under-explained.

2. Add a center status well.
   - Show target name: "MCU node", "Net VCC", "BOM row: ESP32".
   - Show hovered action label.
   - Show disabled reason.
   - Show gesture hint after first few uses.

3. Add marking gesture mode.
   - Right mouse down, move in a stable direction, release.
   - If movement starts quickly, execute without painting the full menu.
   - If the pointer pauses, show the wheel.
   - This mirrors the marking-menu research and Fusion/Blender style workflows.

4. Add subrings, but keep top-level clean.
   - First ring: 4 to 8 primary actions.
   - Second ring: action family details.
   - Example: North "Add" opens MCU, Sensor, Power, Connector.

5. Add preview-on-hover.
   - Connect highlights valid targets.
   - Route shows a trace ghost.
   - Delete outlines what will be removed.
   - Validate highlights the affected subsystem.

6. Make destructive actions harder to misfire.
   - Keep delete/remove always in South-west.
   - Use red styling.
   - For high-risk deletes, require a short dwell, confirmation release, or undo toast.

7. Use view-specific color accents, not a one-note palette.
   - Create: green/cyan accent.
   - Connect/route: electric blue.
   - Validate/run: amber.
   - Inspect/measure: neutral/cyan.
   - Delete: red.
   - Keep the base surface quiet so the wheel stays utilitarian.

8. Add a "favorite slot" system cautiously.
   - Users can customize secondary slots.
   - Do not auto-reorder primary slots based on usage because that destroys muscle memory.

9. Add touch and pen support.
   - Long-press opens wheel.
   - Two-finger tap on canvas can open context wheel, echoing CAD mobile context patterns.
   - Stylus users benefit heavily from marking menus.

10. Add telemetry for learning.

- Track open, cancel, select, disabled-select attempt, dwell time, and gesture select.
- Use it to discover dead actions and missing actions.
- Do not use it to silently reorder stable slots.

## Architecture Proposal

### Command Registry

Replace static arrays with command objects:

```ts
interface RadialCommand {
  id: string;
  label: string;
  icon: LucideIcon;
  slot: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  group: 'create' | 'transform' | 'connect' | 'inspect' | 'run' | 'delete' | 'edit' | 'reuse';
  contexts: MenuContextType[];
  targets: TargetKind[];
  priority: number;
  destructive?: boolean;
  children?: RadialCommand[];
  isVisible(ctx: CommandContext): boolean;
  disabledReason?(ctx: CommandContext): string | null;
  preview?(ctx: CommandContext): void;
  run(ctx: CommandContext): Promise<void> | void;
}
```

### View Adapters

Each view should export a context adapter:

- `getRadialContext(event, state)` identifies target, selected objects, hover object, and eligible commands.
- `previewCommand(command, context)` handles hover previews.
- `runCommand(command, context)` calls real view handlers.

This is better than only DOM sniffing because canvas state often knows more than DOM attributes.

### Shared Linear Fallback

The existing Radix context menu should become a linear renderer of the same registry:

- Same command IDs.
- Same labels.
- Same disabled reasons.
- Same keyboard behavior.
- Same test coverage.

That gives the radial menu personality and speed without sacrificing accessibility.

## Implementation Path

### Pass 1: Make the current wheel feel real

- Show labels immediately or add a center label/status well.
- Add stable `slot` support.
- Wire Architecture actions to existing real handlers where possible.
- Keep `toast` only for unimplemented commands and label them as not wired yet.
- Add E2E coverage that right-clicking Architecture opens one radial menu and visible labels exist.

### Pass 2: Registry unification

- Introduce `RadialCommandRegistry`.
- Convert `radial-menu-actions.ts` from static item arrays to command definitions.
- Feed both `RadialMenu` and Architecture's Radix menu from the registry.
- Preserve existing Radix menu tests by mapping old test IDs to command IDs.

### Pass 3: Gesture mode

- Add pointer-down tracking.
- If movement exceeds a threshold before the hold delay, treat it as a mark.
- If pointer stays still for the delay, show the wheel.
- Add ink/trace feedback and a small selected-action label near the pointer.

### Pass 4: Rollout across workbench views

- Schematic, PCB, Breadboard, BOM, Simulation, 3D, Validation, Serial Monitor.
- Each view gets 4 to 8 top-level actions and optional subrings.
- Add tests per view for open, keyboard select, disabled reason, and one real action.

### Pass 5: Polish and learning loop

- Add usage telemetry.
- Add "practice hints" after repeated right-click use.
- Add a preferences panel for user slot customization.
- Add a help overlay that prints the wheel's current gesture map.

## Open Design Questions

- Should the default invocation be right-click release, or right mouse down plus hold?
- Should the wheel appear on empty canvas only when no local Radix menu claims the event, or should the radial registry replace all local context menus?
- Which command deserves the North-west slot: Duplicate, Paste, AI assist, or Add to BOM?
- Should second-level radial menus appear around the selected wedge or recenter under the pointer like Fusion?
- How far should gesture mode go before command confirmation is needed?

## Recommendation

Go all-in, but do it as infrastructure:

1. Keep the custom radial menu.
2. Rename the concept internally to Radial Command Layer.
3. Make command positions stable.
4. Make labels visible and add a center context well.
5. Feed radial and linear menus from one registry.
6. Add marking gestures after the visible wheel is reliable.
7. Roll out view by view, starting with Architecture because it already has both the radial prototype and a real Radix action menu to merge.

## Landed Pass 1 - 2026-06-03

Implemented the first Radial Command Layer pass in the live app:

- Rebuilt `radial-menu-actions.ts` around stable 8-slot compass commands, groups, descriptions, hints, target summaries, and a `protopulse:radial-command` event bridge.
- Updated `RadialMenu` with persistent labels, a center context well, stable slot geometry, keyboard support, and group/destructive color states.
- Moved radial state into a small `RadialMenuController` so opening the wheel does not re-render the whole workspace.
- Wired real Architecture commands: add node, analyze, fit, select all, paste, connect, edit, delete, duplicate, retype, add to BOM, and datasheet search.
- Added live node metadata (`data-id`, `data-node-label`) so workspace-level target detection can distinguish node vs canvas clicks.
- Fixed the fast follow-up race by reading latest Architecture nodes from a ref instead of waiting for the radial listener to reattach after local state changes.
- Added a Chromium smoke test that clears the test graph, measures browser-side contextmenu-to-menu mount latency, verifies hover does not resize the menu, runs Add Node, right-clicks the new node, and proves Add BOM by waiting for `/api/parts/ingress`.

Verification:

- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Next:

- Replace Architecture's Radix context menu with a linear renderer backed by the same command registry.
- Add per-view adapters for Schematic, PCB, Breadboard, BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.
- Add preference storage for custom slots after the default slots have enough usage proof.
- Add gesture/marking mode only after visible-wheel reliability stays green.

## Landed Pass 2 - 2026-06-03

Added real customization without making the open path heavy:

- Added `radial-menu-preferences.ts`, a `useSyncExternalStore`-based local preference store with stable snapshots, context-specific layout keys, slot moves, collision-safe swaps, layout reset, and localStorage persistence.
- Added `RadialMenuCustomizer`, a resizable and scrollable floating panel opened from the wheel's tool button.
- Added per-command compass-slot controls, active-slot states, reset, and close actions.
- Wired `RadialMenuController` to apply preferences before rendering the wheel while keeping radial state isolated from the main workspace view.
- Added `data-slot` attributes to radial commands and labels so tests can prove customization without brittle pixel geometry.
- Extended Chromium E2E to move Add Node from N to E, verify persistence on reopen, reset it to N, then continue through Add Node and Add BOM.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run check`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

## Landed Pass 3 - 2026-06-03

Folded Architecture's old Radix context menu into the same command layer:

- Added `getLinearActionsForContext` so the radial wheel stays capped at 8 fast muscle-memory actions while the accessible right-click fallback can expose deeper commands.
- Added Architecture linear-only commands: MCU/Sensor/Power/Communication/Connector quick-add, Toggle Grid, Run Validation, Copy Summary, Copy JSON, Edit Component, and Create Schematic.
- Added `RadialCommandLinearMenu`, a memoized shared renderer for Radix fallback rows with group separators, icons, shortcuts, disabled reasons, and destructive styling.
- Replaced the duplicated hard-coded Architecture context-menu JSX with the shared linear renderer.
- Kept `getActionById` radial-first so node-wheel-only commands such as Delete still resolve instantly, then fall back to linear-only commands.
- Added tests for the fallback registry, disabled selected-node commands, quick-add routing, analysis routing, and selected-node edit routing.
- Cleaned the test mocks so Radix-only props do not leak onto DOM elements and create React warnings.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run check`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Next:

- Add view adapters so Schematic, PCB, Breadboard, BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory can run real commands instead of only displaying action metadata.
- Add marking gesture mode with a movement threshold and no full-menu paint on fast directional gestures.
- Add lightweight performance probes around open latency and cancel/selection paths so "fast" stays enforced, not just hoped for.

## Landed Pass 4 - 2026-06-03

Tightened the visible wheel's open/hover performance:

- Precomputed all 8 slot angles, SVG arc paths, guide lines, icon positions, and label positions once at module load instead of recalculating them on every hover render.
- Replaced per-render group-tone switching with static tone maps.
- Memoized the item-to-layout mapping so hover changes update state and styling without rebuilding geometry.
- Memoized `RadialMenu` itself and kept `RadialCommandLinearMenu` memoized so parent workspace churn has less chance to repaint these overlays.
- Added `transform-gpu`, `contain: layout paint style`, and `will-change: transform, opacity` hints to isolate the fixed overlay and keep the open animation cheap.
- Added a unit regression check that those performance hints remain on the radial overlay.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run check`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Next:

- Add direct latency telemetry in the app code, not only E2E instrumentation.
- Implement true marking gestures: right-button down, directional move past threshold, release to select without painting the full wheel.
- Push real adapters into Schematic/PCB/Breadboard next so the fast layer becomes universal instead of Architecture-only.

## Landed Pass 5 - 2026-06-03

Added the first true marking gesture path:

- Right-button down on a supported workspace target now captures the radial context and preference-adjusted actions without opening the wheel.
- Moving at least 42px while holding the right button enters marking mode.
- Releasing in a compass direction selects the command assigned to that slot; north on the Architecture canvas runs Add Node without painting the full menu.
- Normal right-click still opens the visible wheel.
- The contextmenu suppression is scoped to the marking gesture release point and a short 750ms window, so a browser that does not emit a native contextmenu after the gesture will not swallow the next normal right-click.
- Custom slot preferences apply to marking gestures too, so the visible wheel and expert flick path stay aligned.

Verification added or rerun:

- `npm run check`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Next:

- Add a small visual ink/trace preview for marking mode after the no-paint command path stays stable.
- Add direct app telemetry for marking open/cancel/select timing.
- Continue real command adapters view by view.

## Landed Pass 6 - 2026-06-03

Made the marking path visible and measurable without turning it into a heavy menu:

- Added `RadialMarkingPreview`, a tiny fixed overlay with a dashed gesture trace, origin/current markers, direction badge, and command label.
- The preview only appears after the gesture crosses the 42px marking threshold, so normal right-click users still get the full visible wheel and expert users get immediate feedback while flicking.
- Pointermove preview updates are throttled through `requestAnimationFrame`; hot gesture data stays in refs.
- Added `radial-menu-telemetry.ts`, a capped in-memory telemetry buffer on `window.__protopulseRadialTelemetry`.
- Recorded `mark-start`, `mark-threshold`, `mark-select`, `mark-cancel`, `visible-open`, `visible-select`, and `customize-open` events with view/target/action count plus duration/distance where useful.
- Added cancellation cleanup for pointer cancel and window blur so the trace cannot get stuck.
- Extended Chromium E2E to prove the preview appears during a north flick, labels Add Node, disappears on release, avoids painting the full radial menu, records `mark-select`, then still opens the normal radial menu afterward.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run check`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Next:

- Build the next real adapters for Schematic, PCB, and Breadboard so radial commands do real work outside Architecture.
- Add richer per-view hover previews: wire ghost, route ghost, rail highlight, delete outline.
- Add a small developer/debug panel or command palette query for recent radial telemetry events.

## Landed Pass 7 - 2026-06-03

Extended the real command adapter beyond Architecture into Schematic:

- Added Schematic linear-only commands to the shared registry: Add Power, Fit, Toggle Grid, Replace Part, and Decoupling.
- Kept the visible Schematic radial wheel focused on the fast five core commands: Add Part, Wire, ERC, Select All, and Paste.
- Replaced the hard-coded Schematic right-click menu with `RadialCommandLinearMenu`, so the radial wheel and linear fallback now share command metadata.
- Added a Schematic radial event adapter that routes commands to existing canvas handlers instead of creating a second command path.
- Kept selected-component-only commands disabled unless exactly one schematic instance is selected.
- Fixed the Schematic view test leak where `JitRunHistoryPanel` tried to fetch `/api/projects/1/jit-skills/history` from port 3000 during unit tests.

Speed and smoothness guardrails now in code:

- The visible wheel stays capped at 8 slots; deeper commands go to the linear fallback.
- Wheel geometry, tones, and item layout are precomputed or memoized.
- Marking gestures avoid painting the full radial menu after the 42px directional threshold.
- Marking preview pointer updates are throttled with `requestAnimationFrame`.
- Radial telemetry records visible-open, visible-select, mark-start, mark-threshold, mark-select, mark-cancel, and customize-open events.
- E2E still measures browser-side contextmenu-to-menu mount latency and proves the no-paint marking path.

Verification added or rerun:

- `npm run test -- client/src/components/views/__tests__/SchematicView.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx`
- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused radial/Schematic pack: 44 tests passed, no `ECONNREFUSED` warnings.
- Broader radial-focused pack: 119 tests passed, no warnings.
- `npm run check`: design token drift check passed and TypeScript passed.
- Chromium radial E2E: 2 passed.

Next:

- Build the PCB adapter with route, via, pour, DRC, fit, and selected-footprint actions.
- Build the Breadboard adapter with place part, jump wire, rail power, net highlight, and selected-part actions.
- Add a tiny debug/telemetry reader so recent radial timing can be inspected without opening browser devtools.

## Landed Pass 8 - 2026-06-03

Extended the real command adapter into PCB:

- Added PCB linear-only commands to the shared registry: Copper Pour, Keepout, Comment, Fit, and Copy.
- Added a separate selected-footprint linear fallback so footprint right-clicks can expose Fit, Select All, Copy, and Paste without crowding the node wheel.
- Replaced the hard-coded PCB right-click menu with `RadialCommandLinearMenu`.
- Added a PCB radial event adapter for Add Via, Route, Copper Pour, Keepout, Comment, Measure, DRC, Fit, Select All, Copy, Paste, Rotate, Flip Side, and Delete.
- Added `useDeleteCircuitInstance` to the PCB canvas so targeted footprint Delete is a real mutation.
- Added `data-id`, `data-node-label`, and `aria-label` metadata to PCB footprints so the global radial detector can identify targeted footprint commands.
- Fixed the existing PCB Select All context action, which previously cleared selection instead of selecting placed footprints.
- Updated icon mocks for the expanded shared registry.

Speed and smoothness notes:

- PCB uses the same one-listener adapter shape as Schematic.
- Canvas commands stay as cheap state changes (`setTool`, reset pan/zoom, dispatch DRC event).
- Targeted footprint commands reuse existing mutations and do not trigger extra layout scans beyond a local instance lookup.
- The visible PCB wheel remains capped; lower-frequency commands live in the linear fallback.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx`
- `npm run check`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`

Results:

- Focused PCB/registry pack: 34 tests passed.
- Single patched RadialMenu suite: 34 tests passed.
- Broader radial-focused pack: 130 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Chromium radial E2E: 2 passed.

Next:

- Build the Breadboard adapter with place part, jumper, rail inspection, wiring audit, starter circuit, and selected-part actions.
- Add a small telemetry/debug reader for recent radial events.
- Add per-view hover previews after the real adapters are in place.

## Landed Pass 9 - 2026-06-03

Extended the real command adapter into Breadboard:

- Added target metadata to breadboard-board parts and bench-placed parts so the global radial detector can identify selected part commands.
- Added `data-wire-id` to breadboard wires and taught the workspace detector to return `target: wire`.
- Added a Breadboard radial event adapter for Add Part, Jumper, Rails, Audit, Starter, Move, Rotate, Delete, and Edit Properties.
- Routed Jumper to the existing wire tool.
- Routed Rails to the connectivity explainer.
- Routed Audit to the existing board-health audit flow and DRC overlay.
- Routed selected-part Rotate through the existing instance update mutation.
- Added `useDeleteCircuitInstance` in the breadboard canvas so selected-part Delete is a real mutation.
- Kept unsupported deeper commands honest by leaving them unhandled instead of pretending they landed.

Speed and smoothness notes:

- Breadboard uses the same one-window-listener adapter shape as Schematic and PCB.
- Hot tool changes are direct state updates.
- Target lookup is a local instance/wire id lookup from current arrays.
- No full-menu paint is needed on marking gestures; Breadboard inherits the same global no-paint marking path.

Verification added or rerun:

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`
- `npm run check`

Results:

- Focused Breadboard suite: 48 tests passed.
- Broader radial-focused pack: 178 tests passed.
- Chromium radial E2E: 2 passed.
- `npm run check`: design token drift check passed and TypeScript passed.

Next:

- Add a tiny radial telemetry/debug reader.
- Add hover previews for per-view actions: wire ghost, route ghost, rail highlight, delete outline.
- Continue secondary adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.

## Landed Pass 10 - 2026-06-03

Added the tiny radial telemetry/debug reader:

- Added `visible-mounted` telemetry so the app records time from contextmenu handling to the first visible wheel animation frame.
- Added telemetry subscriptions through a single browser event, so the debug reader updates only when radial telemetry changes.
- Added `RadialTelemetryInspector` with total event count, average visible-open mount time, average marking-select time, cancel count, and the last six events.
- Embedded the inspector in the radial customizer, below the slot editor.
- Added a clear button for resetting the capped in-memory telemetry buffer during manual tuning.

Speed and smoothness notes:

- The telemetry buffer is still capped at 120 events.
- The inspector does not poll.
- Summary numbers are memoized from the current event array.
- Recent-event rendering is capped at six rows.
- The visible wheel reports mount timing after the first `requestAnimationFrame`, matching the animation path users actually see.
- The customizer remains bounded, resizable, and internally scrollable so the timing reader does not trap lower controls.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused telemetry/customizer/wheel pack: 43 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broader radial-focused pack: 181 tests passed.
- Chromium radial E2E: 2 passed.

Next:

- Add per-view hover previews: wire ghost, route ghost, rail highlight, delete outline.
- Add a visible perf-budget hint when average wheel mount or marking select time drifts into amber/red.
- Continue secondary adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.

## Landed Pass 11 - 2026-06-03

Tightened the radial timing reader into an explicit performance-budget surface:

- Added a compact status badge to `RadialTelemetryInspector`: Waiting, Fast, Watch, or Laggy.
- Kept the strict visible-open budget anchored to wheel mount timing: green at `<=32ms`, amber through `80ms`, red above `80ms`.
- Added a one-line budget note below the timing chips so slow opens are visible without opening browser devtools.
- Reused the same named budget constants for metric coloring and budget status so thresholds cannot silently drift apart.
- Memoized the derived budget object from the already-memoized telemetry summary.

Speed and smoothness notes:

- The inspector still subscribes to telemetry events and does not poll.
- Recent-event rendering remains capped at six rows.
- The budget badge is computed from the capped in-memory buffer and does not add new global listeners.
- React docs were checked through Context7 for `useEffect` external subscription cleanup and `useMemo` derived calculation guidance before tightening this path.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused telemetry/customizer/wheel pack: 44 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broader radial-focused pack: 182 tests passed.
- Chromium radial E2E: 2 passed.

Next:

- Add per-view hover previews: wire ghost, route ghost, rail highlight, delete outline.
- Continue secondary adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.

## Landed Pass 12 - 2026-06-03

Added the first lightweight visible-wheel command preview layer:

- Added `RadialCommandPreview`, a fixed pointer-events-off overlay that renders simple SVG intent cues under the radial wheel.
- Added preview kinds for create, connect, inspect, run, delete, edit, reuse, transform, and breadboard rail inspection.
- Added per-view copy for PCB route ghosts, breadboard jumper ghosts, rail continuity highlights, delete outlines, measurement anchors, and blocked disabled reasons.
- Wired `RadialMenu` hover and keyboard navigation to emit preview state, so mouse and keyboard users get the same feedback.
- Wired `ProjectWorkspace` to own and clear command preview state on view changes, menu close, customize handoff, selection, and marking gesture completion.
- Added Chromium E2E coverage proving the preview appears on Architecture radial hover and clears when opening customization.

Speed and smoothness notes:

- The preview overlay is one contained fixed layer with `pointer-events: none`.
- Hover does not scan the canvas or inspect target DOM.
- Preview copy is computed from the existing radial context and command metadata.
- The preview sits below the wheel z-index, so it cannot block clicks.
- React docs were checked through Context7 for `useCallback`, memoized children, event-handler cleanup, and derived UI state before wiring hover/focus updates.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused radial UI preview pack: 49 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broader radial-focused pack: 185 tests passed.
- Chromium radial E2E: 2 passed.

Next:

- Push previews deeper into canvas adapters where useful: actual schematic wire endpoint ghosts, PCB route traces, breadboard rail lane highlights, and delete outlines tied to selected geometry.
- Continue secondary adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.

## Landed Pass 13 - 2026-06-03

Pushed command previews into the active canvas adapters:

- Added `RADIAL_COMMAND_PREVIEW_EVENT` and `dispatchRadialCommandPreview`, matching the existing radial command event pattern with a lightweight show/clear contract.
- Added a `ProjectWorkspace` preview bridge so radial hover and keyboard focus now update the generic preview layer and notify mounted canvas adapters with the same state.
- Added a Schematic adapter preview that converts the radial pointer through React Flow `screenToFlowPosition` and renders a wire/placement/delete ghost at the schematic-space anchor.
- Added a PCB adapter preview that converts the radial pointer into board coordinates and draws route, via, or targeted-delete ghosts inside the PCB SVG transform.
- Added a Breadboard adapter preview that uses the breadboard coordinate model to render rail continuity lanes, jumper ghosts, and delete outlines inside the breadboard SVG transform.
- Added unit coverage for the preview event contract and show/clear adapter behavior in Schematic, PCB, and Breadboard tests.
- Tightened the Chromium radial E2E wait budget around menu reopens while preserving the actual browser-open latency assertion at `<500ms`.

Speed and smoothness notes:

- The hover path dispatches one small custom event; it does not scan target DOM or pull large canvas state into `RadialMenu`.
- Canvas adapters only react when mounted and matching their view, and clear on any `clear` or non-matching view preview.
- All adapter ghosts use `pointer-events="none"` or `pointer-events-none`, so they cannot steal clicks from the wheel or canvas.
- PCB and Breadboard ghosts render inside existing SVG transform groups, keeping zoom/pan alignment without extra layout work.
- Schematic uses a fixed overlay only because React Flow owns the inner transform; it still stores the resolved flow coordinate for adapter truth and tests.
- Context7 resolved React docs to `/reactjs/react.dev`; the follow-up query failed, so official React docs were used as fallback for memoized callbacks/derived render guidance: https://react.dev/reference/react/useCallback, https://react.dev/reference/react/useMemo, https://react.dev/reference/react/memo

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused radial adapter preview pack: 133 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broader radial-focused pack: 189 tests passed.
- Chromium radial E2E: 2 passed.

Next:

- Add richer target geometry for schematic delete/replace and breadboard part/wire delete outlines instead of pointer-centered fallback outlines.
- Add secondary view adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.
- Add a compact radial preview mode in the customizer so slot moves can be tried before committing.

## Landed Pass 14 - 2026-06-03

Made radial layout customization draftable, visual, and reversible:

- Added a compact mini wheel inside `RadialMenuCustomizer` so slot edits show a live radial layout before they are committed.
- Changed slot buttons from immediate persistence to local draft edits.
- Added Apply and Revert controls: Apply persists changed command slots, Revert drops local draft changes, and close behaves like cancel for uncommitted slot moves.
- Kept the existing Reset control as a saved-layout reset so users can still return the active context to defaults quickly.
- Highlighted changed commands in the preview and row list, with an unsaved slot count in the footer.
- Memoized `radialItems` and `customizerItems` in `ProjectWorkspace` so the customizer is not handed needless fresh arrays while editing.
- Updated Chromium E2E to verify the new draft slot flow: choose slot, see preview move, apply, close, reopen, and confirm the persisted slot.

Speed and smoothness notes:

- Draft moves are local array transforms only; no `localStorage` writes happen until Apply.
- The mini wheel is a fixed-size contained surface (`contain: layout paint style`) so hover/click state cannot resize the panel.
- The draft swap logic only touches the moving command and an occupied-slot peer, keeping edits cheap even for full 8-command wheels.
- React docs were checked through Context7 for `useMemo`, `useCallback`, `memo`, and derived render state guidance before wiring the draft preview path.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run check`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/SchematicView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.aria.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/ViewRenderer.test.tsx`
- `npm run test:e2e -- e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused customizer draft pack: 47 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broader radial-focused pack: 190 tests passed.
- Chromium radial E2E: 2 passed.

Next:

- Add richer target geometry for schematic delete/replace and breadboard part/wire delete outlines instead of pointer-centered fallback outlines.
- Add secondary view adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.
- Add import/export presets for radial layouts so users can save context-specific wheel setups.

## Landed Pass 15 - 2026-06-03

Added portable radial layout presets:

- Added versioned radial layout preset helpers in `radial-menu-preferences`.
- Added preset export as readable JSON with `version`, `layoutKey`, `exportedAt`, and command `slots`.
- Added strict preset import validation for JSON shape, supported version, matching layout key, known command IDs, movable commands, valid 0-7 slots, and no overlaps after applying partial presets.
- Added preset application as a draft-only customizer action; users can import, inspect the mini wheel, then Apply to persist.
- Added a compact collapsible Presets panel inside the existing scrollable customizer body.
- Added icon-only copy/import controls with status feedback and clipboard fallback through the visible textarea.
- Added unit coverage for serializer/parser/apply helpers and the full customizer copy/import/apply flow.

Speed and smoothness notes:

- Import parsing only runs on explicit import, not while typing.
- Copy/export only serializes the current draft when the copy button is pressed.
- Imported slots update the same draft array used by manual slot moves, so no new persistence path or extra storage writes were added.
- The preset panel stays collapsed by default and lives inside the scrollable customizer body, preserving reachability on smaller viewports.
- React docs were checked through Context7 for `useMemo`, `useCallback`, `memo`, and derived state guidance before wiring the preset handlers.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run check`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused preset/customizer pack: 17 tests passed.
- Broad radial unit pack: 12 files and 163 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Clean Chromium radial E2E: 2 passed with the shell color-env warning removed.

Next:

- Add a named preset shelf if users want multiple saved layouts per context instead of copy/paste JSON.
- Add richer target geometry for schematic delete/replace and breadboard part/wire delete outlines instead of pointer-centered fallback outlines.
- Add secondary view adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.

## Landed Pass 16 - 2026-06-03

Turned portable presets into a real named preset shelf:

- Added named radial layout presets to the existing versioned preference store.
- Added save/update-by-name, list-by-layout, and delete helpers for local preset shelves.
- Kept shelves capped at 8 presets per layout so the customizer stays compact and fast.
- Kept saved preset loads on the same strict validation path as pasted JSON presets.
- Added a compact shelf UI inside the existing collapsible Presets panel.
- Added name input, save button, one-click load, and delete controls.
- Preset loads still apply only to the draft wheel; users inspect the mini wheel and hit Apply before persistence.
- Preset deletion does not touch the active saved layout slots.

Speed and smoothness notes:

- The shelf reuses `useSyncExternalStore` through `useRadialPreferences`; no second persistence system was added.
- Saving serializes only on explicit save.
- Loading validates only on explicit load.
- Shelf rendering is capped and scrollable, so it cannot stretch the customizer into trapped controls.
- The Presets panel stays collapsed by default and remains inside the customizer's scrollable body.
- React docs were checked through Context7 for `useSyncExternalStore`, `useMemo`, `useCallback`, and derived UI state before extending the store-driven UI.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run check`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused shelf/customizer pack: 21 tests passed.
- Broad radial unit pack: 12 files and 167 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Clean Chromium radial E2E: 2 passed.

Next:

- Add richer target geometry for schematic delete/replace and breadboard part/wire delete outlines instead of pointer-centered fallback outlines.
- Add secondary view adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.
- Consider per-preset keyboard shortcuts or favorite pins after the shelf has real usage feedback.

## Landed Pass 17 - 2026-06-03

Added geometry-aware adapter previews for schematic and breadboard targets:

- Added schematic node target bounds to the radial preview adapter.
- Schematic delete and replace previews now outline the targeted node instead of falling back to a pointer-centered ghost when the preview context includes a node target.
- Schematic bounds are derived from existing React Flow node data, using measured dimensions when present and cheap type-aware fallbacks when not.
- Added breadboard delete preview geometry for placed parts.
- Breadboard part bounds are derived from existing placement data, `getOccupiedPoints`, and `coordToPixel`.
- Added breadboard delete preview geometry for wires.
- Breadboard wire previews reuse stored wire points and render the actual wire path as the destructive hover outline.
- Added target-kind and target-id data attributes to the view adapter preview layers so tests and future adapters can assert the exact target shape.

Speed and smoothness notes:

- Preview geometry is computed synchronously from already-loaded view state only.
- No DOM measurement, async work, timers, storage writes, or network calls run on hover.
- Breadboard geometry renders inside the existing transformed SVG board layer, so pan and zoom stay handled by the existing canvas transform.
- Schematic geometry keeps the previous fixed overlay path and only swaps its anchor/size for known node targets.
- React docs were checked through Context7 for derived render state, `useMemo`, and `useCallback` guidance before extending the event adapter path.

Verification added or rerun:

- `npx vitest run client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npx vitest run client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run check`
- `git diff --check`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`

Results:

- Focused schematic/breadboard preview pack: 2 files and 65 tests passed.
- Broad radial unit pack: 12 files and 170 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- `git diff --check`: clean.
- Clean Chromium radial E2E: 2 passed.

Next:

- Add secondary view adapters for BOM, Validation, Simulation, 3D, Serial, Exports, Firmware, and Inventory.
- Add richer PCB trace/delete target geometry if PCB users need the same precision as schematic and breadboard.
- Consider per-preset keyboard shortcuts or favorite pins after the shelf has real usage feedback.

## Landed Pass 18 - 2026-06-03

Added real secondary adapters for BOM/procurement and validation:

- Converted Procurement tabs to controlled state so radial commands can move the user to the right lane.
- Added a BOM radial command listener for `bom_row` targets.
- `add_to_inventory` now opens My Inventory, highlights the row, and logs the stock-review handoff.
- `find_alternates` now opens the Alternates lane, seeds the part number, and runs the existing alternates search.
- `view_datasheet` now opens a datasheet search and logs the action.
- `check_supply_risk` now opens Live Pricing and runs the existing row-specific supplier/pricing lookup.
- `remove` now deletes the targeted BOM line through the existing BOM context.
- `edit_quantity` now returns to BOM Management and opens the existing inline quantity editor.
- Added mobile BOM card `data-bom-id` and `data-bom-label` metadata to match the desktop row target path.
- Added a validation radial target map for safety gates, architecture issues, component issues, DRC, ERC, and standards-compliance findings.
- Added validation row `data-issue-id` and `data-issue-label` metadata for the global target detector.
- `rerun_validation` now calls the existing validation runner.
- `jump_to_source` now routes to the right view for safety, architecture, component, DRC, ERC, and compliance targets.
- `copy_issue` now copies a useful issue summary.
- `explain_issue` now logs the rule explanation/remediation and shows it in a toast.
- `create_task` now drafts a task-style output log entry without pretending to persist a real task record.
- `suppress_issue` now opens the existing suppression path for architecture, component, DRC, and ERC targets, and clearly reports unsupported target types.

Speed and smoothness notes:

- No new hover work was added; these adapters run only when a command is committed.
- Target lookup is a memoized `Map` derived from already-rendered validation rows.
- BOM command handling reuses existing view callbacks and state instead of adding a parallel store.
- No new polling, timers, network calls, storage writes, DOM measurements, or layout scans were added to radial open/hover paths.
- The test harness now mocks virtualized rows and mounted background readers cleanly, so warning noise does not hide real regressions.
- React docs were checked through Context7 for event handlers, derived state, `useMemo`, and `useCallback` guidance before wiring the adapters.

Verification added or rerun:

- `npm test -- client/src/components/views/__tests__/ProcurementView.test.tsx`
- `npm test -- client/src/components/views/__tests__/ValidationView.test.tsx`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx`
- `npm run check`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/p1-keyboard-nav.spec.ts --project=chromium -g "arduino|circuit_code|output|storage"`
- `git diff --check`

Results:

- Focused Procurement radial adapter spec: 15 tests passed.
- Focused Validation radial adapter spec: 15 tests passed.
- Broad radial unit pack: 14 files and 200 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Chromium radial E2E: 2 passed.
- `git diff --check`: clean.

Next:

- Add secondary adapters for Simulation, 3D/Digital Twin, Serial Monitor, Exports, Firmware, and Inventory.
- Upgrade BOM `add_to_inventory` from lane handoff to real prefilled inventory creation once the inventory view exposes a safe write path.
- Add undo or confirmation affordances for destructive radial actions if users find direct remove too sharp in real use.

## Landed Pass 19 - 2026-06-04

Added the next secondary adapter batch for Simulation, 3D/Digital Twin, and Serial Monitor:

- Expanded the global radial target detector to understand `data-probe-id`, `data-log-line-id`, `data-model-id`, and `data-file-id`.
- Added probe row `data-probe-id` and `data-probe-label` metadata in Simulation.
- Added a Simulation radial command listener.
- `add_probe` now creates a real voltage probe through Simulation state.
- `run_simulation` now uses the existing complexity-aware run path.
- `compare_waveform` now surfaces saved run history when there is enough history to compare.
- `sweep_simulation` now switches to DC Sweep, seeds the first available source, and queues the existing simulation start path.
- `simulation_settings` now scrolls the Parameters section into view.
- `export_waveform` now downloads the current simulation result JSON when results exist.
- Added 3D component, trace, and via `data-model-*` metadata so model targets can be detected without DOM measurement.
- Added a 3D radial command listener.
- `isolate_model` now isolates and highlights the targeted 3D component.
- `cross_probe` now routes from a 3D target back to PCB Layout.
- `measure` now focuses the board dimensions panel.
- `fit_check` now enables the 3D wiring-guide inspection layer in mesh mode.
- `model_properties` now focuses bridge context when present, otherwise board metadata.
- `capture_view` now reuses the existing 3D scene export path.
- Added serial log-line `data-log-line-id` and `data-log-line-label` metadata.
- Added a Serial Monitor radial command listener.
- `mark_event` now starts recording if needed and inserts a timestamped marker.
- `resume_serial` now connects or disconnects through the existing Web Serial path.
- `analyze_log` now runs the hardware co-debug path when ready, otherwise exposes the existing troubleshooting hint.
- `decode_serial` now opens the monitor decode path and parses recent ESP-style output if present.
- `clear_serial` now clears through the existing Web Serial monitor action.
- `filter_serial` now focuses the monitor controls and preset surface.
- `export_log` now downloads an existing recording or the currently visible serial lines.

Speed and smoothness notes:

- The radial open/hover path remains attribute-based and synchronous.
- No new polling, timers, network calls, storage writes, layout reads, or DOM measurement were added to radial open/hover.
- View adapters subscribe to one global command event and reuse existing view callbacks after the user commits a command.
- 3D isolation filters the already-loaded component array and keeps camera snapping on the existing fast direct-DOM rotation path.
- Serial export and simulation export run only on committed commands.
- React docs were checked through Context7 for `useEffect` event listener setup/cleanup and derived state before wiring the listeners.

Verification added or rerun:

- `npm test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx`
- `npm run check`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `git diff --check`

Results:

- Focused Simulation/3D/Serial radial adapter pack: 3 files and 48 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broad radial unit pack: 17 files and 248 tests passed.
- Chromium radial E2E: 2 passed.
- `git diff --check`: clean.

Next:

- Add secondary adapters for Exports, Firmware, and Inventory.
- Decide whether Simulation comparison needs a dedicated waveform diff UI instead of the current history handoff.
- Add a stronger serial filter surface if users expect saved log filters rather than focused monitor controls.

## Landed Pass 20 - 2026-06-04

Added the final secondary adapter batch for Exports, Firmware, and Inventory:

- Added Export format `data-file-id` and `data-file-label` metadata so right-clicks can target a specific format.
- Added an Exports radial command listener.
- `create_export` now reveals the targeted format and runs the existing precheck-aware export path.
- `run_export_precheck` now reveals the targeted format and opens the existing precheck panel.
- `export_settings` now focuses the quick export profile surface.
- `copy_export_summary` now copies a concise project/export readiness summary to the clipboard.
- Added Circuit Code firmware radial handling.
- `add_firmware_snippet` now inserts a DSL status LED branch before `c.export()`.
- `compile_firmware` now evaluates the current DSL source through the existing circuit evaluator.
- `firmware_settings` now centers the Circuit Code source-trust/apply controls.
- `export_firmware` now downloads the current Circuit Code DSL source.
- Added Arduino Workbench firmware radial handling.
- `add_firmware_snippet` now inserts a serial `radialLog` helper into the active sketch, or opens the new-file flow when no file is selected.
- `compile_firmware` now starts the existing Arduino Verify path.
- `firmware_settings` now opens the board/profile settings dialog.
- `export_firmware` now downloads the last compiled artifact when available, otherwise downloads the active sketch source.
- Added Arduino file-row `data-file-id` and `data-file-label` metadata for future file-specific firmware targeting.
- Added Inventory row `data-part-id` and `data-part-label` metadata.
- Added an Inventory radial command listener.
- `add_inventory_item` now opens the scanner intake flow.
- `find_alternates`, `inspect_part`, and `stock_audit` now focus/filter the targeted inventory row and highlight it.
- `edit_inventory_item` now fills missing stock tracking fields through the existing BOM update path.
- `remove_inventory_item` now removes the targeted row through the existing BOM delete path.

Speed and smoothness notes:

- The radial open/hover path is still just attribute lookup plus existing action selection.
- No new polling, watchers, network calls, storage writes, layout reads, or DOM measurements were added to radial open/hover.
- Export, Firmware, Arduino, and Inventory work happens only after a committed command.
- View adapters use one cleaned-up global event listener with React `useEffect` cleanup.
- React docs were checked through Context7 for `useEffect` window listener setup/cleanup and stable handler dependencies before wiring the listeners.

Verification added or rerun:

- `npm test -- client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `git diff --check`
- `node .agents/skills/pp-view-exports/scripts/inspect-exports.mjs`
- `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs`
- `node .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs`
- `node .agents/skills/pp-view-arduino/scripts/inspect-arduino.mjs`

Results:

- Focused Exports/Firmware/Inventory radial adapter pack: 3 files and 42 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- Broad radial unit pack: 17 files and 301 tests passed.
- Chromium radial E2E: 2 passed.
- Touched-view Chromium keyboard/browser subset: 6 passed.
- `git diff --check`: clean.
- Exports, Inventory, Circuit Code, and Arduino page inspectors: ok.

Next:

- Run a visual browser audit of the radial menu on Exports, Circuit Code, Arduino, and Inventory once the dev server is open.
- Add an undo/confirm affordance for destructive radial removals if direct remove feels too sharp in real use.
- Upgrade Inventory `find_alternates` from focused row handoff to a real alternates lane if Inventory gets its own substitute surface.

## Landed Pass 21 - 2026-06-04

Added the destructive-command safety layer without slowing normal radial commands:

- Destructive radial commands now arm on first click/Enter/Space instead of executing immediately.
- Armed destructive commands show `Confirm <label>` in the center well, turn the command label into `Confirm <label>`, and render a small `Confirm` badge.
- A second activation of the same destructive command executes and closes the wheel.
- Confirmation automatically clears after a short pause so stale destructive state does not linger.
- Marking gestures that land on a destructive command now open the visible wheel already armed for confirmation instead of deleting/removing from the gesture alone.
- Added confirmation telemetry with `destructive-confirm-requested` and `mark-confirm-required`.
- Added telemetry inspector labels for the new confirmation events.
- Stabilized the radial E2E by closing the Architecture asset library before node-targeted right-clicks so the test uses the real browser pointer path without a panel intercepting the node.

Speed and smoothness notes:

- Non-destructive commands still execute on the first activation.
- The radial open/hover path still does not add network work, storage writes, polling, or DOM measurement.
- Confirmation state is local to the mounted wheel and uses one cleaned-up timeout only when a destructive command is armed.
- Marking gestures still stay fast: only destructive completions branch into the visible confirmation wheel.
- React docs were checked through Context7 for state updates and timeout cleanup before wiring the confirmation timer.

Verification added or rerun:

- `npm test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused destructive-confirmation unit pack: 3 files and 44 tests passed.
- Chromium radial E2E: 2 passed.
- Broad radial unit pack: 17 files and 304 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Do a visual browser pass on destructive confirmation states across compact, edge-clamped, and mobile-sized wheels.
- Consider optional undo toast for destructive radial commands after execution.
- Add destructive confirmation coverage to another non-Architecture target once the next radial adapter batch lands.

## Landed Pass 22 - 2026-06-04

Added responsive wheel scaling so the radial menu stays reachable on compact and edge-clamped viewports:

- The wheel now computes a cheap viewport scale during render when the available viewport cannot fit the full command surface.
- Clamp math now uses the scaled visual size, so edge-opened wheels fit inside narrow mobile-sized viewports instead of overflowing.
- The SVG geometry stays unchanged, preserving slot layout, hit regions, label placement, and existing hover behavior.
- The open animation now uses an inline `translateZ(0) scale(...)` transform so the responsive scale and GPU paint path coexist.
- Added a `data-radial-scale` test hook to prove compact viewport behavior without doing DOM measurement inside the app.
- Added a compact Chromium E2E that opens the wheel near the bottom-right edge at 360x520 and asserts the transformed browser rect remains inside the viewport.
- Stabilized the existing hover-size E2E by waiting for the opening animation to reach its final box before asserting hover does not resize the wheel.
- Fixed the customizer preset-copy test to wait for the clipboard promise-driven `"Preset copied"` status instead of racing the immediate `"Preset exported"` state.

Speed and smoothness notes:

- No resize listener, observer, polling loop, storage call, network call, or layout read was added to the app path.
- Scale is derived from `window.innerWidth` and `window.innerHeight` during the render that already opens the wheel.
- Non-compact desktop viewports still render at scale `1`.
- Compact viewports keep the same command model and wheel geometry rather than switching to a separate mobile component.
- React docs were checked through Context7 for deriving cheap render values instead of adding unnecessary state/effects.
- Playwright docs were checked through Context7 for `page.setViewportSize` and viewport-relative `boundingBox`/browser rect proof.

Verification added or rerun:

- `npm test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused RadialMenu responsive unit spec: 38 tests passed.
- Chromium radial E2E: 3 passed, including the new compact viewport proof.
- Focused RadialMenu + Customizer pack: 2 files and 47 tests passed.
- Broad radial unit pack: 17 files and 305 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Do a screenshot-backed visual pass of the compact wheel and destructive confirmation states.
- Consider optional undo toast for destructive radial commands after execution.
- Add a compact customizer/mobile layout pass if the 23rem panel feels tight on smaller phones.

## Landed Pass 23 - 2026-06-04

Made the customizer itself mobile-reachable so the compact wheel does not hand users off to a clipped 23rem desktop panel:

- Added a viewport-derived customizer layout that switches from a floating resizable panel to a compact sheet when the viewport is too narrow or too short for the full panel.
- Compact customizer sheets pin to an 8px viewport margin and size to `calc(100vw - 16px)` by `calc(100dvh - 16px)`.
- Desktop customizers keep the existing floating, clamped, resizable behavior.
- Added `data-layout="compact-sheet"` / `data-layout="floating"` so tests can prove the layout mode without relying on fragile class scraping.
- Added `radial-customizer-body` and `radial-customizer-footer` test hooks so reachability checks can target the scrollable body and bottom action bar directly.
- Extended the compact Chromium E2E so it opens the wheel at 360x520, opens customize, proves the sheet is inside the viewport, proves the body scrolls, and proves the footer/apply control stays visible.

Speed and smoothness notes:

- No resize listener, observer, polling loop, storage call, network call, animation timer, or DOM measurement was added.
- The layout decision is a cheap render-time derivation from `window.innerWidth` and `window.innerHeight`.
- Compact mode reuses the same customizer content and command model instead of adding a second mobile implementation to keep in sync.
- React docs were checked through Context7 for deriving cheap values during render instead of unnecessary state/effects.
- Tailwind docs were checked through Context7 for mobile-first responsive behavior and arbitrary `calc()` values before adding the compact classes.

Verification added or rerun:

- `npm test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused RadialMenuCustomizer compact-layout spec: 10 tests passed.
- Chromium radial E2E: 3 passed, including compact wheel plus compact customizer reachability proof.
- Broad radial unit pack: 17 files and 306 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Do screenshot-backed visual proof of the compact sheet and destructive confirmation states on mobile and desktop.
- Add collapse/minimize behavior for the customizer so it can get out of the canvas while preserving draft edits.
- Promote the compact/floating panel logic toward a shared workbench panel primitive once another radial-side surface needs the same behavior.

## Landed Pass 24 - 2026-06-04

Added the customizer collapse/minimize affordance so the radial layout editor can get out of the canvas without throwing away draft work:

- The customizer now has a header collapse button with `aria-expanded`, `aria-controls`, and clear expand/collapse labels.
- The panel exposes `data-collapsed` for tests and future shared-panel extraction.
- Collapsed mode hides the heavy editor body and footer, keeps reset/close reachable, and shows a compact draft-status summary in the header.
- Draft slot edits, selected command state, preset text, and saved preset state stay in the mounted customizer component, so expanding restores the same draft.
- Compact sheets drop their forced full-height style when collapsed, so mobile users get an actual minimized strip instead of an invisible full-screen blocker.
- Existing floating and compact layouts remain the same while expanded.

Speed and smoothness notes:

- No resize listener, observer, polling loop, storage call, network call, animation timer, or DOM measurement was added.
- Collapse is one local boolean and a render-time style derivation.
- Collapsed mode removes the scroll-heavy body from the DOM while preserving controlled draft state in the parent component.
- React docs were checked through Context7 for state preservation by component position and conditional rendering before using a mounted-parent collapse model.
- Local ProtoPulse panel patterns were checked for `data-collapsed`, `aria-expanded`, and compact status affordances before wiring the customizer.

Verification added or rerun:

- `npm test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused RadialMenuCustomizer collapse spec: 11 tests passed.
- Chromium radial E2E: 3 passed, including compact customizer collapse/expand proof.
- Broad radial unit pack: 17 files and 307 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Do screenshot-backed visual proof of the compact sheet, collapsed strip, and destructive confirmation states on mobile and desktop.
- Consider moving the repeated floating/compact/collapsed panel mechanics into a shared workbench panel primitive.
- Add an optional undo toast after destructive radial commands execute.

## Landed Pass 25 - 2026-06-04

Added an undo-aware destructive radial command protocol and proved it on real Architecture node deletion:

- `dispatchRadialCommandDetail` now returns the mutable command detail object after view adapters handle it.
- Existing `dispatchRadialCommand` remains compatible and still returns the boolean handled result.
- Radial command details can now include `undo: { label, description, run }`.
- The workspace controller shows an Undo toast action only when a destructive command was handled and the view adapter supplied an undo callback.
- Architecture radial delete now captures the deleted node and connected edges, deletes them, and supplies an undo callback that restores the node, restores missing connected edges, reselects the node, and logs the restore.
- Added telemetry for `destructive-undo-offered` and `destructive-undo-run`, plus inspector labels for both events.
- Hardened Architecture right-click behavior so right-clicking a node for radial actions does not start node dragging.
- Removed duplicate unconditional Architecture context-to-local sync effects so the guarded sync hook can prevent delayed save/refetch cycles from overwriting fresh local radial edits.
- Node deletion now marks edge interaction when connected edges are removed, so edge persistence stays in sync.
- The radial Playwright spec now runs serially to avoid same-project API rate-limit spikes, anchors delete/undo assertions to a real node `data-id`, closes the inspector before node-targeted right-clicks, and proves the delete event was handled with undo metadata.

Speed and smoothness notes:

- The undo protocol adds no polling loop, resize listener, observer, DOM measurement, or background timer.
- Undo work is lazy: restore code only runs if the user clicks the toast action.
- The workspace controller reuses the existing toast system instead of adding a second overlay path.
- Right-click drag hardening removes accidental drag state from radial menu opens.
- Context7 resolved React during this pass, but the docs query failed; no new implementation depended on unverified React API behavior.

Verification added or rerun:

- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium -g "radial command layer opens quickly"`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused undo/Architecture/telemetry unit pack: 4 files and 60 tests passed.
- Solo Architecture radial E2E: 2 passed, including setup and delete plus Undo proof on the exact node id.
- Full Chromium radial E2E: 3 passed.
- Broad radial unit pack: 19 files and 316 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Add screenshot-backed visual proof for destructive confirmation and the undo toast on desktop and compact viewports.
- Consider making node inspector surfaces radial-target-aware so right-clicking the inspector can run node commands without first closing the panel.
- Start extracting the repeated floating, compact, collapsed, and non-blocking panel mechanics into a shared workbench panel primitive.

## Landed Pass 26 - 2026-06-04

Made the Architecture node inspector radial-target-aware so the wheel works from the panel that is currently covering the selected node:

- `NodeInspectorPanel` now exposes `data-nodeid`, `data-node-label`, and `data-radial-target="architecture-node-inspector"` on the inspector root.
- Existing workspace radial target detection already walks up ancestor elements, so right-clicking the inspector header/body now resolves to the selected Architecture node without a separate event path.
- The visual layout is unchanged: no new buttons, panels, icons, overlays, or extra chrome.
- The Architecture unit test now proves both the canvas node and the open inspector advertise matching radial target metadata.
- The Chromium radial E2E now keeps the inspector open after Add BOM, right-clicks the inspector title, opens the node wheel, runs destructive delete, verifies undo metadata, hides the inspector after deletion, then restores the exact node via Undo.

Speed and smoothness notes:

- This pass adds only static DOM metadata.
- No render-time measurement, timers, observers, listeners, storage calls, or network calls were added.
- The existing radial detector and command path are reused, so the inspector gets node commands without duplicating command wiring.
- Context7 checked current React docs for `data-*` attributes and event handlers, and current Playwright docs for right-click locator targeting plus strict locator behavior.

Verification added or rerun:

- `npm test -- client/src/components/views/__tests__/ArchitectureView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused Architecture unit test: 1 file and 25 tests passed.
- Chromium radial E2E: 3 passed, including inspector-targeted node wheel delete plus Undo proof.
- Broad radial unit pack: 19 files and 316 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Add screenshot-backed visual proof for destructive confirmation, Undo toast, compact customizer, collapsed customizer, and inspector-targeted radial launch.
- Make other blocking inspector/panel surfaces radial-target-aware where they cover their backing object.
- Start extracting the repeated floating, compact, collapsed, non-blocking, target-aware panel mechanics into a shared workbench panel primitive.

## Landed Pass 27 - 2026-06-04

Added durable screenshot-backed visual proof for the radial command layer:

- Added `e2e/radial-visual-proof.spec.ts`, an opt-in Playwright proof spec gated by `RADIAL_VISUAL_PROOF=1` so normal E2E runs do not rewrite screenshot artifacts.
- The proof spec creates a fresh authenticated E2E project through the existing Playwright setup, resets Architecture graph state, disables screenshot-noisy animations, and writes a deterministic capture folder.
- The screenshot catalog lives at `docs/audit-screenshots/radial-command-layer-pass-27/`.
- The catalog includes `SUMMARY.json`, `MANIFEST.md`, and 11 PNG captures.
- Desktop captures cover Architecture canvas baseline, canvas radial menu with hover preview, full-context radial menu, customizer expanded, destructive Delete confirmation, inspector-targeted radial launch, Undo toast, and restored node after Undo.
- Compact captures cover scaled wheel reachability, compact customizer expanded, and compact customizer collapsed strip.
- Each screenshot is validated for non-empty byte size during the Playwright run, and the summary records status, total bytes, and capture rows.
- The proof spec hides optional V3 and asset-library panels before node-targeted actions so the captured states are about radial behavior, not incidental panel obstruction.

Speed and smoothness notes:

- The visual proof is opt-in and does not add work to default test runs.
- Screenshot stabilization uses Playwright screenshot options (`animations: "disabled"`, `caret: "hide"`, `scale: "css"`) plus a tiny injected style to remove animation noise.
- The proof reuses existing radial command flows and existing auth/project setup instead of creating a separate app driver.
- Context7 checked current Playwright screenshot docs before implementing the screenshot API usage.

Verification added or rerun:

- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `find docs/audit-screenshots/radial-command-layer-pass-27 -maxdepth 1 -type f -printf '%f %s\n' | sort`
- `node -e "const fs=require('fs'); const s=JSON.parse(fs.readFileSync('docs/audit-screenshots/radial-command-layer-pass-27/SUMMARY.json','utf8')); console.log(JSON.stringify({status:s.status,captureCount:s.captureCount,bytes:s.bytes,files:s.rows.map(r=>r.file)},null,2));"`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Opt-in visual proof Playwright run: 2 passed, including setup and the capture test.
- Screenshot catalog: 11 PNGs, `SUMMARY.json`, and `MANIFEST.md`; summary status `ok`; total screenshot bytes `1136556`.
- Standard Chromium radial E2E: 3 passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Review the screenshot catalog visually and turn any visual friction into concrete UI fixes.
- Add screenshot proof for additional panel-targeted radial surfaces as they become target-aware.
- Start extracting the repeated floating, compact, collapsed, non-blocking, target-aware panel mechanics into a shared workbench panel primitive.

## Landed Pass 28 - 2026-06-04

Turned the visual-proof friction into a product fix:

- Added a compact collapse mode to `V3ArchitectureReadinessPanel` so the Architecture v3 gate no longer has to be fully closed just to recover canvas working space.
- The gate now has a dedicated collapse/expand icon button with `aria-expanded`, `aria-controls`, and stable `data-testid="v3-architecture-gate-collapse"` coverage.
- Expanded mode keeps the existing scrollable/resizable panel behavior.
- Collapsed mode changes the panel footprint to a small non-resizable strip with status, node count, and edge count, keeping the gate visible without blocking the canvas.
- The collapsed panel advertises `data-collapsed="true"` and exposes `v3-architecture-gate-summary` for tests and future visual tooling.
- The Architecture unit test now proves collapse, summary text, body hiding, expansion, and toolbar close behavior.
- The Chromium radial E2E now opens the v3 gate, collapses it, right-clicks the newly added Architecture node, and verifies the node-targeted radial wheel still opens.
- The opt-in visual proof now writes a new `docs/audit-screenshots/radial-command-layer-pass-28/` catalog with 12 captures, including the collapsed v3 gate.
- The visual proof initially exposed that reopening the gate after the optional-panel hider was not stable in the screenshot driver; the proof now captures the collapsed gate while it is already mounted, then hides optional panels for clean radial screenshots.

Speed and smoothness notes:

- The product change adds one local boolean state and conditional body rendering only inside the v3 gate component.
- Collapsed mode removes resize and the heavy scroll body from layout, so it is cheaper than leaving the full gate open.
- No new app-level listeners, observers, polling, storage writes, network calls, or radial-menu runtime hooks were added.
- Context7 checked current React docs for local component state and conditional rendering before the component change.

Verification added or rerun:

- `npm run test -- client/src/components/views/__tests__/ArchitectureView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `node -e "const fs=require('fs'); const p='docs/audit-screenshots/radial-command-layer-pass-28/SUMMARY.json'; const s=JSON.parse(fs.readFileSync(p,'utf8')); if(s.status!=='ok'||s.captureCount!==12||s.rows.some(r=>r.bytes<=1000)) throw new Error(JSON.stringify(s)); console.log('ok', s.captureCount, s.bytes);"`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused Architecture unit test: 1 file and 25 tests passed.
- Standard Chromium radial E2E: 3 passed, including collapsed v3 gate plus node radial launch proof.
- Opt-in visual proof Playwright run: 2 passed, including setup and the capture test.
- Screenshot catalog: 12 PNGs, `SUMMARY.json`, and `MANIFEST.md`; summary status `ok`; total screenshot bytes `932746`.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Use the same collapse-first pattern for any other Architecture floating panels that can block node/canvas radial gestures.
- Start extracting the repeated floating, compact, collapsed, non-blocking, target-aware panel mechanics into a shared workbench panel primitive.
- Add screenshot proof when the next panel becomes target-aware or shared-panel-backed.

## Landed Pass 29 - 2026-06-04

Added fast command search to the radial wheel customizer:

- `RadialMenuCustomizer` now has a compact command search field above the command rows.
- Search filters by command label, description, group, hint, and current slot direction.
- The preview wheel stays visible while rows are filtered, so the user keeps spatial orientation while hunting for a command.
- The selected preview command follows the filtered result when the current selection is no longer visible.
- A match counter shows `visible/total` command rows.
- A clear-search icon button appears only when a query is active.
- Empty search results render a small dashed empty state instead of a blank panel.
- The search is local controlled input state with derived filtered rows; no preference writes or app-level listeners were added.
- The standard Chromium radial E2E now filters the real Architecture canvas wheel to `Analyze`, verifies `Add Node` hides, clears search, and continues slot customization.
- The opt-in visual proof now writes `docs/audit-screenshots/radial-command-layer-pass-29/` with 13 captures, including `06-desktop-customizer-filtered.png`.

Speed and smoothness notes:

- Filtering is a small `useMemo` over the already-rendered draft command array.
- The implementation adds no network calls, storage writes, observers, timers, or radial-open work.
- The preview wheel is not remounted or hidden during search; only the row list changes.
- Context7 checked current React docs for controlled input and derived filtered data patterns before implementation.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `node -e "const fs=require('fs'); const p='docs/audit-screenshots/radial-command-layer-pass-29/SUMMARY.json'; const s=JSON.parse(fs.readFileSync(p,'utf8')); if(s.status!=='ok'||s.captureCount!==13||s.rows.some(r=>r.bytes<=1000)) throw new Error(JSON.stringify(s)); console.log('ok', s.captureCount, s.bytes);"`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`
- `chafa --symbols=block --colors=none --size=100x45 docs/audit-screenshots/radial-command-layer-pass-29/06-desktop-customizer-filtered.png`

Results:

- Focused customizer unit test: 1 file and 12 tests passed.
- Related radial UI unit pack: 4 files and 56 tests passed.
- Standard Chromium radial E2E: 3 passed, including command search in the customizer flow.
- Opt-in visual proof Playwright run: 2 passed, including setup and the capture test.
- Screenshot catalog: 13 PNGs, `SUMMARY.json`, and `MANIFEST.md`; summary status `ok`; total screenshot bytes `976573`.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Add keyboard-first search affordances inside the customizer, such as focusing the search field when the customizer opens from keyboard or command-palette paths.
- Carry command search into denser target-specific wheels as more panels become radial-target-aware.
- Start extracting the repeated floating, compact, collapsed, non-blocking, target-aware panel mechanics into a shared workbench panel primitive.

## Landed Pass 30 - 2026-06-04

Made the radial wheel customizer keyboard-fast:

- Command search now auto-focuses when the customizer opens or expands.
- `/`, `Ctrl+F`, and `Meta+F` focus and select the command search without adding visible shortcut clutter.
- `Escape` clears an active command search first; a second Escape closes the customizer.
- `Alt+1..8` moves the selected command to a wheel slot in the draft layout without applying it.
- The keyboard slot path works with filtered results, so a user can search a command and assign it without touching the pointer.
- The customizer exposes `aria-keyshortcuts` on the dialog and search input.
- The standard Chromium radial E2E proves auto-focus, typed search, `Alt+4` slot assignment, Escape clear, and continued slot customization.
- The opt-in visual proof now writes `docs/audit-screenshots/radial-command-layer-pass-30/` with `06-desktop-customizer-keyboard-filtered.png`.

Speed and smoothness notes:

- The keyboard handlers are local to the customizer dialog.
- No new radial-open work, network calls, storage writes, observers, timers, or app-level listeners were added.
- Slot assignment updates the existing draft item array and stays unapplied until the user hits Apply.
- Context7 checked current React docs for `useRef`/`useEffect` focus and `onKeyDown` patterns before implementation.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `node -e "const fs=require('fs'); const p='docs/audit-screenshots/radial-command-layer-pass-30/SUMMARY.json'; const s=JSON.parse(fs.readFileSync(p,'utf8')); if(s.status!=='ok'||s.captureCount!==13||s.rows.some(r=>r.bytes<=1000)) throw new Error(JSON.stringify(s)); console.log('ok', s.captureCount, s.bytes);"`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`
- `chafa --symbols=block --colors=none --size=100x45 docs/audit-screenshots/radial-command-layer-pass-30/06-desktop-customizer-keyboard-filtered.png`

Results:

- Focused customizer unit test: 1 file and 15 tests passed.
- Related radial UI unit pack: 4 files and 59 tests passed.
- Standard Chromium radial E2E: 3 passed, including keyboard search/slot assignment in the customizer flow.
- Opt-in visual proof Playwright run: 2 passed.
- Screenshot catalog: 13 PNGs, `SUMMARY.json`, and `MANIFEST.md`; status `ok`; total screenshot bytes `980763`.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Add keyboard-first behavior to opening the radial menu/customizer from non-pointer entry paths.
- Start extracting shared workbench panel mechanics once one more floating panel uses the same collapse/search/keyboard affordance pattern.

## Landed Pass 31 - 2026-06-04

Added keyboard-first radial opening and customization:

- `Shift+F10` and the `ContextMenu` key now open the radial wheel without a pointer.
- Keyboard open reuses the same context/action/preference path as right-click.
- If focus is inside the workspace, the wheel opens around the focused radial target; otherwise it falls back to the workspace center.
- Keyboard open records `keyboard-open` telemetry so pointer and keyboard entry paths remain visible in the inspector stream.
- The radial wheel exposes `aria-keyshortcuts` for its keyboard controls.
- Pressing `C` while the wheel is open jumps straight into the customizer.
- Modified copy shortcuts such as `Ctrl+C` are not stolen by the wheel.
- The standard Chromium E2E now proves `Shift+F10` opens the canvas wheel, emits `keyboard-open`, closes with `Escape`, and uses `C` to open the customizer during the main flow.
- The opt-in visual proof now writes `docs/audit-screenshots/radial-command-layer-pass-31/` with `03-desktop-keyboard-radial-menu.png`.

Speed and smoothness notes:

- The keyboard opener is one local `keydown` listener in the existing radial controller.
- It does no storage writes, network calls, observers, polling, or action-list construction unless the shortcut matches.
- Matched keyboard opens reuse existing memoized preferences and the same action catalog path as pointer opens.
- The `C` shortcut is handled only while the radial wheel is mounted.
- Context7 checked current React docs for refs/effects and keyboard handler patterns before implementation.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `node -e "const fs=require('fs'); const p='docs/audit-screenshots/radial-command-layer-pass-31/SUMMARY.json'; const s=JSON.parse(fs.readFileSync(p,'utf8')); if(s.status!=='ok'||s.captureCount!==14||s.rows.some(r=>r.bytes<=1000)) throw new Error(JSON.stringify(s)); console.log('ok', s.captureCount, s.bytes);"`
- `chafa --symbols=block --colors=none --size=100x45 docs/audit-screenshots/radial-command-layer-pass-31/03-desktop-keyboard-radial-menu.png`
- `npm run check`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused radial wheel unit test: 1 file and 40 tests passed.
- Focused customizer unit test: 1 file and 15 tests passed.
- Related radial UI unit pack: 4 files and 61 tests passed.
- Clean standard Chromium radial E2E rerun: 3 passed, including keyboard open and keyboard customizer launch.
- Opt-in visual proof Playwright run: 2 passed.
- Screenshot catalog: 14 PNGs, `SUMMARY.json`, and `MANIFEST.md`; status `ok`; total screenshot bytes `1038579`.
- `npm run check`: design token drift check passed and TypeScript passed.
- Affected post-type-fix UI tests: 2 files and 43 tests passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Add direct slot hotkeys on the open wheel so keyboard users can press `1..8` to execute the currently visible slot.
- Add focused-target keyboard proof against a real node or row target, not only the canvas fallback.
- Start extracting shared workbench panel mechanics once another floating panel repeats the same collapse/search/keyboard affordance pattern.

## Landed Pass 32 - 2026-06-04

Made the open radial wheel execute like a real keyboard power tool:

- Plain `1..8` now maps directly to radial slots `0..7` while the wheel is open.
- Number hotkeys update the active preview and use the same selection path as click, Enter, and Space.
- Disabled commands do not run from number hotkeys.
- Destructive commands keep the same two-step confirmation behavior; pressing the slot number once arms the command, pressing it again confirms.
- Modified shortcuts such as `Ctrl+7` are not stolen by the wheel.
- The wheel exposes the number shortcuts through `aria-keyshortcuts`.
- The standard Chromium E2E now proves a real focused Architecture node can open the wheel with `Shift+F10`, execute slot `8`, duplicate the node, and carry node target metadata through the radial command event.
- The opt-in visual proof now writes `docs/audit-screenshots/radial-command-layer-pass-32/` with `08-desktop-focused-node-keyboard-radial-menu.png`.

AI-native kickoff:

- Tyler pushed for AI to be wired in hard, not just present as a label.
- `generate_architecture` in Architecture now builds a context-rich AI prompt from the live canvas, current radial target, target id/label, pointer position, target node details, current nodes, and current connections.
- The button path, linear context menu path, and radial wheel path now share the same Architecture AI prompt builder.
- The radial AI path is still fast: the prompt is built only when the command is selected. No storage writes, network calls, observers, polling, or always-on AI listeners were added.
- Next AI pass should add more explicit radial AI commands: explain this, propose next connection, fix this validation issue, find alternates, expand this block, and generate from this target.

Speed and smoothness notes:

- Number-key execution is local to the mounted radial wheel.
- No new storage writes, network calls, observers, polling, or global always-on listeners were added for slot hotkeys.
- The direct slot path does no action lookup unless a plain `1..8` key is pressed while the wheel is mounted.
- Context7 checked current React docs for keyboard handlers, `useCallback`, refs/effects, and `preventDefault` patterns before implementation.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `node -e "const fs=require('fs'); const p='docs/audit-screenshots/radial-command-layer-pass-32/SUMMARY.json'; const s=JSON.parse(fs.readFileSync(p,'utf8')); if(s.status!=='ok'||s.captureCount!==15||s.rows.some(r=>r.bytes<=1000)) throw new Error(JSON.stringify(s)); console.log('ok', s.captureCount, s.bytes);"`
- `chafa --symbols=block --colors=none --size=100x45 docs/audit-screenshots/radial-command-layer-pass-32/08-desktop-focused-node-keyboard-radial-menu.png`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `npm run test -- client/src/components/views/__tests__/ArchitectureView.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`

Results:

- Focused radial wheel unit test: 1 file and 44 tests passed.
- Related radial UI unit pack: 4 files and 65 tests passed.
- Focused ArchitectureView AI bridge test: 1 file and 26 tests passed, including targeted radial context into `protopulse:chat-send`.
- Clean standard Chromium radial E2E: 3 passed, including focused-node keyboard open plus slot `8` duplicate.
- Opt-in visual proof Playwright run: 2 passed.
- Screenshot catalog: 15 PNGs, `SUMMARY.json`, and `MANIFEST.md`; status `ok`; total screenshot bytes `1083301`.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- `git diff --check`: clean.

Next:

- Add first-class AI radial commands beyond `generate_architecture`: explain this target, propose next connection, expand this block, fix validation issue, find alternates, and summarize tradeoffs.
- Add a small contextual AI command registry so AI actions can be reused across Architecture, Schematic, Breadboard, BOM, Validation, and 3D without each view inventing its own prompt shape.
- Keep latency strict: build AI prompts only on command execution, keep menu open/hover paths free of model calls, and use optimistic local UI feedback before any async work.

## Landed Pass 33 - 2026-06-04

Started the first-class AI radial command surface:

- Architecture node wheels now expose `Explain` in the inspect slot, replacing the old browser datasheet search behavior.
- Architecture canvas wheels now expose `AI Connect` in the connect slot so the wheel can ask for the next useful architecture connection.
- The deeper Architecture command list now includes `AI Explain`, `AI Connect`, and `AI Expand`.
- `view_datasheet` remains a compatibility alias in the Architecture adapter, but now routes to the AI explain prompt instead of opening a browser search.
- The Architecture AI prompt builder now has explicit intents: `generate`, `explain`, `propose_connection`, and `expand_block`.
- AI radial prompts open the chat panel and then dispatch `protopulse:chat-send`, so the action is visible to the user.
- Prompts carry live canvas context, radial target, target id/label, pointer position, target node details, current nodes, and current connections.

Speed and smoothness notes:

- AI prompts are built only when the user executes an AI command.
- No AI work, network call, storage write, observer, or polling was added to radial open, hover, preview, or customizer paths.
- The node wheel remains capped at 8 slots and keeps destructive delete in the SW confirm slot.
- Context7 checked current React docs for event handler placement, `useCallback`/`useMemo`, and keeping non-reactive work inside user event handlers.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `npm run test -- client/src/components/views/__tests__/ArchitectureView.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/ArchitectureView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --project=chromium`
- `RADIAL_VISUAL_PROOF=1 env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-visual-proof.spec.ts --project=chromium`
- `node -e "const fs=require('fs'); const p='docs/audit-screenshots/radial-command-layer-pass-33/SUMMARY.json'; const s=JSON.parse(fs.readFileSync(p,'utf8')); if(s.status!=='ok'||s.captureCount!==15||s.rows.some(r=>r.bytes<=1000)) throw new Error(JSON.stringify(s)); console.log('ok', s.captureCount, s.bytes);"`
- `chafa --symbols=block --colors=none --size=100x45 docs/audit-screenshots/radial-command-layer-pass-33/08-desktop-focused-node-keyboard-radial-menu.png`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`

Results:

- Radial action registry focused test: 1 file and 29 tests passed.
- Architecture AI bridge focused test: 1 file and 28 tests passed, including radial AI explain and linear AI expand.
- Combined radial/UI/AI unit pack: 6 files and 122 tests passed.
- Clean standard Chromium radial E2E: 3 passed, including visible `AI Connect` and focused-node `Explain` assertions.
- Opt-in visual proof Playwright run: 2 passed.
- Screenshot catalog: 15 PNGs, `SUMMARY.json`, and `MANIFEST.md`; status `ok`; total screenshot bytes `1107311`.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- `git diff --check`: clean.

Next:

- Add the shared contextual AI command registry so prompt intents are not trapped inside ArchitectureView.
- Extend the same AI command shape to Validation issue explain/fix, BOM alternates/tradeoffs, Breadboard wiring help, and 3D model inspection.
- Add one browser proof that an AI radial command opens the chat panel and shows the sent contextual prompt without needing a manual sidebar click.

## Landed Pass 34 - 2026-06-04

Made radial AI reusable beyond Architecture:

- Added `client/src/lib/radial-ai-commands.ts` as the shared prompt builder and chat dispatcher.
- The helper supports contextual intents for architecture generation/explain/connect/expand, validation fixes, alternates, supply risk, and sourcing tradeoffs.
- The helper standardizes radial context, target details, optional sections, final instruction text, `protopulse:open-chat-panel`, and `protopulse:chat-send`.
- Refactored Architecture AI prompts to use the shared helper while preserving target-aware canvas summaries.
- Validation `explain_issue` now sends a practical AI fix/explain prompt instead of only logging static local text.
- BOM row wheels now include `AI Tradeoffs` in slot 7 and send cost, supplier, stock, quantity, and status context to AI chat.
- Added focused unit coverage for the shared helper, Validation issue AI handoff, Procurement tradeoff AI handoff, and the BOM action registry.
- Added a focused Playwright proof that creates a node from the radial wheel, opens the node wheel, runs `Explain`, opens chat, and verifies the contextual AI prompt event.

Speed and smoothness notes:

- AI prompt construction still happens only when an AI command is executed.
- No model calls, fetches, storage writes, observers, polling, or extra action lookups were added to radial open, hover, preview, or customization paths.
- The browser proof hides optional Architecture overlays before targeting a node, matching the real "canvas must stay reachable" rule and avoiding false click interception.
- Context7 checked current React docs for event handlers, side effects, render purity, and `useCallback`/`useMemo` before the shared dispatcher/refactor.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command"`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-validation/scripts/inspect-validation.mjs`
- `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`
- `git diff --check`

Results:

- Combined radial AI unit pack: 5 files and 92 tests passed.
- Focused Playwright radial AI proof: 2 passed, including setup and Chromium.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Validation inspector: ok, now tracking 81 tests in required files.
- Procurement inspector: ok.
- `git diff --check`: clean.

Next:

- Extend shared radial AI commands to Breadboard wiring help, Schematic/ERC reasoning, PCB/DFM review, 3D fit inspection, and Serial log decode.
- Add a compact "AI prompt preview" affordance in the radial command preview/customizer so Tyler can see what will be sent before firing it.
- Consider a lightweight radial AI history lane: last AI command per target, repeat command, and compare prompt result without slowing the wheel.

## Landed Pass 35 - 2026-06-04

Added a fast AI-aware radial preview:

- `RadialCommandPreview` now recognizes AI command ids such as `generate_architecture`, `ai_explain_architecture`, `explain_issue`, and `ai_part_tradeoffs`.
- AI commands get their own preview glyph, color tone, and compact `AI` badge.
- The preview detail names the context that will be sent, such as `AI prompt with Architecture New Component context`.
- The preview stays pure and cheap: it derives from command metadata and current radial context only. It does not build the full prompt, dispatch chat events, call a model, fetch, store, observe, or poll.
- The focused Playwright proof now hovers `Explain`, verifies the AI preview badge and context detail, then clicks the command and verifies chat open/send events.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialCommandPreview.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command"`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `npm run check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `git diff --check`

Results:

- Focused preview unit test: 1 file and 4 tests passed.
- Focused Playwright radial AI proof: 2 passed, including setup and Chromium.
- Radial UI unit pack: 4 files and 66 tests passed.
- `npm run check`: design token drift check passed and TypeScript passed.
- UI/UX design inspector: ok.
- `git diff --check`: clean.

Next:

- Add a repeat-last-AI-command affordance so Tyler can rerun the last target-aware AI command without hunting through the wheel.
- Extend shared radial AI commands to Breadboard wiring help, Schematic/ERC reasoning, PCB/DFM review, 3D fit inspection, and Serial log decode.
- Consider exposing the AI preview badge inside the customizer preview wheel when a command is known to open chat.

## Landed Pass 36 - 2026-06-04

Added repeat-last radial AI behavior and hardened the proof path:

- `radial-ai-commands` now keeps an in-memory last radial AI command with a `useSyncExternalStore`-friendly subscription API.
- Architecture, Validation, and Procurement radial AI paths record useful history labels such as `Explain architecture: New Component`, `Fix issue: ...`, and `Part tradeoffs: ...`.
- `RadialMenu` exposes a small `Repeat AI` affordance plus the `R` key while the wheel is open. It lives outside the 8 pie slots, so it does not disturb custom slot layouts or marking-menu muscle memory.
- `ProjectWorkspace` repeats the last stored prompt through the same chat bridge and records `visible-repeat-ai` telemetry.
- The telemetry event type and inspector label map now include `visible-repeat-ai`.
- The focused Playwright proof now runs the AI command, closes the optional API-key setup dialog if it appears, reopens the wheel, clicks `Repeat AI`, and verifies a second contextual chat-send event.

Speed and smoothness notes:

- The history is in memory only. No prompt text is written to localStorage/sessionStorage.
- Prompt building and event dispatch still happen only when an AI command is fired or repeated.
- The repeat affordance is a fixed button outside slot layout math, so hover/slot geometry stays unchanged.
- React docs were checked with Context7 for `useSyncExternalStore` and event-handler side effects before wiring the external history store.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command"`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run check` token drift stage, then `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`

Results:

- Focused radial AI helper test: 1 file and 4 tests passed.
- Focused radial menu test: 1 file and 46 tests passed.
- Focused Playwright radial AI repeat proof: 2 passed after closing the expected setup dialog and rerunning against the warmed dev server.
- Broad changed-area Vitest pack: 8 files and 132 tests passed.
- Telemetry follow-up tests: 2 files and 7 tests passed.
- Design token drift check passed.
- Direct TypeScript check passed with an 8GB Node cap. The full `npm run check` wrapper was resource-terminated during TypeScript while a separate `.claude/worktrees/3d-viewer` TypeScript job was also active, so the gate was split into its two real parts.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- `git diff --check`: clean.

Next:

- Add repeat-last AI to keyboard/muscle-memory docs and the radial telemetry inspector copy if the pattern sticks.
- Extend shared radial AI commands to Breadboard wiring help, Schematic/ERC reasoning, PCB/DFM review, 3D fit inspection, and Serial log decode.
- Consider a small "pin this AI command" lane so Tyler can keep one favorite AI action available while the repeat slot continues tracking the most recent one.

## Landed Pass 37 - 2026-06-05

Extended the shared radial AI layer into Schematic and PCB:

- Added `review_schematic` and `review_pcb` intents to the shared radial AI command helper.
- Added `AI ERC` to Schematic node and canvas wheels.
- Added `AI DFM` to PCB footprint/object and canvas wheels.
- Schematic radial AI now sends bounded context to chat: circuit name, target node, visible symbols, known nets, visible connections, and ERC issues.
- PCB radial AI now sends bounded context to chat: board dimensions, layers, active layer, target footprint, placed footprints, nets, routed traces, and the current board trust/safety gate status.
- Both paths use the existing chat bridge and last-AI history path, so `Repeat AI` works for these new commands without another menu-specific system.

Research refresh:

- Official Fusion marking-menu docs: https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-6514ABC1-CB75-4F0B-AB0E-316FAD36BA93.htm
- Official Maya Hotbox/marking-menu docs: https://help.autodesk.com/cloudhelp/2022/ENU/Maya-Basics/files/GUID-06174D85-0B39-4EAD-B814-D1E06C3344AE.htm
- Official Blender pie-menu docs: https://docs.blender.org/manual/en/latest/interface/controls/buttons/menus.html

These continue to support the ProtoPulse direction: stable directional slots, small top-level wheels, context-specific command sets, and a visible novice path that can become fast muscle memory.

Speed and smoothness notes:

- The new commands do no AI prompt construction until the command is actually fired.
- Prompt sections are bounded with small slices, so a huge schematic or board cannot make the wheel open slower.
- No fetches, observers, storage writes, polling, or model calls were added to menu open, hover, preview, customization, or slot layout.
- The Schematic and PCB wheels stay under the 8-action cap.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `npm run test -- client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`

Results:

- Schematic focused test: 1 file and 15 tests passed.
- PCB focused test: 1 file and 8 tests passed.
- Registry focused test: 1 file and 29 tests passed after fixing one duplicate Schematic registry insertion.
- Broad changed-area Vitest pack: 8 files and 113 tests passed.
- Design token drift check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- `git diff --check`: clean.

Next:

- Extend shared radial AI commands to Breadboard wiring help, Serial log decode, 3D fit inspection, Simulation explanation, and starter-circuit learning prompts.
- Add a compact "AI prompt preview" detail for Schematic and PCB so Tyler can see what context will be sent before firing.
- Consider a pinned AI command lane for one favorite action, separate from the last-command `Repeat AI` lane.

## Landed Pass 38 - 2026-06-05

Extended the shared radial AI layer into Breadboard:

- Added `breadboard_wiring` to the shared radial AI intent list.
- Added `AI Wiring` to Breadboard part/wire and canvas wheels.
- The Breadboard canvas adapter now handles `ai_breadboard_wiring` through the shared `runRadialAiCommand` path.
- The prompt includes bounded bench context: project, target part or jumper, placed parts, bench-staged parts, breadboard jumpers, known nets, board audit status when open, and coach/layout context.
- Because this uses the shared radial AI dispatcher, `Repeat AI` can replay the Breadboard wiring prompt just like Architecture, Validation, Procurement, Schematic, and PCB prompts.

Speed and smoothness notes:

- No prompt is built until `AI Wiring` is actually fired.
- Large board state is bounded with small slices: 10 placed parts, 6 bench-staged parts, 8 jumpers, 10 nets, 6 audit issues, and 6 coach actions.
- No pointer, drag, pan, zoom, hover, preview, or radial open behavior was changed.
- The Breadboard part wheel remains at the 8-action cap, and the canvas wheel remains under it.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Registry focused test: 1 file and 29 tests passed.
- Breadboard focused test: 1 file and 52 tests passed.
- Breadboard inspector: ok, now tracking 80 tests in required files.
- Broad changed-area Vitest pack: 9 files and 165 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after the doc append.

Next:

- Extend shared radial AI commands to Serial log decode, 3D fit inspection, Simulation explanation, and starter-circuit learning prompts.
- Add prompt-preview detail for AI commands across Schematic, PCB, and Breadboard.
- Consider a small "radial AI history" inspector view that shows recent AI intents without storing full prompts long-term.

## Landed Pass 39 - 2026-06-05

Extended the shared radial AI layer into Serial Monitor:

- Added `serial_decode` to the shared radial AI intent list.
- Added `AI Decode` to the Serial Monitor radial wheel without moving the existing `Mark` north slot. `AI Decode` uses the open north-east slot.
- The Serial Monitor radial adapter now handles `ai_serial_decode` through the shared `runRadialAiCommand` path.
- The prompt includes bounded serial context: selected log line, last 30 visible serial lines, connection state, baud, line ending, DTR/RTS, selected board/profile, replay state, bytes sent/received, detector signals, and the first 40 sketch lines.
- Empty serial output is handled with a destructive toast instead of sending a useless AI prompt.

Speed and smoothness notes:

- No AI prompt is built until `AI Decode` is actually fired.
- The local ESP decoder and hardware co-debug mutation remain unchanged; this pass only adds a chat handoff.
- The Serial radial wheel stays at the 8-action cap.
- Existing serial muscle memory is preserved: `Mark` remains in the north slot.

Verification added or rerun:

- `npm run test -- client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `node .agents/skills/pp-view-serial-monitor/scripts/inspect-serial-monitor.mjs`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Serial focused radial test: 1 file and 4 tests passed.
- Registry focused test: 1 file and 29 tests passed.
- Serial Monitor inspector: ok.
- Broad changed-area Vitest pack: 10 files and 169 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before the doc append.

Next:

- Extend shared radial AI commands to 3D fit inspection, Simulation explanation, and starter-circuit learning prompts.
- Add prompt-preview detail for AI commands across Schematic, PCB, Breadboard, and Serial.
- Consider AI command pinning so one favorite AI action can stay stable while `Repeat AI` tracks the most recent command.

## Landed Pass 40 - 2026-06-05

Extended the shared radial AI layer into the 3D View:

- Added `inspect_3d_fit` to the shared radial AI intent list.
- Added `AI Fit` to the 3D model radial wheel in the open north slot.
- The 3D View radial adapter now handles `ai_3d_fit_inspection` through the shared `runRadialAiCommand` path.
- The prompt includes bounded physical scene context: target model, board dimensions, first 10 components, first 8 traces, first 8 vias, first 8 drill holes, visible layer state, wiring guide state, airwire state, isolated model, current view angle, and cross-view bridge provenance.
- Bridge provenance stays in the prompt so Breadboard, Component Editor, Community, Generative, and Digital Twin handoffs keep their trust and verification context visible during AI fit review.
- Because this uses the shared radial AI dispatcher, `Repeat AI` can replay the 3D fit prompt like the Architecture, Validation, Procurement, Schematic, PCB, Breadboard, and Serial prompts.

Docs and local guidance checked:

- Context7 React docs (`/reactjs/react.dev`) for event-handler side effects and callback dependency hygiene.
- `pp-view-3d` skill references for 3D page map, testing, and gotchas.
- 3D gotcha preserved: do not weaken source-agnostic bridge payloads or blank the scene when traces, vias, or drill holes exist.

Speed and smoothness notes:

- No AI prompt is built until `AI Fit` is actually fired.
- No fetches, model calls, observers, or storage writes were added to menu open, hover, preview, customization, or slot layout.
- Scene sections are bounded, so large 3D boards cannot make the AI handoff explode.
- The 3D radial wheel stays under the 8-action cap.

Verification added or rerun:

- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/viewer-3d-bridge.test.ts client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- 3D focused test: 1 file and 45 tests passed.
- Registry focused test: 1 file and 29 tests passed.
- 3D inspector: ok, now tracking 62 tests in required files.
- Broad changed-area Vitest pack: 12 files and 220 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before the doc append.

Next:

- Extend shared radial AI commands to Simulation explanation and starter-circuit learning prompts.
- Add prompt-preview detail for AI commands across Schematic, PCB, Breadboard, Serial, and 3D.
- Consider AI command pinning so one favorite AI action can stay stable while `Repeat AI` tracks the most recent command.

## Landed Pass 41 - 2026-06-05

Extended the shared radial AI layer into Simulation probes:

- Added `explain_simulation` to the shared radial AI intent list.
- Added `AI Explain` to the Simulation radial wheel in the open north-east slot.
- Preserved Simulation wheel muscle memory: `Probe` stays north and `Run` stays east.
- `ProbeManager` now handles `ai_simulation_explain` through the shared `runRadialAiCommand` path.
- The prompt includes bounded simulation context: selected probe, first 10 probes, probe type, target node/component, probe count, and whether probe controls are enabled.
- The Simulation page-skill references now record `client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx` as the nearest radial test.
- Because this uses the shared radial AI dispatcher, `Repeat AI` can replay Simulation probe explanations like the other radial AI commands.

Speed and smoothness notes:

- No AI prompt is built until `AI Explain` is actually fired.
- The adapter listens for the existing radial command event; no polling, fetches, solver calls, storage writes, or waveform work were added.
- Prompt context is bounded to 10 probes.
- The Simulation radial wheel remains under the 8-action cap.

Verification added or rerun:

- `npm run test -- client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts`
- `node .agents/skills/pp-view-simulation/scripts/inspect-simulation.mjs`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/viewer-3d-bridge.test.ts client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Simulation probe focused test: 1 file and 2 tests passed.
- Registry focused test: 1 file and 29 tests passed.
- Shared radial AI helper test: 1 file and 4 tests passed.
- Simulation inspector: ok.
- Broad changed-area Vitest pack: 13 files and 222 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after the doc append.

Next:

- Extend shared radial AI commands to starter-circuit learning prompts.
- Add prompt-preview detail for AI commands across Schematic, PCB, Breadboard, Serial, 3D, and Simulation.
- Consider AI command pinning so one favorite AI action can stay stable while `Repeat AI` tracks the most recent command.

## Landed Pass 42 - 2026-06-05

Extended the radial menu into the Starter Circuits gallery:

- Added `starter_learn` to the shared radial AI intent list.
- Added `starter_circuits` as a supported radial context and `starter_circuit` as a target kind.
- Mapped the `starter_circuits` workspace view to the radial system.
- Starter circuit cards now expose `data-starter-circuit-id` and `data-starter-circuit-label` for target detection.
- Added a compact Starter Circuits card wheel:
  - `AI Learn` in north.
  - `Open` in east.
  - `Copy Code` in north-west.
- `StarterCircuitsPanel` now handles `ai_starter_learn`, `open_starter_circuit`, and `copy_starter_code` through the existing radial command event path.
- The `AI Learn` prompt includes bounded learning context: selected starter, description, board type, tags, up to 12 components, up to 10 learning objectives, first 40 Arduino code lines, and current gallery filter state.
- Added `starter_circuits:starter` radial preference-key normalization so custom layouts work for starter cards.
- Starter Circuits page-skill references now record `client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx` as the closest test.

Speed and smoothness notes:

- No AI prompt is built until `AI Learn` is actually fired.
- No fetches, generated model calls, polling, observers, or solver work were added.
- Code preview is bounded to 40 lines, components to 12, learning objectives to 10, and tags to 10.
- Empty gallery space does not show card-specific commands; the wheel only appears for actual starter cards.
- The Starter Circuits wheel has 3 actions and stays well under the 8-action cap.

Verification added or rerun:

- `npm run test -- client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts`
- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts`
- `node .agents/skills/pp-view-starter-circuits/scripts/inspect-starter-circuits.mjs`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/viewer-3d-bridge.test.ts client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Starter Circuits focused test: 1 file and 40 tests passed.
- Registry focused test: 1 file and 29 tests passed.
- Shared radial AI helper test: 1 file and 4 tests passed.
- Radial preferences focused test: 1 file and 12 tests passed.
- Starter Circuits inspector: ok.
- Broad changed-area Vitest pack: 15 files and 274 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap after adding the missing `starter_circuits` preference-key branch.
- `git diff --check`: clean after the doc append.

Next:

- Add prompt-preview detail for AI commands across Schematic, PCB, Breadboard, Serial, 3D, Simulation, and Starter Circuits.
- Consider AI command pinning so one favorite AI action can stay stable while `Repeat AI` tracks the most recent command.
- Start moving toward command subrings or a command-palette bridge for lower-frequency actions once the main wheel lanes are saturated.

## Landed Pass 43 - 2026-06-05

Made AI command previews more explicit without making hover do any AI work:

- Replaced the generic AI hover copy with command-specific prompt-preview descriptors.
- The preview chip now shows:
  - `Packet`: what context would be included.
  - `Scope`: the current view and selected target.
  - `Bound`: the prompt family that will be fired.
  - `Run`: the click-only action path.
- Added descriptors for architecture, schematic, PCB, breadboard, validation, procurement, simulation, starter circuits, 3D fit, and serial decode AI commands.
- Kept preview generation pure and local: static descriptor lookup plus `getViewSummary()` and `getTargetSummary()`.
- Added fixed AI chip dimensions so the richer preview does not resize or jump as the user hovers.
- Added focused tests for validation issue explain, 3D fit inspection, and starter-circuit learning previews.

Speed and smoothness notes:

- Hover still does not build prompts, call models, fetch data, inspect the DOM, start timers, or dispatch command events.
- The chip content is bounded to short strings and rendered with truncation/line clamps.
- Position clamping now accounts for the larger AI preview chip, so it stays on-screen near viewport edges.
- Non-AI previews keep the smaller chip and existing route/rail/delete behavior.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialCommandPreview.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Focused preview test: 1 file and 6 tests passed.
- Broad radial UI/library pack: 6 files and 100 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Add a visible AI prompt-draft handoff into the chat panel when the user clicks an AI radial command.
- Consider a tiny "last AI packet" telemetry field so the inspector can prove hover is preview-only and click is the only command path.

## Landed Pass 44 - 2026-06-05

Made radial AI clicks visibly draft prompts in chat instead of auto-sending them:

- Added `protopulse:chat-draft` as the shared radial AI draft event.
- `dispatchRadialAiPrompt()` now opens the chat panel and emits a draft payload with `source: radial-ai`.
- `ChatPanel` listens for draft payloads, replaces the input with the bounded prompt, closes the design-agent subpanel, and focuses the normal chat input.
- `runRadialAiCommand()` and `repeatLastRadialAiCommand()` now reuse the same draft path.
- Updated Schematic, PCB, Breadboard, Serial, 3D, Simulation, Starter Circuits, Validation, Procurement, and Architecture tests to expect drafts from radial AI commands.
- Updated user-facing toast/log copy from `Sent` to `Drafted` where radial AI now prepares an editable prompt instead of sending immediately.
- Kept the legacy Breadboard toolbar explain path as an explicit `chat-send` path; only the shared radial AI helper changed behavior.
- Classified the new radial and 3D event names in the storage-key inventory generator, regenerated `storage-key-inventory.json`, and added a direct storage-classification test for `protopulse:chat-draft`.

Speed and smoothness notes:

- Hover remains preview-only and does not build prompts, send events, or touch chat state.
- Click builds the bounded prompt once, then dispatches one lightweight browser event.
- The draft bridge avoids surprise model calls and gives Tyler a chance to inspect or edit the prompt before spending tokens.
- Chat focus uses the existing `textareaRef`, not a DOM query loop.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/desktop-storage-migration.test.ts`
- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/desktop-storage-migration.test.ts client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run test -- client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npx tsx scripts/dev/check-storage-key-inventory.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Focused radial AI/ChatPanel/storage tests: 3 files and 34 tests passed.
- Broad radial draft surface pack: 17 files and 353 tests passed.
- Post-name-cleanup rerun: 3 files and 99 tests passed.
- Storage inventory drift check: ok.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Add a tiny "last AI packet" telemetry field so the inspector can prove hover is preview-only and click is the only command path.
- Consider an opt-in send-now modifier or menu item for advanced users who want radial AI commands to fire immediately.

## Landed Pass 45 - 2026-06-05

Added lightweight AI draft telemetry:

- Added `ai-draft` as a radial telemetry event name.
- Added bounded metadata fields for AI draft telemetry:
  - `intent`
  - `promptChars`
  - short `reason`
- `runRadialAiCommand()` records `ai-draft` telemetry when the command has radial context.
- `repeatLastRadialAiCommand()` records the repeated draft using the remembered context.
- The direct Architecture AI prompt path now passes telemetry metadata into `dispatchRadialAiPrompt()`.
- `RadialTelemetryInspector` now labels `ai-draft` rows as `AI draft` and displays intent plus prompt length.
- Tests prove the telemetry stores metadata only, not full prompt contents.

Speed and smoothness notes:

- Hover still records no AI draft event.
- AI draft telemetry is created only from the click path that builds a prompt.
- The telemetry payload stores prompt length, intent, view, target, and a bounded summary, not the prompt body.
- The inspector reuses the existing radial telemetry subscription and does not add polling.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `npm run test -- client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `git diff --check`
- `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --pretty false`

Results:

- Focused telemetry tests: 3 files and 13 tests passed.
- Affected radial/UI pack: 6 files and 93 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Consider an opt-in send-now modifier or menu item for advanced users who want radial AI commands to fire immediately.
- Consider adding a small inspector count for AI drafts versus hover previews.

## Landed Pass 46 - 2026-06-05

Added opt-in send-now for radial AI commands while keeping draft as the default:

- Added `activation` metadata to radial command events.
- `RadialMenu` now passes compact activation options:
  - normal click/Enter/Space/number hotkeys: `{ input }`
  - Shift-click and Shift+Enter/Space: `{ input, sendNow: true, modifier: 'shift' }`
- Added `draft` / `send-now` delivery helpers to `radial-ai-commands`.
- `dispatchRadialAiPrompt()` now still opens the chat panel first, then either:
  - emits `protopulse:chat-draft` for normal AI radial commands
  - emits `protopulse:chat-send` for Shift-activated AI radial commands
- Draft/send events include `source: radial-ai` and `delivery`.
- Added `ai-send-now` telemetry so the inspector can distinguish drafted prompts from immediately sent prompts.
- Wired delivery through Architecture, Procurement, Validation, Starter Circuits, 3D board view, Simulation probes, Serial Monitor, Breadboard, Schematic, and PCB radial AI handlers.
- Updated toast/log copy so it says `Drafted` for the default path and `Sent` for Shift-send.
- Kept repeat-last-AI draft-first for now; it remains a safe resend-to-input affordance rather than an immediate model call.

Speed and smoothness notes:

- No global Shift key store was added.
- No hover path builds prompts or touches chat state.
- Delivery is just one boolean on the existing command event.
- The send-now path reuses the existing chat-send bridge, so there is no new chat transport.
- Number hotkeys still ignore modified number presses, which avoids stealing browser/OS shortcuts.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/lib/__tests__/radial-ai-commands.test.ts client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx`
- `npm run test -- client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx`
- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused RadialMenu/AI/Starter tests: 3 files and 96 tests passed.
- Architecture/Procurement/Validation radial tests: 3 files and 60 tests passed.
- 3D/Simulation/Serial radial tests: 3 files and 51 tests passed.
- Schematic/PCB/Breadboard radial tests: 3 files and 75 tests passed.
- Total focused verification for this pass: 12 files and 282 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Consider adding a tiny visible hint in the radial preview for AI commands: `Click drafts / Shift-click sends`.
- Consider a separate repeat-last-AI send-now affordance only if Tyler actually wants repeat to bypass draft safety.

## Landed Pass 47 - 2026-06-05

Made the AI draft/send power move visible in the radial preview:

- Added an AI-only delivery hint row: `Click drafts / Shift-click sends`.
- Kept the hint inside the existing hover preview render path.
- Increased the AI preview chip height and viewport clamp budget so the hint does not clip near screen edges.
- Left non-AI previews unchanged; route, rail, delete, edit, and other previews do not show the AI hint.
- Kept all click/send behavior in the existing event handlers from Pass 46.

Speed and smoothness notes:

- No new event listeners, timers, storage reads, model calls, prompt building, or chat state writes were added.
- Hover still uses static descriptor data only.
- The hint is a short, single-line row with truncation, so it cannot resize the chip or create layout churn.
- The AI chip remains fixed-size and viewport-clamped.

Docs checked:

- Context7: React `/reactjs/react.dev` conditional rendering and purity guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/lib/__tests__/radial-ai-commands.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused RadialCommandPreview/RadialMenu/AI helper tests: 3 files and 61 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Add visible AI draft/send counts to `RadialTelemetryInspector` so Tyler can see how often radial AI is drafting versus immediately sending.
- Consider a lightweight browser screenshot pass for the AI preview chip once the next UI-visible pass lands.

## Landed Pass 48 - 2026-06-05

Made radial AI prompt usage visible in the timing inspector:

- Added compact AI prompt counters to `RadialTelemetryInspector`.
- The inspector now shows total AI prompts, AI drafts, and AI sends.
- Counts are derived from the existing in-memory telemetry event buffer.
- No new storage reads, listeners, timers, model calls, chat writes, or telemetry events were added.
- The recent-event list still shows command metadata and prompt character counts without exposing prompt body text.

Speed and smoothness notes:

- The counters are derived inside the existing `useMemo` summary path.
- The three AI metric cells are fixed-layout and short-label, so they do not resize the inspector or disturb the recent-event list.
- The color treatment uses separate sky, fuchsia, and emerald accents to avoid flattening the inspector into a one-note palette.

Docs checked:

- Context7: React `/reactjs/react.dev` component purity and `useMemo` guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused telemetry/AI helper tests: 3 files and 15 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Do a lightweight browser/screenshot pass for the AI preview chip and telemetry inspector together.
- Consider a tiny interaction test for Shift-click send-now from a rendered radial menu into the chat-send bridge.

## Landed Pass 49 - 2026-06-05

Proved the rendered workspace radial bridge preserves AI draft/send activation:

- Exported `RadialMenuController` from `ProjectWorkspace.tsx` so tests can render the real workspace radial controller without booting the full workspace shell.
- Added `ProjectWorkspace.radial-controller.test.tsx`.
- The new test opens a real rendered radial menu on a fake Architecture node using the same `data-id` target contract production Architecture nodes use.
- Normal click on `ai_explain_architecture` dispatches a radial command with `activation: { input: 'mouse' }`.
- Shift-click on the same rendered item dispatches `activation: { input: 'mouse', sendNow: true, modifier: 'shift' }`.
- The command detail still carries the real node context: view, target kind, target id, and target label.

Speed and smoothness notes:

- No runtime behavior changed beyond making the controller test-addressable.
- No new production listeners, timers, storage reads, telemetry writes, model calls, or chat writes were added.
- This test sits at the boundary where the rendered radial menu hands off to the global command event, which is the highest-risk gap between UI gesture and AI delivery behavior.

Docs checked:

- Context7: React `/reactjs/react.dev` event-handler guidance.
- Context7: Testing Library `/testing-library/testing-library-docs` click event init/modifier-key guidance.

Verification added or rerun:

- `npm run test -- client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/lib/__tests__/radial-ai-commands.test.ts client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused workspace-controller/radial/AI tests: 4 files and 61 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean after this doc append.

Next:

- Do the browser/screenshot pass for the AI preview chip and telemetry inspector together.
- Consider adding a Playwright-level visual smoke if the current dev server route can open the radial menu deterministically.

## Landed Pass 50 - 2026-06-05

Proved the live browser radial AI path with screenshots and full radial E2E coverage:

- Updated `e2e/radial-command-layer.spec.ts` so the Architecture AI radial command now proves the current delivery contract: normal click drafts, Repeat AI drafts again, and Shift-click sends immediately.
- The E2E now listens for `protopulse:chat-draft` and `protopulse:chat-send`, so it verifies the actual browser events instead of assuming a chat stream happened.
- The AI preview proof asserts the richer prompt descriptor, scope, bound prompt, and the visible `Click drafts / Shift-click sends` hint.
- Fixed the radial open telemetry measurement so `visible-mounted` records at DOM commit via `useLayoutEffect`; the animation rAF no longer adds an artificial frame to every open timing.
- Changed the telemetry budget to use typical median open latency while still showing outliers in the recent-event rows.
- Captured focused browser proof screenshots:
  - `logs/radial-ai-preview-chip-pass50.png`
  - `logs/radial-telemetry-ai-summary-pass50.png`
- The telemetry proof opens the real radial customizer after live interactions and verifies AI prompt counters: 3 total, 2 drafts, 1 send.

Speed and smoothness notes:

- The new E2E uses locator screenshots of the preview chip and telemetry inspector, not full-page baselines, so it stays fast and avoids noisy visual-golden churn.
- The late customizer open uses the existing keyboard radial shortcut after closing chat, which avoids fragile right-click interception from side panels.
- The regenerated telemetry screenshot now shows `Watch` with 75ms typical open latency, below the lag ceiling, and a 68ms latest mounted row on this dev server.
- Browser verification was rerun with the line reporter after the first HTML report pass, so generated `playwright-report/` churn was cleaned back out.

Docs checked:

- Context7: Playwright `/microsoft/playwright` locator/screenshot guidance.

Verification added or rerun:

- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused radial AI E2E: 2 passed in 1.4 minutes after the timing measurement fix.
- Full radial command-layer E2E: 4 passed in 3.2 minutes after the timing measurement fix.
- Focused radial unit tests: 4 files and 61 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Tighten the telemetry/customizer UX itself if visual inspection of the screenshots suggests spacing or contrast improvements.
- Consider adding a small screenshot manifest/checklist for radial proof artifacts if future passes add more states.

## Landed Pass 51 - 2026-06-05

Added a compact gesture coach to the radial customizer:

- Added a `Compass` coach inside `RadialMenuCustomizer`.
- The coach shows all eight radial slots, their current command labels, and compact state badges for `AI`, `Risk`, and `Moved`.
- Clicking a coach slot moves the currently selected command to that slot as a draft, so users can tune muscle-memory placement without scrolling to the command row.
- The coach keeps shortcut details in `aria-label`/`title` instead of adding an instruction wall to the UI.
- Captured browser proof at `logs/radial-gesture-coach-pass51.png`.

Research used:

- Kurtenbach and Buxton marking-menu work emphasizes the novice-to-expert transition: users can pop up the radial menu first, then learn directional marks over time. Source: https://www.billbuxton.com/MMExpert.html
- The expert-performance work used compass-style directions for 4- and 8-item marking menus, which maps directly to ProtoPulse's eight-slot radial wheel. Source: https://www.billbuxton.com/MMExpert.html
- User-learning research says marking menus work best for small, frequently used command sets and that skill improves with use. Source: https://www.billbuxton.com/MMUserLearn.html

Speed and smoothness notes:

- No new global listeners, storage writes, telemetry writes, or command-dispatch work were added.
- Slot mapping is derived from the existing draft item array with a memoized slot map.
- The coach is a fixed compact grid inside the existing scrollable customizer body, so compact/mobile overflow remains handled by the same container behavior.

Docs checked:

- Context7: React `/reactjs/react.dev` `useLayoutEffect` guidance for DOM-commit measurement before paint.
- Web: Bill Buxton archive pages for marking-menu expert performance and novice-to-expert learning: https://www.billbuxton.com/MMExpert.html and https://www.billbuxton.com/MMUserLearn.html

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 16 tests passed.
- Compact customizer E2E: 2 passed in 1.3 minutes.
- Full radial command-layer E2E: 4 passed in 3.1 minutes.
- Focused radial unit pack: 5 files and 77 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider a later "gesture history" view that groups recent mark-select and mark-cancel events by slot, if the coach needs more training feedback.

## Landed Pass 52 - 2026-06-05

Turned the gesture coach into a live learning loop and fixed the customizer footer/body balance:

- The customizer now subscribes to radial telemetry and builds per-slot gesture stats from `mark-select`, `mark-confirm-required`, and `mark-cancel` events.
- Each compass slot now shows live usage feedback such as `1 mark`, `No marks`, or `0 marks / 1 miss`, with average duration preserved in the title when available.
- The coach remains a fast draft slot mover: selecting a command and clicking a compass slot still swaps the draft layout without committing until Apply.
- The E2E seeds representative mark and miss history, then verifies the visible slot feedback in both the AI flow and compact viewport flow.
- Added compact embedded density to `RadialTelemetryInspector` so the customizer can keep timing/AI counters visible without letting recent-event rows steal the body height.
- Bounded the customizer footer with its own scroll area and made the body remain the primary working space.
- Polished coach tile spacing and captured full-panel browser proof at `logs/radial-gesture-history-pass52.png`.

Speed and smoothness notes:

- Telemetry feedback is derived from the existing in-memory radial telemetry buffer and a single existing custom event subscription.
- No new persistent storage writes, global pointer listeners, or command-dispatch work were added.
- The footer is now bounded and scrollable, so telemetry can grow without clipping the coach or trapping customizer controls.
- The existing dev server can keep the auth limiter warm after repeated Playwright auth setup runs; final focused and full radial runs completed without a 429 after normal spacing.

Docs and research carried forward:

- Context7: React `/reactjs/react.dev` `useLayoutEffect` guidance for DOM-commit timing measurement before paint.
- Web: Bill Buxton marking-menu expert performance and learning pages: https://www.billbuxton.com/MMExpert.html and https://www.billbuxton.com/MMUserLearn.html

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 16 tests passed after the coach usage feedback.
- Customizer plus telemetry unit tests: 2 files and 22 tests passed after compact telemetry was added.
- Focused radial AI E2E: 2 passed in 1.9 minutes after the footer/body fix regenerated the full-panel screenshot.
- Full radial command-layer E2E: 4 passed in 3.7 minutes.
- Focused radial unit pack: 5 files and 78 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider adding a small visible "fastest/roughest slot" summary if usage history becomes dense enough to make coach-level optimization worthwhile.
- Keep watching the customizer body/footer balance as more radial training and telemetry controls get added.

## Landed Pass 53 - 2026-06-05

Added tiny gesture insight chips to the coach:

- The customizer now derives a fastest marked slot and highest-miss watch slot from the same gesture stats used by the compass tiles.
- The coach shows compact chips like `Fast N 42ms` and `Watch SW 1 miss` only when telemetry exists.
- The chips use icons and short labels, keeping the customizer useful without adding an instruction wall.
- Captured browser proof at `logs/radial-gesture-insights-pass53.png`.

Speed and smoothness notes:

- The chips are memoized from the already-built per-slot stats.
- No extra telemetry events, storage writes, pointer listeners, or command handlers were added.
- The insight sort is eight fixed slots, so the work is constant-time and tiny.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 16 tests passed.
- Focused radial AI E2E: 2 passed in 1.6 minutes after the insight chips.
- Full radial command-layer E2E: 4 passed in 2.9 minutes.
- Focused radial unit pack: 5 files and 78 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider letting the coach recommend a command swap only after repeated misses, while keeping the actual layout stable unless Tyler chooses to apply it.

## Landed Pass 54 - 2026-06-05

Added draft-only coach suggestions after repeated gesture misses:

- The gesture coach now derives a suggestion when the current selected command is not already in a repeatedly missed direction.
- Suggestions are intentionally conservative: they appear only after at least 2 misses and only for customizable commands.
- Clicking the suggestion previews the move in the draft layout, but it does not call `onMove` or save anything until Apply.
- The suggestion is compact and action-shaped: `Try Add Node in SW` with a `Draft` badge.
- Captured browser proof:
  - `logs/radial-gesture-suggestion-pass54.png`
  - `logs/radial-gesture-suggestion-compact-pass54.png`

Speed and smoothness notes:

- The suggestion is memoized from the existing gesture insight state.
- No new global listeners, pointer handlers, telemetry writes, or storage writes were added.
- The suggestion uses the existing draft move/swap path, so it inherits the current preview-before-apply safety behavior.
- Browser proof found one transient auth/storage-state miss in the full sweep; the focused AI proof and the rerun full sweep both passed.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for pure derived values with `useMemo`, avoiding effects for pure calculations, and cleanup for external subscriptions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 17 tests passed.
- Focused radial AI E2E: 2 passed in 1.7 minutes.
- Compact radial E2E: 2 passed in 50.1 seconds.
- Full radial command-layer E2E: 4 passed in 2.4 minutes after rerun.
- Focused radial unit pack: 5 files and 79 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider making suggestions command-aware later by recording command ids on confirm/cancel paths where that is truthful, so the coach can recommend swaps based on the command the user was trying to hit.

## Landed Pass 55 - 2026-06-05

Made gesture coaching command-aware:

- Marking telemetry now carries the resolved command id on threshold/cancel paths when the pointer has truthfully resolved to a command slot.
- Pointer-cancel/window-blur cancellations after the mark threshold now preserve the last resolved slot and command id.
- Disabled command slots now record `disabled-command-in-slot` with the command id instead of looking like empty-slot misses.
- The customizer tracks per-command miss counts inside each slot's gesture stats.
- Coach suggestions now prefer the selected command's own missed slot before falling back to generic rough-slot suggestions.
- The suggestion remains draft-only and still requires Apply before saving.
- Captured browser proof:
  - `logs/radial-command-aware-suggestion-pass55.png`
  - `logs/radial-command-aware-suggestion-compact-pass55.png`

Speed and smoothness notes:

- The new command-aware fields reuse the existing telemetry event stream and customizer subscription.
- No new listeners, storage writes, or command dispatch paths were added.
- The command-aware suggestion is derived in render from already-memoized gesture stats, matching React's pure-derived-state guidance.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving pure render values instead of effects and updating state/callbacks from event handlers.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer/controller unit tests: 2 files and 21 tests passed.
- Focused radial AI E2E: 2 passed in 1.4 minutes.
- Compact radial E2E: 2 passed in 55.4 seconds.
- Full radial command-layer E2E: 4 passed in 2.6 minutes.
- Focused radial unit pack: 5 files and 81 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider exposing a tiny "why suggested" detail in the coach tooltip or telemetry inspector if command-specific suggestions need to be explainable without adding visible copy.

## Landed Pass 56 - 2026-06-05

Made gesture suggestions explain their draft impact:

- The customizer now derives an impact label for the suggested target slot.
- Empty target slots show `Empty slot`.
- Occupied target slots show `Swap <command>`, matching the draft swap behavior.
- The impact label sits beside the existing `Draft` badge, so users can see what the preview click will do without reading a tutorial.
- Captured browser proof:
  - `logs/radial-suggestion-impact-pass56.png`
  - `logs/radial-suggestion-impact-compact-pass56.png`

Speed and smoothness notes:

- The impact label is derived from the already-memoized draft slot map.
- No new storage writes, global listeners, timers, or telemetry events were added.
- The suggestion still stays draft-only and uses the existing `handleMoveDraft` path.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving pure render values and updating state from event handlers.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 18 tests passed.
- Focused radial AI E2E: 2 passed in 1.3 minutes.
- Compact radial E2E: 2 passed in 54.8 seconds.
- Full radial command-layer E2E: 4 passed in 2.4 minutes.
- Focused radial unit pack: 5 files and 81 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider letting users pin or reject repeated coach suggestions so the wheel can learn taste, not just error patterns.

## Landed Pass 57 - 2026-06-05

Scoped gesture coaching to the active radial context:

- The customizer now builds gesture stats only from telemetry whose `view` and `target` match the wheel being customized.
- Telemetry from other views still remains available to the Timing inspector.
- The coach no longer lets PCB, schematic, node, or other-context misses steer Architecture canvas suggestions.
- The stats memo now depends on primitive context fields, keeping recomputes tighter when equivalent context objects are recreated.
- The browser proof injects louder wrong-context misses before the real Architecture canvas misses, and the coach still recommends the correct SW move.
- Captured browser proof:
  - `logs/radial-context-scoped-suggestion-pass57.png`
  - `logs/radial-context-scoped-suggestion-compact-pass57.png`

Speed and smoothness notes:

- This reduces the amount of telemetry the coach reasons over without changing the recorder or inspector.
- The radial telemetry buffer remains capped at 120 events by `client/src/lib/radial-menu-telemetry.ts`.
- No new listeners, timers, storage writes, or render-time side effects were added.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving pure render values and updating state from event handlers.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 19 tests passed.
- Focused radial AI E2E after screenshot rename: 2 passed in 1.1 minutes.
- Compact radial E2E after screenshot rename: 2 passed in 51.2 seconds.
- Full radial command-layer E2E: 4 passed in 2.0 minutes.
- Expanded radial unit pack: 6 files and 86 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider a lightweight suggestion dismiss or pin affordance so coaching can respect user intent when a repeated miss is deliberate.

## Landed Pass 58 - 2026-06-05

Made coach suggestions dismissible:

- Suggestion rows now split into a main draft-preview button plus a compact dismiss icon.
- Dismissing hides only the current suggestion key: source, command, slot, and miss count.
- The suggestion can return when new evidence arrives, such as a higher miss count or a different command/slot.
- Dismiss is local UI state only: no storage writes, telemetry spam, or global listeners.
- Unit coverage proves dismissing does not move the command, does not call `onMove`, and leaves the layout saved.
- Captured browser proof:
  - `logs/radial-dismissible-suggestion-pass58.png`
  - `logs/radial-dismissible-suggestion-compact-pass58.png`

Also hardened E2E auth setup:

- The Playwright setup now validates and reuses `e2e/.auth-state.json` before registering a new random user.
- This prevents repeated local radial proof runs from burning the stricter auth limiter and failing with `429` before radial tests start.
- If stored auth is stale, setup falls back to the existing fresh user/project creation path.

Speed and smoothness notes:

- The dismiss key is a cheap derived string from the existing suggestion object.
- No radial open path changed.
- No new recorder events, persistent preferences, timers, or cross-window state were added.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for derived render values and event-handler state updates.
- Context7: Playwright `/microsoft/playwright` guidance for setup projects, API request auth, and saved `storageState`.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Customizer unit tests: 1 file and 20 tests passed.
- Focused radial AI E2E: 2 passed in 58.7 seconds.
- Compact radial E2E: 2 passed in 43.0 seconds.
- Full radial command-layer E2E initially exposed auth setup `429`; fixed setup reuse, reran, and 4 tests passed in 3.1 minutes.
- Expanded radial unit pack: 6 files and 87 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider adding a persisted "never suggest this swap again" preference only if session-level dismiss proves too temporary.

## Landed Pass 59 - 2026-06-05

Added persistent coach suggestion suppression:

- Suggestion rows now have two distinct exits: `X` hides the suggestion for the current customizer session, and the ban icon persists "never suggest this move again" for the current wheel layout.
- Suppression keys are scoped by command and target slot, then stored under the active layout key so Architecture canvas preferences do not bleed into node, PCB, schematic, or other radial contexts.
- The per-layout suppression list is capped at 32 entries to keep local preferences small and fast.
- Resetting a radial layout also clears suppressions for that layout, which keeps "reset" honest.
- Unit coverage proves persistent suppression hides the suggestion after rerender while keeping the draft layout unchanged.
- Captured browser proof:
  - `logs/radial-persistent-suggestion-controls-pass59.png`
  - `logs/radial-persistent-suggestion-controls-compact-pass59.png`

Also fixed a warning found by the radial E2E console trap:

- The AI Chat follow-up suggestion generator now dedupes chips before rendering them.
- This removes the duplicate React child key warning for repeated labels such as `Run Validation`.
- Added a ChatPanel regression test so duplicate generated suggestions render as one chip.

Also tightened radial E2E undo targeting:

- Full radial E2E exposed a Playwright strict-mode failure because `getByRole('button', { name: 'Undo' })` matched timeline `Undo action` buttons plus the toast `Undo` button.
- The test now targets the exact accessible name `Undo` and asserts visibility before clicking the toast action.
- Product labels stayed unchanged; the test selector was the loose part.

Speed and smoothness notes:

- The suppression check is a memoized set lookup during customizer render.
- No radial open-path dispatch, global listeners, or gesture telemetry writes were added.
- Storage writes happen only when the user explicitly chooses the persistent ban control.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for derived render values and event-handler state updates.
- Context7: Playwright `/microsoft/playwright.dev` guidance that action locators are strict and should uniquely identify the intended element.

Verification added or rerun:

- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused radial AI E2E: 2 passed in 1.1 minutes.
- Focused compact radial E2E: 2 passed in 42.1 seconds.
- Full radial command-layer E2E initially exposed the loose Undo selector; fixed it and reran 4 tests passing in 2.6 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 114 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Consider making the suggestion controls explain themselves through existing tooltips so the row stays compact while still teaching the difference between session dismiss and persistent ban.

## Landed Pass 60 - 2026-06-05

Added compact explanation tooltips for coach suggestion exits:

- The session `X` control now explains that it hides the current suggestion only for now.
- The persistent ban control now explains that it stops that exact command-to-slot suggestion for the current wheel layout.
- Both controls keep explicit `aria-label` and `title` text so keyboard users, Playwright, and native browser hints all see the same intent.
- The Radix tooltip content uses a high portal z-index so it renders above the right panel/customizer stack instead of slipping underneath it.
- Captured browser proof:
  - `logs/radial-suggestion-never-tooltip-pass60.png`

Also removed stale Replit dev wiring:

- Removed the old Replit Vite plugins from `vite.config.ts`.
- Removed `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal`, and the orphaned `modern-screenshot` dependency from the package lock.
- Removed the live `@replit` Twitter-site meta tag and `.replit.dev` local-dev host check from `client/index.html`.
- Removed remaining `@replit` breadcrumbs from shared button/badge comments.
- Active app/source checks now have no Replit package, env, or dev-host references in `client`, `server`, `vite.config.ts`, `playwright.config.ts`, `package.json`, or `package-lock.json`.

Also hardened isolated E2E server startup:

- Playwright can now run a fresh server on an alternate `PORT` instead of reusing Tyler's open dev server on `5000`.
- The Playwright server command passes `RATE_LIMIT_MAX=5000`, which avoids false local `429` failures from earlier manual proof runs.
- The Playwright server command passes a unique `VITE_HMR_PORT`, and `server/vite.ts` gives Playwright-only Vite middleware a dedicated websocket port.
- This avoids the fixed middleware websocket collision on `24678` while leaving the normal dev server alone.
- Auth setup now navigates with Playwright `waitUntil: "commit"` because it only needs the origin to seed `localStorage`, not a full React boot.
- Radial E2E now waits up to 90 seconds for the heavy lazy Architecture canvas. Direct measurement on a cold isolated server showed the canvas became visible after about 54.5 seconds with no console or network errors.

Speed and smoothness notes:

- The tooltips are only mounted around two existing small buttons; no radial open path changed.
- Suggestion suppression and gesture telemetry logic stayed unchanged.
- The isolated E2E server fix avoids killing or disturbing Tyler's normal dev server.
- Cold-load waits were expanded only for the Architecture canvas readiness point, not for radial menu open/interaction timing.

Docs checked:

- Context7: Radix Primitives `/radix-ui/primitives` guidance for `TooltipProvider`, `TooltipTrigger asChild`, and accessible tooltip content.
- Context7: Playwright `/microsoft/playwright.dev` guidance for strict locators and `page.goto({ waitUntil: "commit" })`.
- Context7: Vite `/vitejs/vite` guidance for dev websocket/HMR configuration.
- Context7: npm CLI `/npm/cli` guidance for `npm uninstall` package and lockfile updates.
- Local Vite 7.3.2 source confirmed middleware websocket fallback to port `24678` when no dedicated HMR server/port is specified.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture command" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR npx playwright test e2e/radial-command-layer.spec.ts --grep "compact viewports" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npm ls @replit/vite-plugin-cartographer @replit/vite-plugin-dev-banner @replit/vite-plugin-runtime-error-modal modern-screenshot`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 21 tests passed.
- Focused radial AI E2E: 2 passed in 1.6 minutes after the tooltip z-index fix.
- Focused compact radial E2E: 2 passed in 58.4 seconds.
- Full isolated radial command-layer E2E: 4 passed in 3.7 minutes on `PORT=5010` and `VITE_HMR_PORT=25110`.
- Expanded radial plus ChatPanel unit pack: 8 files and 114 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- `npm ls` confirmed the removed Replit packages and orphan dependency are no longer installed in the project tree.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc update.

Next:

- Use the freed-up compact control pattern for any future coach hints: short icon controls in-row, explanation in tooltip, and no extra bulk in the customizer.

## Landed Pass 61 - 2026-06-05

Added radial open-path performance guardrails:

- `RadialMenu` unit coverage now proves every open records a `visible-mounted` telemetry event with view, target, action count, and a sub-32ms mounted duration in the component hot path.
- The real browser E2E now waits for the latest `visible-mounted` telemetry after right-click open and asserts mounted latency stays below a 120ms ceiling.
- The existing browser `contextmenu -> DOM node exists` latency check still asserts the menu appears within 500ms.
- This separates cold Vite route transforms from radial menu responsiveness. The heavy Architecture route may take about 55 seconds on a fresh dev server, but once the workspace is ready the radial menu itself must stay fast.

Also rechecked the E2E auth setup after one stale-state recovery:

- One focused run exposed an old saved auth artifact that caused `/api/auth/me` to log a 500 before setup created a fresh user/project.
- The setup overwrote `e2e/.auth-state.json` with a fresh valid session.
- A direct `/api/auth/me` check against the refreshed session returned `200`.
- A second focused browser run reused the refreshed session cleanly with no auth 500 output.

Speed and smoothness notes:

- No new runtime work was added to the radial open path.
- The new checks observe existing telemetry instead of adding timers, polling, or layout work to production interactions.
- The budget is intentionally strict on the mounted wheel, while leaving cold-route loading outside the radial responsiveness score.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for `useMemo`/`useCallback` and limiting memoization to expensive calculations or referential-stability needs.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "opens quickly" --reporter=line --retries=0`
- Direct refreshed-session check: `GET /api/auth/me` with `X-Session-Id` from `e2e/.auth-state.json`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`

Results:

- Focused radial menu unit tests: 1 file and 49 tests passed.
- First focused browser run: 2 passed in 3.3 minutes and refreshed a bad saved auth artifact.
- Direct refreshed-session auth check: `200 OK`.
- Second focused browser run: 2 passed in 2.7 minutes with no auth 500 output.
- Expanded radial plus ChatPanel unit pack: 8 files and 115 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.4 minutes.

Next:

- If performance ever regresses, wire the same mounted-latency signal into a small local trend chart so Tyler can see whether the wheel is getting slower across sessions.

## Landed Pass 62 - 2026-06-05

Added slot accelerator and gesture memory cues:

- Every radial wedge now shows its slot number and gesture direction together, for example `1 / N` or `3 / E`.
- Every command item now exposes `aria-keyshortcuts` with its current slot number.
- Every command item now carries a compact SVG title hint such as `Add Node: press 1 or flick N`.
- The center well shows the active command's number/direction pair, for example `7/W`, when a command is hovered or keyboard-focused.
- Customizing a command slot updates the visible shortcut chip and accessible shortcut immediately.
- Captured browser proof:
  - `logs/radial-accelerator-memory-cues-pass62.png`

Research basis:

- Bill Buxton / Kurtenbach marking-menu research stresses a smooth novice-to-expert transition: users can open the visible menu while learning, then graduate into directional marks for frequent commands.
- Autodesk Maya docs emphasize that experienced users can select marking-menu items with quick gestures, sometimes so fast the whole menu does not need to display.
- Blender pie-menu docs emphasize press/move/release expert use, number-key selection, directional highlighting, and fallback click selection.
- The implementation uses that pattern directly: visible menu labels teach both the number key and the gesture direction without adding a tutorial panel or extra opening delay.

Speed and smoothness notes:

- The shortcut string is derived from the already-known slot number.
- No storage, listeners, timers, layout polling, or telemetry writes were added.
- The existing precomputed slot layout still owns the wheel geometry.
- The visual chip lives inside the existing label row, so hover does not resize the menu.

Docs and research checked:

- Web: Bill Buxton, `User Learning and Performance with Marking Menus`, https://www.billbuxton.com/MMUserLearn.html
- Web: Autodesk Maya Marking Menus, https://help.autodesk.com/cloudhelp/2024/ENU/Maya-KeyboardShortcuts/files/GUID-8BA1A3AA-4C44-4779-8B22-0AAE3627E8EB.htm
- Web: Blender Manual, Pie Menus, https://docs.blender.org/manual/en/latest/interface/controls/buttons/menus.html#pie-menus
- Context7: React `/reactjs/react.dev` guidance for derived display values and `useMemo` caveats.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "opens quickly" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused radial menu unit tests: 1 file and 50 tests passed.
- Focused browser scenario: 2 passed in 1.7 minutes and produced `radial-accelerator-memory-cues-pass62.png`.
- TypeScript caught that SVG `<g>` does not accept a React `title` prop; fixed by using an SVG `<title>` child and reran focused unit, focused browser, TypeScript, and full radial E2E proof.
- Expanded radial plus ChatPanel unit pack: 8 files and 116 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.1 minutes on the latest tree.

Next:

- Consider a transient "learned gesture streak" surface that rewards repeated successful marks without interrupting the command flow.

## Landed Pass 63 - 2026-06-05

Added a compact gesture mastery insight:

- `RadialTelemetryInspector` now derives a `Gesture streak` strip from existing radial telemetry.
- Three latest consecutive successful marks for the same command, slot, view, and target show as a locked streak, for example `3x Add Node`, `N gesture trained`, `Locked`.
- A latest gesture cancel, destructive confirmation handoff, different command, different slot, different view, or different target resets the streak back to waiting/building.
- Non-gesture noise such as `customize-open`, visible opens, AI drafts, and AI sends does not break the latest gesture streak.
- Captured browser proof:
  - `logs/radial-gesture-mastery-pass63.png`

Speed and smoothness notes:

- No radial open-path work was added.
- No new telemetry events, storage reads, listeners, timers, polling, layout measurement, or command execution work were added.
- The mastery strip is derived inside the existing inspector render flow and memoized from the already-read telemetry buffer.
- The UI is a fixed compact row between the timing note and AI counters, so it does not resize the wheel, block the canvas, or add friction to gesture execution.
- Browser screenshot review confirmed the strip remains readable and compact: `3x Add Node`, `N gesture trained`, and `Locked` fit without covering controls.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving pure display data during render and avoiding effects for derived UI.
- Context7: Playwright `/microsoft/playwright` locator assertions and locator screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused telemetry inspector unit tests: 1 file and 9 tests passed.
- Focused browser AI telemetry/mastery scenario: 2 passed in 1.8 minutes on the final stable run.
- Expanded radial plus ChatPanel unit pack: 8 files and 119 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.1 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Debugging note:

- One focused and one full browser run exposed that Playwright clicks against the SVG group/coordinate helper could hover the correct wedge but fail to deliver a reliable click selection in this AI telemetry scenario.
- The first radial browser test still covers mouse command selection end to end.
- This AI telemetry scenario now uses the wheel's supported accelerator path instead: `1` for Add Node, `4` for AI draft, and hover plus `Shift+Enter` for send-now. That keeps this test focused on AI delivery, telemetry, mastery proof, and keyboard accelerator behavior instead of duplicating the mouse-hit test.

Next:

- Add an optional per-command mastery filter in the customizer so Tyler can see which gestures are trained, building, or cold across the whole wheel layout.

## Landed Pass 64 - 2026-06-05

Made gesture mastery actionable in the customizer:

- Added a command mastery model in `RadialMenuCustomizer`.
- Each command row now gets a compact mastery badge:
  - `Trained` commands show the current streak count, such as `4x`.
  - `Building` commands show a smaller current streak count.
  - `Cold` commands show `Cold`.
- Added a four-way segmented filter under command search: `All`, `Trained`, `Building`, and `Cold`.
- Filter counts update from the current draft layout and current scoped gesture telemetry.
- The mastery status is tied to the command's current slot. If a command is moved, old marks on the old slot do not falsely count as trained on the new layout.
- Captured browser proof:
  - `logs/radial-mastery-filter-pass64.png`
  - `logs/radial-mastery-trained-row-pass64.png`

Speed and smoothness notes:

- The filter is derived from the existing telemetry buffer already subscribed by the customizer.
- No new storage, telemetry events, timers, polling, command dispatch, or radial open-path work were added.
- The segmented control is compact and lives inside the existing command filter rail, so the customizer stays scrollable and does not add another floating panel.
- The row badge uses a small trophy icon plus short text, avoiding long instructional copy inside the command list.
- Browser screenshot review confirmed the filter row stays tight and the trained Add Node row fits cleanly without clipped text.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving pure display data during render and avoiding effects for derived UI.
- Context7: Playwright `/microsoft/playwright` locator assertions and locator screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 22 tests passed.
- Focused browser AI/mastery/filter scenario: 2 passed in 1.9 minutes on the final screenshot run.
- Expanded radial plus ChatPanel unit pack: 8 files and 120 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.2 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Debugging note:

- The browser send-now path briefly exposed an intermittent `Shift+Enter` test issue.
- The fix now focuses the radial menu, verifies `aria-activedescendant="radial-menuitem-ai_explain_architecture"`, then sends explicit Shift down, Enter, and Shift up events with cleanup.
- That keeps the proof on the real keyboard command path while removing ambiguity from Playwright's combined key chord helper.

Next:

- Add a tiny mastery summary to the collapsed customizer header so Tyler can see trained/building/cold counts even when the panel is collapsed.

## Landed Pass 65 - 2026-06-05

Made collapsed customizer state informative:

- The collapsed radial customizer header now shows trained/building/cold mastery counts.
- The summary sits under the existing draft status, so a collapsed panel still tells Tyler whether the wheel has learned gestures.
- The counts reuse the existing per-command mastery model from Pass 64.
- Captured browser proof:
  - `logs/radial-collapsed-mastery-pass65.png`

Speed and smoothness notes:

- No new telemetry events, storage, timers, polling, command dispatch, or radial open-path work were added.
- The collapsed summary is pure derived UI from already-computed mastery counts.
- The pills are short and wrapped, so narrow floating/collapsed layouts keep the text reachable instead of clipping.
- Browser screenshot review confirmed the collapsed header shows `Layout saved`, `1 trained`, `0 building`, and `6 cold` without overlapping the control buttons.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for calculating derived display data during render and avoiding effects for pure summaries.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 22 tests passed.
- Focused browser AI/mastery/collapsed-summary scenario: 2 passed in 2.3 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 120 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.1 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a lightweight command "practice lane" that lets Tyler rehearse cold gestures from the customizer without running real commands.

## Landed Pass 66 - 2026-06-05

Added a safe gesture practice lane:

- `RadialMenuCustomizer` now includes a compact `Practice` lane inside the Compass coach.
- The lane targets the selected command's current gesture direction.
- Dragging inside the practice pad scores a local result:
  - `Hit N` when the flick matches the selected command's slot.
  - `Miss E` or another direction when it does not match.
  - `Too short` when the movement does not cross the practice threshold.
- The lane tracks local hits, attempts, and streak for the selected command.
- Reset clears only the selected command's local practice record.
- Keyboard practice works on the focused pad with number keys `1` through `8`.
- Captured browser proof:
  - `logs/radial-practice-lane-pass66.png`

Safety guarantee:

- Practice does not call `onMove`.
- Practice does not dispatch radial commands.
- Practice does not write telemetry.
- Practice does not change node count or run the selected command.
- Practice does not affect the real mastery telemetry counts; it is rehearsal, not fake production usage.

Speed and smoothness notes:

- No radial open-path work was added.
- No new storage, timers, polling, command listeners, or telemetry events were added.
- The practice vector is local UI state inside the customizer only.
- The pad is fixed-size and uses stable absolute labels, so practicing does not resize the coach or shift nearby controls.
- Browser screenshot review confirmed the lane stays compact and readable: `Practice`, target `N`, `Hit N`, `1/1 hits / streak 1`, and safety badges fit without clipping.

Docs checked:

- Context7: React `/reactjs/react.dev` pointer handlers and derived render data guidance.
- Context7: Playwright `/microsoft/playwright` low-level mouse drag actions, bounding boxes, polling assertions, and locator screenshots.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "opens quickly" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 23 tests passed.
- Focused browser AI/mastery/practice scenario: 2 passed in 2.3 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 121 tests passed.
- Focused main radial E2E rerun after a transient console-resource failure: 2 passed in 2.0 minutes.
- Full isolated radial command-layer E2E final rerun: 4 passed in 3.1 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Debugging note:

- The first full browser run after this pass failed the main radial test because the console collector saw `Failed to load resource: net::ERR_CONNECTION_CLOSED`.
- The captured context did not include a URL.
- The focused main scenario was rerun and passed cleanly.
- The full radial command-layer suite was rerun and passed cleanly.
- Because the error did not reproduce in the focused main rerun or final full rerun, no console filter or code change was added for it.

Next:

- Add a "practice cold" quick action that selects the first cold command and focuses the practice pad in one click.

## Landed Pass 67 - 2026-06-05

Made cold gesture practice one click:

- Added a compact `Cold` quick action inside the practice lane.
- The button selects the first command whose current slot has no trained streak.
- It clears command search, switches the command list to the `Cold` mastery filter, and focuses the practice pad.
- Keyboard practice can start immediately after the click.
- The quick action exposes the selected cold command id for tests through `data-command-id`.
- Captured browser proof:
  - `logs/radial-practice-cold-pass67.png`

Safety guarantee:

- The quick action does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count or project data.
- Practicing from the focused pad still stays local to the customizer practice record.

Speed and smoothness notes:

- The cold target is derived from the existing mastery map.
- No new storage, timers, polling, command listeners, telemetry events, or radial open-path work were added.
- Focus is moved with a DOM ref after the user action, so there is no extra render effect loop.
- The button is fixed-height and short, so it does not resize the coach or push controls around.
- Browser screenshot review confirmed the lane stays readable with `Practice`, `NE`, `Cold`, `Hit NE`, the reset icon, score/streak, and safety badges visible.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for focusing DOM nodes with refs from user actions and keeping derived display data in render.
- Context7: Playwright `/microsoft/playwright` role/locator focus, keyboard input, and locator screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 24 tests passed.
- Focused browser AI/mastery/cold-practice scenario: 2 passed in 2.8 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 122 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.5 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add an optional "practice queue" mode that advances to the next cold command after a hit while still staying local-only and never firing real radial commands.

## Landed Pass 68 - 2026-06-05

Added a local-only cold practice queue:

- Added a compact `Queue` toggle beside the existing `Cold` practice shortcut.
- Queue mode starts at the first unpracticed cold command and focuses the safe practice pad.
- A correct gesture hit advances to the next unpracticed cold command.
- Misses and too-short gestures keep the same target and show a retry cue.
- Queue progress is visible as local drill progress, such as `Queue 2/6 - Next SE`.
- The real mastery badges remain honest: they still come only from real radial telemetry, not practice.
- Captured browser proof:
  - `logs/radial-practice-queue-pass68.png`

Safety guarantee:

- Queue mode does not call `onMove`.
- Queue mode does not dispatch radial commands.
- Queue mode does not write telemetry.
- Queue mode does not mutate node count or project data.
- Queue progress is session-local rehearsal state only.

Speed and smoothness notes:

- The queue is derived from the existing cold mastery list plus local practice hit records.
- No new storage, timers, polling, command listeners, telemetry events, or radial open-path work were added.
- Auto-advance happens inside the practice event handler after a hit.
- The practice pad keeps focus so keyboard drilling can continue without extra clicks.
- Browser screenshot review confirmed the lane stays compact and readable with `Practice`, `SE`, `Queue`, `Cold`, `Aim SE`, `Queue 2/6 - Next SE`, score/streak, and safety badges visible.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving lists during render, updating state in event handlers, and focusing DOM nodes with refs from user actions.
- Context7: Playwright `/microsoft/playwright` guidance for locator clicks, focus assertions, keyboard presses, attribute assertions, and locator screenshots.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 25 tests passed.
- Focused browser AI/mastery/practice-queue scenario: 2 passed in 3.3 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 123 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.5 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a tiny queue completion state that offers one-click replay of missed/weak practice items without touching telemetry.

## Landed Pass 69 - 2026-06-05

Added weak-item replay for practice queue misses:

- Added a compact `Replay` control beside `Queue` and `Cold`.
- Local weak practice items are derived from session-only practice results that ended in a miss, short flick, or no-hit weak streak.
- Clicking `Replay` selects the first weak command, primes the practice pad back to its target direction, and keeps focus on the pad.
- A correct replay hit clears the weak item from the replay list.
- Replay status is visible in the same queue line, such as `Queue 3/6 - Replay clear`.
- Refined the practice lane header so `Practice`, `Queue`, `Replay`, `Cold`, status, and reset all fit without clipping.
- Captured browser proof:
  - `logs/radial-practice-replay-pass69.png`

Safety guarantee:

- Replay does not call `onMove`.
- Replay does not dispatch radial commands.
- Replay does not write telemetry.
- Replay does not mutate node count or project data.
- Real mastery badges remain telemetry-only; replay clears only local practice weakness.

Speed and smoothness notes:

- Weak replay items are pure derived UI from the existing local practice record.
- No new storage, timers, polling, command listeners, telemetry events, or radial open-path work were added.
- Replay uses the same safe practice pad and keyboard path already proven by Passes 66-68.
- Browser screenshot review caught and fixed a clipped `Practice` label by moving `Queue`, `Replay`, and `Cold` into a stable three-column action row.
- Final screenshot review confirmed the lane stays compact and readable: `Practice`, `SE`, `Queue`, `Replay`, `Cold`, `Hit SE`, `Queue 3/6 - Replay clear`, score/streak, and safety badges all fit.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving filtered/replay lists during render, updating state in event handlers, and using refs from user-driven handlers.
- Context7: Playwright `/microsoft/playwright` guidance for locator clicks, keyboard presses, focus assertions, attribute assertions, and locator screenshots.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser AI/mastery/replay scenario: 2 passed in 2.4 minutes on the final visual-fix run.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.4 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add an optional replay summary chip to the collapsed customizer so weak practice state is visible without expanding the panel.

## Landed Pass 70 - 2026-06-05

Made weak replay state visible while collapsed:

- Added a collapsed-header `Replay` summary chip when local weak practice items exist.
- The chip shows the weak replay count, such as `1 replay`.
- The chip is read-only and does not start replay, move slots, dispatch commands, or touch telemetry.
- It appears beside the existing trained/building/cold collapsed mastery chips.
- Captured browser proof:
  - `logs/radial-collapsed-replay-pass70.png`

Safety guarantee:

- The collapsed chip is pure derived UI from session-local practice state.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, or practice records.

Speed and smoothness notes:

- The chip reuses the existing local weak-practice list derived during render.
- No new storage, timers, polling, command listeners, telemetry events, or radial open-path work were added.
- The chip only renders when weak practice items exist, so the collapsed header stays quiet during normal use.
- Browser screenshot review confirmed `Layout saved`, `1 trained`, `0 building`, `6 cold`, and `1 replay` fit cleanly with the header controls visible.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving display summaries during render and avoiding effects for pure derived UI.
- Context7: Playwright `/microsoft/playwright` locator screenshot and attribute/text assertion guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser AI/mastery/collapsed-replay scenario: 2 passed in 2.1 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.5 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact "practice heat" row in the customizer that ranks commands by local attempts so Tyler can spot overworked or neglected gestures at a glance.

## Landed Pass 71 - 2026-06-05

Added a local practice heat row:

- Added a compact `Heat` strip inside the practice lane.
- The strip ranks cold commands by session-local practice attempts.
- Each heat chip shows command label, attempt count, and local state: `weak`, `hit`, `tried`, or `idle`.
- The summary now calls out both coverage and neglect, such as `3 tried / 3 idle`.
- Clicking a heat chip jumps the safe practice pad to that gesture and primes aiming.
- Captured browser proof:
  - `logs/radial-practice-heat-pass71.png`

Safety guarantee:

- Heat is derived from the existing session-local practice records.
- Clicking a heat chip does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It only updates local practice selection, local queue mode, and the safe pad focus.

Speed and smoothness notes:

- Heat ranking is a tiny render-time sort over the already-filtered cold command list.
- No new storage, timers, polling, global listeners, telemetry subscriptions, or radial open-path work were added.
- The row uses horizontal overflow inside the existing scrollable customizer body, so it does not clip the pad or bottom controls.
- Browser screenshot review confirmed `Practice`, `Queue`, `Replay`, `Cold`, `Heat`, `3 tried / 3 idle`, the ranked chips, pad, queue status, and safety badges fit cleanly.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for calculating derived data during rendering and avoiding effects for pure derived UI.
- Context7: Playwright `/microsoft/playwright` locator text/attribute assertions and locator screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser AI/mastery/practice-heat scenario: 2 passed in 2.6 minutes on the final run.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.3 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a safe practice session recap that appears after the queue completes, summarizing hits, weak gestures, and the next replay target without writing telemetry.

## Landed Pass 72 - 2026-06-05

Added a safe practice session recap:

- Added a `Session recap` panel that appears when the local cold-practice queue is fully covered.
- The recap summarizes local hit quality, such as `6/7 hits`.
- It summarizes remaining weak gestures, such as `0 weak`.
- It shows the next replay target, or `Replay clear` when there is nothing weak left.
- The recap includes a compact `Replay` action that is disabled when replay is clear and uses the existing safe replay path when a weak target exists.
- Captured browser proof:
  - `logs/radial-practice-recap-pass72.png`

Safety guarantee:

- Recap data is pure derived UI from session-local practice records.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- The only actionable path in the recap reuses the already-safe weak-practice replay handler.

Speed and smoothness notes:

- The recap is derived during render from the existing heat list and queue progress.
- No new storage, timers, polling, listeners, telemetry subscriptions, or radial open-path work were added.
- The recap only appears after local practice coverage is complete, so it does not add noise during normal editing.
- Browser screenshot review confirmed the recap, heat row, practice pad, queue status, and safety badges remain reachable inside the scrollable customizer.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving summary data during rendering and avoiding effects or duplicate state for pure derived UI.
- Context7: Playwright `/microsoft/playwright` visibility, text, data attribute, focus, and screenshot assertion guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "radial AI architecture" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser AI/mastery/practice-recap scenario: 2 passed in 2.2 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 4 passed in 3.8 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact practice streak milestone badge that celebrates clean local queue coverage while staying session-only and non-telemetry.

## Landed Pass 73 - 2026-06-05

Added a clean-practice milestone badge:

- Added a compact `Clean run` badge inside the `Session recap` header.
- The badge appears only when the local practice queue is complete, local hits equal local attempts, and no weak practice items remain.
- The badge stays hidden after a miss/replay run such as `6/7 hits`, even when replay is clear.
- Captured browser proof:
  - `logs/radial-practice-clean-milestone-pass73.png`

Safety guarantee:

- The milestone is pure derived UI from the existing session-local recap values.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- The new browser proof measures telemetry after the real radial/customizer open events, then confirms safe practice adds no telemetry.

Speed and smoothness notes:

- The badge is a tiny boolean derived during render.
- No new state, storage, timers, polling, listeners, subscriptions, or radial open-path work were added.
- The badge sits in the recap header and wraps if needed, so it does not crowd the recap metrics or practice pad.
- Browser screenshot review confirmed `Clean run`, recap metrics, heat chips, queue status, pad, and safety badges remain readable and reachable.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving small UI summaries/badges during render and avoiding duplicate state/effects.
- Context7: Playwright `/microsoft/playwright` locator text, visibility, data attribute, and screenshot assertion guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone scenario: 2 passed in 1.5 minutes on the final run.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed after giving the intentionally heavy named-preset shelf test a scoped 10 second timeout; the test itself completed in 4.8 seconds on the final expanded run.
- Full isolated radial command-layer E2E: 5 passed in 5.2 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact practice milestone chip to the collapsed customizer header so a clean session remains visible after collapsing.

## Landed Pass 74 - 2026-06-05

Added a collapsed clean-practice milestone chip:

- Added a compact `Clean run` chip to the collapsed customizer header.
- The chip appears only when the existing session-local recap is clean: queue complete, hits equal attempts, and no weak practice items remain.
- The chip exposes `data-clean="true"` and `data-attempts` for stable unit and browser assertions.
- A miss/replay path still does not show the clean chip after replay clears.
- Captured browser proof:
  - `logs/radial-collapsed-clean-milestone-pass74.png`

Safety guarantee:

- The collapsed chip is pure derived UI from the already-existing `practiceCleanRun`, attempts, and hit label.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It adds no new storage, listeners, timers, effects, or subscriptions.

Speed and smoothness notes:

- The chip is rendered from existing state during the same collapsed-header render.
- No new computation is added to the radial open path.
- The chip lives in the existing wrapping collapsed mastery row, so it stays reachable on compact screens.
- Browser screenshot review confirmed the collapsed row shows mastery chips plus `Clean run` without clipping.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for calculating derived UI during rendering and avoiding duplicate state/effects.
- Context7: Playwright `/microsoft/playwright` locator text, attribute, test id, and screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone scenario: 2 passed in 1.9 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 4.5 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add one stable collapsed practice-state cluster that prioritizes clean, replay, and idle states in a predictable order without increasing header height.

## Landed Pass 75 - 2026-06-05

Added a stable collapsed practice-state cluster:

- Replaced the separate collapsed clean/replay presence logic with one `radial-customizer-collapsed-practice` cluster.
- The cluster always renders exactly one practice chip in the existing collapsed mastery row.
- The state priority is explicit and stable: `clean replay idle`.
- `Clean run` wins when the local queue was perfect.
- `Replay` wins when any weak local practice item exists.
- `Idle` fills the slot otherwise, such as `Practice 0/2` before safe practice starts.
- Captured browser proof:
  - `logs/radial-collapsed-practice-idle-pass75.png`
  - `logs/radial-collapsed-practice-clean-pass75.png`

Safety guarantee:

- The cluster is pure derived UI from existing local practice records, queue progress, and recap values.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It adds no new state, storage, listeners, timers, effects, or subscriptions.

Speed and smoothness notes:

- The cluster uses a tiny render-time state selection from values already computed for the customizer.
- It renders one chip only, so the collapsed header does not gain another row or extra control group.
- Existing state-specific test ids remain available under the stable cluster for clean, replay, and idle proofs.
- Browser screenshot review confirmed idle and clean states keep the same collapsed header height and do not clip text.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for calculating derived UI during rendering and avoiding duplicate state/effects.
- Context7: Playwright `/microsoft/playwright` `getByTestId`, locator text/attribute assertions, and locator screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone scenario: 2 passed in 1.6 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 4.7 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add collapsed-state keyboard/a11y polish so the practice cluster exposes a short accessible status without making the header visually louder.

## Landed Pass 76 - 2026-06-05

Added non-visual accessibility status for the collapsed practice cluster:

- Added a hidden `role="status"` node inside `radial-customizer-collapsed-practice`.
- The status uses `aria-live="polite"` and `aria-atomic="true"`.
- The visible collapsed practice chip now points to that hidden status with `aria-describedby`.
- The status sentence is state-specific:
  - `Practice status: 0/2 local practice coverage.`
  - `Practice status: clean local run, 2/2 hits.`
  - `Practice status: 1 replay ready for replay, 2/6 coverage.`
- Captured browser proof:
  - `logs/radial-collapsed-practice-a11y-pass76.png`

Safety guarantee:

- The accessibility sentence is pure derived UI from the existing collapsed practice state.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It adds no new state, storage, listeners, timers, effects, or subscriptions.

Speed and smoothness notes:

- No visible chip, row, icon, or control was added.
- The screenshot remained visually identical to the Pass 75 clean collapsed header.
- The hidden status is a tiny text node and does not affect radial open-path work.
- A transient `/api/auth/me` server error appeared during one focused E2E startup; the focused E2E was rerun cleanly before using browser evidence.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for `aria-*` DOM props and deriving values during render.
- Context7: Playwright `/microsoft/playwright` `toHaveAccessibleDescription`, test ids, and locator screenshot guidance.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone/a11y scenario: 2 passed in 2.2 minutes on the final clean run.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 4.2 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact collapsed tooltip/help affordance for practice state that explains clean/replay/idle on hover/focus without changing the collapsed header layout.

## Landed Pass 77 - 2026-06-05

Added compact collapsed practice-state help:

- Wrapped the existing collapsed practice chip in the shared `StyledTooltip`.
- The chip remains the only visible practice element in the collapsed header.
- The chip is now keyboard-focusable, so keyboard users can reveal the same help.
- The help text is state-specific:
  - `Clean practice run. Every local target was hit, so replay is clear.`
  - `1 replay queued for replay. Expand practice to retry weak gestures safely.`
  - `0/2 practice coverage. Expand practice to drill the remaining cold gestures.`
- Captured browser proof:
  - `logs/radial-collapsed-practice-help-pass77.png`

Safety guarantee:

- Tooltip help is pure derived UI from the existing collapsed practice state.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It adds no new state, storage, listeners, timers, effects, or subscriptions.

Speed and smoothness notes:

- No new visible row, icon, button, or chip was added.
- The tooltip is rendered only through the existing Radix/shadcn tooltip primitive.
- E2E caught that a top-side tooltip could intercept the collapse button; the tooltip now opens below the chip and uses pointer-free content.
- The screenshot confirms the tooltip explains the clean state without changing collapsed header layout.
- The expanded unit pack also exposed one load-sensitive customizer test timeout; only that deterministic filter/preview test now has a scoped 10 second timeout.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for derived render values and avoiding duplicate state/effects.
- Context7: Playwright `/microsoft/playwright` locator focus, hover, text, visibility, and screenshot guidance.
- Context7: Radix `/radix-ui/primitives` tooltip `Trigger asChild`, focus behavior, and accessible tooltip behavior.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone/help scenario: 2 passed in 2.0 minutes on the final screenshot run.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 5.2 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a collapsed practice mini-progress ring/pulse on the chip itself, CSS-only, so progress feels alive without adding layout or runtime work.

## Landed Pass 78 - 2026-06-05

Added the collapsed practice mini-progress cue:

- The collapsed practice chip now exposes `data-progress-percent` and `data-cue` on both the wrapper and visible chip.
- The visible chip owns a CSS-only bottom progress line through `--collapsed-practice-progress`.
- Clean runs show a full cyan cue with a reduced-motion-safe pulse.
- Replay states show an amber cue using current practice coverage, so `2/6` renders as `33%` while the label still says `1 replay`.
- Idle practice states show a muted coverage cue, including `0%`, `50%`, and complete coverage.
- Captured browser proof:
  - `logs/radial-collapsed-practice-cue-pass78.png`

Safety guarantee:

- The cue is pure derived UI from existing local practice state.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It adds no new state, storage, listeners, timers, effects, subscriptions, DOM rows, or buttons.

Speed and smoothness notes:

- The cue uses one inline CSS variable and a pseudo-element.
- No JavaScript animation loop was added.
- No layout-measuring code was added.
- Motion-sensitive users keep the static progress line because the pulse is scoped to `motion-safe`.
- The collapsed header keeps the same compact footprint.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for deriving strings/classes during render instead of duplicating state.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` guidance for `before:` pseudo-elements, arbitrary animation values, and `motion-reduce`/`motion-safe`.
- Context7: Playwright `/microsoft/playwright` locator text, visibility, attribute, and screenshot assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone/cue scenario: 2 passed in 2.6 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 4.6 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a collapsed practice quick-open affordance that lets Enter/Space on the practice chip expand the customizer and focus the safe practice pad, without firing commands or changing saved layout state.

## Landed Pass 79 - 2026-06-05

Added safe quick-open behavior to the collapsed practice chip:

- The collapsed practice chip now behaves like a compact control with `role="button"`.
- Enter and Space expand the customizer and focus the safe local practice pad.
- Clicking the chip does the same thing for pointer users.
- The chip exposes `data-quick-open="practice-pad"` and `aria-keyshortcuts="Enter Space"` for tests and future agents.
- The existing tooltip and live status still describe the practice state.
- Idle, clean, and replay states all use the same quick-open behavior.

Safety guarantee:

- Quick-open only expands the local customizer UI and moves focus to the practice pad.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It does not start a practice queue automatically.

Implementation note:

- Expanding the customizer normally focuses search.
- Quick-open needs to focus practice instead, so the implementation uses a one-shot ref to skip the normal search autofocus only for this path.
- Focus still goes to search for normal expand, Ctrl/Cmd+F, `/`, Escape search clearing, and Alt-slot draft moves.

Speed and smoothness notes:

- No new visible control was added.
- No permanent listener, subscription, storage write, or animation loop was added.
- The only async work is a single `requestAnimationFrame` already used by existing focus helpers.
- The collapsed header footprint does not change.

Docs checked:

- Context7: React `/reactjs/react.dev` guidance for refs, event handlers, and derived render values.
- Context7: Playwright `/microsoft/playwright` locator keyboard, focus, attribute, and visibility assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone/quick-open scenario: 2 passed in 2.2 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 4.4 minutes.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Let the replay collapsed chip quick-open directly into replay-ready practice mode, still local-only, so Space on `1 replay` expands, focuses the pad, and primes the weak gesture without firing commands or writing telemetry.

## Landed Pass 80 - 2026-06-05

Made replay quick-open actually replay-ready:

- The collapsed replay chip now expands the customizer, focuses the practice pad, switches the practice queue to replay mode, selects the first weak gesture, and primes the pad with `Aim <direction>`.
- Idle and clean chips still quick-open as plain focus-only practice affordances.
- The chip exposes `data-quick-open-mode="replay"` for replay and `data-quick-open-mode="focus"` for idle/clean.
- Replay uses the existing safe replay-practice path instead of a new command path.
- The replay chip ARIA label now reads like an action: `Open replay practice: 1 replay`.

Safety guarantee:

- Replay quick-open only changes local customizer practice state.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, or mastery telemetry.
- It primes practice mode, but it does not count a hit, miss, attempt, or replay completion until the user performs a practice gesture.

Implementation note:

- Reused the existing replay selection behavior: `setPracticeQueueActive(true)`, `setPracticeQueueMode('replay')`, and `selectColdPracticeItem(firstWeakPracticeItem, 'Replay <dir>', true)`.
- Kept the one-shot practice-focus ref from Pass 79 so normal expand still focuses search while replay quick-open lands on the safe pad.

Speed and smoothness notes:

- No new visible control was added.
- No permanent listener, subscription, storage write, or animation loop was added.
- No extra layout measurement was added.
- The collapsed header footprint remains unchanged.

Docs checked:

- Context7: React `/reactjs/react.dev` refs, event handlers, effects, and DOM focus management.
- Context7: Playwright `/microsoft/playwright` locator focus, keyboard, attribute, visibility, and web-first assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Full isolated radial command-layer E2E: first attempt failed in auth setup before radial tests due transient `/api/auth/register` and `/api/auth/me` 500s; clean rerun passed 5 tests in 5.3 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact collapsed practice keyboard hint in the tooltip copy for action chips, so users discover Enter/Space without adding visible clutter to the header.

## Landed Pass 81 - 2026-06-05

Added compact keyboard discovery to collapsed practice tooltips:

- The collapsed practice tooltip now keeps the state-specific help text as the first line.
- A second compact line teaches the shortcut:
  - `Enter/Space opens practice.`
  - `Enter/Space opens replay practice.`
- The collapsed header itself remains unchanged.
- The chip and wrapper expose `data-action-hint` so tests and future agents can inspect the current shortcut copy.
- Browser tests now use `toContainText` for the tooltip body and direct text assertions for the hint line.

Safety guarantee:

- This is presentation-only copy.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, mastery telemetry, or local practice records.
- It adds no new state, storage, listeners, effects, subscriptions, DOM rows, visible header controls, or animation loops.

Speed and smoothness notes:

- No collapsed-header layout footprint changed.
- The extra tooltip line appears only when the existing tooltip opens on hover/focus.
- The hint is derived during render from the existing collapsed practice state.

Docs checked:

- Context7: React `/reactjs/react.dev` deriving display values during render, refs for focus, and keyboard event handlers.
- Context7: Playwright `/microsoft/playwright` `toContainText`, `toHaveText`, focus assertions, keyboard press, and web-first assertions.
- Context7: Radix `/radix-ui/primitives` tooltip `asChild`, focus/hover open behavior, and accessible tooltip content.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --grep "clean milestone" --reporter=line --retries=0`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Focused browser clean milestone/tooltip-hint scenario: 2 passed in 2.0 minutes.
- Full isolated radial command-layer E2E: 5 passed in 5.0 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a tiny collapsed replay success flash after a replay practice hit clears the weak queue, using derived local practice state and CSS-only styling so the user gets reward feedback without layout churn.

## Landed Pass 82 - 2026-06-05

Added the collapsed replay-clear success flash:

- When replay practice clears the last weak gesture, the collapsed practice chip now exposes `data-replay-cleared="true"` and `data-flash="replay-clear"`.
- The chip still uses the compact `Practice <progress>` label, so the header layout does not change.
- The progress cue shifts to emerald, and a tiny CSS-only overlay pulse rewards the replay clear.
- The hidden status changes to `Practice status: replay cleared, <progress> local practice coverage.`
- The tooltip help changes to `Replay cleared. Weak gestures are back under control.`
- Captured browser proof:
  - `logs/radial-collapsed-replay-clear-pass82.png`

Safety guarantee:

- The flash is derived from existing local practice state:
  - replay mode active
  - queue message is `Replay clear`
  - weak queue is empty
  - at least one local practice hit exists
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, mastery telemetry, or local practice records.
- It adds no new state, storage, listeners, effects, subscriptions, timers, DOM rows, visible header controls, or JavaScript animation loop.

Speed and smoothness notes:

- Uses existing collapsed chip markup.
- Uses `after:` pseudo-element styling and `motion-safe` animation only.
- Reduced-motion users keep the emerald static success styling without the pulse.
- The screenshot confirms the collapsed header stays compact.

Docs checked:

- Context7: React `/reactjs/react.dev` deriving UI values during render instead of adding state/effects.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` pseudo-elements, dynamic data variants, arbitrary animation utilities, and `motion-safe`/`motion-reduce`.
- Context7: Playwright `/microsoft/playwright` data attribute assertions, focus assertions, screenshot proof, and web-first assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PORT=5010 VITE_HMR_PORT=25110 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 RATE_LIMIT_MAX=5000 npx playwright test e2e/radial-command-layer.spec.ts --reporter=line --retries=0`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Full isolated radial command-layer E2E: 5 passed in 5.4 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a collapsed practice streak crumb for repeated successful local hits, derived from local practice records, so the chip can quietly celebrate consistency without adding a new row.

## Landed Pass 83 - 2026-06-05

Added the collapsed practice streak crumb:

- When any local practice record reaches a streak of 2 or more, the collapsed practice chip now shows a tiny inline streak crumb like `2x`.
- The crumb lives inside the existing collapsed practice chip, so no new header row or separate control was added.
- The streak is derived with `Object.values(practiceByCommand)` instead of the cold-practice heat list, so already-trained commands can still count when the user keeps practicing them.
- The collapsed wrapper and chip now expose:
  - `data-streak`
  - `data-streak-active`
  - `data-streak-label`
- The hidden status appends `Best local streak: <Nx>.` whenever the crumb is visible.
- Captured browser proof:
  - `logs/radial-collapsed-practice-streak-pass83.png`

Safety guarantee:

- The crumb is derived from existing local practice records.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, mastery telemetry, or local practice records.
- It adds no new state, storage, listeners, effects, subscriptions, timers, DOM rows, visible header controls, or JavaScript animation loop.

Speed and smoothness notes:

- The visible change is one tiny inline badge inside the existing chip.
- The chip uses `inline-flex`, a truncated label span, and a shrink-safe crumb so compact collapsed layouts do not jump.
- Replay and replay-clear states carry the same streak data and accessible status.
- Playwright now disables remote Google Fonts through `VITE_DISABLE_REMOTE_FONTS=1` for its web server, which removes a flaky external network dependency from console-clean browser proof while preserving normal app font loading.

Docs checked:

- Context7: React `/reactjs/react.dev` deriving display values during render instead of adding state/effects.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` compact inline styling, pseudo-elements, and reduced-motion-safe utilities.
- Context7: Playwright `/microsoft/playwright` web-first text, attribute, accessibility, and screenshot assertions.
- Context7: Vite `/vitejs/vite` `server.hmr` and HTML `%VITE_*%` env replacement for the Playwright font gate.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Full isolated radial command-layer E2E: first clean-port run exposed a flaky external Google Fonts console error, then the Playwright font gate was added and the rerun passed 5 tests in 3.4 minutes with no flaky result.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact collapsed practice source hint, probably in the existing tooltip, so the user can tell which command produced the current best streak without adding visible header clutter.

## Landed Pass 84 - 2026-06-05

Added the collapsed streak source hint:

- The collapsed practice tooltip now explains which command produced the current best local streak.
- Example browser-proved copy:
  - `Best streak: Add Node N at 2x.`
- The collapsed header still only shows the compact `Practice <progress>` chip plus the tiny streak crumb.
- No new visible row, control, panel, or header footprint was added.
- The best source is derived from current wheel commands and local practice records:
  - highest `record.streak`
  - tie-breaks toward more local hits
  - ignores commands outside the current wheel
- The collapsed wrapper, chip, and crumb now expose:
  - `data-streak-source-command-id`
  - `data-streak-source-label`
  - `data-streak-source-direction`
- Captured browser proof:
  - `logs/radial-collapsed-practice-streak-source-pass84.png`

Safety guarantee:

- The source hint is derived during render from existing local practice records and `draftItems`.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, mastery telemetry, or local practice records.
- It adds no new state, storage, listeners, effects, subscriptions, timers, visible header controls, or JavaScript animation loop.

Speed and smoothness notes:

- The source detail appears only in the existing hover/focus tooltip.
- The collapsed chip dimensions and layout stay unchanged.
- The data attributes make the state inspectable without DOM measurement or extra runtime work.
- The real-browser screenshot confirms the tooltip source line is readable without crowding the collapsed header.

Docs checked:

- Context7: React `/reactjs/react.dev` deriving display values during render instead of adding state/effects.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` compact text utilities and `data-*` state attributes.
- Context7: Playwright `/microsoft/playwright` web-first text, attribute, accessible-description, focus, and screenshot assertions.
- Context7: Radix `/radix-ui/primitives` tooltip `asChild`, hover/focus activation, and accessible tooltip content.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 26 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.7 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 124 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact collapsed practice reset affordance or tooltip action hint that lets users clear local practice state deliberately without adding another header button.

## Landed Pass 85 - 2026-06-06

Added a deliberate collapsed local-practice reset:

- When local practice state exists, the collapsed practice chip now exposes a keyboard-only reset shortcut:
  - `Shift+Backspace`
- The reset hint appears only inside the existing collapsed practice tooltip:
  - `Shift+Backspace clears local practice.`
- No new header button, visible row, panel, or permanent control was added.
- The collapsed wrapper and chip now expose:
  - `data-reset-available`
  - `data-reset-hint`
- The chip's `aria-keyshortcuts` expands from `Enter Space` to `Enter Space Shift+Backspace` only while there is local practice state to clear.
- Pressing `Shift+Backspace` clears the current wheel's local practice records and resets queue/replay UI state back to normal cold practice.
- Captured browser proof:
  - `logs/radial-collapsed-practice-reset-pass85.png`

Safety guarantee:

- The reset is local-session practice cleanup only.
- It does not call `onMove`.
- It does not dispatch radial commands.
- It does not write telemetry.
- It does not mutate node count, project data, saved layouts, named presets, mastery telemetry, or real radial command history.
- It clears `practiceByCommand`, cancels any in-progress practice vector, turns practice queue off, and returns queue mode/message to the cold-practice default.
- It adds no storage, subscriptions, effects, timers, visible header controls, or JavaScript animation loop.

Speed and smoothness notes:

- The reset affordance is discoverable on hover/focus through the existing tooltip.
- The collapsed chip footprint is unchanged.
- The shortcut is deliberately hard to hit accidentally.
- When no local practice exists, the reset hint disappears and `aria-keyshortcuts` returns to `Enter Space`.

Docs checked:

- Context7: React `/reactjs/react.dev` keyboard event properties, event-handler state updates, and deriving display values during render.
- Context7: Playwright `/microsoft/playwright` modifier-key `press` behavior and web-first text/attribute assertions.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` compact text utilities and `data-*` UI state attributes.
- Context7: Radix `/radix-ui/primitives` tooltip `asChild`, focus/hover activation, and accessible tooltip content.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 27 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.7 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 125 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a compact collapsed practice undo hint for the reset, or move on to a higher-value radial command customization pass like per-context preset pinning.

## Landed Pass 86 - 2026-06-06

Added per-context named preset pinning:

- Saved wheel presets can now be pinned to the current radial context from the existing Presets shelf.
- A pinned preset becomes the active layout for that context immediately, so users can switch an Architecture Canvas wheel to a saved command arrangement without manually applying every slot move.
- The pin state is stored in the existing radial preferences object:
  - `pinnedPresets`
- The pinned row lives inside the existing collapsible Presets panel, so it adds no permanent header clutter.
- Each saved preset row exposes a compact pin/unpin icon button with:
  - `aria-pressed`
  - `Pin <preset> to this context`
  - `Unpin <preset> from this context`
- The preset panel exposes the current pin state through:
  - `data-pinned`
  - `data-preset-id`
- Captured browser proof:
  - `logs/radial-pinned-preset-pass86.png`

Behavior details:

- `applyRadialPreferences` resolves a valid pinned preset before falling back to saved layout slots.
- Deleting a pinned preset clears that context pin.
- Resetting a layout clears that layout's slots, suppressed suggestions, and pinned preset.
- Manual slot moves break the pin for that context and copy the current pinned slots into normal layout preferences first, so a user can safely customize from a pinned preset without losing the rest of that arrangement.
- Updating a named preset with the same name keeps the same preset id, so a pinned context follows the updated preset.

Safety guarantee:

- Pinning does not dispatch radial commands.
- Pinning does not call `onMove`.
- Pinning does not create graph nodes, mutate project data, change telemetry, or alter local practice state.
- Manual Apply still uses the same `onMove` path as normal slot customization.
- The preference sanitizer only keeps pinned preset ids that still exist on that layout's preset shelf.
- The store now preserves existing `presetShelves`, `suppressedSuggestions`, and `pinnedPresets` across save, delete, suppress, move, pin, unpin, and reset operations.

Speed and smoothness notes:

- Pinned layout resolution is a small object lookup against the already loaded radial preferences snapshot.
- The UI adds one compact icon button per saved preset row and one tiny status row inside the already collapsible preset panel.
- No new subscriptions, timers, global listeners, animation loops, or storage keys were added.
- The failed first E2E run exposed that preference-driven `items` updates reset the preset status back to `Preset ready`; the customizer now resets that status only when the layout key changes, while manual Apply explicitly reports that it unpinned the context.

Docs checked:

- Context7: React `/reactjs/react.dev` `useSyncExternalStore`, immutable external store snapshots, event-handler updates, and render-time derived values.
- Context7: Playwright `/microsoft/playwright` locator-first interactions and web-first text/attribute/visibility assertions.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` `data-*` variants and compact utility-state styling.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused preference plus customizer tests: 2 files and 44 tests passed.
- Full isolated radial command-layer E2E: first run exposed the status reset issue, then the rerun passed 5 tests in 3.4 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 129 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

Next:

- Add a lightweight pinned-preset indicator to the collapsed customizer summary, or move to radial-context preset recommendations that suggest which saved wheel to pin based on view and target.

## Landed Pass 87 - 2026-06-06

Added context preset intelligence and collapsed pinned-state visibility:

- When a context has saved presets but no pinned preset, the Presets panel now shows a compact recommendation row.
- The recommendation uses the newest saved preset for the current context and offers a one-click pin action.
- Example browser-proved copy:
  - `Suggested: Fast build for Architecture / Canvas.`
- When a preset is pinned, the recommendation disappears so the panel does not nag.
- The collapsed customizer summary now shows a compact pinned-preset chip when a preset is active.
- The collapsed chip is keyboard reachable:
  - `Enter`
  - `Space`
- Activating the collapsed chip expands the customizer and opens the Presets panel, so the user can inspect or unpin without hunting.
- Captured browser proof:
  - `logs/radial-collapsed-pinned-preset-pass87.png`

State and accessibility details:

- The recommendation row exposes:
  - `data-testid="radial-customizer-preset-recommendation"`
  - `data-preset-id`
- The collapsed pinned chip exposes:
  - `data-testid="radial-customizer-collapsed-pinned-preset"`
  - `data-pinned="true"`
  - `data-preset-id`
  - `role="button"`
  - `aria-label="Open pinned preset: <name>"`
  - `aria-keyshortcuts="Enter Space"`
- The collapsed chip has tooltip help that explains the pinned context and the keyboard action.

Safety guarantee:

- The recommendation is derived during render from the existing saved preset shelf and current pinned state.
- The collapsed pinned chip is derived during render from the existing pinned preset.
- Activating the recommendation only pins a saved preset through the existing radial preferences store.
- Activating the collapsed chip only opens the already existing customizer body and Presets panel.
- It does not dispatch radial commands.
- It does not call `onMove`.
- It does not mutate project data, telemetry, practice state, saved layouts, or named presets.
- It adds no storage keys, subscriptions, global listeners, timers, or animation loops.

Speed and smoothness notes:

- The recommendation is a single compact row inside the already collapsible Presets panel.
- The collapsed chip is a tiny inline item beside existing mastery/practice chips, with max-width and truncation to avoid header growth.
- All new labels are derived from the already loaded radial preference snapshot and context summaries.
- The browser screenshot proves the collapsed indicator stays readable without reopening the whole panel.

Docs checked:

- Context7: React `/reactjs/react.dev` render-time derived values and event-handler state updates.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` `data-*` variants, compact chip utilities, and state styling.
- Context7: Playwright `/microsoft/playwright` locator-first interactions and web-first text/attribute/visibility assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `npm run test -- client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 28 tests passed.
- Focused preference plus customizer tests: 2 files and 44 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.2 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 129 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.
- `git diff --check`: clean before this doc append.

## Landed Pass 88 - 2026-06-06

Command-history backed "recently useful here" slice:

- The customizer now derives a compact `Recent here` rail from the existing radial telemetry buffer.
- It filters to the current radial context:
  - same view
  - same target
  - command still exists in the current draft wheel
- It counts recent command-use events from:
  - `visible-select`
  - `visible-repeat-ai`
  - `ai-draft`
  - `ai-send-now`
  - `mark-select`
- It dedupes by command and sorts by newest use first, then usage count.
- It shows the top three commands only, keeping the customizer fast and visually quiet.
- Each chip shows:
  - command icon
  - command label
  - current compass direction
  - usage count
- Selecting a recent chip clears search and mastery filters, then highlights that command in the preview/list.

State and accessibility details:

- The recent rail exposes:
  - `data-testid="radial-customizer-recent-commands"`
- Each recent command chip exposes:
  - `data-testid="radial-customizer-recent-command-<commandId>"`
  - `data-command-id`
  - `data-count`
  - `data-slot`
  - `data-direction`
- Each chip has an accessible label that names the command and usage count.
- The rail omits itself when no context-local recent commands exist.

Safety guarantee:

- The feature is derived during render from existing telemetry, draft items, and context.
- It adds no storage keys.
- It adds no new listeners, timers, animation loops, network calls, or global state.
- Clicking a chip does not dispatch a radial command.
- Clicking a chip does not call `onMove`.
- Clicking a chip does not mutate project data or telemetry.
- It only updates local customizer selection/search/filter state.

Speed and smoothness notes:

- The telemetry buffer is already capped at 120 events.
- The helper does one linear pass through that small buffer and one small sort over deduped commands.
- The rail is capped at three chips, so it cannot turn into a scroll trap.
- The UI uses fixed compact rows with truncation, so hover and long labels do not resize the panel.

Docs checked:

- Context7: React `/reactjs/react.dev` render-time derived values and event-handler state updates.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` responsive utilities and `data-*` variants.
- Context7: Playwright `/microsoft/playwright` data-testid locators, visibility, attribute, and click assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/components/ui/RadialMenuCustomizer.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx e2e/radial-command-layer.spec.ts 'docs/ideas+shit/radial-command-layer-research.md'`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 29 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.6 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 130 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean.
- Prettier check: clean on touched files.
- Direct TypeScript check passed with an 8GB Node cap.
- Captured browser proof:
  - `logs/radial-recent-commands-pass88.png`

## Landed Pass 89 - 2026-06-06

Added a staged smart-wheel layout suggestion:

- The customizer now derives a compact `Smart wheel` suggestion when current context signals can improve the draft layout.
- It can combine:
  - an unpinned recommended saved preset as the base layout
  - recent command usage as a signal to return displaced commands to their semantic compass home
  - repeated command-specific gesture misses as a stronger signal to stage the command at the slot Tyler actually tried
- The suggestion is deliberately staged:
  - clicking `Tune wheel` only changes the local draft
  - the existing `Apply` button is still required to commit real slot changes
  - `Revert` still backs out the staged layout before commit
- A command that has already been staged into a repeated missed slot is not immediately suggested back to its semantic home, preventing oscillation.
- Captured browser proof:
  - `logs/radial-smart-wheel-pass89.png`

State and accessibility details:

- The smart layout container exposes:
  - `data-testid="radial-customizer-smart-layout"`
- The count chip exposes:
  - `data-testid="radial-customizer-smart-layout-count"`
- The action exposes:
  - `data-testid="radial-customizer-smart-layout-suggestion"`
  - `data-change-count`
  - `data-recent-count`
  - `data-semantic-move-count`
  - `data-friction-misses`
  - `data-preset-id`
  - `data-preset-name`
  - `data-primary-command-id`
- The action has an accessible label and title that describe the staged move count and signal mix.

Safety guarantee:

- The feature is derived during render from existing draft items, saved presets, recent commands, gesture stats, and the current visible gesture suggestion.
- It adds no storage keys.
- It adds no new listeners, timers, animation loops, network calls, or global state.
- Clicking `Tune wheel` does not dispatch a radial command.
- Clicking `Tune wheel` does not call `onMove`.
- Clicking `Tune wheel` does not mutate project data, telemetry, saved presets, pinned presets, or local practice state.
- It only stages local draft slot changes through the same draft path the customizer already uses.

Speed and smoothness notes:

- The helper works against the existing capped telemetry buffer and the already-small recent-command list.
- It only considers up to the current recent-command rail, then a single visible gesture suggestion.
- The row omits itself when it would not create an actual draft change.
- The row is compact, truncates its detail text, and stays inside the existing scrollable customizer body.

Research notes:

- Marking-menu research stresses stable direction learning and novice-to-expert transition. Source: https://www.billbuxton.com/MMExpert.html
- Marking-menu learning research says small, frequent command sets are where gesture practice becomes valuable. Source: https://www.billbuxton.com/MMUserLearn.html
- Adaptive-menu research warns against adaptation that changes available command locations without user control; ProtoPulse keeps adaptation previewable and reversible. Source: https://www.cs.ubc.ca/labs/imager/tr/2009/findlater_chi_ephemeral/

Docs checked:

- Context7: React `/reactjs/react.dev` render-time derived values, `useMemo`, and event-handler state updates.
- Context7: Tailwind `/tailwindlabs/tailwindcss.com` responsive utilities and `data-*` variants.
- Context7: Playwright `/microsoft/playwright` data-testid locators, visibility, text, attribute, click, accessibility, and screenshot assertions.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/components/ui/RadialMenuCustomizer.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx e2e/radial-command-layer.spec.ts`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 30 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.6 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 131 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean on touched code/test files before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.

## Landed Pass 90 - 2026-06-06

Added a smart-wheel explanation breakdown:

- The `Smart wheel` suggestion now shows compact per-move evidence rows before the user stages the draft.
- Each row explains:
  - the command being moved
  - original direction
  - proposed direction
  - reason category
  - evidence string
- Direct signal moves sort before incidental swap moves, so the highest-value explanation appears first.
- If staging a command forces another command out of the slot, the displaced command is labeled as a `Swap` reason with evidence like `Made room for Add Node`.
- The breakdown stays capped in-place:
  - first three moves render as rows
  - overflow renders as a compact `+N more staged moves` row
- Captured browser proof:
  - `logs/radial-smart-wheel-breakdown-pass90.png`

State and accessibility details:

- The move list exposes:
  - `data-testid="radial-customizer-smart-layout-moves"`
  - `data-count`
- Each rendered move row exposes:
  - `data-testid="radial-customizer-smart-layout-move-<commandId>"`
  - `data-command-id`
  - `data-from-slot`
  - `data-to-slot`
  - `data-from-direction`
  - `data-to-direction`
  - `data-reasons`
  - `data-evidence`
- The move row title repeats the command, direction change, and evidence for hover inspection.

Safety guarantee:

- The breakdown is derived from the already computed smart-wheel draft.
- It adds no storage keys.
- It adds no new listeners, timers, animation loops, network calls, or global state.
- Rendering the breakdown does not dispatch radial commands.
- Rendering the breakdown does not call `onMove`.
- Rendering the breakdown does not mutate project data, telemetry, saved presets, pinned presets, or practice state.
- Clicking `Tune wheel` still only stages the local draft; `Apply` remains the only commit path.

Speed and smoothness notes:

- Reason tracking uses small maps while the smart-wheel suggestion is already being built.
- The rendered breakdown is capped at three rows, so the smart section stays compact.
- Rows use fixed compact text, truncation, and existing scrollable customizer body behavior.
- No layout-shifting hover expansion was added.

Research and docs checked:

- Context7 was probed first for React, Tailwind, and Playwright, but returned `fetch failed`, so this pass fell back to primary docs and research sources.
- React official docs: rendering lists with keys and deriving values in render. Source: https://react.dev/learn/rendering-lists
- Tailwind official docs: data attribute variants and responsive utilities. Source: https://tailwindcss.com/docs/hover-focus-and-other-states
- Playwright official docs: locator assertions. Source: https://playwright.dev/docs/test-assertions
- Adaptive-menu research supports user-controlled adaptation instead of opaque reordering. Source: https://www.cs.ubc.ca/labs/imager/tr/2009/findlater_chi_ephemeral/

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/components/ui/RadialMenuCustomizer.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx e2e/radial-command-layer.spec.ts 'docs/ideas+shit/radial-command-layer-research.md'`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests: 1 file and 30 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.4 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 131 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.

## Landed Pass 91 - 2026-06-06

Added a smart-wheel `After preview` grid:

- The `Smart wheel` suggestion now shows all 8 proposed radial slots before the user clicks `Tune wheel`.
- Changed slots are highlighted with a compact `New` chip.
- Empty slots remain visible as `Empty`, so the user can understand the full proposed wheel shape instead of only the moved commands.
- The preview uses fixed 4-column compact cells and stays inside the existing scrollable customizer body.
- Captured browser proof:
  - `logs/radial-smart-wheel-preview-pass91.png`

State and accessibility details:

- The preview container exposes:
  - `data-testid="radial-customizer-smart-layout-preview"`
  - `data-slot-count`
  - `data-change-count`
- Each preview slot exposes:
  - `data-testid="radial-customizer-smart-layout-preview-slot-<slot>"`
  - `data-slot`
  - `data-direction`
  - `data-command-id`
  - `data-changed`
  - `data-reasons`
- The preview grid uses `role="list"` with per-slot `role="listitem"`.
- Slot titles repeat the direction, proposed command, and reason for hover inspection.

Safety guarantee:

- The preview is derived from the already computed smart-wheel suggestion.
- It adds no storage keys.
- It adds no new listeners, timers, animation loops, network calls, or global state.
- Rendering the preview does not dispatch radial commands.
- Rendering the preview does not call `onMove`.
- Rendering the preview does not mutate project data, telemetry, saved presets, pinned presets, or practice state.
- Clicking `Tune wheel` still only stages the local draft; `Apply` remains the only commit path.

Speed and smoothness notes:

- Preview derivation uses one small command-id map and the fixed 8-slot radial order.
- The rendered preview is a tiny bounded grid: 8 cells, no lazy measuring, no hover expansion, no animation loop.
- The slot labels use truncation and fixed compact cell sizing to avoid layout jumps.
- The preview reuses the existing smart-wheel memo path, so it only updates when the suggestion changes.

Research and docs checked:

- Context7 was healthy this pass.
- React docs checked through Context7: list rendering with stable keys and `map`.
- Tailwind docs checked through Context7: data attribute variants and responsive grid utilities.
- Playwright docs checked through Context7: `getByTestId`, visibility, attribute assertions, and locator screenshots.

Verification added or rerun:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused customizer unit tests after formatting: 1 file and 30 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.3 minutes.
- Expanded radial plus ChatPanel unit pack: 8 files and 131 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.

## Landed Pass 92 - 2026-06-06

Added a radial coverage map:

- The command registry now exports `getRadialCoverageEntries()`.
- The customizer now shows a compact `Coverage map` panel for the radial command layer.
- The map exposes the current wheel first, then same-view targets, empty contexts, thin contexts, and the rest of the covered surfaces.
- Each context cell shows:
  - view
  - target
  - coverage level
  - radial command count
  - AI command count when present
  - empty slot directions
- The map makes command gaps visible before deeper AI automation work.
- Captured browser proof:
  - `logs/radial-coverage-map-pass92.png`

Registry details:

- Added `RadialCoverageLevel`:
  - `full`
  - `ready`
  - `thin`
  - `empty`
- Added `RadialCoverageEntry` with:
  - `key`
  - `context`
  - labels
  - radial command count
  - linear fallback count
  - AI command count
  - destructive command count
  - used and empty slot counts
  - empty slot directions
  - command IDs
- Added shared `isRadialAiCommand()` so the registry and customizer count AI commands the same way.

State and accessibility details:

- The coverage panel exposes:
  - `data-testid="radial-customizer-coverage-map"`
  - `data-context-count`
  - `data-ready-count`
  - `data-full-count`
  - `data-ai-context-count`
  - `data-current-key`
- The current summary exposes:
  - `data-testid="radial-customizer-coverage-current-summary"`
  - `data-command-count`
  - `data-empty-slot-count`
- Each coverage cell exposes:
  - `data-testid="radial-customizer-coverage-<view>-<target>"`
  - `data-view`
  - `data-target`
  - `data-current`
  - `data-command-count`
  - `data-linear-command-count`
  - `data-empty-slot-count`
  - `data-ai-count`
  - `data-destructive-count`
  - `data-coverage`
  - `data-empty-slots`
- The list uses `role="list"` and per-cell `role="listitem"`.

Safety guarantee:

- The coverage map is derived from static registry commands.
- It adds no storage keys.
- It adds no new listeners, timers, animation loops, network calls, or global state.
- Rendering the map does not dispatch radial commands.
- Rendering the map does not call `onMove`.
- Rendering the map does not mutate project data, telemetry, saved presets, pinned presets, or practice state.

Speed and smoothness notes:

- The registry currently audits 23 fixed view/target contexts.
- Each entry scans at most the capped 8-command radial wheel plus the linear fallback list.
- The rendered map is bounded with `max-h-36` and `overflow-y-auto`.
- Sorting is a tiny derived list: current context, same view, gaps, thin surfaces, then the rest.
- The UI uses fixed compact cells, truncation, and Tailwind data variants.

Research and docs checked:

- Context7 was healthy this pass.
- React docs checked through Context7: rendering derived lists with `map`, stable keys, and derived render data.
- Tailwind docs checked through Context7: data attribute variants and compact grid utilities.
- Playwright docs checked through Context7: `getByTestId`, visibility, attribute assertions, and locator screenshots.

Verification added or rerun:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/ui/RadialMenuCustomizer.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx e2e/radial-command-layer.spec.ts 'docs/ideas+shit/radial-command-layer-research.md'`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused registry plus customizer unit tests: 2 files and 62 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.9 minutes.
- Expanded radial plus ChatPanel unit pack: 9 files and 163 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.

Next:

- Use the new coverage map to expand thin or empty contexts, starting with BOM canvas and Starter Circuits canvas, then add more direct radial AI commands where the map shows no AI coverage.

## Landed Pass 93 - 2026-06-06

Expanded the first coverage-map gaps into real wheels:

- BOM canvas now has a full 8-slot radial wheel:
  - Add Item
  - AI Plan
  - Alternates
  - Templates
  - Quote
  - Alerts
  - Settings
  - Export
- Starter Circuits canvas now has a full 8-slot radial wheel:
  - AI Pick
  - Beginner
  - Open
  - Sensors
  - Motors
  - Reset
  - Displays
  - Copy Code
- The coverage map now reports both `bom/canvas` and `starter_circuits/canvas` as `full`, with 8 commands, 0 empty slots, and 1 AI command each.
- Captured browser proof:
  - `logs/radial-coverage-map-pass93.png`

BOM behavior landed:

- `add_bom_item` opens the management tab and add-item dialog.
- `ai_bom_plan` drafts or sends a whole-BOM procurement plan with project, cost, lifecycle, blocker, warning, representative part, and safety-gate context.
- `open_bom_alternates` opens alternates and seeds the first BOM item when present.
- `open_bom_templates` opens reusable BOM templates.
- `quote_bom` opens pricing and runs the existing quote flow.
- `open_supply_chain` opens supply-chain alerts.
- `open_bom_settings` opens the management tab and settings panel.
- `export_bom_csv` runs the existing guarded CSV export path.

Starter Circuits behavior landed:

- `ai_starter_learn` works from canvas by using the first visible starter circuit.
- `open_starter_circuit` works from canvas by opening the first visible starter in the Arduino workbench.
- `copy_starter_code` works from canvas by copying the first visible starter sketch.
- `starter_filter_beginner`, `starter_filter_sensors`, `starter_filter_motors`, and `starter_filter_displays` drive the existing filters.
- `starter_reset_filters` clears search, category, and difficulty filters.

Safety and speed notes:

- Both wheels reuse existing handlers, tabs, dialogs, export paths, toast paths, and AI dispatch plumbing.
- The registry remains static and bounded to 8 radial slots per context.
- Rendering the coverage map still does not dispatch commands, mutate preferences, add listeners, or touch project data.
- The customizer `Apply` path was not changed.
- The new commands avoid animation loops, timers, storage churn, or heavy per-frame work.

Research and docs checked:

- Context7 was healthy this pass.
- React docs checked through Context7 for derived list rendering and stable keys.
- Tailwind docs checked through Context7 for data attribute variants and compact UI utilities.
- Playwright docs checked through Context7 for `getByTestId`, attribute checks, visibility checks, and locator screenshots.

Verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`

Results:

- Focused registry, BOM, Starter, and customizer unit tests: 4 files and 124 tests passed.
- Full isolated radial command-layer E2E: 5 tests passed in 3.8 minutes.
- Expanded radial plus AI unit pack: 11 files and 225 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Page-skill coverage check passed.
- Direct TypeScript check passed with an 8GB Node cap.

Next:

- Use the coverage map to continue converting thin or empty contexts into useful full wheels, prioritizing surfaces that can reuse existing handlers and add direct AI help without adding runtime weight.

## Landed Pass 94 - 2026-06-06

Expanded Starter Circuits card commands from a thin wheel into a target-aware full wheel:

- Starter circuit cards now have a full 8-slot radial wheel:
  - AI Learn
  - Same Level
  - Open
  - Similar
  - Details
  - Reset
  - Copy Parts
  - Copy Code
- The coverage map now reports `starter_circuits/starter_circuit` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

Starter circuit card behavior landed:

- `starter_show_category` filters the gallery to circuits similar to the selected starter card.
- `starter_show_difficulty` filters the gallery to the selected starter card's difficulty level.
- `starter_toggle_details` expands or collapses the selected starter card.
- `copy_starter_parts` copies a clean component list for the selected starter card.
- Existing `ai_starter_learn`, `open_starter_circuit`, `starter_reset_filters`, and `copy_starter_code` commands remain target-aware.

Safety and speed notes:

- The wheel reuses existing Starter Circuits state, filters, expand/collapse behavior, clipboard handling, toast handling, and AI prompt dispatch.
- The registry remains static and bounded to 8 radial slots.
- No timers, animation loops, storage churn, workers, or extra background listeners were added.
- Clipboard work only runs when Tyler invokes the command.

Focused verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`

Results:

- Focused registry plus Starter Circuits unit tests: 2 files and 76 tests passed.
- Live coverage output confirmed `starter_circuits-starter_circuit full 8/8 empty=0 ai=1`.

Broad verification:

- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-starter-circuits/scripts/inspect-starter-circuits.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/StarterCircuitsPanel.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx 'docs/ideas+shit/radial-command-layer-research.md'`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`

Broad results:

- Expanded radial plus AI unit pack: 11 files and 226 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Starter Circuits inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc result append.
- Prettier check: clean before this doc result append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 3.5 minutes.

Next:

- Shift the next pass toward more visible radial-menu product value, starting with the weakest high-impact contexts and the customizer/preview experience rather than only filling command slots.

## Landed Pass 95 - 2026-06-06

Expanded the two weakest command wheels from 4-slot utility menus into full, useful, AI-aware wheels:

- Exports file targets now have a full 8-slot radial wheel:
  - Export
  - AI Plan
  - Reveal
  - Import
  - Precheck
  - History
  - Settings
  - Copy
- Firmware file targets now have a full 8-slot radial wheel:
  - Snippet
  - AI Review
  - Format
  - Review
  - Compile
  - Console
  - Settings
  - Export
- The coverage map now reports both `exports/file` and `firmware/file` as `full`, with 8 commands, 0 empty slots, and 1 AI command each.

Exports behavior landed:

- `ai_export_plan` drafts or sends an export readiness prompt with project, target format, release confidence, BOM, validation, architecture, profile, and representative issue context.
- `reveal_export_format` centers the selected export format without starting a download.
- `open_import_design` focuses the existing import chooser.
- `open_import_history` expands and focuses import history.
- Existing `create_export`, `run_export_precheck`, `export_settings`, and `copy_export_summary` behavior remains target-aware.

Firmware behavior landed:

- `ai_firmware_review` drafts or sends firmware readiness context from both Circuit Code and Arduino.
- Circuit Code uses the command to summarize DSL source trust, parse/evaluation state, component/net counts, visible errors, apply readiness, and source preview.
- Arduino uses the command to summarize active sketch, profile, health, active job, upload safety, schematic pin mapping, and source preview.
- `format_firmware` normalizes Circuit Code source and runs the existing Arduino formatter in Arduino.
- `open_firmware_review` opens Circuit Code's apply consequence preview when safe, and opens Arduino pin-review context in Arduino.
- `open_firmware_console` centers Circuit Code status/error output and opens Arduino console output.
- Existing `add_firmware_snippet`, `compile_firmware`, `firmware_settings`, and `export_firmware` behavior remains intact.

Safety and speed notes:

- The registry remains static and bounded to 8 radial slots.
- The new commands reuse existing panels, dialogs, filters, source state, formatter, clipboard/download helpers, toast paths, and AI prompt dispatch plumbing.
- No timers, animation loops, workers, storage churn, or new long-lived background listeners were added.
- AI prompts are command-triggered only and send compact snapshots of already-loaded state.

Verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-exports/scripts/inspect-exports.mjs`
- `node .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs`
- `node .agents/skills/pp-view-arduino/scripts/inspect-arduino.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/radial-ai-commands.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/panels/ExportPanel.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/CircuitCodeView.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/views/ArduinoWorkbenchView.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx 'docs/ideas+shit/radial-command-layer-research.md'`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`

Results:

- Focused registry, export, and firmware unit tests: 3 files and 61 tests passed.
- Live coverage output confirmed `exports-file full 8/8 empty=0 ai=1` and `firmware-file full 8/8 empty=0 ai=1`.
- Expanded radial plus AI unit pack: 13 files and 255 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Exports inspector: ok.
- Circuit Code inspector: ok.
- Arduino inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 4.1 minutes.

Next:

- Continue coverage cleanup on `inventory/part`, `validation/issue`, and `schematic/canvas`, then reassess whether the remaining ready contexts need one more direct command or a stronger customizer/preview affordance.

## Landed Pass 96 - 2026-06-06

Expanded the next no-AI ready contexts into full wheels:

- Inventory part targets now have a full 8-slot radial wheel:
  - Add Part
  - AI Plan
  - Alternates
  - Inspect
  - Audit
  - Remove
  - Edit
  - Labels
- Validation issue targets now have a full 8-slot radial wheel:
  - Task
  - AI Fix
  - Jump
  - AI Explain
  - Re-run
  - Suppress
  - Summary
  - Copy
- The coverage map now reports both `inventory/part` and `validation/issue` as `full`, with 8 commands and 0 empty slots.

Inventory behavior landed:

- `ai_inventory_plan` drafts or sends an inventory readiness prompt with clicked-part context, stock status, inventory health score, confidence-gate blockers and warnings, and health recommendations.
- `print_inventory_label` opens the existing QR label-printing dialog and centers the clicked part when a target exists.
- Existing `add_inventory_item`, `find_alternates`, `inspect_part`, `stock_audit`, `remove_inventory_item`, and `edit_inventory_item` remain target-aware.

Validation behavior landed:

- `ai_issue_fix` drafts or sends the same grounded validation issue context through a fix-path command.
- `explain_issue` now labels itself as AI Explain in the wheel, matching what it already did.
- `open_validation_summary` centers the validation safety-gate summary without requiring a target issue.
- Existing `create_task`, `jump_to_source`, `rerun_validation`, `suppress_issue`, and `copy_issue` remain target-aware.

Safety and speed notes:

- The registry remains static and bounded to 8 radial slots.
- Inventory commands reuse the existing inventory health analyzer, confidence gate, row filter/highlight, scanner dialog, label dialog, and AI dispatch plumbing.
- Validation commands reuse the existing virtual issue target map, validation AI prompt builder, summary section, suppression path, run-validation action, clipboard path, and output log.
- No timers, animation loops, workers, storage churn, or new long-lived background listeners were added.
- The new AI prompts are command-triggered only and use already-loaded state.

Verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialTelemetryInspector.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs`
- `node .agents/skills/pp-view-validation/scripts/inspect-validation.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/radial-ai-commands.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/StorageManagerPanel.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/validation/VirtualizedIssueList.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/ui/__tests__/RadialMenu.test.tsx 'docs/ideas+shit/radial-command-layer-research.md'`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`

Results:

- Focused registry, inventory, and validation unit tests: 3 files and 71 tests passed.
- Live coverage output confirmed `inventory-part full 8/8 empty=0 ai=1` and `validation-issue full 8/8 empty=0 ai=2`.
- Expanded radial plus AI unit pack: 15 files and 294 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Inventory inspector: ok.
- Validation inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 3.8 minutes.

Next:

- Finish the lone 6/8 context, `schematic/canvas`, then decide whether each 7/8 ready context deserves one more command or should intentionally stay open for gesture comfort.

## Landed Pass 97 - 2026-06-06

Expanded the last 6/8 context into a full wheel:

- Schematic canvas targets now have a full 8-slot radial wheel:
  - Add Part
  - Add Power
  - Wire
  - AI ERC
  - ERC
  - Fit
  - Select All
  - Paste
- The coverage map now reports `schematic/canvas` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

Schematic behavior landed:

- `add_power` moved from linear-only fallback into the radial wheel and reuses the existing VCC power-symbol placement path.
- `fit_view` moved from linear-only fallback into the radial wheel and reuses the existing React Flow fit-view adapter.
- The deeper schematic fallback menu still exposes `toggle_grid`, `replace_component`, and `add_decoupling` without duplicating the newly shared commands.

Safety and speed notes:

- No new schematic state model, canvas layer, worker, timer, storage path, or event surface was added.
- The radial registry remains static and bounded to 8 slots.
- The new radial commands reuse already-tested schematic command handlers.

Verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-schematic/scripts/inspect-schematic.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `lsof -i :5100`

Results:

- Focused registry and schematic adapter tests: 2 files and 47 tests passed.
- Live coverage output confirmed `schematic-canvas full 8/8 empty=0 ai=1`.
- Expanded radial plus AI unit pack: 19 files and 295 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Schematic inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 3.3 minutes.
- Port 5100 was clean after the E2E run.

Next:

- Review the remaining 7/8 ready contexts: `architecture/canvas`, `pcb/canvas`, `breadboard/canvas`, `bom/bom_row`, `simulation/probe`, and `model_3d/model`.

## Landed Pass 98 - 2026-06-06

Expanded the 3D model context into a full wheel:

- 3D model targets now have a full 8-slot radial wheel:
  - AI Fit
  - Isolate
  - Cross-probe
  - Measure
  - Fit Check
  - Clear
  - Properties
  - Capture
- The coverage map now reports `model_3d/model` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

3D behavior landed:

- `clear_3d_scene` fills the SW/remove slot and reuses the existing `handleClear3D()` path behind the toolbar trash button.
- The radial adapter marks the command handled, clears the 3D viewer singleton, and reports the action through the existing toast surface.
- The command is destructive, target-aware, and deliberately scoped to the current 3D scene instead of changing PCB, schematic, bridge, or stored project state.

Safety and speed notes:

- No new WebGL, Three.js, R3F, worker, storage, bridge, or camera infrastructure was added.
- The 3D clear command reuses an existing local viewer action.
- The radial registry remains static and bounded to 8 slots.
- The test harness silences the expected clear-scene console log so verification output stays clean.

Verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/BoardViewer3DView.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts e2e/p1-viewer-3d-bridge.spec.ts`
- `lsof -i :5100`

Results:

- Focused registry and 3D view tests: 2 files and 78 tests passed.
- Live coverage output confirmed `model_3d-model full 8/8 empty=0 ai=1`.
- Expanded radial plus AI plus 3D unit pack: 21 files and 347 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- 3D view inspector: ok, with 63 tracked test cases.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Combined radial command-layer plus 3D bridge E2E: 15 tests passed in 6.3 minutes.
- Port 5100 was clean after the E2E run.

Next:

- Review the remaining 7/8 ready contexts: `architecture/canvas`, `pcb/canvas`, `breadboard/canvas`, `bom/bom_row`, and `simulation/probe`.

## Landed Pass 99 - 2026-06-06

Expanded the simulation probe context into a full wheel:

- Simulation probe targets now have a full 8-slot radial wheel:
  - Probe
  - AI Explain
  - Run
  - Compare
  - Sweep
  - Remove
  - Settings
  - Export
- The coverage map now reports `simulation/probe` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

Simulation behavior landed:

- `remove_probe` fills the SW/remove slot and reuses the same probe-list state update path as the row trash button.
- A targeted radial remove deletes the selected probe and reports the action through the existing toast surface.
- A remove command with no available probe is still handled and shows a destructive "No probe to remove" toast instead of silently failing.

Safety and speed notes:

- No simulation engine, waveform, solver, storage, worker, or generated-output path was changed.
- The command only mutates the local probe list through `onProbesChange`.
- The radial registry remains static and bounded to 8 slots.

Verification:

- `node .agents/skills/pp-view-simulation/scripts/inspect-simulation.mjs`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-simulation/scripts/inspect-simulation.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/simulation/ProbeManager.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `lsof -i :5100`

Results:

- Focused registry and probe-manager tests: 2 files and 36 tests passed.
- Live coverage output confirmed `simulation-probe full 8/8 empty=0 ai=1`.
- Expanded radial plus AI plus 3D plus simulation unit pack: 21 files and 349 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Simulation inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 3.0 minutes.
- Port 5100 was clean after the E2E run.

Next:

- Review the remaining 7/8 ready contexts: `architecture/canvas`, `pcb/canvas`, `breadboard/canvas`, and `bom/bom_row`.

## Landed Pass 100 - 2026-06-07

Expanded the PCB canvas context into a full wheel:

- PCB canvas targets now have a full 8-slot radial wheel:
  - Add Via
  - AI DFM
  - Route
  - Measure
  - DRC
  - Keepout
  - Select All
  - Paste
- The coverage map now reports `pcb/canvas` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

PCB behavior landed:

- `add_keepout` moved from linear-only fallback into the radial wheel and reuses the existing PCB tool adapter.
- A radial keepout command switches the active PCB tool to Keepout, matching the toolbar behavior.
- The deeper PCB fallback menu still exposes copper pour, comment, fit, and copy without duplicating the newly shared keepout command.

Safety and speed notes:

- No PCB geometry, DRC, zone persistence, routing, solver, storage, or generated-output path was changed.
- The command only changes the active PCB tool.
- The radial registry remains static and bounded to 8 slots.

Verification:

- `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `lsof -i :5100`

Results:

- Focused registry and PCB adapter tests: 2 files and 41 tests passed.
- Live coverage output confirmed `pcb-canvas full 8/8 empty=0 ai=1`.
- Expanded radial plus AI plus 3D plus simulation unit pack: 21 files and 350 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- PCB inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 3.0 minutes.
- Port 5100 was clean after the E2E run.

Next:

- Review the remaining 7/8 ready contexts: `architecture/canvas`, `breadboard/canvas`, and `bom/bom_row`.

## Landed Pass 101 - 2026-06-07

Expanded the BOM row context into a full wheel:

- BOM row targets now have a full 8-slot radial wheel:
  - Stock Bin
  - AI Tradeoffs
  - Alternates
  - Datasheet
  - Risk
  - Remove
  - Quantity
  - Copy
- The coverage map now reports `bom/bom_row` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

BOM behavior landed:

- `ai_part_tradeoffs` moved into the NE/transform slot so row-level AI is fast and prominent.
- `copy_bom_row` fills the NW/reuse slot and copies a readable row summary: part number, manufacturer, description, quantity, unit price, total price, supplier, stock, and status.
- ProcurementView now handles the copy command through the existing clipboard helper, output log, and toast surfaces.

Safety and speed notes:

- No supplier API, quote, export, lifecycle, shortfall, storage, or generated-output path was changed.
- The copy command is read-only and only touches the clipboard plus user feedback surfaces.
- The radial registry remains static and bounded to 8 slots.

Verification:

- `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/ProcurementView.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/ProcurementView.tsx client/src/components/views/__tests__/ProcurementView.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `lsof -i :5100`

Results:

- Focused registry and procurement tests: 2 files and 52 tests passed.
- Live coverage output confirmed `bom-bom_row full 8/8 empty=0 ai=1`.
- Expanded radial plus AI plus 3D plus simulation plus procurement unit pack: 22 files and 370 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Procurement inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 2.9 minutes.
- Port 5100 was clean after the E2E run.

Next:

- Review the remaining 7/8 ready contexts: `architecture/canvas` and `breadboard/canvas`.

## Landed Pass 102 - 2026-06-07

Expanded the breadboard canvas context into a full wheel:

- Breadboard canvas targets now have a full 8-slot radial wheel:
  - Add Part
  - AI Wiring
  - Jumper
  - Rails
  - Audit
  - Delete
  - Select All
  - Starter
- The coverage map now reports `breadboard/canvas` as `full`, with 8 commands, 0 empty slots, and 1 AI command.

Breadboard behavior landed:

- The existing `delete` command now also works from an empty breadboard canvas target.
- Canvas-level `delete` switches into the existing delete tool instead of trying to delete a missing part or wire.
- Targeted node and wire deletion still use the same command id and still delete the selected breadboard part or jumper.
- The breadboard test icon mock now includes the registry icons used by the fuller command set.

Safety and speed notes:

- No breadboard geometry, connector model, wire persistence, coach logic, stash logic, board audit, or 3D bridge path was changed.
- The new canvas command only changes the active tool to the already-existing delete mode.
- The radial registry remains static and bounded to 8 slots.

Verification:

- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- Included again in the combined Pass 103 radial verification pack and browser E2E run below.

Results:

- Focused registry and breadboard tests: 2 files and 85 tests passed.
- Live coverage output confirmed `breadboard-canvas full 8/8 empty=0 ai=1`.
- The final all-context live coverage pass confirmed every tracked radial context is now full.

Next:

- Finish the remaining 7/8 ready context: `architecture/canvas`.

## Landed Pass 103 - 2026-06-07

Expanded the architecture canvas context into a full wheel:

- Architecture canvas targets now have a full 8-slot radial wheel:
  - Add Node
  - Generate
  - AI Connect
  - Fit
  - Analyze
  - Validate
  - Select All
  - Paste
- The coverage map now reports `architecture/canvas` as `full`, with 8 commands, 0 empty slots, and 2 AI commands.
- The live coverage audit now reports every tracked radial context as `full 8/8`.

Architecture behavior landed:

- `run_validation` moved from linear-only fallback into the SW radial slot as `Validate`.
- The architecture radial event handler now routes `run_validation` through the existing Validation navigation handler.
- The deeper architecture fallback still carries grid, export, JSON, edit, and schematic-instance commands.
- Customizer and E2E coverage expectations now match the full architecture wheel instead of the old empty SW slot.

Safety and speed notes:

- No architecture graph storage, node geometry, edge editing, schematic generation, AI prompt text, validation engine, or generated-output path was changed.
- The new command only navigates to the existing Validation view.
- The radial registry remains static and bounded to 8 slots.

Verification:

- `npm run test -- client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npx tsx -e 'import { getRadialCoverageEntries } from "./client/src/lib/radial-menu-actions.ts"; ...'`
- `npm run test -- client/src/lib/__tests__/radial-menu-actions.test.ts client/src/lib/__tests__/radial-ai-commands.test.ts client/src/lib/__tests__/radial-menu-preferences.test.ts client/src/lib/__tests__/radial-menu-telemetry.test.ts client/src/components/ui/__tests__/RadialMenu.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx client/src/components/ui/__tests__/RadialCommandPreview.test.tsx client/src/components/ui/__tests__/RadialCommandLinearMenu.test.tsx client/src/components/ui/__tests__/RadialMarkingPreview.test.tsx client/src/pages/__tests__/ProjectWorkspace.radial-controller.test.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx client/src/components/circuit-editor/__tests__/PCBLayoutView.radial.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/panels/__tests__/SerialMonitorPanel.radial.test.tsx client/src/components/panels/__tests__/ExportPanel.radial.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/CircuitCodeView.test.tsx client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard.mjs`
- `node .agents/skills/pp-view-architecture/scripts/inspect-architecture.mjs`
- `npm run page-skills:check`
- `git diff --check`
- `npx prettier --check client/src/lib/radial-menu-actions.ts client/src/lib/__tests__/radial-menu-actions.test.ts client/src/components/circuit-editor/breadboard-canvas/index.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/ArchitectureView.tsx client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/ui/__tests__/RadialMenuCustomizer.test.tsx e2e/radial-command-layer.spec.ts`
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`
- `PORT=5100 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 npm run test:e2e -- e2e/radial-command-layer.spec.ts`
- `lsof -i :5100`

Results:

- Focused registry, architecture, breadboard, and customizer tests: 4 files and 144 tests passed.
- Live coverage output confirmed `architecture-canvas full 8/8 empty=0 ai=2`.
- Live coverage output confirmed every tracked radial context is `full 8/8`.
- Expanded radial unit pack: 24 files and 452 tests passed.
- Design token drift check passed.
- UI/UX design inspector: ok.
- AI chat inspector: ok.
- Breadboard inspector: ok.
- Architecture inspector: ok.
- Page-skill coverage check passed.
- `git diff --check`: clean before this doc append.
- Prettier check: clean before this doc append.
- Direct TypeScript check passed with an 8GB Node cap.
- Full isolated radial command-layer E2E: 5 tests passed in 3.4 minutes.
- Port 5100 was clean after the E2E run.

Next:

- All tracked radial contexts are full. The next radial pass should shift from coverage fill-in to polish and resilience: gesture queue stability, reduced E2E retry pressure, and any remaining visual/interaction refinements.
