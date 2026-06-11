# ProtoPulse Frontend Pivot Plan

Created: 2026-05-17T10:19:09Z

## Why Now

The v3 architecture work has enough real runtime surface to make frontend work high-value instead of cosmetic. The app now has tscircuit-first schematic direction, trust-boundary UI pieces, verifier/triage concepts, export paths, and schema visualization surfaces. The next useful phase is making those pieces feel coherent, dense, readable, and comfortable to use.

## Start Gate

Before fully switching lanes, finish the currently running TypeScript check from the tscircuit export mapping work and record the result in the v3 audit.

## Frontend Success Criteria

1. Capture real screenshots for every primary surface before changing it.
2. Work one surface at a time, starting with the left sidebar.
3. Keep changes tied to visible user workflows, not only styling cleanup.
4. Preserve app density for engineering work: compact, scannable, and predictable.
5. Verify each pass with screenshots plus focused tests or typecheck when touched code requires it.

## First Surfaces

1. Left sidebar: project picker, search, navigation, tree sections, collapsed state, project settings footprint, scrolling behavior, and flyouts.
2. Main workspace shell: header, tab/view switching, empty states, pane boundaries, and spacing rhythm.
3. Schematic/canvas area: toolbar density, overlay controls, trust badges, verifier trace, and next-action surfaces.
4. Right/bottom panels: chat, export, validation, procurement, and logs.
5. Cross-app polish: typography, scrollbars, focus states, loading states, error states, motion, and personalization hooks.

## Working Method

For each surface:

1. Screenshot current state across desktop and narrower widths.
2. List observed friction with exact screenshot references.
3. Propose a small design direction.
4. Implement one slice.
5. Re-screenshot and compare.
6. Record what changed and what remains.

## Initial Backlog

- Build or reuse a repeatable screenshot capture command for frontend audit batches.
- Re-catalog the left sidebar after the latest code changes.
- Reduce the project settings footprint in the sidebar so it no longer dominates the lower half.
- Check sidebar section height, scroll containment, and hover/focus affordances.
- Review font sizes and text wrapping in compact panels.
- Normalize icon button sizing and tooltip behavior.
- Identify any card-inside-card or over-rounded controls that violate the app design rules.
- Build a design token pass for spacing, borders, panel backgrounds, and scrollbars.
- Create a before/after screenshot index under `docs/audit-screenshots/`.
- Add targeted UI regression tests only where layout state is code-owned and cheap to assert.

## Current Status

Frontend pivot is active.

Completed first slice:

- Quieted the desktop top chrome from a stacked 80px header plus workflow breadcrumb into a single 48px command bar.
- Replaced the icon-heavy top navigation with text-first primary view tabs.
- Moved secondary views and secondary actions into `More workspace actions`.
- Made the More menu scrollable with a viewport-aware max height.
- Removed the separate workflow breadcrumb bar from the workspace shell.

Verification:

- `npm run test -- client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx` => pass
- `npm run check` => pass
- Screenshot proof:
  - `docs/audit-screenshots/2026-05-17T10-37-50-796Z/top-chrome/header-closed.png`
  - `docs/audit-screenshots/2026-05-17T10-37-50-796Z/top-chrome/header-more-open.png`
  - `docs/audit-screenshots/2026-05-17T10-37-50-796Z/top-chrome/SUMMARY.json`

Observed after screenshot:

- Header is substantially calmer.
- More menu is scrollable, but it is still a long mixed list. Next pass should group secondary views and actions more clearly and consider moving mode/status controls into the same menu on narrower desktop widths.

Completed second slice:

- Reduced left-sidebar bottom noise by replacing the in-sidebar Project Settings flyout with a compact trigger row.
- Moved Project Settings content into a dedicated dialog panel with independent scrolling (`max-h` + `overflow-y-auto`) so the sidebar no longer gets consumed by settings UI.
- Kept all existing settings features (name, description, stats, import/export, version copy) while improving layout stability.

Verification:

