# ProtoPulse UI/UX Master Rollup

Date: 2026-03-30  
Auditor: Codex  
Status: Fresh runtime-backed UI/UX pass completed  
Method: Live browser audit + code inspection + comparison against prior FE audits

## Coverage Summary
- Routes reviewed: project picker, authenticated workspace shell, representative workspace views, not-found/project-open failure path
- Live evidence captured:
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/01-project-picker.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/02-dashboard-onboarding.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/03-architecture-empty.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/04-architecture-populated.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/05-procurement.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/06-validation.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/07-exports.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/08-community.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/09-arduino-blank.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/15-chat-panel-ai-pass.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/16-design-agent-ai-pass.png`
  - `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/17-generative-design-ai-pass.png`
- Runtime note:
  - Current-page console was clean of warnings and errors during the final runtime check.
  - Preserved console history still contained React Flow container-size warnings from earlier navigation states during the audit pass.
  - A stale Vite optimize-deps cache initially produced a blank app shell; this was a local dev-runtime issue, not counted as a product UI finding.

## Executive Read
ProtoPulse feels visually ambitious and information-rich, but the current experience is still too stateful, too dense, and too inconsistent for a new or returning user to trust quickly. The shell is powerful, the architecture canvas is compelling, and several panels have good affordances, but the product still leaks implementation state into the UX: stale recent projects open dead IDs, persisted layout/view state can override first-run expectations, onboarding layers stack on top of each other, and some views still collapse into near-empty shells rather than delivering a task-ready workspace.

The biggest UI/UX problem is not one page. It is system coherence. The product has multiple navigation systems, multiple onboarding systems, multiple density levels, and multiple “sources of truth” about what the user should do next. That makes the app feel less like a guided integrated tool and more like a large set of partially connected expert surfaces.

## Highest-Priority Findings

### 1) `P1` Project picker trust is broken by dead-open flows
Evidence:
- Runtime: clicking listed sample/recent project `19` navigated to `/projects/19`, then surfaced a “Not found” toast and returned to the picker.
- API confirmation during audit:
  - `GET /api/projects` returned project `19`.
  - `GET /api/projects/19` returned `{ "message": "Project not found" }`.

Why it matters:
- The first important action in the app, “open a project,” is not trustworthy.
- This damages confidence before the user reaches the workspace.

Recommended direction:
- Make project-list membership and project-open authorization use the same source of truth.
- Remove or auto-heal stale recent-project entries before navigation.
- Replace bounce-back + toast with a recoverable state that explains what happened and offers “Open another project” and “Repair recents.”

### 2) `P1` Persisted shell state overrides first-run intent
Evidence:
- Freshly created project initially opened into `serial_monitor` with sidebar collapsed and chat hidden.
- New projects did not consistently land on a beginner-safe starting view.

Why it matters:
- The app feels haunted by prior sessions.
- First-run experience is determined by old local state instead of product intent.

Recommended direction:
- Treat first-open for a new project as a special mode with pinned defaults:
  - `dashboard` active
  - sidebar open
  - chat visible or intentionally invited
- Only restore per-project layout after the user has interacted in that specific project.

### 3) `P1` Onboarding surfaces compete instead of cooperating
Evidence:
- Dashboard showed welcome overlay content while the shell also displayed workflow breadcrumbs and the floating “Getting Started” checklist.
- Architecture and procurement continued to show the checklist even when the main task area already had its own empty-state instruction.

Why it matters:
- Three simultaneous guidance systems create cognitive drag instead of momentum.
- The user has to decide which guide is authoritative.

Recommended direction:
- Collapse onboarding into one active guide at a time:
  - first-run overlay on dashboard
  - contextual empty-state guidance inside the active view
  - compact persistent checklist only after dismissal of the overlay

### 4) `P1` Validation signal-to-noise is badly out of proportion to project maturity
Evidence:
- A tiny audit project with two nodes, one connection, and one BOM item showed “Found 128 potential issues in your design.”
- The side troubleshooter surfaced `17 issues found` at the same time, creating additional count ambiguity.

Why it matters:
- The validation surface feels noisy, punitive, and not calibrated to beginner state.
- Counts at this scale look untrustworthy.

Recommended direction:
- Gate advanced rules behind project maturity or an “advanced checks” toggle.
- Group issues into:
  - must-fix now
  - recommended next
  - advanced/manufacturing guidance
- Make counts reconcile across all validation panels.

### 5) `P1` Some advanced views still render as shells rather than usable products
Evidence:
- `Arduino` view rendered as effectively blank black space plus the floating checklist.
- The workspace chrome remained visible, but the task surface itself had no meaningful affordance.

Why it matters:
- Advanced tabs feel available before they are ready.
- Blank shells communicate incompleteness more than capability.

Recommended direction:
- Replace blank surfaces with explicit readiness states:
  - “Set up a board profile”
  - “Import firmware”
  - “Open sample sketch”
- Hide or soften tabs that do not yet have an actionable baseline state.

## Cross-Cutting Themes
- Information density is generally too high for first-run flows.
- Navigation depends too heavily on icon literacy and tooltip discovery.
- Floating right-side checklist overlaps and visually competes with important content in multiple views.
- The shell is visually cohesive, but the task surfaces vary a lot in maturity and guidance quality.
- Empty and zero-data states are stronger on dashboard and architecture than on Arduino or project-open failure paths.

## Quick Wins
1. Fix project picker/open consistency and stale recents handling.
2. Reset shell defaults for brand-new projects.
3. Turn the floating checklist into a docked/minimized pattern that does not occlude content.
4. Replace blank advanced views with explicit setup states.
5. Calibrate validation counts and severity buckets for low-maturity projects.

## Medium Lifts
1. Unify onboarding and guidance into a single staged system.
2. Standardize toolbar density and action grouping across all primary views.
3. Normalize empty/loading/error states so each major view has a trusted baseline.
4. Introduce per-project shell state instead of global shell state.

## Big Swings
1. Reframe the shell around task modes: Learn, Design, Build, Validate, Ship.
2. Replace the current “icon ribbon + tab strip + workflow breadcrumb + checklist” stack with a clearer hierarchy.
3. Add maturity-aware UX that progressively unlocks advanced views as project structure becomes richer.

## Product Direction Ideas
These are enhancement-oriented recommendations, not just issue remediation:

1. Make ProtoPulse feel like a guided electronics workshop, not a collection of tool windows.
2. Build a “trust layer” into the shell:
   - honest status
   - reliable recents
   - clear save/sync/open state
   - visible prerequisites for advanced actions
3. Introduce adaptive UX modes:
   - `Starter`
   - `Builder`
   - `Lab`
   - `Manufacturing`
4. Turn onboarding into a narrative:
   - discover
   - assemble intent
   - design
   - validate
   - ship
5. Give every advanced view a meaningful “ready-to-start” state instead of a blank shell.

## Signature Experience Opportunities
1. `Mission Control Shell`
   Replace the current many-layer shell with a mode-based top frame that changes the available tools and emphasis based on what the user is trying to do.
2. `Explain Everything`
   Lean into the educational promise by making “why this matters” visible in validation, BOM, architecture, and exports.
3. `Readiness Everywhere`
   Add explicit readiness badges and prerequisite checklists for views, exports, board setup, and manufacturing.
4. `Project Memory That Helps`
   Persist state per project and purpose, not globally, so the app feels attentive instead of haunted.

## Educational and Hobbyist Direction
This pass reinforces a major product truth: ProtoPulse already contains many of the right educational ingredients, but they do not yet behave like one visible beginner journey.

Fresh evidence and code review showed that the app already has:
- `Starter Circuits`
- `Knowledge`
- `Labs`
- `Calculators`
- interactive tutorials
- panel explainers
- beginner terminology remapping
- student/hobbyist/pro role presets
- a structured learning-path engine
- an AI tutor engine
- classroom-mode infrastructure

The issue is not lack of learning features. The issue is choreography and surfacing.

Right now:
- the learning affordances are scattered across tabs, floating panels, and small header icons
- the role-preset selector exists in code but is not surfaced in the current UI
- the learning-path and AI-tutor systems exist in code but are not visibly driving the beginner experience
- beginner mode mostly renames terminology instead of changing workflow difficulty, guidance depth, or task sequencing
- the same floating checklist overlays learning surfaces instead of becoming a real coach

The product opportunity is substantial:
- ProtoPulse can become a tool that teaches electronics while the user is building something real
- hobbyists can be guided from "I just want to blink an LED" to "I made a board and firmware" without leaving the app
- educators, clubs, makerspaces, and self-taught builders can all use the same product, just with different scaffolding levels

See:
- `44_UIUX-11_educational_hobbyist_blueprint.md`
- `45_UIUX-12_beginner_first_experience_roadmap.md`

## AI Product Direction
This pass also confirms that ProtoPulse's AI opportunity is bigger than "add a chat panel to an EDA tool." The product already contains the beginnings of a differentiated AI operating layer:
- grounded conversational assistance
- project-changing AI actions with preview and confirmation
- a separate design-agent workflow
- generative design
- multimodal inputs
- safety classification
- low-confidence review infrastructure
- tutoring infrastructure

The issue is not missing raw capability. The issue is role clarity and product choreography.

Right now the app exposes several overlapping AI front doors:
- `ProtoPulse AI` chat
- `Design Agent`
- `Generative Design`
- view-specific AI actions

That makes the AI feel powerful after inspection, but not fully legible on first contact. Fresh runtime review also showed that:
- chat is core product value, but is still easy to collapse out of sight
- the chat panel contains strong trust features, but they are visually secondary
- the design agent is underframed relative to its promise
- generative design feels detached from the main AI narrative
- current user-guide copy still references multi-provider behavior that no longer matches the surfaced product flow

The product direction should be:
1. clarify AI roles
2. productize trust and review
3. make chat view-aware and stage-aware
4. rebuild the design agent as a plan-first mission workflow
5. connect chat, teaching, generation, and execution into one understandable system

See:
- `46_UIUX-13_ai_experience_blueprint.md`
- `47_UIUX-14_chat_panel_design_agent_recommendations.md`
- `48_UIUX-15_ai_ship_order_roadmap.md`

## AI Blind Spots and Trust Layer
One more important conclusion emerged after the AI strategy pass: ProtoPulse's remaining AI risk is now less about missing raw capability and more about missing operating discipline.

The biggest "easy to forget" gaps are:
- scoped ownership and context isolation
- server-enforced confirmation rather than UI-only warning patterns
- productized low-confidence review
- visible memory governance
- degraded-mode behavior for no-key, outage, and low-confidence states
- prompt-injection and hostile-input resistance
- hardware-specific AI safety rules
- AI evaluation discipline and trust metrics

The repo already contains pieces of this foundation:
- `ai-safety-mode.ts`
- `ai-review-queue.ts`
- AI-specific error catalogs
- persistent chat history and branching
- agent rate limiting and step bounds

But those pieces do not yet form one visible trust-and-safety operating model.

See:
- `49_UIUX-16_ai_blind_spots_and_failure_modes.md`
- `50_UIUX-17_ai_trust_safety_operating_model.md`
- `51_UIUX-18_ai_eval_metrics_rollout_plan.md`

## Deep Systems Expansion Pack
The UI/UX and AI passes were only part of the real product story. A deeper second wave now extends the audit set into the harder trust domains:
- simulation correctness and decision trust
- import/export truthfulness and roundtrip fidelity
- data integrity and state consistency
- permissions, isolation, and collaboration safety
- hardware runtime safety
- performance, telemetry, and observability
- manufacturing readiness
- learning/accessibility/documentation honesty/maturity
- test reality, failure recovery, and release confidence

See:
- `52_AUDX-01_simulation_correctness_and_decision_trust_audit.md`
- `53_AUDX-02_import_export_truthfulness_and_roundtrip_audit.md`
- `54_AUDX-03_data_integrity_state_consistency_and_recovery_audit.md`
- `55_AUDX-04_permissions_isolation_and_collaboration_safety_audit.md`
- `56_AUDX-05_hardware_runtime_safety_and_device_control_audit.md`
- `57_AUDX-06_performance_load_telemetry_and_observability_audit.md`
- `58_AUDX-07_manufacturing_readiness_and_real_world_ship_risk_audit.md`
- `59_AUDX-08_learning_accessibility_documentation_honesty_and_maturity_audit.md`
- `60_AUDX-09_test_reality_failure_recovery_and_release_confidence_audit.md`
- `61_AUDX-10_master_rollup_deep_systems_audit.md`
- `62_AUDX-11_evidence_index.md`
- `63_AUDX-12_improvement_opportunities_matrix.md`

## Related Fresh Audit Files
- `34_UIUX-01_workspace_shell_navigation_audit.md`
- `35_UIUX-02_core_design_views_audit.md`
- `36_UIUX-03_workflow_management_views_audit.md`
- `37_UIUX-04_learning_ai_advanced_views_audit.md`
- `38_UIUX-05_shared_ui_system_audit.md`
- `39_UIUX-06_responsive_accessibility_interaction_audit.md`
- `40_UIUX-07_visual_evidence_index.md`
- `41_UIUX-08_enhancement_blueprint.md`
- `42_UIUX-09_view_by_view_ideas.md`
- `43_UIUX-10_ship_order_roadmap.md`
- `44_UIUX-11_educational_hobbyist_blueprint.md`
- `45_UIUX-12_beginner_first_experience_roadmap.md`
- `46_UIUX-13_ai_experience_blueprint.md`
- `47_UIUX-14_chat_panel_design_agent_recommendations.md`
- `48_UIUX-15_ai_ship_order_roadmap.md`
- `49_UIUX-16_ai_blind_spots_and_failure_modes.md`
- `50_UIUX-17_ai_trust_safety_operating_model.md`
- `51_UIUX-18_ai_eval_metrics_rollout_plan.md`
- `52_AUDX-01_simulation_correctness_and_decision_trust_audit.md`
- `53_AUDX-02_import_export_truthfulness_and_roundtrip_audit.md`
- `54_AUDX-03_data_integrity_state_consistency_and_recovery_audit.md`
- `55_AUDX-04_permissions_isolation_and_collaboration_safety_audit.md`
- `56_AUDX-05_hardware_runtime_safety_and_device_control_audit.md`
- `57_AUDX-06_performance_load_telemetry_and_observability_audit.md`
- `58_AUDX-07_manufacturing_readiness_and_real_world_ship_risk_audit.md`
- `59_AUDX-08_learning_accessibility_documentation_honesty_and_maturity_audit.md`
- `60_AUDX-09_test_reality_failure_recovery_and_release_confidence_audit.md`
- `61_AUDX-10_master_rollup_deep_systems_audit.md`
- `62_AUDX-11_evidence_index.md`
- `63_AUDX-12_improvement_opportunities_matrix.md`
