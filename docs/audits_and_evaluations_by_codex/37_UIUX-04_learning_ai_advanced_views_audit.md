# UI/UX Audit: Learning, AI, and Advanced Views

Date: 2026-03-30  
Auditor: Codex  
Method: Live browser inspection + shell comparison

## Scope Reviewed
- Community
- Arduino
- Chat-shell presence
- Learn/patterns/starter-circuits/labs shell visibility
- Advanced-tab maturity as perceived from runtime

## Findings

### 1) `P1` Arduino currently presents as an advanced destination with almost no visible task affordance
Evidence:
- `09-arduino-blank.png`

Impact:
- The tab promises a workbench but renders like a missing page.
- This is one of the clearest “shell without product” moments in the app.

Recommendation:
- Replace the blank state with a structured setup experience:
  - choose board
  - open sample
  - import sketch
  - connect hardware

### 2) `P2` Community is feature-complete enough to feel real, but visually dense and card-homogeneous
Evidence:
- `08-community.png`

Impact:
- Strong breadth and richness
- Weak differentiation between browsing modes, quality signals, and trust signals

Recommendation:
- Increase card contrast hierarchy.
- Surface curated/editor picks more clearly.
- Add stronger contributor trust cues.

### 3) `P2` AI chat is persistently present in the architecture but too easy to hide from the main workflow
Evidence:
- Multiple audited surfaces showed chat hidden while the product still positions AI as a core value proposition.

Impact:
- AI feels both central and optional in an inconsistent way.

Recommendation:
- If chat is hidden, replace it with a more explicit invite than a small header toggle.

### 4) `P2` Advanced views need readiness states, not just route availability
Affected surfaces:
- Arduino
- likely Circuit Code / Serial Monitor / Digital Twin in early-stage projects

Impact:
- The product exposes ambition before it exposes scaffolding.

Recommendation:
- Every advanced view should answer:
  - what this view is for
  - what prerequisite state is missing
  - what the user can do right now

## What Is Working
- Community visibly demonstrates ecosystem ambition.
- Advanced tabs are easy to reach once enabled.

## Priority Recommendations
1. Fix Arduino blank-state UX immediately.
2. Add readiness/setup states across advanced tools.
3. Make hidden AI feel intentionally recoverable.
