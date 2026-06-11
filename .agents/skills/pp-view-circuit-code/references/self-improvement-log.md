# Circuit Code Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Circuit Code work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Circuit Code behavior.

## Pending Proposals

- Add screenshots for the main Circuit Code states.
- Add more specific gotchas after the next real Circuit Code implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Analysis Pass (user: "/pp-view-circuit-code" in the systematic full-app views backlog campaign)

**Workflow followed exactly:**
1. Inspector run → ok (CircuitCodeView 177 LOC — small shell around a substantial DSL engine).
2. page-map.md read.
3. ux-contract.md read (strong emphasis on "Source Trust" and visibility of generated code vs. preview vs. apply).
4. testing.md read (zero tests recorded for the view).
5. gotchas.md read.
6. This entry + contribution to master backlog report.

**Deep Findings:**

**What the View Actually Is:**
- A bidirectional textual circuit design environment:
  - Left: CodeMirror-based editor for a custom circuit DSL.
  - Right: Live SVG schematic preview generated from the IR (via `ir-to-schematic`).
  - Bottom: Error panel (click-to-jump) + status + "Apply to Project" button.
- The heavy logic lives in `client/src/lib/circuit-dsl/` (parser, IR, web-worker evaluator, completions, code generator (visual→code), error mapping, net naming, etc.).
- "Apply" sends the layout to the backend (`/apply-code`) which creates real `CircuitDesign` + instances in the project.

**Biggest Observations vs. UX Contract:**
- **Source Trust** is called out in the contract but has almost no visible surface in the view. There's no indicator of whether the current code was AI-generated, user-written, imported, verified, or round-tripped from the visual editor.
- The "Generated Circuit Code" vs. "Code Preview" distinction is not strongly communicated (the editor is the source of truth; the preview is derived).
- Apply flow is present but its consequences (what exactly gets created in the project) are not previewed or explained in the UI.

**Other Notable Items:**
- Live evaluation uses a 300ms debounce + web worker — good architecture, but worker stability, cancellation, and large-design performance are untested in the view.
- Error mapping from IR/evaluator back to editor lines is implemented (`evalErrorsToDiagnostics`), which is excellent for UX.
- Round-tripping (visual editor → generated code → code view → apply) is a powerful but complex feature with fidelity risks.
- No tests for the view itself, despite the complexity of the DSL engine underneath.
- Strong latent synergy with AI/Chat (the code generator + completions are perfect for "write circuit code from description" flows).

**Durable Lesson:**
When you have a powerful textual DSL with live visual preview and an "apply" path into the canonical model, the highest-leverage UX work is making the provenance ("where did this code come from?") and the consequences of "Apply" transparent. Source Trust is not a backend-only concern — it must be visible at the point the user is editing and committing the code.

**Recommended for Codex:**
- Add visible source trust / provenance UI in the status bar or header (AI-generated? Verified? Last applied from visual?).
- Improve the Apply preview / diff (what new designs/instances will be created?).
- Add tests for the view (especially error mapping, apply flow, and round-tripping fidelity).
- Tighten integration with AI/Chat so that generated circuit code can be opened directly in this view with proper trust metadata.
- Monitor worker performance and cancellation for large designs.

This analysis is contributed to the living master backlog report. The Circuit Code view is a sophisticated "textual first" design surface whose core engine is solid, but the trust, apply preview, and cross-tool integration surfaces are still thin relative to the power of the feature and the emphasis in its own UX contract.

---

## 2026-05-24 R12 Apply Preview Implementation

- Added a consequence preview before Circuit Code can post to `/api/projects/:projectId/circuits/apply-code`.
- The preview summarizes the new circuit design, component count, net count, wire segment count, and the first few components.
- Added visible source-trust context near the apply path so local/generated DSL state is not treated as an invisible backend detail.
- Fixed CodeMirror accessibility exposed by the browser proof: named the editable textbox, made the scroll region keyboard-focusable, and raised line-number gutter contrast.
- Recorded `client/src/components/views/__tests__/CircuitCodeView.test.tsx` in this skill pack because the test existed but the auto-synced facts were stale.
- Durable lesson: for DSL-to-canonical-model flows, "Apply" needs the same consequence-preview discipline as procurement and BOM template merges.

## 2026-05-25 Keyboard-Nav Resize Handle Name

- `e2e/p1-keyboard-nav.spec.ts` caught the Circuit Code split-pane resize handle as a focusable `role="separator"` with no accessible name.
- The handle now carries an explicit `aria-label` so keyboard users and assistive tech understand it resizes the code editor and schematic preview panes.

Durable lesson: Resizable split-pane handles are interactive controls. Treat them like controls, not decoration, and name them at the call site when the pane purpose is page-specific.
