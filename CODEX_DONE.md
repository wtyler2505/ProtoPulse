STATUS: done
TASKS_COMPLETED: [1, 2, 3]

BL-0875 source-code axe fix:
- Views fixed: 10 / 10
- Per-view changes summary:
  - ComponentEditorView: added accessible names to hidden FZPZ and SVG file inputs.
  - CalculatorsView: added accessible names to reset icon buttons, made VaultInfoIcon ARIA valid via `role="img"`, and normalized NumberInput `aria-valuenow` values out of exponential notation.
  - DesignPatternsView: added accessible names to category and difficulty select triggers.
  - KanbanView: added accessible names to priority, tag, and assignee filter select triggers.
  - KnowledgeView: added accessible names to category and difficulty filter select triggers.
  - BoardViewer3DView: added an accessible name to the reset-view icon button and associated edit-board number inputs with visible labels.
  - CommunityView: added accessible names to type filter and sort select triggers.
  - PcbOrderingView: associated the Silkscreen Color label with its select trigger.
  - GenerativeDesignView: associated existing visible labels with range/number inputs and fixed VaultInfoIcon ARIA validity via the shared component.
  - AuditTrailView: added accessible names to entity type and action filter select triggers.
- a11y suite axe-violation count before: 10
- a11y suite axe-violation count after: 0
- Remaining failures in a11y suite (non-axe): DashboardView `history is not iterable`; ArchitectureView missing TooltipProvider wrapper; SchematicView timeout; BreadboardView missing `useBom` mock plus timeout; PCBLayoutView runner soft-assertion spillover from Breadboard mock failure; ProcurementView missing `useBom` mock; CircuitCodeView `Worker is not defined`; ArduinoWorkbenchView `Cannot read properties of undefined (reading 'find')`.

MASTER_BACKLOG.md updates:
- BL-0875: reduced to test-harness/render work only and updated with the 2026-05-09 full-suite result, 8 fail / 19 pass / 27 total, and 0 remaining `violations:` lines.
- BL-0880 (if created): created as DONE for the BL-0875 source-code axe fixes with per-area fix and verification notes.

BLOCKERS: None for the source-code axe work.
NEXT_STEPS: Continue BL-0875 harness work: add the missing TooltipProvider wrapper, repair Dashboard history and `useBom` mocks, add the Worker stub, fix ArduinoWorkbenchView test data, and isolate the Schematic timeout / PCBLayout soft-assertion attribution.
