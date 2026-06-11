import re
import glob

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

p0 = read_file("tmp-analysis-for-read/phase-0-metrics.md")
p1_rep = read_file("tmp-analysis-for-read/phase-1-report.md")
p1_chk = read_file("tmp-analysis-for-read/phase-1-checklist.md")
p2_rep = read_file("tmp-analysis-for-read/phase-2-report.md")
p2_chk = read_file("tmp-analysis-for-read/phase-2-checklist.md")
p3_rep = read_file("tmp-analysis-for-read/phase-3-report.md")
p3_chk = read_file("tmp-analysis-for-read/phase-3-checklist.md")
p4_rep = read_file("tmp-analysis-for-read/phase-4-report.md")
p4_chk = read_file("tmp-analysis-for-read/phase-4-checklist.md")
p5_rep = read_file("tmp-analysis-for-read/phase-5-report.md")
p5_chk = read_file("tmp-analysis-for-read/phase-5-checklist.md")
cross = read_file("tmp-analysis-for-read/cross-phase-notes.md")

exec_summary = """ProtoPulse occupies a unique niche as a browser-based, AI-first EDA platform designed to bridge the gap from system-level architecture to board manufacturing. While it boasts a formidable array of 78 AI tools and multi-model AI orchestration, it currently suffers from a lack of production-level EDA capabilities and severe architectural complexity that blocks feature development.

**Top 3 Strengths:**
1. **AI Action Breadth:** An unmatched 78-action AI system with native tool use across the entire design lifecycle.
2. **Architecture-First Workflow:** Novel, node-based system architecture diagramming via `@xyflow/react` that precedes schematic capture.
3. **Dual AI Strategy:** Integrates both Anthropic and Gemini with multiple routing strategies to optimize for cost, quality, and speed.

**Top 3 Critical Issues:**
1. **Extreme Complexity Hotspots:** Functions like `PCBLayoutView` reaching a Cyclomatic Complexity (CCN) of 135 (9x the danger threshold of 15) and `ShapeCanvas` totaling CCN=381, halting safe feature scaling. (TDR > 20% locally)
2. **Fabricated Sourcing Data:** The BOM procurement tools currently rely entirely on AI-simulated stock and pricing, misleading users with fabricated data.
3. **Foundational Gaps:** Lacking a true PCB layout engine with copper routing, 3D mechanical fit viewer, and professional design import support (KiCad/Altium).

**Highest Impact Opportunity:**
- **Generative "Circuits-as-Code" (IN-01):** By leveraging the `@tscircuit` ecosystem, ProtoPulse could allow AI and engineers to define schematics and layouts declaratively, offering a massive leapfrog over traditional GUI-bound competitors.

**Recommended Priority for Next 30/60/90 Days:**
- **30 Days (Stabilize & Enable):** Refactor the most critical complexity hotspots (TD-01 `PCBLayoutView`, TD-04 `ShapeCanvas`, TD-07 `ProjectProvider`) and integrate real supplier APIs for BOM pricing (EN-13) to restore system trust and enable safe expansion.
- **60 Days (Table-Stakes Parity):** Implement a baseline PCB layout routing engine (FG-01) and design import capabilities for KiCad/Eagle/Altium (FG-22).
- **90 Days (Collaborative Edge):** Develop Real-time Multi-user Collaboration (IN-05 / FG-06) enabled by the prerequisite multi-project support and context decomposition."""

cross_phase = """### 1. Impact Chains (Cause & Effect)
- **TD-07 (Monolithic Context) → UI Sluggishness → UX Abandonment:** The monolithic `ProjectProvider` context funneling 40+ values causes a re-render storm across the entire application on any state change. This causes visible UI jank during AI generation and slow tab switching, creating a sluggish feel that will frustrate professionals and drive them to responsive desktop clients.
- **TD-01 (PCBLayoutView CCN=135) → FG-01 Blocked → Competitive Disadvantage:** The cyclomatic complexity of `PCBLayoutView` is at 135 (against a 2026 industry benchmark of 15-20). Adding production-ready features like copper routing or DRC to this file is impossible without breaking existing functionality, directly blocking the most critical competitive gap (PCB Layout), without which users cannot actually manufacture boards.
- **AI-Simulated Procurement (State Gap) → EN-13 (P0 Recalibration) → User Trust Loss:** Phase 1 revealed that pricing, stock, and lead times are 100% fabricated by the AI without real API connections. For hardware startups, sourcing incorrect components is a fatal flaw. This state reality demands EN-13 (Real supplier APIs) be elevated to P0, as fixing this restores basic product trust.

### 2. Risk Heatmap

| Module | Complexity | Change Freq | User Exposure | Overall Risk |
|---|---|---|---|---|
| `ShapeCanvas.tsx` | Critical (CCN=381) | High | High (Core Editor) | **EXTREME** |
| `PCBLayoutView.tsx` | Critical (CCN=135) | Medium | High (Core Workflow) | **CRITICAL** |
| `parseLocalIntent.ts` | High (CCN=102) | Low | High (Local AI Mode) | **HIGH** |
| `useActionExecutor.ts` | High (1299 LOC) | High | High (AI Chat) | **CRITICAL** |
| `export-generators.ts`| Medium (1209 LOC)| Low | High (Manufacturing) | **MEDIUM** |

### 3. Priority Recalibration
- **EN-13 (Supplier APIs):** Promoted from P1 to P0. You cannot simulate procurement data.
- **FG-22 (Design Import):** Promoted from P2 to P1. Professional engineers will not adopt an EDA tool without an import pathway from KiCad/Altium.
- **FG-01 (PCB Layout):** Still P0, but firmly placed behind **TD-01** (PCBLayoutView Refactor).

### 4. Bundled Work
- **Refactoring UI-11 (DRC Visualization):** Group with TD-01 and TD-04. Do not add visualization features until the underlying canvases are simplified.
- **Export Unification (UI-06 & FG-07/08/09):** Group with TD-10. Consolidate the dual export system before building out the unified export UI or expanding formats.

""" + cross

