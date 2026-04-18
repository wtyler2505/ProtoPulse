---
name: E2E walkthrough — Learn (knowledge) tab — TESTED
description: Frontend E2E findings for 'Learn (knowledge) tab — TESTED' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 0 🔴, 2 🟡, 3 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 0
  ux: 2
  idea: 3
  works: 0
  e2e_ids: 5
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Learn (knowledge) tab — TESTED

URL `/projects/30/knowledge`. Electronics Knowledge Hub — 20 articles. Cards: Resistors / Capacitors / Inductors / Diodes / Transistors / MOSFETs / Voltage Regulators / Voltage Dividers / Pull-Up & Pull-Down / Decoupling Caps / H-Bridges / RC-LC Filters / Op-Amps / ADC-DAC / I2C / etc.

Difficulty badges: Beginner / Intermediate.

### Learn findings

- **E2E-053 🟡 UX** — Naming: tab labeled "Learn" but URL is `/knowledge` and h2 says "Electronics Knowledge Hub". Three different names for same thing — pick one.
- **E2E-054 🟢 IDEA** — Only 20 articles vs Vault has 675 atomic notes. "Learn" should integrate with vault — show featured vault MOCs as additional learning paths.
- **E2E-055 🟢 IDEA** — No "Mark as read" / progress tracking. For a learn-tab to drive user growth, gamify completion (badges, streaks).
- **E2E-056 🟢 IDEA** — Cards show "+2", "+3" tag overflow but no tooltip showing the additional tags on hover.
- **E2E-057 🟡 UX** — All articles look like reference docs. Add tutorials format ("Build your first divider in 5 minutes").

### Edge cases
- Filter by category that has 0 articles
- Search with special regex chars
- Read article on offline
- Article with broken external link

---

