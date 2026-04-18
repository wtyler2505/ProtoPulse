---
name: E2E walkthrough — PASS 2 — APP-WIDE CRITIQUE (cross-tab themes)
description: Frontend E2E findings for 'PASS 2 — APP-WIDE CRITIQUE (cross-tab themes)' chunk from 2026-04-18 walkthrough. 16 E2E IDs; 5 🔴, 5 🟡, 4 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 5
  ux: 5
  idea: 4
  works: 0
  e2e_ids: 16
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 2 — APP-WIDE CRITIQUE (cross-tab themes)

After visual review of all 32+ tabs:

- **E2E-483 🔴 systemic** — **Top toolbar overload.** ~32 icon-only buttons in tight cluster, no labels, no group separation. New users panic, experts can't tell modes. Group by purpose (workspace / view / collab / help / mode) with inline labels by default + a "Compact" toggle.
- **E2E-484 🔴 systemic** — **Tab strip overflow.** 35 tabs requires horizontal scroll. Show only top 8-10 + an "All Tabs" overflow drawer, OR collapse into vertical sidebar like VS Code.
- **E2E-485 🔴 systemic** — **Confidence labels self-contradict** in 4+ places ("Evidence strong" + "SETUP REQUIRED" / "All Checks Passing" + "128 issues"). Pick ONE source of truth.
- **E2E-486 🟡 systemic** — **Empty-state overuse.** Many tabs are 80%+ empty space. Either prefill with useful demos or merge thin tabs.
- **E2E-487 🟡 systemic** — **Three Learning surfaces:** Learn / Patterns / Starter Circuits + Vault. All overlap. Merge into a single "Learn Hub" with type filters.
- **E2E-488 🟡 systemic** — **Three board sources:** PCB tab default 50×40, 3D View 100×80, Order PCB 100×80 (E2E-228/235/270). One source of truth needed.
- **E2E-489 🟢 systemic** — **Trust receipt + confidence panel pattern is ProtoPulse's superpower.** Replicate to every tab that involves trust (Procurement, Validation, Generative).
- **E2E-490 🟢 systemic** — **Card → action integration (E2E-283 Calculator → BOM)** should be the universal pattern. Every card across Patterns, Learn, Community, Starter Circuits should have one-click "Use this" CTAs that wire to the rest of the app.
- **E2E-491 🟡 systemic** — **Color taxonomy untaught.** Cyan = primary action, orange = warning, red = error/critical, green = success, purple = info-pill. But categories also use these colors (Power=red, Passive=green) creating clash. Document the color system.
- **E2E-492 🔴 systemic** — **Beginner mode (Student) doesn't visibly change UI.** Promised "simpler" but nothing different from Hobbyist mode in this audit. Verify mode actually does something.
- **E2E-493 🔴 systemic** — **AI Assistant collapsed sidebar** (right side, vertical text "AI ASSISTANT") is a key feature buried as a slim strip. Make it a clear floating chat icon like ChatGPT.
- **E2E-494 🟡 systemic** — **Accessibility gaps systemic:** role="button" on divs, missing aria-labels on icon-only buttons, color-only state indicators. Run axe-core scan and fix top-50 issues.
- **E2E-495 🟢 IDEA systemic** — Add a global Command Palette (Ctrl+K) — power user productivity multiplier.
- **E2E-496 🟢 IDEA systemic** — Add an "Onboarding tour" using the Coach button (when fixed) — guided first-time walkthrough of all major workflows.

---

