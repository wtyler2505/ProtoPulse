# UI/UX Audit Report - audit-screenshots

## Table of Contents
- Executive Summary
- Methodology
- Findings by Category
- Per-Screenshot Findings
- Consistency / Drift Analysis
- Coverage Matrix
- Issue Ledger
- Action Plan
- Code Examples
- Mockups
- Design Token Harvest
- Appendix

## Executive Summary
### Key Findings
1. The shell layout is consistent (left project tree, top module tabs, right AI panel), but text contrast and secondary-label legibility are below WCAG 2.2 AA expectations across most dark screens.
2. State communication is uneven: some screens clearly show loading/error/edit states, while others are effectively blank (PCB empty canvas, architecture load, architecture view drift) with no actionable guidance.
3. Cross-view drift exists in repeated surfaces: collapsed sidebar behavior differs between versions, and `H-procurement-view.png` appears to include stitched/duplicated viewport capture artifacts.
4. The login path is broken in evidence (`08-login.png` shows 404), which is a critical UX and trust failure.
5. Tables (validation/procurement) are information-dense but lack stronger visual hierarchy (row grouping, stronger headings, clearer inline-edit emphasis).

### Critical Recommendations
1. Ship a contrast and typography token pass first (body/secondary text, borders, placeholder text, status chips) to meet WCAG 2.2 AA.
2. Add explicit empty/loading/error patterns for architecture/PCB/output views, with primary next actions.
3. Fix login routing immediately and provide recovery CTAs for not-found states.
4. Standardize sidebar collapsed/full behaviors and table interaction states via shared component tokens.
5. Add visible keyboard focus states and larger interactive hit areas on dense toolbars and icon-only controls.

## Methodology
### Tools Used
- Screenshot inspection: `view_image` on all 23 files in `docs/audit-screenshots`.
- File integrity/metadata: `identify`, `exiftool`, `pngcheck`.
- OCR extraction: `tesseract` (timeout-capped per image).
- Visual metrics: `python3` + `cv2` + `skimage` for `edge_density`, `mean_lum`, `std_lum`, `white_ratio`.
- Similarity clustering: `imagehash` pHash + Hamming distance.
- Optimization potential (derived copies only): `optipng`, `pngquant` in `/tmp/ui-audit`.

### Analysis Framework Applied
- Initial assessment (visual reasoning): mapped hierarchy and relationship of shell regions and view-specific content.
- Systematic analysis (structured argumentation): thesis/antithesis/synthesis for strengths vs weaknesses.
- Decision framework: impact vs effort prioritization for remediation.
- Pattern recognition (first principles): repeated constraints around contrast, state signaling, and component drift.

### Assumptions and Constraints
- Static screenshots only; interaction timing, keyboard order, ARIA semantics, and true focus behavior are **Unverified**.
- `BASELINE_DIR` and `BASE_URL` were not provided; regression diffing and live audits (Lighthouse/pa11y) are **Unverified**.
- OCR under-detected text on dark UI surfaces (many `ocr_chars=0`), likely due low contrast and dense anti-aliased text.

## Findings by Category

### 1. Visual Design Analysis
- Screenshot references: `00-initial-state.png`, `06-validation.png`, `05-procurement.png`, `03-component-editor.png`, `08-login.png`
- Current state:
  - 22/23 screens are very dark (`mean_lum` mostly 5.0-21.7; exception: `08-login.png` at 241.6).
  - Average edge density is 0.0259, indicating many low-salience, dark surfaces with fine-line detail.
  - OCR captured almost no text on core dark views, supporting legibility risk.
- Issues:
  - **High:** Secondary text and placeholders are too dim across dark surfaces.
  - **High:** Table headings/status tags lack enough luminance separation for quick scanning.
  - **Critical:** `08-login.png` visual system breaks entirely (light 404 screen disconnected from app style).
- Reasoning method: Tool-assisted metrics (luminosity/OCR) + manual visual inspection.
- Recommendations:
  1. Raise secondary text luminance and border contrast tokens (minimum 4.5:1 for body-size text).
  2. Increase table header contrast and row striping separation.
  3. Introduce a dedicated not-found/auth visual template consistent with app shell.
- Implementation priority: High
- Estimated effort: 10-14 hours

### 2. Information Architecture Analysis
- Screenshot references: `01-architecture-default.png`, `03-component-editor.png`, `04-schematic.png`, `06-output.png`, `08-project-settings.png`
- Current state:
  - Stable shell IA: top tabs, left hierarchy, right AI panel.
  - Screen-level IA varies: component editor is clear; PCB/architecture load states are sparse without guidance.
