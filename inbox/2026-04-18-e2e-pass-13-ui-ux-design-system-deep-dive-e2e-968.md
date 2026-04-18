---
name: E2E walkthrough — PASS 13 — UI/UX DESIGN SYSTEM DEEP DIVE (E2E-968+)
description: Frontend E2E findings for 'PASS 13 — UI/UX DESIGN SYSTEM DEEP DIVE (E2E-968+)' chunk from 2026-04-18 walkthrough. 99 E2E IDs; 20 🔴, 30 🟡, 16 🟢, 9 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 20
  ux: 30
  idea: 16
  works: 9
  e2e_ids: 99
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 13 — UI/UX DESIGN SYSTEM DEEP DIVE (E2E-968+)

Per Tyler: full UI/UX design pass — layout, colors, flows, feel, cohesion. Reviewed all 45 existing screenshots + captured 5 new design-detail screenshots. This pass is a **design-system audit** rather than per-tab functionality.

### New screenshots captured for this pass

- `41-header-close.png` — header bar at full resolution
- `42-ai-chat-expanded.png` — AI panel after Show chat clicked
- `43-workspace-mode-dialog.png` — Workspace Mode popover
- `44-explain-panel-dialog.png` — Explain this panel popover
- `45-light-mode-dashboard.png` — Light mode (toggle activated)

### (1) Color system

**Observed palette** (from 45 screenshots + DOM probes):
- Background base: near-black `#0a0a0a` / Tailwind `zinc-950`
- Surface: `#171717` / `zinc-900`
- Border: `#27272a` / `zinc-800`
- Primary: cyan `#00f0fa` / hsl(180-185, 100%, 50%) — used for active states, primary CTAs, highlights
- Accent green: `#10b981` (success / "Saved + restore")
- Accent amber/orange: `#f59e0b` (warning / "Need board profile" / power)
- Accent red: `#ef4444` (errors / Active layer F.Cu)
- Accent purple: `#a855f7` (info / vault MOC count badges / category)
- Accent yellow: `#facc15` (caution; warnings panel)
- Body text: zinc-200 / zinc-300
- Muted text: zinc-500 / zinc-600

- **E2E-968 🔴 P1 BUG (NEW)** — **Light mode toggle is broken.** Verified: clicked theme-toggle, `documentElement.classList === "light"`, but **screenshot is identical to dark mode**. The class is applied; the CSS doesn't react. Either Tailwind dark variant config is wrong, or the `dark` class is hardcoded somewhere upstream.
- **E2E-969 🔴 design** — Color uses **6 semantic colors** (cyan/green/amber/red/purple/yellow) but no documented palette / design token document in repo (per memory + observation). Hard to ensure cross-component consistency.
- **E2E-970 🟡 design** — Cyan `#00f0fa` is used for BOTH "active state" (selected tool, pressed button) AND "primary brand color" (logo, headlines). When EVERYTHING is cyan, nothing stands out.
- **E2E-971 🟡 design** — Severity colors muddled: in Architecture node "POWER" is amber, in Validation issue tag "power" is also amber, but in Layer Stack panel POWER inner layer is **red**. Same word, three meanings, three colors.
- **E2E-972 🟢 design IDEA** — Adopt a documented design-token system (e.g. `--color-primary`, `--color-warning`, `--color-success`, `--color-power`, `--color-signal`, `--color-data`) so domain-specific colors and UI-state colors don't collide.
- **E2E-973 🟡 design** — Warning panel on Validation has a yellow-tinted background row (`Warnings Present` zone) — but only ONE place uses background tint for severity. Inconsistent.
- **E2E-974 🟡 a11y design** — Amber on dark zinc-900 (e.g. "Need board profile" badge): contrast ratio ~4.2:1 → passes WCAG AA for small text but fails AAA. Cyan text on dark passes AA (`#00f0fa` ≈ 11:1 ratio).
- **E2E-975 🔴 design** — No light mode realistically — even though toggle exists, it doesn't work. **Hide the toggle** until light mode actually ships, or implement it.

### (2) Typography

**Observed:** appears to be `Inter` or system stack with monospace for code blocks. Sizes range from text-xs (10-11px) to h2 (24-28px).

