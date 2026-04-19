# Shell, Header, Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Collapse the 34-element 60px top toolbar + 35-tab horizontal overflow + 21-icon unnamed sidebar + rotated-text AI panel + missing command palette + broken light-mode toggle + mobile 5-item bottom-nav into a coherent navigation shell that beginners can comprehend and experts can weaponize.

**Architecture:** Ship the shell in six layers: (1) WorkspaceShell 2-row header (80px) grouped by purpose, (2) VS Code-style vertical activity-bar nav with optional legacy tab-strip mode, (3) sidebar with group labels + user pin/unpin, (4) AI panel as floating chat bubble (replace rotated strip), (5) hover-peek docks with visible edge handles, (6) `Ctrl+K` command palette + `Ctrl+P` quick-tab-switcher. Mobile strategy = `compact` breakpoint at 1280px AND proper bottom-nav with drawer for overflow.

**Tech Stack:** Wouter 3.3 (router), Radix UI (Dialog for command palette, Popover for hover-peek), `cmdk` (command palette ergonomics — to install), existing hover-peek dock logic from audit-discovered `hover-peek-*` testids (map to existing component; extend — do not duplicate).

**Parent:** `00-master-index.md` §3.1 (Pass 3 missed + Pass 13 shell), §4.3 (multi-owner E2E-487 Learning-surfaces merge), §5 (Tier C, Wave 3 parallel with `16-design-system.md`).

**Tier:** C. **Depends on:** `01-p0-bugs.md` (settings route), `16-design-system.md` Phase 3 (Button primitive with `hotkey` prop), `03-a11y-systemic.md` Phase 2 (icon-only aria-labels). **Blocks:** every per-tab plan needing to appear in the new tab-inventory ordering.

**Parallelizable with** `16-design-system.md` (disjoint files — 17 owns layout + nav; 16 owns primitives).

---

## Coverage

