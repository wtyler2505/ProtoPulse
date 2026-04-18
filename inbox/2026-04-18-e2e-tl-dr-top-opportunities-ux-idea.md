---
name: E2E walkthrough — TL;DR — Top opportunities (UX/IDEA)
description: Frontend E2E findings for 'TL;DR — Top opportunities (UX/IDEA)' chunk from 2026-04-18 walkthrough. 6 E2E IDs; 1 🔴, 1 🟡, 1 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 1
  ux: 1
  idea: 1
  works: 0
  e2e_ids: 6
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## TL;DR — Top opportunities (UX/IDEA)

- **Inconsistent tab/route/heading naming** — Learn=knowledge, Inventory=storage, Tasks=kanban (E2E-053, E2E-276)
- **Trust receipt pattern is GOLD** — present in Sim/Order/Arduino/SerialMonitor; expand to Dashboard.
- **Card-click integration** — Calculator → Add to BOM / Apply to Component (E2E-283) is the killer pattern. Replicate everywhere.
- **API key gating** — many AI buttons enabled without key, will fail. Disable + tooltip universally.
- **Confidence labels paradox** — "Evidence strong" + "SETUP REQUIRED" sent contradictory signals (Sim, Order, Exports).

---


**Tester:** Claude (Chrome DevTools MCP, user perspective)
**Build:** main branch, dev server localhost:5000
**Account:** e2e_test_user / TestPass123!SecureE2E
**Project:** Blink LED (Sample) — id 30

Per Tyler: test every button, every workflow, every tab. Document everything — bugs, UX friction, ideas, enhancements.

Findings are tagged:
- 🔴 **BUG** — broken behavior
- 🟡 **UX** — friction or unclear
- 🟢 **IDEA** — enhancement opportunity
- ⚪ **OBS** — neutral observation

Each gets a stable ID `E2E-XXX` for backlog cross-ref.

**Sweep methodology disclosure:** Findings E2E-001 through E2E-200 are largely from a fast first-pass coverage sweep — they enumerate surface but were not all individually click-verified. Findings E2E-201+ are baby-step verified (real DevTools click, snapshot diff, observed result). Anything tagged "GLANCED" should be re-verified before action. Method discriminator going forward: a button is "works" iff a real DevTools click produces a user-visible state change (DOM diff, URL change, toast, dialog, focus-trap).

---

