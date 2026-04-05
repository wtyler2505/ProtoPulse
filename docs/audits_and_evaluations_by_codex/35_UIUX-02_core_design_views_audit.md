# UI/UX Audit: Core Design Views

Date: 2026-03-30  
Auditor: Codex  
Method: Live browser inspection + targeted code review

## Scope Reviewed
- Dashboard
- Architecture
- Schematic tab availability
- Breadboard/PCB tab availability
- Exports as downstream design surface
- Supporting code:
  - `client/src/components/views/DashboardView.tsx`
  - architecture empty/populated runtime state

## Findings

### 1) `P1` Dashboard onboarding is strong in isolation but conflicts with shell guidance
Evidence:
- `02-dashboard-onboarding.png`
- `DashboardView` returns a full `WelcomeOverlay` for empty projects while the shell still shows persistent workflow guidance

Impact:
- Good overlay content is diluted by competing chrome.

### 2) `P1` Architecture is currently the clearest task-ready surface in the app
Evidence:
- `03-architecture-empty.png`
- `04-architecture-populated.png`

Strengths:
- Clear empty-state messaging
- Immediate access to asset library
- Visible generation CTA
- Strong visual payoff once nodes and edge exist

Weaknesses:
- Floating checklist still competes with the canvas
- Asset list shows repeated “recently used” entries and feels cluttered quickly
- Toolbar icons remain unlabeled

### 3) `P2` Architecture canvas maturity sharply exceeds neighboring views, which makes the product feel uneven
Evidence:
- Architecture provides meaningful empty and populated states.
- Arduino and some other advanced views collapse into shell-only or near-shell-only presentations.

Impact:
- The user’s trust depends too much on which tab they happen to click.

### 4) `P2` Schematic/Breadboard/PCB are advertised early, but the journey into them is still not well staged
Evidence:
- These tabs become visible once basic design content exists.
- The shell promotes them before the user has explicit “why go here next?” guidance.

Impact:
- Progression from architecture to implementation feels structurally available but not narratively guided.

Recommendation:
- Add milestone-style nudges:
  - “You have blocks. Next: expand into schematic.”
  - “You have a schematic. Next: verify breadboard placement.”

### 5) `P2` Export center is clean but too abstract for low-maturity projects
Evidence:
- `07-exports.png`
- Many exports appear, but several are clearly unavailable or structurally premature.

Impact:
- The user sees breadth, but not readiness.

Recommendation:
- Add readiness labels like:
  - available now
  - requires schematic
  - requires PCB
  - missing BOM metadata

## What Is Working
- Dashboard typography and card structure are strong.
- Architecture is visually impressive and product-defining.
- Export center has a clean information layout.

## Priority Recommendations
1. Make architecture the intentional next step for every new project.
2. Add clearer stage transitions into schematic, breadboard, and PCB.
3. Add export readiness explanations instead of silent red icons or vague disabled states.