| E2E | Severity | Summary | Phase |
|-----|---|---|---|
| E2E-011 | IDEA | "Use plain labels" — also live in Settings | 7 (Settings integration) |
| E2E-012 | IDEA | Welcome "Watch 60s tour" video | 6 (onboarding tour) |
| E2E-013 | UX | Welcome "Skip and go to dashboard" vs open Architecture | 7 |
| E2E-014 | OBS | Mode picker no "custom" | 7 |
| E2E-053 | UX | Tab/route/heading naming inconsistent (Learn=knowledge, Inventory=storage, Tasks=kanban) | 1 |
| E2E-069 | UX | `workspace-hardware-badge` "Need board profile" no tooltip | 1 (header cluster) |
| E2E-074 | P1 | Coach popover — shipped by `02-p1-dead-buttons.md` | *02* |
| E2E-089 | IDEA | Tab dynamism undocumented — tooltip on overflow | 2 |
| E2E-090 | UX | Tab strip scroll shifts unexpectedly | 2 |
| E2E-276 | UX | Route/heading naming drift | 1 |
| E2E-483 | systemic | Top toolbar overload — group by purpose, labels by default | 1 |
| E2E-484 | systemic | Tab strip overflow — VS Code vertical nav + overflow drawer | 2 |
| E2E-486 | systemic | Empty-state overuse — merge thin tabs | 2 (tab inventory consolidation) |
| E2E-487 | systemic | 3 learning surfaces + Vault overlap — coordinate with 13 | 2 |
| E2E-492 | systemic | Beginner mode doesn't visibly change UI | 7 |
| E2E-493 | systemic | AI Assistant rotated strip — promote to chat bubble | 4 |
| E2E-495 | IDEA | Global Command Palette (Ctrl+K) | 6 |
| E2E-496 | IDEA | Onboarding tour via Coach | 6 |
| E2E-497 | visual | Sample project cards have good metadata — keep | 2 (projects view) |
| E2E-498 | design | Project grid dense — sort/group toggle | 2 |
| E2E-499 | UX | E2E Test Project duplicates — multi-select + bulk delete | 2 |
| E2E-500 | IDEA | Sample project fork/remix CTA | 2 |
| E2E-501 | IDEA | Project templates by industry | 2 |
| E2E-503 | UX | 404 page "Return to Dashboard" goes to /projects | 1 |
| E2E-504 | IDEA | Settings content — profile/API keys/theme/hotkeys/notifications/GDPR | 7 |
| E2E-505 | visual | Sidebar groups in DOM but no visible labels | 3 |
| E2E-506 | UX | Sidebar icons all equal weight — pin top 3 | 3 |
| E2E-507 | IDEA | User pin/unpin per icon | 3 |
| E2E-508 | visual | AI Assistant 24px strip undiscoverable | 4 |
| E2E-509 | UX | AI quick-actions not context-aware | 4 |
| E2E-510 | IDEA | Multi-modal AI (drag datasheet) | 4 (scoped — moves to 18) |
| E2E-511 | IDEA | Voice input button untested | 4 → 18 |
| E2E-512 | UX | "Local • —" footer opaque | 4 |
| E2E-513 | visual | Workspace Mode (Student/Hobbyist/Pro) no visible UI difference | 7 |
| E2E-514 | IDEA | "Educator" mode | 7 |
| E2E-515 | visual | Hover-peek pattern undocumented | 5 |
| E2E-516 | IDEA | Hover-peek delay configurable | 5 |
| E2E-517 | UX | Theme toggle no Auto (system) option | 7 |
| E2E-518 | IDEA | Save theme per project | 7 |
| E2E-519 | IDEA | Print mode preset | 7 |
| E2E-520 | UX | Mobile bottom nav only 5 items — rest inaccessible | 8 |
| E2E-521 | IDEA | Mobile swipe between tabs + drawer | 8 |
| E2E-549 | expansion | Activity-bar nav (VS Code-style) + Ctrl+P quick-tab-switcher | 2 + 6 |
| E2E-550 | expansion | TutorialMenu as tracked-progress checklist | 6 |
| E2E-556 | newbie | "New here? Watch 2 min intro" above /projects | 6 |
| E2E-557 | newbie | Blink LED sample has BME280 (wrong starter) | *04-dashboard.md* (sample data fix) |
| E2E-558 | newbie | No guided "first PCB end-to-end" wizard | 6 |
| E2E-559 | expert | Keyboard-first nav (Ctrl+P, Ctrl+Shift+P, Ctrl+Tab) | 6 |
| E2E-983 | design | Top toolbar 2-3px gaps | 1 |
| E2E-984 | design | Asset Library 240px fixed — resizable | 3 |
| E2E-986 | design | Tab strip 6px gap | 2 |
| E2E-989 | design | AI panel rotated strip | 4 |
| E2E-990 | design | Header 60px → 80px 2-row | 1 |
| E2E-992 | design | Tabs + breadcrumb compete | 2 |
| E2E-993 | design | Icons unlabeled (handled partly by `03-a11y-systemic.md`) | 1 |
| E2E-996 | IDEA | "show labels" preference | 7 |
| E2E-997 | design | No favicon/brand mark | 1 |
| E2E-1012 | design | Header icon hover state missing (handled by `16 Phase 3`) | *16* |
| E2E-1021 | visual | Mode picker popover clean but modes inert | 7 |
| E2E-1022 | design | Header 34 elements 60px | 1 |
| E2E-1023 | design | Project name chevron tiny | 1 |
| E2E-1024 | design | Need board profile + Saved + Student mode compete | 1 |
| E2E-1025 | IDEA | Header 80px 2-row | 1 |
| E2E-1026 | design | "Show chat" click no visible change | 4 |
| E2E-1027 | IDEA | AI panel close X | 4 |
| E2E-1030 | design | Tab strip icons 14px | 2 |
| E2E-1034 | design | Mobile 32-icon header overflow | 8 |
| E2E-1036 | IDEA | Compact breakpoint at 1280px | 8 |
| E2E-560 | expert | Git integration — moved to 18 | *18* |
| E2E-561 | expert | Programmatic API access — moved to 18 | *18* |

**Count:** 54 IDs directly owned + 6 cross-routed. All Pass 3 "missed" + Pass 2 "app-wide systemic" + Pass 13 "shell" findings accounted for.

## Existing Infrastructure (verified 2026-04-18)