- Issues:
  - **High:** Blank/near-blank canvases without instructional empty states (PCB, architecture loading/view variants).
  - **Medium:** Right AI panel consumes persistent width even when primary task needs canvas real estate.
  - **Medium:** Project settings in sidebar are discoverable but visually compressed.
- Reasoning method: Manual grouping by task flow + filename state inference (`initial-load`, `project-settings`).
- Recommendations:
  1. Add explicit empty-state callouts with primary CTA per view.
  2. Support collapsible/auto-hide AI panel while preserving context access.
  3. Promote project settings into a dedicated modal/page for high-density edits.
- Implementation priority: High
- Estimated effort: 12-18 hours

### 3. Interactive Elements Analysis
- Screenshot references: `05-procurement-inline-edit.png`, `03-generate-modal.png`, `07-chat-settings.png`, `01-sidebar-collapsed.png`
- Current state:
  - Buttons and tab affordances are present and mostly consistent.
  - Inline edit state in procurement is visually subtle; icon-only collapsed nav requires recall.
- Issues:
  - **High:** Inline edit row emphasis is weak (pHash distance 0 vs non-edit procurement shot).
  - **Medium:** Icon-only controls in collapsed sidebar have no visible text aids in static evidence.
  - **High:** Focus-ring visibility is **Unverified** and likely weak given contrast patterns.
- Reasoning method: pHash drift check + manual affordance review.
- Recommendations:
  1. Add clear edit-mode container styling (background, border, sticky action cluster).
  2. Add tooltips/labels for icon-only nav and toolbar controls.
  3. Enforce focus-visible style tokens across all interactive controls.
- Implementation priority: High
- Estimated effort: 8-12 hours

### 4. Technical Quality Assessment
- Screenshot references: all 23 images (pipeline artifacts in `/tmp/ui-audit`)
- Current state:
  - Image integrity: no PNG hard errors; all files 24-bit RGB (8-bit).
  - Compression opportunity: optipng median savings ~35-45%; pngquant ~71-79% in many files.
  - Drift artifacts: `H-procurement-view.png` includes obvious stitched/duplicated viewport slices.
- Issues:
  - **Medium:** Capture pipeline inconsistency introduces false visual regressions.
  - **High:** Stitched or partial viewport captures reduce audit reliability.
  - **Low:** PNG optimization not critical for product UX but useful for docs/reporting efficiency.
- Reasoning method: Tool outputs (`pngcheck`, pHash, optimization stats) + manual anomaly review.
- Recommendations:
  1. Standardize screenshot capture dimensions and viewport lock.
  2. Add capture validation (single viewport, no seam artifacts).
  3. Optionally compress docs assets in CI for faster report loading.
- Implementation priority: Medium
- Estimated effort: 4-8 hours

### 5. User Experience Evaluation
- Screenshot references: `08-login.png`, `04-pcb.png`, `A1-initial-load.png`, `00-initial-state.png`, `06-output.png`
- Current state:
  - Core workflows are represented (architecture -> editor -> procurement -> validation/output).
  - Friction is highest when users hit empty/loading/error states without next-step guidance.
- Issues:
  - **Critical:** Login route failure (404) blocks entry path.
  - **High:** Empty canvases and loading screen do not explain next action.
  - **Medium:** Dense validation/procurement tables increase cognitive load without progressive disclosure.
- Reasoning method: Manual UX journey tracing + filename state inference.
- Recommendations:
  1. Resolve auth routing and provide explicit recovery actions.
  2. Add contextual helper rails (“what to do next”) for each empty/loading/error surface.
  3. Add table density presets and guided filters for issue/BOM triage.
- Implementation priority: High
- Estimated effort: 14-24 hours

## Per-Screenshot Findings
Legend:
- `VH` visual hierarchy, `AG` alignment/grid, `SS` spacing scale, `TH` typography, `CC` contrast/semantic color, `CS` component consistency, `IA` interaction affordance, `FB` feedback visibility, `ESL` error/empty/loading, `NAV` location awareness, `CDS` content density/scanability, `TO` truncation/overflow, `TT` touch target sizing, `AC` accessibility cues, `TS` trust/safety cues.
- `TT` is `NA` for desktop-only screenshots.

### 00-initial-state.png
Shows validation view with issue table, full left project sidebar, right AI panel.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | Pass | Pass | Pass | Fail | Pass | NA | Fail | Pass |

Top issues:
- High: Low-contrast secondary text in headers and metadata lines.
- Medium: Validation table is dense with weak visual grouping.
- Medium: AI panel consumes width during issue triage.

Recommendations:
- Increase table heading/subtext contrast and row grouping.
- Add compact mode toggle for side panels while validating.