- **E2E-976 🔴 design** — H1/H2/H3 hierarchy is INCONSISTENT across tabs. Workspace title uses h2 ("Design workspace" = h2), but project name uses static text below. Vault title uses h2 ("Knowledge Vault"). Dashboard uses h2 ("Blink LED (Sample)"). All three are h2 with different sizes and weights.
- **E2E-977 🟡 design** — Section headers use ALL CAPS (e.g. "TOPIC MAPS", "TOP BLOCKERS", "QUICK INTAKE", "BREADBOARD-INTELLIGENCE") — design choice but inconsistently applied. Some are caps; some title-case; some sentence-case.
- **E2E-978 🟡 design** — Numeric stats (the big "$0.00", "0 components", "12 articles") use varying type sizes — Dashboard cards have HUGE 36px numbers but Procurement BOM cost has medium 18px. Inconsistent KPI hierarchy.
- **E2E-979 🟢 design IDEA** — Adopt 3-tier numeric scale: `kpi-xl` (48px for hero stats), `kpi-md` (24px for card stats), `kpi-sm` (16px for inline counts).
- **E2E-980 🟡 design** — Body text leading (line-height) varies — vault note bodies are tight (1.4×), Validation issue rows are loose (1.7×). Pick a system.
- **E2E-981 🟡 design** — No visible "code" font for technical strings (component MPN, hex IDs, file paths). Should use monospace for these.
- **E2E-982 🟢 design** — Title case "Design workspace" vs sentence case "Bill of Materials" — **inconsistent capitalization**. Pick title or sentence and apply globally.

### (3) Spacing / density

- **E2E-983 🔴 design** — Top toolbar has 32+ icons crammed together with **2-3px gaps**. Density is way too high for icon-only UI. Widen gaps to 8px and add divider lines between groups.
- **E2E-984 🔴 design** — Architecture left sidebar Asset Library is 240px fixed — too narrow for descriptive part names. Some names truncate. Make resizable + default 280px.
- **E2E-985 🟡 design** — Cards on Dashboard have ~24px internal padding — feels generous and good. But other tabs (Procurement BOM, Calculators) use 16px. Pick one.
- **E2E-986 🟡 design** — Tab strip spacing: workspace top tabs (`Dashboard / Architecture / ...`) sit very close together (~6px gap). Hard to see active state vs hover state. Increase to 12px + add subtle background pill on active.
- **E2E-987 🟡 design** — Empty-state spacing inconsistent: Dashboard cards have inline empty text ("No BOM items yet"), Schematic has centered icon + headline + subtext + button (200px tall area), Inventory has tiny inline "0 items" + filter input. Pick a canonical empty-state pattern.

### (4) Layout patterns

- **E2E-988 🔴 design** — **Layout is inconsistent across tabs.** Dashboard = 2x2 card grid. Architecture = sidebar+canvas. Procurement = sub-tabs+table. Validation = 2-column with right rail. Vault = 3-column. Order PCB = top stats + form steps. **No common pattern** — each tab feels like a different app.
- **E2E-989 🟡 design** — When the AI Assistant is collapsed, it occupies a 24px vertical strip with rotated text — visually unique to ProtoPulse, but discoverability is poor (E2E-508 again from a design lens).
- **E2E-990 🟡 design** — Header bar at top is 56-60px tall containing project name + 32+ tools. **Too dense for the height.** Either grow to 80px and label, or split into two rows (name on top, toolbar below).
- **E2E-991 🟢 design IDEA** — Adopt a 3-zone canvas convention: **Left** = inputs/library/picker, **Center** = canvas/main work, **Right** = inspector/AI/help. Apply to every "canvas" tab (Architecture, Schematic, PCB, Breadboard, Component Editor, 3D View). Currently each does it slightly differently.
- **E2E-992 🟡 design** — Workflow breadcrumb "Architecture > Schematic > PCB Layout > Validation > Export" sits below the tab strip. **Two navigation systems competing** — pick tab OR breadcrumb.

### (5) Iconography