| Concern | Files | Notes |
|---------|---|---|
| WorkspaceHeader | `client/src/pages/workspace/WorkspaceHeader.tsx` (486 lines, 22 button sites) | Primary refactor target |
| Sidebar | `client/src/components/layout/Sidebar.tsx` (+ `layout/sidebar/` subdir) | Already componentized |
| Workflow breadcrumb | `client/src/components/layout/WorkflowBreadcrumb.tsx` | E2E-992 — either keep or remove |
| Recent projects | `client/src/components/layout/RecentProjectsList.tsx` | Pass 3 missed-projects findings |
| Command palette (exists!) | `client/src/components/ui/command-palette.tsx` + `client/src/components/CommandPalette.tsx` | Two separate — audit + consolidate |
| AI Chat Panel | `client/src/components/panels/ChatPanel.tsx` | Rotated strip origin |
| Hover-peek | `rg "hover-peek" client/src` | Audit says testids exist — locate component |
| Theme toggle | `client/src/components/ui/theme-toggle.tsx` | 2-mode, missing Auto |
| Wouter routes | `client/src/App.tsx` (Switch block) | Add /settings (via 01 Phase 4), /projects filtering, mobile nav routes |
| cmdk lib | NOT installed | `npm install cmdk` in Phase 6 |
| Project provider | `client/src/pages/ProjectWorkspace.tsx:838` | `<ProjectProvider>` — power-user APIs hook here |

## Research protocol

- **Context7** `cmdk` — `query-docs "React 19 compatible command palette with fuzzy search"`
- **Context7** `@radix-ui/react-navigation-menu` — `query-docs "responsive collapse to drawer"`
- **Context7** `wouter` — `query-docs "nested route groups / route params for tab-based navigation"`
- **WebSearch** "VS Code activity bar UX pattern documentation" — inspire §2
- **WebSearch** "keyboard shortcut conflicts cmd vs ctrl cross-platform" — inform Phase 6
- **Codebase** `rg "hover-peek" client/src` — locate existing hover-peek impl (audit confirmed testids exist)
- **Codebase** `rg "tab-strip|TabStrip|workspace-tab" client/src/pages/workspace/` — find current tab renderer
- **Advisor** — before Phase 2 (major nav refactor), before Phase 6 (shortcut keymap collisions)

---

## Phase 1 — Header 80px 2-row + grouped toolbar (E2E-483, E2E-990, E2E-1022-E2E-1025, E2E-1024, E2E-983, E2E-997, E2E-1023, E2E-069, E2E-503, E2E-053, E2E-276, E2E-993)

- [ ] **Task 1.1 — Inventory of header elements**

```bash
rg -n "data-testid" /home/wtyler/Projects/ProtoPulse/client/src/pages/workspace/WorkspaceHeader.tsx
```

Group into clusters: `ProjectIdentity` (name + chevron + workflow-breadcrumb) / `ProjectStatus` (health / hardware / mode) / `WorkspaceTools` (pcb-tutorial / import-design / mention-badge / activity-feed / share / whats-new / explain / coach) / `UserArea` (notifications / avatar / settings gear / theme / help) / `ConnectionState` (dot).

- [ ] **Task 1.2 — Design the 2-row header**

```
Row 1 (40px):  [Brand mark] [Project name ▾] [ > breadcrumb ]           [ status pills cluster ] [ user avatar dropdown ]
Row 2 (40px):  [ Tools cluster left ]            [ search / command trigger ]            [ tools cluster right ]
```

Brand mark = small ProtoPulse logo (E2E-997). Clicking opens `/projects`.

- [ ] **Task 1.3 — Failing Playwright: cluster structure present**

```ts
test('header has 2-row layout with grouped clusters (E2E-990, E2E-1025)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await expect(page.getByTestId('header-row-identity')).toBeVisible();
  await expect(page.getByTestId('header-row-tools')).toBeVisible();
  await expect(page.getByTestId('header-brand-mark')).toBeVisible();
  await expect(page.getByTestId('header-cluster-project-status')).toBeVisible();
  await expect(page.getByTestId('header-cluster-user')).toBeVisible();
});
```

- [ ] **Task 1.4 — Implement refactor**

Rewrite `WorkspaceHeader.tsx` from the 486-line monolith into:
- `WorkspaceHeader.tsx` (composition only)
- `HeaderRowIdentity.tsx`
- `HeaderRowTools.tsx`
- `HeaderClusterProjectStatus.tsx`
- `HeaderClusterUser.tsx`
- `HeaderClusterWorkspaceTools.tsx`
- `BrandMark.tsx`

Every icon-only button gets an aria-label (handled jointly with `03-a11y-systemic.md` Phase 2) + a label visible by default under 1280px (E2E-993 / `show labels` preference).

- [ ] **Task 1.5 — Status pill tooltip (E2E-069)**

`workspace-hardware-badge` "Need board profile" gets a `<StyledTooltip>` explaining WHY + linking to `/settings/appearance` or the board picker.