Metrics: `1777x845`, `185.0KB`, `ocr=0`, `edge_density=0.0308`, `mean_lum=13.0`, `std_lum=23.3`, `pHash=d793b0b71ad44a4c`.
Baseline diff: Unverified (no `BASELINE_DIR`).

### 01-architecture-default.png
Architecture canvas with asset library open and connected nodes.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | NA | NA | Pass | Pass | Pass | NA | Fail | NA |

Top issues:
- High: Library list and minor labels are difficult to read.
- Medium: Right panel plus library constrains primary canvas.

Recommendations:
- Raise text/token contrast for list metadata.
- Allow temporary auto-hide of right panel in diagram-heavy tasks.

Metrics: `1600x761`, `192.7KB`, `ocr=0`, `edge_density=0.0310`, `mean_lum=19.2`, `std_lum=21.2`, `pHash=c0adad7f27564154`.

### 01-sidebar-collapsed.png
Validation view with left sidebar collapsed to icon rail.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Fail | Pass | Pass | Pass | Fail | Pass | NA | Fail | Pass |

Top issues:
- High: Icon-only navigation lacks textual affordance in captured state.
- Medium: Dense table still hard to scan quickly.

Recommendations:
- Add persistent tooltips/expanded-on-hover labels.
- Increase row separation and heading prominence.

Metrics: `1600x761`, `149.6KB`, `ocr=0`, `edge_density=0.0293`, `mean_lum=12.8`, `std_lum=22.3`, `pHash=e3baba92bcc44545`.

### 01-sidebar-full.png
Validation view with full sidebar expanded.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | Pass | Pass | Pass | Fail | Pass | NA | Fail | Pass |

Top issues:
- High: Secondary typography remains low contrast.
- Medium: Table reading rhythm is flat (minimal row hierarchy).

Recommendations:
- Introduce stronger typography scale and color roles for table meta text.
- Add zebra/section separators for long issue lists.

Metrics: `1600x761`, `179.1KB`, `ocr=0`, `edge_density=0.0372`, `mean_lum=14.4`, `std_lum=25.6`, `pHash=e7b2b0b690c54d4d`.

### 02-architecture-clean.png
Architecture canvas with selected node and no library drawer.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | Pass | NA | Pass | Pass | Pass | NA | Fail | NA |

Top issues:
- Medium: Contrast of edge labels and node metadata is weak.
- Medium: Selection glow may be insufficient for low-vision users.

Recommendations:
- Increase edge-label font weight and color contrast.
- Add dual-channel selected state (outline + badge).

Metrics: `1600x761`, `156.2KB`, `ocr=0`, `edge_density=0.0260`, `mean_lum=18.8`, `std_lum=19.0`, `pHash=c28dad37217655d4`.

### 02-node-selected.png
Architecture view with asset library open and selected MCU node.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | Pass | NA | Pass | Pass | Pass | NA | Fail | NA |

Top issues:
- High: Library metadata legibility remains poor.
- Medium: Simultaneous side panels reduce working area.

Recommendations:
- Increase list text contrast and spacing.
- Add one-click distraction-free canvas mode.

Metrics: `1600x761`, `202.9KB`, `ocr=0`, `edge_density=0.0319`, `mean_lum=19.1`, `std_lum=19.1`, `pHash=c08dad27237655d6`.

### 03-component-editor.png
Component metadata editor form with tabs and part list.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Pass | Fail | Pass | Pass | NA | NA | Pass | Pass | Pass | NA | Fail | NA |

Top issues:
- Medium: Placeholder and helper text are low-contrast.
- Medium: Required/error semantics are not visible in this state.

Recommendations:
- Define stronger form helper/placeholder tokens.
- Add persistent required cues and inline validation patterns.

Metrics: `1600x761`, `129.7KB`, `ocr=0`, `edge_density=0.0249`, `mean_lum=11.7`, `std_lum=17.2`, `pHash=efc0a18781de5653`.

### 03-generate-modal.png
Generate Package modal overlay with template cards.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Pass | Fail | Pass | Pass | Pass | NA | Pass | Fail | Pass | NA | Fail | NA |

Top issues:
- Medium: Card density is high with limited hierarchy.
- Medium: Scrollbar contrast and modal depth cues are weak.

Recommendations:
- Group templates with stronger section separators.
- Increase modal surface contrast and scrollbar visibility.

Metrics: `1600x761`, `156.7KB`, `ocr=547`, `edge_density=0.0156`, `mean_lum=5.3`, `std_lum=13.4`, `pHash=cc96236e33993176`.