- **E2E-993 🔴 design** — Icons are **Lucide-style** (line-icons) for the most part — clean, consistent. BUT: many icon-only buttons have NO LABELS (E2E-314 again from design lens). The line-icon style is gentle/quiet — needs labels to compensate.
- **E2E-994 🟡 design** — Some icons are decorative emoji-style (e.g. brand icons in some screenshots — graduation cap on Coach button) while others are line-art. **Mixed style** = visual chaos.
- **E2E-995 🟡 design** — Icon sizes vary 14px to 20px in the same toolbar — should be uniform 16px.
- **E2E-996 🟢 design IDEA** — Add a "show labels" preference (per Welcome dialog's "Use plain labels" toggle, but EXPAND it to always-on icon labels everywhere).
- **E2E-997 🟡 design** — No app/product icon visible (no favicon-style ProtoPulse logo on header). Branding moment lost.

### (6) Component design language

- **E2E-998 ✅ design** — **Cards are good** — rounded corners (`rounded-md` ~8px), subtle border, dark surface. Consistent across Dashboard / Procurement / Vault / Community.
- **E2E-999 🟡 design** — **Pills/chips inconsistent** — some are filled (Generative cards level pills `Beginner` / `Intermediate`), some outlined (Architecture node category `SENSOR`), some have icon (Lifecycle status). Pick a system.
- **E2E-1000 🟡 design** — **Buttons inconsistent** — Add Component is filled cyan, Run DRC Checks is filled cyan, AI Generate is outlined cyan, Cancel is outlined zinc. Pick `primary / secondary / tertiary / destructive` semantic system and apply globally.
- **E2E-1001 🔴 design** — **Disabled states muddled** — some disabled buttons stay full opacity but with `cursor-not-allowed`, others fade to 50% opacity, others become greyed-out cards. Pick one disabled treatment.
- **E2E-1002 🟢 design** — **Trust receipt panel** (Sim/Order/Arduino/Serial) is the **best component in the design system** — amber-bordered card with status badge + 8 status fields in 2-col grid + bullet list of caveats + "Next step" callout. Replicate everywhere.

### (7) Empty states

- **E2E-1003 🔴 design** — Empty-state design varies wildly:
  - Schematic: icon + headline + subtext + cyan CTA button (BEST)
  - Procurement: icon + headline + subtext + outlined CTA button (good)
  - History: icon + headline + subtext + cyan CTA button (good)
  - Inventory: just inline "0 items" with no CTA (worst)
  - Comments: prose-style "Start a design review conversation" (medium)
  - Generative: "No candidates yet" + tiny prose (medium)
  - Supply Chain: just "No supply chain alerts. Run a check…" (medium)
- **E2E-1004 🟢 design IDEA** — Adopt one canonical empty state component: Icon (60px, brand cyan accent) + Headline (h3 18px) + Subtext (14px muted) + Primary CTA + (optional) Secondary CTA + (optional) Demo data button.

### (8) Loading states

- **E2E-1005 🔴 design** — `panel-skeleton` is the only loading state observed (E2E-019 + E2E-025) — appears as bare grey rectangles for 3-4 seconds with no text. Should use a "Loading [TabName]…" label + spinner.
- **E2E-1006 🟡 design** — Some lazy loads have NO visible loading state at all (e.g. clicking a Validation issue) — feels broken when there's a delay.
- **E2E-1007 🟢 design IDEA** — Adopt a 2-stage loading: (1) skeleton with shimmer animation for first ~300ms, (2) explicit "Still loading… (5s)" text after 3s.

### (9) Error states / feedback

- **E2E-1008 🔴 design** — Alternates / Part Usage tabs show ONLY a small red text "Failed to load X data" with no icon, no retry button, no link to setup. Design fail (E2E-481 again from design lens).
- **E2E-1009 🟡 design** — Toast notifications are clean (cyan accent border, dark background, dismissible). But sit bottom-right with no auto-dismiss. Long-running toasts pile up.
- **E2E-1010 🟢 design IDEA** — Standardize 4 toast types: **Success** (green check), **Info** (cyan info), **Warning** (amber triangle), **Error** (red x). Each with a 5-second auto-dismiss + dismissed-toast history accessible from a notification icon.

### (10) Interactive feedback (hover, focus, active)

- **E2E-1011 ✅ design** — **Wire/Schematic tools** show active state with cyan-tinted background + cyan border (E2E-611). Best-in-class active feedback.
- **E2E-1012 🔴 design** — **Most icon-only header buttons have NO VISIBLE HOVER STATE** (or one too subtle to see). Need a standard hover treatment (background tint to muted-50, slight scale or color shift).
- **E2E-1013 🟡 a11y design** — Focus rings exist (`focus-visible:ring-2 focus-visible:ring-ring`) but ring color is similar to background-tinted cyan — low contrast for keyboard users.
- **E2E-1014 🔴 design** — No active/pressed state on most buttons — clicking a button gives ZERO tactile feedback. Add subtle scale-down (95%) on press.

### (11) Animation / motion

- **E2E-1015 🔴 design** — No observed animations across tabs — tab transitions are instantaneous, modal dialogs pop in without ease, accordions snap. Modern apps use 150-300ms ease-in-out transitions for 90% of UI state changes.
- **E2E-1016 🟢 design IDEA** — Add a global motion system: 100ms for "tactile" (button press), 200ms for "ui" (dropdown open), 300ms for "page" (tab transitions, modal in/out). Honor `prefers-reduced-motion`.

### (12) Dialogs / popovers

Verified from screenshots 43 (Workspace Mode) + 44 (Explain panel):

- **E2E-1017 ✅ design** — Workspace Mode popover and Explain panel popover both use the **same dialog component design** — dark zinc-900 background, cyan accent on selected, clear typography. Excellent reuse.
- **E2E-1018 🟡 design** — Popovers anchor to top-right of the trigger, sometimes pushing off-screen on smaller widths. Need responsive anchor flip.
- **E2E-1019 🟡 design** — Popover heading sizes vary — "Workspace Mode" is 14px, "Dashboard" (Explain panel title) is 16px. Inconsistent.
- **E2E-1020 🟢 design** — Explain panel includes "RELATED" links to Architecture / Validation / Procurement at the bottom — excellent contextual navigation.
- **E2E-1021 🟡 design** — Workspace Mode popover has 3 tabs (Student / Hobbyist / Pro) with icons (graduation / wrench / star) — clean. But the 3 modes deliver no visible UI difference (E2E-513 reaffirmed).

### (13) Header bar (close-up findings from screenshot 41)

- **E2E-1022 🔴 design** — Header has **34 distinct interactive elements** in a 60px-tall row across the full viewport width. Top-left: project name combo. Center: 32 icon buttons. Right: status badges + Coach/help/notifications/settings/avatar/connection-dot/theme.
- **E2E-1023 🔴 design** — Project name "Blink LED (Sample)" sits next to a tiny chevron-like icon → suggests project switcher dropdown. But it's tiny and uninteractive-looking.
- **E2E-1024 🟡 design** — "Need board profile" amber pill + "Saved + restore" green pill sit RIGHT NEXT to "Student Mode" button + Coach help — three different treatments competing. Group as a single "Project Status" cluster.
- **E2E-1025 🟢 design IDEA** — Header should be 80px tall with two rows: Row 1 = project name + breadcrumb + project status pills + user controls. Row 2 = workspace tools + tab navigation.

### (14) AI Assistant chat panel (screenshot 42)

- **E2E-1026 🟡 design** — The "Show chat" toggle was clicked but the screenshot reveals NO VISIBLE CHANGE on dashboard. Either the chat is hidden behind another layer, or click failed silently. Verify expansion actually happens.
- **E2E-1027 🟢 design IDEA** — When AI Assistant expanded, it should have its own clear "exit" button (the right-side `Hide chat` button is the toggle but lives outside the panel itself). Add an X close button INSIDE the panel.

### (15) Cross-tab cohesion

- **E2E-1028 🔴 design** — Each tab has its own visual personality: Dashboard = cards-on-grid, Architecture = canvas+sidebar, Procurement = sub-tab grid, Vault = 3-column reader, Calculators = 2-col cards, Order PCB = wizard. **No shared "this is ProtoPulse" identity** beyond the cyan-on-dark palette.
- **E2E-1029 🟢 design IDEA** — Adopt a "**Workspace Shell**" concept: every tab content slots into a consistent shell (top bar + canvas + right inspector + bottom status). Tabs become differentiated by content, not chrome.
- **E2E-1030 🟡 design** — Tab icons in the workspace tab strip use Lucide icons but are tiny (~14px). User can't tell tabs apart at a glance — adds to overflow problem.

### (16) Brand / aesthetic

- **E2E-1031 ✅ design** — The dark cyberpunk aesthetic is **distinctive and on-brand** for an EDA tool aimed at hackers/makers. Most EDA tools (KiCad, Eagle) are visually drab; ProtoPulse stands out.
- **E2E-1032 🟡 design** — But the "cyberpunk" feel is fragile — one off-brand element (a stock-icon button, a Helvetica font, a default Tailwind gray) would break the spell. Need a stricter style guide.
- **E2E-1033 🟢 design IDEA** — Embrace the brand fully: subtle scan-lines or noise texture on background, glowing edges on cards, 1px CRT bloom on cyan elements. Optional "high-vibe" theme.

### (17) Mobile / responsive

- **E2E-1034 🔴 design** — Header tools row has no mobile collapse strategy beyond `mobile-bottom-nav` (E2E-520). On a 768px viewport, the 32-icon header would horribly overflow.
- **E2E-1035 🟡 design** — Cards in 2-col grids would stack on mobile — verify collapse breakpoints at 640/768/1024.
- **E2E-1036 🟢 design IDEA** — Adopt a "compact" layout breakpoint at 1280px: hide AI Assistant strip, collapse sidebar to icons-only, condense toolbar.

### (18) Light mode (CRITICAL)

- **E2E-1037 🔴 P0 BUG (NEW from screenshot 45)** — **Light mode toggle does NOT work.** classList changes to "light", but visually NOTHING changes. **Hide the broken toggle** OR implement light mode properly. Currently it's a lie to the user.

### (19) Recurring excellent patterns (replicate widely)

- **E2E-1038 ✅ design** — **Trust receipts** (Sim/Order/Arduino/Serial Monitor): amber-bordered card with status badge + grid of status fields + "next step" callout. Replicate to Dashboard / Validation / Generative / Digital Twin / Exports.
- **E2E-1039 ✅ design** — **Hotkey-in-label** for tool buttons (Schematic uses `Select (V)`, `Pan (H)`). Replicate to all canvas toolbars (Architecture, Breadboard, PCB).
- **E2E-1040 ✅ design** — **Closed-loop integration** like Calculator → Add to BOM, Schematic placement → BOM toast. Replicate every place a value/component is computed.
- **E2E-1041 ✅ design** — **Disabled-with-reason tooltip** (Push to PCB, AI Copilot, Send message). Replicate everywhere a button is disabled.
- **E2E-1042 ✅ design** — **MOC count badges** in Vault (`actuators 87`). Replicate count badges to all categorized lists (Architecture asset categories, Procurement sub-tabs).

### (20) Top design recommendations

**Quick wins (<1 week each):**
1. **Hide broken light mode toggle** OR ship light mode (E2E-968/1037).
2. **Document a design-token color system** (E2E-972).
3. **Standardize empty-state component** with icon + headline + subtext + CTA (E2E-1003/1004).
4. **Standardize toast types + auto-dismiss** (E2E-1010).
5. **Add hover/active feedback to all icon-only buttons** (E2E-1012/1014).

**1-month design investments:**
6. **3-zone canvas convention** (Left input / Center canvas / Right inspector) applied to all canvas tabs (E2E-991).
7. **Trust receipt pattern replicated** to Dashboard / Validation / Generative (E2E-1038).
8. **Hotkey-in-label** applied to all toolbars (E2E-1039).
9. **Top toolbar widened to 80px with labeled icons + grouped sections** (E2E-983/990/1025).
10. **Animation system** (100/200/300ms ease-in-out tiers, with `prefers-reduced-motion`) (E2E-1016).

**Quarter design investments (changes the brand feel):**
11. **Unified Workspace Shell** so every tab feels like one app (E2E-1028/1029).
12. **Mobile responsive strategy** with compact breakpoint at 1280px (E2E-1036).
13. **Documented style guide + Storybook** to prevent off-brand drift.
14. **High-vibe theme** with optional CRT bloom / scan-lines (E2E-1033).
15. **Per-tab Welcome tour** that uses Coach popover (when fixed) to walk through first-time use of each tab.

### Pass 13 wrap-up

Pass 13 added **75 design findings (E2E-968 → E2E-1042)**. Total now: **1042 findings across 14 sub-passes**.

**Top 3 design wins to celebrate:**
1. Trust receipt pattern (amber gating card with status grid)
2. Hotkey-in-label tool buttons (Schematic best-in-class)
3. Closed-loop integration (Calculator → BOM, Schematic → BOM toast)

**Top 3 design failures to fix:**
1. Light mode toggle is broken (changes class but not visuals)
2. Top toolbar overload (32 unlabeled icons in 60px height)
3. Layout inconsistency across tabs (no shared shell)

---