- `npm run check` => pass
- `npm run test -- client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx` => pass
- `npm run test -- client/src/components/layout/__tests__/Sidebar.test.tsx` => fail (2 pre-existing missing status-action testids unrelated to this settings-panel refactor)

Next pass queued:

- Re-capture left-sidebar screenshots after this settings-panel change and compare before/after.
- Continue sidebar density pass on section spacing and icon count.

Sidebar re-capture completed:

- Used the hardened screenshot workflow (`screenshot-capture-super`) instead of the older ad-hoc catalog script.
- New validated catalog:
  - `docs/audit-screenshots/2026-05-17T11-00-55-456Z-sidebar-catalog/`
  - includes `MANIFEST.md`, `CHECKLIST.md`, `SUMMARY.json`
  - `SUMMARY.json.status = ok` with 22 captures across desktop/tablet/mobile and settings-open states.

Test stability follow-up:

- Updated sidebar tests to match current UX contract where project-health details are hidden by default behind `Show details`.
- `npm run test -- client/src/components/layout/__tests__/Sidebar.test.tsx` => pass (14/14).

Completed third slice (left-sidebar density/noise):

- Reduced icon noise in the sidebar header by collapsing utility actions into one overflow menu:
  - kept dedicated theme button
  - moved high-contrast and sign-out into `More sidebar actions`
- Tightened vertical rhythm in the expanded sidebar:
  - smaller top link row padding
  - reduced section top/bottom spacing
  - reduced large gaps between explorer and grouped navigation

Verification:

- `npm run test -- client/src/components/layout/__tests__/Sidebar.test.tsx` => pass (14/14)
- `npm run check` => pass
- Fresh sidebar evidence pass:
  - `docs/audit-screenshots/2026-05-17T11-09-36-296Z-sidebar-catalog/`
  - `SUMMARY.json.status = ok`
  - 30 captures

Completed fourth slice (schematic/canvas density):

- Tightened schematic workspace command bar density:
  - reduced header height and horizontal spacing
  - normalized action button heights
  - tightened circuit select control footprint
- Reduced side panel footprint in schematic:
  - narrowed parts panel from `w-56` to `w-52`
  - tightened tab-row vertical padding
- Reduced visual loudness of in-canvas overlays:
  - changed selected-net chip from pill-style to compact rounded rectangle
  - aligned inline ERC warning chips to compact rounded rectangle style

Files touched:

- `client/src/components/views/SchematicView.tsx`
- `client/src/components/circuit-editor/SchematicCanvas.tsx`

Verification:

- `npm run test -- client/src/components/views/__tests__/SchematicView.test.tsx` => pass (3/3)
- `npm run test -- client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx` => pass (6/6)
- `npm run check` => pass
- Screenshot evidence:
  - `docs/audit-screenshots/2026-05-17T11-18-47-385Z-schematic-canvas/`
  - includes `SUMMARY.json`

Schematic scroll bug fix:

- Fixed non-scrollable schematic layout by adding `min-h-0` through the nested flex chain in schematic workspace containers.
- This restores scroll behavior in constrained panel/canvas regions.

File touched:

- `client/src/components/views/SchematicView.tsx`

Verification:

- `npm run test -- client/src/components/views/__tests__/SchematicView.test.tsx` => pass (3/3)
- `npm run check` => pass

Completed fifth slice (right/bottom panel density):

- Tightened chat header density:
  - reduced header height and icon button footprints
  - aligned settings overlay offset to new header height
- Tightened export panel density:
  - reduced root padding and vertical gaps
  - reduced category and import row paddings for higher information density

Files touched:

- `client/src/components/panels/chat/ChatHeader.tsx`
- `client/src/components/panels/ChatPanel.tsx`
- `client/src/components/panels/ExportPanel.tsx`

Verification:

- `npm run test -- client/src/components/panels/__tests__/ChatPanel.test.tsx` => pass (11/11)
- `npm run check` => pass
- Screenshot evidence:
  - `docs/audit-screenshots/2026-05-17T11-30-46-106Z-right-bottom-panels/`
  - includes `SUMMARY.json` with chat and export captures