### 04-breadboard.png
Breadboard canvas view with red error toast in lower-right.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fail | Pass | Pass | Fail | Fail | Fail | Pass | Pass | Pass | Pass | Fail | Pass | NA | Fail | Fail |

Top issues:
- High: Error toast lacks clear remediation action.
- Medium: Breadboard labels and tool controls are visually noisy.
- Medium: Style diverges from other canvas views.

Recommendations:
- Add actionable error CTA (“Retry load”, “Open diagnostics”).
- Harmonize breadboard visual language with global tokens.

Metrics: `1600x761`, `145.4KB`, `ocr=698`, `edge_density=0.0305`, `mean_lum=21.7`, `std_lum=25.4`, `pHash=e75aad5abd585084`.

### 04-pcb.png
PCB layout canvas appears empty with boundary frame only.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fail | Pass | Pass | Fail | Fail | Pass | Fail | Fail | Fail | Pass | Fail | Pass | NA | Fail | NA |

Top issues:
- High: No explicit empty-state guidance or next action.
- Medium: Toolbar meaning unclear without labels.

Recommendations:
- Add empty-state block with “Import PCB footprint” / “Generate from schematic”.
- Add tooltip labels on toolbar icons.

Metrics: `1600x761`, `125.3KB`, `ocr=736`, `edge_density=0.0227`, `mean_lum=21.1`, `std_lum=15.6`, `pHash=d22d2d3d257c545c`.

### 04-schematic.png
Schematic canvas with duplicated component symbols and parts panel.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Pass | Fail | Fail | Pass | NA | NA | Pass | Fail | Pass | NA | Fail | NA |

Top issues:
- Medium: Component symbol style differs from architecture cards.
- Medium: Large unused whitespace with minimal guidance.

Recommendations:
- Align symbol cards and tokens with architecture component style.
- Add quick-start hints for wiring actions.

Metrics: `1600x761`, `129.3KB`, `ocr=434`, `edge_density=0.0272`, `mean_lum=45.5`, `std_lum=78.9`, `pHash=966969868696d679`.

### 05-add-item-modal.png
Add BOM Item modal over procurement table.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Pass | Fail | Pass | Pass | Pass | Fail | Pass | Pass | Pass | NA | Fail | Pass |

Top issues:
- Medium: Missing visible inline validation in required fields.
- Medium: Placeholder text contrast is low.

Recommendations:
- Add per-field validation feedback and error text.
- Raise placeholder color token to AA-compliant contrast.

Metrics: `1600x761`, `142.6KB`, `ocr=275`, `edge_density=0.0163`, `mean_lum=5.0`, `std_lum=14.0`, `pHash=99a633992699d966`.

### 05-procurement-inline-edit.png
Procurement table with one row in inline edit mode.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | Pass | NA | Pass | Fail | Fail | NA | Fail | Pass |

Top issues:
- High: Edit state is too subtle (pHash identical to non-edit frame).
- Medium: Dense row content with narrow columns causes clipping risk.

Recommendations:
- Add bold edit strip/background and explicit “Editing row” label.
- Increase column min widths for part/manufacturer fields.

Metrics: `1600x761`, `157.1KB`, `ocr=0`, `edge_density=0.0333`, `mean_lum=13.1`, `std_lum=20.6`, `pHash=a796bcb4847c51c9`.

### 05-procurement.png
Procurement table default state with cost summary and actions.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | NA | NA | Pass | Fail | Fail | NA | Fail | Pass |

Top issues:
- High: Table legibility at scale is weak (thin text, low contrast).
- Medium: Supplier values wrap unevenly, hurting scan speed.

Recommendations:
- Increase row text size/contrast and spacing.
- Add column-level truncation rules with hover reveal.

Metrics: `1600x761`, `157.5KB`, `ocr=0`, `edge_density=0.0316`, `mean_lum=12.8`, `std_lum=20.3`, `pHash=a796bcb4847c51c9`.

### 06-output.png
Output console view with log lines and filter field.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Pass | Fail | Pass | Pass | Pass | NA | Pass | Pass | Pass | NA | Fail | NA |

Top issues:
- Medium: Control icons and subtle labels are low contrast.
- Low: Empty lower area lacks suggested actions.

Recommendations:
- Raise icon/secondary label contrast in console toolbar.
- Add quick command chips when log count is low.

Metrics: `1600x761`, `107.4KB`, `ocr=0`, `edge_density=0.0222`, `mean_lum=11.3`, `std_lum=15.8`, `pHash=efc1a1d5845c547c`.

### 06-validation.png
Validation list state similar to initial validation screen.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | Pass | Pass | Pass | Fail | Pass | NA | Fail | Pass |

Top issues:
- High: Low contrast in long table sections.
- Medium: High cognitive load due repeated issue rows.