- [ ] **Task 1.6 — Fix /404 "Return to Dashboard" button to go to /dashboard (E2E-503)**

Since there's no /dashboard in Wouter, make the button go to `/projects` OR add `/dashboard` as an alias. Fix the label to match actual destination.

- [ ] **Task 1.7 — Route/heading naming audit (E2E-053, E2E-276)**

Compile table:

```
Tab label       | Route          | Page heading         | Inconsistent?
Learn           | /learn         | "Knowledge"          | YES → rename heading "Learn"
Inventory       | /inventory     | "Storage Manager"    | YES → rename to "Inventory"
Tasks           | /tasks         | "Kanban Board"       | YES → rename to "Tasks"
Vault           | /vault         | "Knowledge Vault"    | OK
```

Ship renames in this plan (single file-touch refactor). Add a Playwright test asserting `document.title === tab label`.

- [ ] **Task 1.8 — Tests PASS + commit**

---

## Phase 2 — Vertical Activity-Bar nav + Tab overflow drawer (E2E-484, E2E-486, E2E-487, E2E-497-501, E2E-986, E2E-992, E2E-1030, E2E-549, E2E-089, E2E-090)

- [ ] **Task 2.1 — `advisor()` — activity bar vs tab strip decision**

The audit recommends "Show only top 8-10 + 'All Tabs' drawer OR vertical sidebar like VS Code". Present both options to advisor; pick with migration path (tab-strip mode as legacy flag).

- [ ] **Task 2.2 — Inventory current 35 tabs + natural groupings**

Per audit tabs observed: Dashboard / Architecture / Schematic / Breadboard / PCB / 3D View / Component Editor / Procurement / Simulation / Tasks / Learn / Vault / Community / Order PCB / Inventory / Serial Monitor / Calculators / Patterns / Starter Circuits / Labs / History / Audit Trail / Lifecycle / Comments / Generative / Digital Twin / Exports / Supply Chain / BOM Templates / My Parts / Alternates / Part Usage / Arduino / Circuit Code / Validation.

Natural groups (E2E-486 tab consolidation):
- **Design** — Dashboard, Architecture, Schematic, PCB, 3D View
- **Build** — Breadboard, Component Editor, Arduino, Circuit Code, Serial Monitor
- **Analyze** — Validation, Simulation, Digital Twin
- **Procure** — Procurement (absorbs BOM, Alternates, Live Pricing, Supply Chain, BOM Templates, My Parts, Part Usage)
- **Learn** — Learn Hub (absorbs Learn, Patterns, Starter Circuits, Labs, Vault) (E2E-487 merge)
- **Community** — Community, Comments, Tasks
- **History** — History, Audit Trail, Lifecycle
- **Utility** — Calculators, Generative, Exports, Order PCB

**Impact on per-tab plans:** `10-procurement-suite.md` and `13-learning-surfaces.md` must coordinate — this plan does the nav grouping; those plans do the merge.

- [ ] **Task 2.3 — Implement Activity Bar**

```tsx
// client/src/components/layout/ActivityBar.tsx
const GROUPS = [
  { id: 'design', icon: Blueprint, label: 'Design', members: ['dashboard', 'architecture', 'schematic', 'pcb', '3d-view'] },
  // ...
];
```

Clicking a group icon opens a nested drawer listing its members.

- [ ] **Task 2.4 — Implement tab overflow drawer**

Keep the horizontal tab strip as a preference (Settings toggle), but default to activity-bar. Overflow goes to `⋯ More` drawer with fuzzy filter.

- [ ] **Task 2.5 — Dynamic-tab reveal hint (E2E-089)**

When Schematic/PCB/Validation/3D View auto-unlock on first architecture node, show toast: "Schematic and PCB unlocked — click to open."

- [ ] **Task 2.6 — Anchor scroll on tab-append (E2E-090)**

Save tab-strip scroll offset, replay after mutation.

- [ ] **Task 2.7 — Projects list improvements (E2E-497-501)**

- Sort/group toggle on `/projects`
- Multi-select with bulk delete (for E2E Test Project cleanup)
- Fork/remix CTA on sample projects
- Templates-by-industry picker

- [ ] **Task 2.8 — Tests + commit**

---

## Phase 3 — Sidebar groups + pin/unpin (E2E-505, E2E-506, E2E-507, E2E-984)

- [ ] **Task 3.1 — Read current sidebar**

