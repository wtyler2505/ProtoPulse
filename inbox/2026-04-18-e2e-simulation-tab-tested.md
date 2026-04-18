---
name: E2E walkthrough — Simulation tab — TESTED
description: Frontend E2E findings for 'Simulation tab — TESTED' chunk from 2026-04-18 walkthrough. 4 E2E IDs; 0 🔴, 1 🟡, 2 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_none
severity_counts:
  p1_bug: 0
  ux: 1
  idea: 2
  works: 0
  e2e_ids: 4
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Simulation tab — TESTED

URL `/projects/30/simulation`. SPICE simulation panel.

Sections: Release Confidence, Trust Receipt, Analysis Type (DCOP/Transient/AC/DC Sweep), Parameters, Probes, Corners, Run, Results, SPICE Import, Result History, Presets, Scenario Panel.

Confidence: "Guided build candidate — Evidence partial". Top blockers listed: BOM empty, no architecture nodes, no connections. Next actions enumerated.

### Simulation findings

- **E2E-045 ⚪ OBS** — Trust receipt + release confidence pattern is consistently strong across Simulation/Ordering. This is a real ProtoPulse differentiator.
- **E2E-046 🟡 UX** — `Start Simulation` button is enabled even though "SETUP REQUIRED" + "no circuit design selected" — clicking will surely fail. Should disable until circuit selected.
- **E2E-047 🟢 IDEA** — Analysis Type cards have good descriptions; could add "Recommended for: blink LED → DCOP" hint based on project type.
- **E2E-048 🟢 IDEA** — Add "Compare with previous run" diff view for waveforms.

### Edge cases
- Run sim with circular dependency in nets
- AC analysis with no signal source
- Transient with infinite step
- Probe a non-existent net
- Result history > 100 runs (pagination)

---