Recommendations:
- Add issue grouping, sticky severity filters, and row badges.
- Increase line-height/contrast of subtext.

Metrics: `1600x761`, `178.0KB`, `ocr=0`, `edge_density=0.0354`, `mean_lum=13.9`, `std_lum=23.8`, `pHash=e7b2b2b690c44d4d`.

### 07-chat-settings.png
Output screen with AI settings drawer open on the right.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Pass | Pass | NA | NA | Pass | Fail | Pass | NA | Fail | Pass |

Top issues:
- High: Form labels, helper text, and sliders are low contrast.
- Medium: Drawer density is high for credential + tuning inputs.

Recommendations:
- Increase contrast on labels/helper copy and sliders.
- Split AI settings into sections with progressive disclosure.

Metrics: `1600x761`, `121.2KB`, `ocr=0`, `edge_density=0.0253`, `mean_lum=12.2`, `std_lum=19.0`, `pHash=add0c1a956ac3c5e`.

### 08-login.png
404 not found page appears instead of login flow.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fail | Pass | Pass | Fail | Fail | Fail | Fail | Pass | Pass | Fail | Pass | Pass | NA | Fail | Fail |

Top issues:
- Critical: Login route is broken (404).
- High: No recovery CTA (Home, Retry, Sign in).
- High: Theme and affordance mismatch with core product.

Recommendations:
- Restore login route and provide fallback CTAs on 404.
- Use app-consistent auth error templates.

Metrics: `1600x761`, `30.1KB`, `ocr=0`, `edge_density=0.0018`, `mean_lum=241.6`, `std_lum=43.6`, `pHash=e686993966c69999`.

### 08-project-settings.png
Output view with project settings expanded in lower left sidebar.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Fail | Fail | Fail | Fail | Pass | Pass | NA | NA | Pass | Fail | Pass | NA | Fail | Pass |

Top issues:
- Medium: Sidebar becomes crowded and visually cramped.
- Medium: Settings fields have weak readability.

Recommendations:
- Move project settings to dedicated panel/modal.
- Increase spacing and field contrast in sidebar settings.

Metrics: `1600x761`, `107.7KB`, `ocr=0`, `edge_density=0.0226`, `mean_lum=11.4`, `std_lum=15.6`, `pHash=efc1a1d6841c5c7c`.

### A1-initial-load.png
Architecture screen initial loading state with spinner on empty canvas.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fail | Pass | Pass | Fail | Fail | Pass | Fail | Pass | Pass | Pass | Fail | Pass | NA | Fail | NA |

Top issues:
- High: Loading state lacks contextual status and expected duration.
- Medium: No fallback action if loading stalls.

Recommendations:
- Add message + progress semantics (“Loading architecture nodes…”).
- Provide retry/open logs CTA when load exceeds threshold.

Metrics: `1600x761`, `129.8KB`, `ocr=0`, `edge_density=0.0180`, `mean_lum=10.3`, `std_lum=14.9`, `pHash=afa1af85c554d740`.

### A3-sidebar-collapsed.png
Architecture view variant with collapsed sidebar and asset panel open.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass | Pass | Pass | Fail | Fail | Fail | Fail | NA | NA | Pass | Pass | Pass | NA | Fail | NA |

Top issues:
- High: Collapsed sidebar behavior drifts from earlier variant.
- Medium: Icon-only controls increase recall burden.

Recommendations:
- Standardize collapsed sidebar component tokens and behavior.
- Add label-on-hover and keyboard navigable landmarks.

Metrics: `1600x761`, `167.8KB`, `ocr=0`, `edge_density=0.0231`, `mean_lum=19.4`, `std_lum=17.5`, `pHash=d6adad2139745456`.

### C-architecture-view.png
Architecture variant appears mostly empty/dim despite shell and asset panel.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fail | Pass | Pass | Fail | Fail | Fail | Fail | Fail | Fail | Pass | Fail | Pass | NA | Fail | NA |

Top issues:
- High: Missing visible diagram content without explanatory empty state.
- Medium: Reduced contrast and sparse context make intent ambiguous.

Recommendations:
- Add empty-state with “Add first component” CTA and sample templates.
- Ensure canvas content fallback rendering is resilient.

Metrics: `1777x845`, `154.5KB`, `ocr=0`, `edge_density=0.0204`, `mean_lum=16.1`, `std_lum=15.9`, `pHash=d1d525f536c47ac0`.

### H-procurement-view.png
Procurement variant with visible seam/duplicated viewport capture.