```bash
ls /home/wtyler/Projects/ProtoPulse/client/src/components/layout/sidebar/
```

- [ ] **Task 3.2 — Add group labels**

Existing DOM groups: design / analysis / hardware / manufacturing / ai_code / documentation. Render each with a label header + collapse chevron.

- [ ] **Task 3.3 — Pin/unpin**

Store pinned IDs in `localStorage` under `protopulse-sidebar-pins`. Top section shows pinned + larger icons.

- [ ] **Task 3.4 — Asset Library resize (E2E-984)**

Already has `asset-resize-handle` (audit confirmed). Verify smooth behavior; bump default to 280px.

- [ ] **Task 3.5 — Tests + commit**

---

## Phase 4 — AI Chat panel as floating bubble (E2E-508, E2E-509, E2E-512, E2E-1026, E2E-1027, E2E-989, E2E-493)

- [ ] **Task 4.1 — Design chat-bubble pattern**

Replace 24px rotated strip with a 48px round FAB at bottom-right. Click → panel slides in from right (380px wide).

- [ ] **Task 4.2 — Panel has explicit X close (E2E-1027)**

- [ ] **Task 4.3 — Context-aware quick-actions (E2E-509)**

`useTab()` context; quick-actions array switches based on `activeView`. E.g. Schematic → `["Auto-wire selected", "Push to PCB", "Explain net"]`; PCB → `["Auto-place", "Auto-route", "Explain DRC error"]`.

- [ ] **Task 4.4 — Status footer meaning (E2E-512)**

Replace `"Local • —"` with explicit `Model: <name> • Tokens: <n>` + tooltip "Local = running on-device / Cloud = Anthropic / OpenAI / Gemini".

- [ ] **Task 4.5 — Tests + commit**

---

## Phase 5 — Hover-peek docks with edge handles (E2E-515, E2E-516)

- [ ] **Task 5.1 — Locate existing hover-peek impl**

```bash
rg -n "hover-peek" /home/wtyler/Projects/ProtoPulse/client/src
```

- [ ] **Task 5.2 — Add edge handle affordance**

Small `<` / `>` chevron at the vertical middle of each collapsed panel edge. `aria-label="Expand sidebar"`.

- [ ] **Task 5.3 — Configurable delay**

Settings toggle: "Hover-peek delay: [0 / 200ms / 500ms]". Wire to `hover-peek-*` component props.

- [ ] **Task 5.4 — Tests + commit**

---

## Phase 6 — Command palette + keyboard shortcuts (E2E-495, E2E-496, E2E-549, E2E-550, E2E-556, E2E-558, E2E-559)

- [ ] **Task 6.1 — Install cmdk**

```bash
npm install cmdk
```

- [ ] **Task 6.2 — Consolidate existing command palettes**

Audit finds `client/src/components/ui/command-palette.tsx` AND `client/src/components/CommandPalette.tsx`. Merge into one: ONE `cmdk`-based primitive with registered commands.

- [ ] **Task 6.3 — Shortcut map (`advisor()` on collisions)**

```
Ctrl+K       — Command palette (global)
Ctrl+P       — Quick tab switcher (file-open analogue)
Ctrl+Shift+P — Command palette (alias)
Ctrl+Tab     — Cycle tabs forward
Ctrl+Shift+Tab — Cycle tabs backward
?            — Show keyboard shortcuts dialog
Esc          — Close modals / exit wire-tool / cancel
```

- [ ] **Task 6.4 — TutorialMenu as tracked checklist (E2E-550)**

Convert existing TutorialMenu into a progress checklist: "1/12 — Place your first component". Persist completion in `localStorage` + sync to server. Gamified.

- [ ] **Task 6.5 — First-PCB wizard (E2E-558)**

New `/tour/first-pcb` route that guides: Architecture → add 1 component → Schematic → wire → PCB → auto-route → DRC → Order PCB. Each step gated + shareable link to resume.

- [ ] **Task 6.6 — "New here?" above-fold on /projects (E2E-556)**

Banner: "New to ProtoPulse? Watch the 2-min tour →" with dismissable persistence.

- [ ] **Task 6.7 — Tests + commit**

---

## Phase 7 — Settings page content + modes (E2E-011, E2E-013, E2E-014, E2E-492, E2E-504, E2E-513, E2E-514, E2E-517, E2E-518, E2E-519, E2E-996, E2E-1021)

