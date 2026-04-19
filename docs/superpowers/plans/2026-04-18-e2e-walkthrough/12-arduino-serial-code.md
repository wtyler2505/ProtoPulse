# Arduino + Serial Monitor + Circuit Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1/2 Arduino + Serial + Circuit Code findings. Preserve the audit-praised "Arduino readiness" trust receipt (E2E-342 — best visual in app) and serial device preflight (E2E-430). Fix label truncation (E2E-341), disable Verify/Upload until profile selected (E2E-027, E2E-343), demystify "Verify" terminology for beginners (E2E-345), fix SIMULATE sub-tab vs Simulation tab IA confusion (E2E-348), add `DTR/RTS` switch labels (E2E-434), custom baud rate (E2E-433).

**Tech Stack:** shadcn/ui Select + Switch, existing Arduino CLI MCP integration, Serial Web API or Tauri plugin (hardware POC).

**Parent:** Tier F. Depends on 16, 17.

## Coverage

Pass 1 Arduino: E2E-026-028 + E2E-051-052 tab-naming. Pass 2 Arduino: E2E-341-348. Pass 2 Serial: E2E-429-434. Circuit Code: minimal audit coverage (grep Pass 1).

## Existing Infrastructure

- `client/src/components/views/ArduinoWorkbenchView.tsx` (lazy)
- `client/src/components/panels/SerialMonitorPanel.tsx` (lazy)
- `client/src/components/views/CircuitCodeView.tsx` (lazy)

## Waves

### Wave 1 — Arduino
- [ ] Task 1.1 — Fix label truncation Board Manager / Serial Monitor sidebar (E2E-341): CSS `text-overflow: ellipsis` with `title={label}` for full on hover.
- [ ] Task 1.2 — Disable Verify/Upload until profile selected (E2E-027, E2E-343) — use `<Button disabledReason="Select a board profile first">` from 16.
- [ ] Task 1.3 — Verify tooltip (E2E-345): "Verify = compile sketch without uploading".
- [ ] Task 1.4 — Output panel example log on empty (E2E-344): pre-populate with "// Output will appear here after Verify or Upload".
- [ ] Task 1.5 — Icon-only header buttons get aria-labels (E2E-346) — consumed from 03 Phase 2.
- [ ] Task 1.6 — Keyboard shortcut hint for libraries panel (E2E-347).
- [ ] Task 1.7 — SIMULATE sub-tab rename/remove (E2E-348): "Simulate in-sketch" → rename to "Sketch Simulation" + hyperlink to Simulation tab. Or consolidate.
- [ ] Task 1.8 — Tests + commit.

### Wave 2 — Serial Monitor
- [ ] Task 2.1 — Switch labels above each toggle (E2E-434): tooltip or label-above DTR/RTS/Auto-scroll/Timestamps.
- [ ] Task 2.2 — Baud rate tooltip (E2E-432): "Baud rate = serial speed; 115,200 is most common for Arduino".
- [ ] Task 2.3 — Custom baud rate + hex/binary + RTS/DTR pulse (E2E-433).
- [ ] Task 2.4 — Tests + commit.

### Wave 3 — Circuit Code
- [ ] Task 3.1 — Audit Pass 1 Circuit Code findings (grep).
- [ ] Task 3.2 — Editor shortcuts documented.
- [ ] Task 3.3 — Tests + commit.

## Checklist

```
□ Prereqs: 16, 17 merged
□ check/test/lint/prettier clean
□ Playwright arduino-*, serial-*, circuit-code-* pass
```