| VH | AG | SS | TH | CC | CS | IA | FB | ESL | NAV | CDS | TO | TT | AC | TS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fail | Fail | Fail | Fail | Fail | Fail | Pass | NA | NA | Fail | Fail | Fail | NA | Fail | Pass |

Top issues:
- High: Screenshot artifact (duplicated viewport) masks actual UI quality.
- Medium: Navigation/location cues become ambiguous due seam.

Recommendations:
- Re-capture with locked viewport and single-frame capture script.
- Add screenshot QA gate before storing evidence.

Metrics: `1777x845`, `206.4KB`, `ocr=0`, `edge_density=0.0393`, `mean_lum=13.8`, `std_lum=23.2`, `pHash=b7c1963d922cda49`.

## Consistency / Drift Analysis
### Components Varying Without Clear Rationale
- Sidebar collapsed patterns differ significantly between `01-sidebar-collapsed.png` and `A3-sidebar-collapsed.png` (pHash distance 28), suggesting version/style drift.
- Procurement inline-edit vs default views are visually near-identical (`05-procurement-inline-edit.png` vs `05-procurement.png`, pHash distance 0), reducing affordance clarity.
- Output and project-settings captures are near-duplicates (`06-output.png` vs `08-project-settings.png`, distance 4), indicating settings may be under-signaled.

### Token Drift
- Contrast drift: secondary text and placeholder readability varies across views.
- Surface depth drift: modal/card overlays (generate/package, add BOM) use inconsistent darkness and border emphasis.
- Spacing drift: sidebar settings and table rows use tighter spacing than editor forms.

### Style Mismatches
- `08-login.png` is a light 404 page, breaking dark-shell continuity.
- `04-breadboard.png` introduces a distinct visual style and error block treatment not aligned to other editors.
- `H-procurement-view.png` indicates screenshot pipeline mismatch rather than design intent.

## Coverage Matrix

### States x Viewports
| View | Default | Selected | Inline Edit | Modal | Loading | Error | Empty | Collapsed Sidebar | Full Sidebar | Desktop | Mobile | Tablet |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Architecture | Yes | Yes | NA | NA | Yes (`A1`) | NA | Partial (`C`) | Yes | Yes | Yes | No | No |
| Component Editor | Yes | NA | NA | Yes (`03-generate-modal`) | NA | NA | NA | NA | NA | Yes | No | No |
| Schematic | Yes | NA | NA | NA | NA | NA | Partial (sparse) | NA | NA | Yes | No | No |
| Breadboard | Yes | NA | NA | NA | NA | Yes (toast) | NA | NA | NA | Yes | No | No |
| PCB | Yes | NA | NA | NA | NA | NA | Yes (implicit, weak) | NA | NA | Yes | No | No |
| Procurement | Yes | NA | Yes | Yes (`05-add-item-modal`) | NA | NA | NA | NA | NA | Yes | No | No |
| Validation | Yes | NA | NA | NA | NA | Yes (issue rows) | NA | Yes | Yes | Yes | No | No |
| Output | Yes | NA | NA | Settings Drawer | NA | NA | Partial (sparse logs) | NA | NA | Yes | No | No |
| Login/Auth | No (broken route) | NA | NA | NA | NA | Yes (`404`) | NA | NA | NA | Yes | No | No |

### Missing Coverage Flags
- Hover/focus/disabled states: Missing.
- Mobile/tablet responsive captures: Missing.
- Form validation error states: Largely missing.
- Confirm/danger flow captures: Missing.

## Issue Ledger
| ID | Severity | Evidence | Finding | Recommendation | Effort |
|---|---|---|---|---|---|
| UI-001 | Critical | `08-login.png` | Login route resolves to 404. | Fix route; add auth fallback and recovery CTAs. | 2-4h |
| UI-002 | High | `00-initial-state.png`, `06-validation.png`, `05-procurement.png` | Low contrast secondary text/metadata in dark theme. | Update color tokens for body/secondary text and borders to AA targets. | 6-10h |
| UI-003 | High | `05-procurement-inline-edit.png`, `05-procurement.png` | Inline edit mode not visually distinct (pHash distance 0). | Add explicit edit row styling + label + sticky actions. | 3-5h |
| UI-004 | High | `04-pcb.png`, `C-architecture-view.png`, `A1-initial-load.png` | Weak empty/loading state guidance. | Add reusable empty/loading components with primary CTA. | 6-8h |
| UI-005 | High | `01-sidebar-collapsed.png`, `A3-sidebar-collapsed.png` | Collapsed sidebar icon-only navigation hurts discoverability. | Add tooltips/labels and standardized collapsed behavior. | 4-6h |
| UI-006 | Medium | `05-procurement.png`, `06-validation.png` | Dense tabular content slows scanning. | Add row grouping, zebra striping, sticky filters, density toggle. | 6-10h |
| UI-007 | Medium | `07-chat-settings.png` | AI settings panel overloads right rail and mixes tasks. | Split into sections and progressive disclosure. | 4-6h |
| UI-008 | Medium | `08-project-settings.png` | Sidebar settings are cramped and low-emphasis. | Move to dedicated settings surface with larger controls. | 6-12h |
| UI-009 | Medium | `04-breadboard.png` | Error toast lacks clear remediation action. | Provide action buttons and links to diagnostics. | 2-4h |
| UI-010 | Medium | `03-component-editor.png`, `05-add-item-modal.png` | Validation/error states not visible in forms. | Add inline validation and accessible error messaging patterns. | 4-8h |
| UI-011 | Medium | `H-procurement-view.png` | Screenshot evidence contains seam/duplication artifact. | Enforce deterministic capture pipeline and QA checks. | 2-3h |
| UI-012 | Low | All screenshots | PNG files have large optimization potential in docs artifacts. | Optional CI image compression for docs/reporting assets. | 2-3h |