Prereq: `01-p0-bugs.md` Phase 4 (route scaffolded).

- [ ] **Task 7.1 — Profile section**

- [ ] **Task 7.2 — Appearance section**

- Theme: Light / Dark / Auto (system) (E2E-517)
- Theme per project override (E2E-518)
- High-contrast mode (existing `.high-contrast` class)
- Motion preference (respect `prefers-reduced-motion`)
- Print mode preset (E2E-519)
- Show labels on icons (E2E-996, E2E-011)

- [ ] **Task 7.3 — API Keys section**

Anthropic / OpenAI / Gemini — per project memory `reference_gemini_api_key.md`. Encrypted at rest (existing pattern).

- [ ] **Task 7.4 — Hotkey customization**

User can remap any of the shortcuts from Phase 6.

- [ ] **Task 7.5 — Notifications**

Toggle for toasts / in-app banners / email (future).

- [ ] **Task 7.6 — Data export (GDPR) + delete account**

- [ ] **Task 7.7 — Implement Workspace Modes (E2E-492, E2E-513, E2E-514, E2E-1021)**

Actually deliver the Student / Hobbyist / Pro distinction:
- **Student**: hide Tier F+ tabs (Generative, Digital Twin, Lifecycle, Audit Trail); simpler labels; all AI gated behind confirmation; lesson-mode default ON.
- **Hobbyist (default)**: all tabs visible; plain labels optional.
- **Pro**: all tabs + power features (bulk edit, CLI mode, programmatic API hints — linked to `18-innovation-roadmap.md` E2E-561).
- **Educator (E2E-514)**: Student plus grading overlay + classroom dashboard.

Store choice in `localStorage` + user profile. Every view `useWorkspaceMode()` to gate features.

- [ ] **Task 7.8 — Welcome skip path bug (E2E-013)**

Verify "Skip and go to dashboard" actually goes to dashboard; "Open Architecture" goes to architecture.

- [ ] **Task 7.9 — Tests + commit**

---

## Phase 8 — Mobile responsive (E2E-520, E2E-521, E2E-1034, E2E-1036)

- [ ] **Task 8.1 — Compact breakpoint at 1280px**

Use Tailwind `compact:` variant (custom). Below 1280px: AI panel collapses to bubble; sidebar collapses to icons; toolbar row 2 tucks into overflow.

- [ ] **Task 8.2 — Mobile bottom nav with drawer**

Currently 5 fixed items. Add 6th slot = "More" → opens drawer listing all tabs organized by activity-bar groups (from Phase 2).

- [ ] **Task 8.3 — Swipe between tabs (E2E-521)**

Use `@dnd-kit/core` (already installed) OR native pointer events for touch swipe. Only apply within a group to avoid accidental disorienting jumps.

- [ ] **Task 8.4 — FAB for AI chat on mobile**

Already in Phase 4 — verify mobile position doesn't overlap bottom-nav.

- [ ] **Task 8.5 — Playwright viewport matrix**

```ts
const VIEWPORTS = [{ w: 1920, h: 1080 }, { w: 1440, h: 900 }, { w: 1280, h: 800 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }];
for (const vp of VIEWPORTS) { /* assert no horizontal overflow, nav reachable */ }
```

- [ ] **Task 8.6 — Tests + commit**

---

## Team Execution Checklist

```
□ Prereqs merged: 01 Phase 4 (/settings route), 16 Phase 3 (Button with hotkey), 03 Phase 2 (aria-labels)
□ npm run check          ← zero errors
□ npm test               ← all green
□ npx eslint .           ← zero warnings
□ Playwright: header layout + activity-bar + command palette + mobile viewport matrix pass
□ Coverage table verified
□ docs/design-system/shell.md documents the final shell anatomy + keyboard shortcut reference
□ advisor() called ≥3× (Task 2.1 nav decision, Task 6.3 shortcut collisions, before final merge)
```

## Research log

- Context7 `cmdk` — pending Task 6.1
- Context7 `wouter` — pending Task 2.3
- WebSearch "VS Code activity bar UX" — pending Task 2.1
- WebSearch "keyboard shortcut cross-platform" — pending Task 6.3
- Codebase `WorkspaceHeader.tsx` — 486 lines, 22 buttons (verified)
- Codebase 2 separate command palettes — verified `client/src/components/ui/command-palette.tsx` + `client/src/components/CommandPalette.tsx`
- advisor() calls — pending as scheduled