def extract_main_content(md, skip_h1=True):
    # Removes the first H1 header and meta tags if any, to keep hierarchy clean
    lines = md.split('\n')
    out = []
    for line in lines:
        if skip_h1 and line.startswith('# '):
            skip_h1 = False
            continue
        if line.startswith('> Generated') or line.startswith('> Refined') or line.startswith('> Competitors') or line.startswith('> Stack') or line.startswith('> Domain'):
            continue
        out.append(line)
    return '\n'.join(out).strip()

def extract_raw_outputs(p4):
    # Extract Raw Tool Outputs section
    if "## Raw Tool Outputs" in p4:
        return p4.split("## Raw Tool Outputs")[1].strip()
    return ""

def remove_raw_outputs(p4):
    if "## Raw Tool Outputs" in p4:
        return p4.split("## Raw Tool Outputs")[0].strip()
    return p4

report = f"""# rest-express -- Product Analysis Report

> Generated: 2026-05-17
> Stack: React 19.2.0 Express Drizzle ORM PostgreSQL Vite Tailwind Vitest
> Domain: EDA

## Baseline Metrics

{p0}

## Executive Summary

{exec_summary}

## Phase 1: Current State Inventory

{extract_main_content(p1_rep)}

## Phase 2: Competitive Gap Analysis

{extract_main_content(p2_rep)}

## Phase 3: UX & Workflow Evaluation

{extract_main_content(p3_rep)}

## Phase 4: Technical Debt & Architecture

{extract_main_content(remove_raw_outputs(p4_rep))}

## Phase 5: Feature Innovation

{extract_main_content(p5_rep)}

## Cross-Phase Analysis

{cross_phase}

## Appendix A: Methodology

5-phase product analysis using quantitative CLI tooling (scc, lizard, ast-grep, rg, fd)
combined with competitive research (trafilatura, WebSearch) and structural code analysis.
Analysis performed by specialized agents with cross-phase synthesis.

## Appendix B: Directory Structure

(Available in external directory structure logs)

## Appendix C: Tool Outputs

{extract_raw_outputs(p1_rep) or ''}
{extract_raw_outputs(p4_rep)}
"""

write_file("docs/product-analysis-report.md", report)

import re

def parse_checklist_items(text, prefix):
    items = []
    lines = text.split('\n')
    for line in lines:
        if line.startswith('- [ ] ' + prefix):
            items.append(line)
    return items

def sort_and_renumber(items, prefix):
    # Priority sorting P0 -> P3
    p0 = []
    p1 = []
    p2 = []
    p3 = []
    for item in items:
        if 'Priority: P0' in item or 'Priority: **P0' in item: p0.append(item)
        elif 'Priority: P1' in item or 'Priority: **P1' in item: p1.append(item)
        elif 'Priority: P2' in item: p2.append(item)
        elif 'Priority: P3' in item: p3.append(item)
        else: p3.append(item)
    
    sorted_items = p0 + p1 + p2 + p3
    out = []
    for i, item in enumerate(sorted_items):
        # replace the original ID like FG-XX with FG-New
        item = re.sub(r'- \[ \] ' + prefix + r'-\d+:', f'- [ ] {prefix}-{i+1:02d}:', item)
        out.append(item)
    return '\n'.join(out)

fg_items = parse_checklist_items(p2_chk, "FG")
ui_items = parse_checklist_items(p3_chk, "UI")
td_items = parse_checklist_items(p4_chk, "TD")

en_items_1 = parse_checklist_items(p1_chk, "EN")
en_items_4 = parse_checklist_items(p4_chk, "EN")
en_items = en_items_1 + en_items_4
# Filter out exact duplicates if any
en_unique = []
for item in en_items:
    # simple dedup by text ignoring the EN-xx id
    content = item.split(":", 1)[1] if ":" in item else item
    if content not in [u.split(":", 1)[1] if ":" in u else u for u in en_unique]:
        en_unique.append(item)

in_items = parse_checklist_items(p5_chk, "IN")

checklist = f"""# rest-express -- Product Analysis Checklist

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

## Feature Gaps (FG-)

{sort_and_renumber(fg_items, "FG")}

## UX Issues (UI-)

{sort_and_renumber(ui_items, "UI")}

## Tech Debt (TD-)

{sort_and_renumber(td_items, "TD")}

## Enhancements (EN-)

{sort_and_renumber(en_unique, "EN")}

## Innovations (IN-)

{sort_and_renumber(in_items, "IN")}
"""

write_file("docs/product-analysis-checklist.md", checklist)

print("Generated docs/product-analysis-report.md")
print("Generated docs/product-analysis-checklist.md")
print(f"FG: {{len(fg_items)}}, UI: {{len(ui_items)}}, TD: {{len(td_items)}}, EN: {{len(en_unique)}}, IN: {{len(in_items)}}")