## Prioritized Action Plan
### Quick Wins (High Impact, Low Effort)
1. Fix login route and add 404 recovery actions.
2. Improve contrast tokens for secondary text, placeholders, and table headers.
3. Make procurement inline edit state clearly visible.
4. Add tooltip labels for icon-only collapsed navigation.

### Medium-Term Improvements
1. Introduce reusable empty/loading/error state components for canvas views.
2. Refactor validation/procurement tables for scanability (density toggle, grouping, sticky filters).
3. Rework AI settings and project settings into clearer, less compressed layouts.

### Long-Term Enhancements
1. Define and enforce a full design token system (contrast tiers, spacing scale, focus ring spec).
2. Add responsive variants (mobile/tablet) and capture them in audit baseline.
3. Build visual regression pipeline with normalized viewport, state scripts, and per-view golden references.

## Action Plan
1. Week 1: Critical path (auth route, contrast token patch, inline-edit visibility).
2. Week 2: State-pattern rollout (empty/loading/error components + table scanability updates).
3. Week 3+: System hardening (responsive variants, visual regression automation, token governance).

## Code Examples
Top 10 implementation-oriented snippets (React + Tailwind token style, aligned with project stack):

### 1) Stronger Dark Theme Text Tokens
```css
:root {
  --bg-canvas: #05080f;
  --bg-surface: #0b1220;
  --text-primary: #e8f1ff;
  --text-secondary: #a8bbd6;
  --text-muted: #7f93b0;
  --border-subtle: #223149;
  --focus-ring: #16d9ff;
}
```

### 2) Focus Visible Pattern (WCAG 2.2)
```tsx
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05080f]">
  Run DRC Checks
</button>
```

### 3) Reusable Empty State Component
```tsx
export function EmptyState({ title, detail, cta }: { title: string; detail: string; cta?: React.ReactNode }) {
  return (
    <section className="mx-auto mt-16 max-w-lg rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </section>
  );
}
```

### 4) Inline Edit Emphasis for Procurement Row
```tsx
<tr className={isEditing ? "bg-cyan-950/40 ring-1 ring-cyan-400/60" : ""}>
  {/* cells */}
  {isEditing && <td className="text-xs text-cyan-300">Editing</td>}
</tr>
```

### 5) Table Header/Row Scanability
```tsx
<thead className="sticky top-0 bg-[#0d1626] text-[11px] uppercase tracking-wide text-[#b7c9e4]">
```

### 6) Collapsed Sidebar with Label Tooltips
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button aria-label="Validation" className="h-9 w-9">...</button>
  </TooltipTrigger>
  <TooltipContent side="right">Validation</TooltipContent>
</Tooltip>
```

### 7) Loading State with Timeout Fallback
```tsx
{isLoading ? (
  <EmptyState
    title="Loading Architecture"
    detail="Fetching nodes and connections..."
    cta={isSlow ? <button onClick={refetch}>Retry</button> : undefined}
  />
) : children}
```

### 8) Form Validation Message Pattern
```tsx
{error?.partNumber && (
  <p id="partNumber-error" className="mt-1 text-xs text-rose-300">
    Part number is required and must be at least 3 characters.
  </p>
)}
```

### 9) Not-Found Recovery Screen
```tsx
<section className="mx-auto mt-24 max-w-md rounded-lg border border-rose-500/40 bg-[#111827] p-6">
  <h1 className="text-xl font-semibold text-white">Page Not Found</h1>
  <p className="mt-2 text-sm text-slate-300">We couldn't find that route. Return to your workspace or sign in again.</p>
  <div className="mt-4 flex gap-2">
    <Link to="/">Go to Workspace</Link>
    <Link to="/auth/login">Sign In</Link>
  </div>
</section>
```

### 10) Capture QA Guard (for screenshot tooling)
```ts
if (imageHasViewportSeam(pngBuffer)) {
  throw new Error("Screenshot capture failed QA: seam artifact detected");
}
```

## Mockups

### Before (Current Pattern)
```text
+---------------------------------------------------------------+
| Top tabs                                                      |
+------+---------------------------------------+----------------+
| Left | Main content (dense/low contrast)     | Right AI panel |
| nav  |                                       | always open     |
+------+---------------------------------------+----------------+
```

### After (Improved Task Focus)
```text
+---------------------------------------------------------------+
| Top tabs + context actions                                    |
+------+-----------------------------------------------+--------+
| Left | Main content with stronger hierarchy           | AI     |
| nav  | - clear headings                              | panel  |
|      | - grouped table sections                      | toggle |
|      | - empty/loading/error helper blocks           |        |
+------+-----------------------------------------------+--------+
```

### Table Row Editing (Target)
```text
[STATUS] [PART] [MFG] [DESC] [QTY] [PRICE] [TOTAL] [ACTIONS]
<normal row>
<EDITING ROW: cyan tint + "Editing" badge + save/cancel pinned>
```

## Design Token Harvest
Suggested token set inferred from repeated patterns:

| Token | Suggested Value | Rationale |
|---|---|---|
| `--color-bg-canvas` | `#05080f` | Primary dark workspace background |
| `--color-bg-surface` | `#0b1220` | Panels/modals/tables |
| `--color-border-subtle` | `#223149` | Card and field boundaries |
| `--color-text-primary` | `#e8f1ff` | Main readable text |
| `--color-text-secondary` | `#a8bbd6` | Body secondary copy |
| `--color-text-muted` | `#7f93b0` | Meta labels |
| `--color-accent` | `#16d9ff` | Active tab/button/focus |
| `--color-success` | `#17d98a` | In-stock/success |
| `--color-warning` | `#f5c451` | Warning badges |
| `--color-danger` | `#ff4d6d` | Critical/error |
| `--space-1` | `4px` | Micro gaps |
| `--space-2` | `8px` | Control spacing |
| `--space-3` | `12px` | Tight content blocks |
| `--space-4` | `16px` | Default section spacing |
| `--space-6` | `24px` | Panel padding |
| `--radius-sm` | `6px` | Inputs/chips |
| `--radius-md` | `10px` | Cards/modals |
| `--font-size-body` | `14px` | Dense desktop readability baseline |
| `--font-size-meta` | `12px` | Meta labels (with increased contrast) |

## Appendix

### Color Contrast Notes
- Many critical screens returned `ocr_chars=0`, which often correlates with low-contrast text recognition on dark UIs.
- `mean_lum` for most screens is between `5.0` and `21.7`, indicating uniformly dark surfaces that require stronger foreground contrast discipline.
- `08-login.png` is a luminance outlier (`mean_lum=241.6`) and visually inconsistent with the rest of the app.

### Typography Scale Analysis
- Observed effective scale appears clustered around tiny labels + body text without enough separation.
- Recommendation baseline:
  - Title: `24px/32px`
  - Section heading: `18px/24px`
  - Body: `14px/20px`
  - Meta labels: `12px/16px` (higher contrast than current)

### Component Inventory (Observed)
- Shell: top nav tabs, left project explorer, right AI assistant panel.
- Data surfaces: validation table, procurement BOM table, output console.
- Editors: architecture canvas, schematic canvas, PCB canvas, breadboard canvas, component form editor.
- Overlays: add-item modal, generate-package modal, settings drawer, toast error.
- Auth/error: 404 not-found view (in place of login).

### Accessibility Checklist (Static-Evidence Based)
- Text contrast: Failing in many secondary/muted areas.
- Keyboard focus visibility: **Unverified** in screenshots; likely insufficient contrast.
- Target size for icon controls: **Unverified** for pointer/touch compliance.
- Label associations and form errors: partially visible; robust ARIA/error associations **Unverified**.
- Semantic status cues (color + icon/text): partially present in validation/procurement.

### Evidence Artifacts
- Derived artifacts path: `/tmp/ui-audit`
- Files include per-image:
  - `.identify.txt`, `.exif.txt`, `.pngcheck.txt`, `.ocr.txt`, `.metrics.txt`, `.phash.txt`
  - optimized copies `.png` and `.quant.png`
- Summary table source: `/tmp/ui-audit/metrics.tsv`
