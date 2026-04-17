# Breadboard Workflow Playbook

## The Product Standard

Breadboard Lab must feel like **one continuous maker workflow**, not a set of disconnected features. A user should be able to walk this path without confusion:

```
open tab → see board + starter shelf → pick intent (starter / project / exact-part)
       → drop part → see trust label → wire it → see connectivity highlighted
       → see DRC/audit feedback → apply coach suggestion → mark reconciled →
       → flip to schematic / validation / inventory with coherent state
```

Any step that **breaks flow** (needs guessing, needs reading docs, needs context from elsewhere) is a bug — even if every component works in isolation.

## Preferred Implementation Order

### A. Surface Before Inventing

**Before adding a new feature**, check the existing surface:

1. Is there a pure-lib helper that already computes what you need?
   ```
   grep -rn "functionName\|featureKeyword" client/src/lib/breadboard-*.ts client/src/lib/circuit-editor/*.ts
   ```
2. Is there a dialog mounted but under-signposted from `BreadboardView.tsx`?
3. Is there a child panel whose props support what you want but aren't passed?
4. Are there tests that already exercise logic proving the feature exists?

**Example that bit us:** `BreadboardExactPartRequestDialog` existed for weeks before it was wired to the sidebar's "request exact part" button. The fix was one prop passthrough, not a new component.

### B. Clarify Provenance

A user should always be able to tell **where content came from**:

| Origin | Visual cue | Copy example |
|---|---|---|
| Starter shelf | Plain outline + "starter" tag | "Generic 10kΩ resistor (starter)" |
| Project shelf | Project-scoped icon + project name | "From: LED Driver V2" |
| Verified exact board | Green shield + MPN + vendor | "Arduino Uno R3 · Arduino" |
| Candidate/draft | Yellow dashed outline | "Draft: unverified connector map" |
| Coach suggestion | Coach-purple border + pulse | "Coach suggests…" |
| Schematic sync | Two-arrow sync icon | "Synced from schematic" |

**Never let different origins collapse into the same label.** A user debugging a wiring bug needs to know if the pin map came from the datasheet (verified-exact) or inferred by the system (heuristic).

### C. Strengthen Readiness

Every Breadboard workflow should reinforce: **"Can I build this right now, and can I trust it?"**

Readiness inputs:
- **Stash truth** — Does the BOM part exist in the user's inventory? See `server/storage/bom.ts:getShortfalls()` + `shared/parts/shortfall.ts`.
- **Part trust** — Verified-exact > connector-defined > heuristic > stash-absent. See `breadboard-bench.ts`.
- **Layout quality** — Are rails balanced? Are signal paths short? Are decouplers adjacent? See `breadboard-layout-quality.ts`.
- **Board-health issues** — Any unresolved violations? See `breadboard-board-audit.ts`.
- **Coach coverage** — Does the coach have a plan for this selected part?

These should all roll up to **one blended readiness signal** visible without panning. If it degrades (score drops, issue count rises), the user needs to see which input changed.

### D. Keep View Coherence

Breadboard is not isolated. When a breadboard change changes meaning across views:

| If you change... | Verify these still agree |
|---|---|
| A placement location | Schematic instance reference, BOM line item, validation status |
| A wire | Schematic net, DRC overlay, connectivity overlay |
| A part identity (exact-part upgrade) | BOM MPN, inventory, schematic refdes |
| A trust label | Coach plan, audit score, AI prompt context, shopping list |
| An audit issue | DRC overlay fires at the right coordinates |
| A stash quantity | Shortfall display, preflight gate, shopping list |

If any disagree after your change, the change isn't done.

## Concrete UX Heuristics (With Failing Counter-Examples)

### Good Breadboard UI...

**Teaches without lecturing.**
- ✅ Red rail = VCC, blue/black = GND — shown via single tooltip on hover
- ❌ Long paragraph in a sidebar explaining breadboard rail theory

**Distinguishes exact from approximate.**
- ✅ NodeMCU ESP32-S has green shield + "Verified · 2.3mm spacing" subtitle
- ❌ Generic "ESP32 module" placed the same way with no indication of fit risk

**Helps users recover from risky wiring.**
- ✅ DRC flags "I2C pull-up missing" + "Add 4.7kΩ from SDA to VCC" button
- ❌ DRC flags a red warning icon with hover text the user has to find

**Stays calm at both extremes.**
- ✅ Empty board: shows starter shelf prominently, coach waits
- ✅ Crowded board: audit surfaces top-3 issues, coach picks one step
- ❌ Empty board shows errors because nothing is placed yet
- ❌ Crowded board drowns the user in every possible rule violation

**Prioritizes the next practical move.**
- ✅ Coach says: "Place a 100nF decoupling cap near U1 VCC"
- ❌ Coach says: "Consider reviewing your power distribution strategy"

### Bad Breadboard UI...

- **Makes users infer the workflow model.** If the starter shelf isn't visible on an empty board, a beginner doesn't know where to start.
- **Hides high-value systems.** If board audit lives behind a collapsed accordion, it won't get used.
- **Looks realistic but doesn't improve understanding.** A photorealistic wire that connects to the wrong hole is worse than a schematic line to the right hole.
- **Exposes raw issue data without actions.** "DRC-ERR-042" is not an actionable message.

## The 5-Second Rule

**A new user should figure out their first action within 5 seconds of opening the tab.**

If they can't, one of these is wrong:
- The empty-state is too empty (no starter shelf visible)
- The starter shelf is mounted but not prominently surfaced
- The intake question ("Which board do you have?") never fires
- The canvas looks complete when it's actually empty

## Workflow-By-Intent Recipes

### "Beginner wants to light an LED"

1. Empty board → `BreadboardQuickIntake` fires → user picks "Arduino Uno + LED"
2. Starter shelf auto-populates with: Uno, 10kΩ resistor, LED, jumper wires
3. User drags Uno → snaps to board with verified-exact footprint
4. Drags LED → snap preview shows correct orientation hint
5. Drags resistor → placed in series with LED
6. Coach overlay: "Wire: 5V → resistor → LED anode → LED cathode → GND"
7. User completes wires → DRC clean → audit 0 issues → preflight "Ready to build"

**If ANY step breaks, the skill failed.** Fix that step first.

### "Maker wants to wire a ZS-X11H BLDC controller"

1. User types "ZS-X11H" in exact-part dialog
2. Resolver → `shared/verified-boards/riorand-kjl01.ts` (KJL-01 is related; ZS-X11H is a sibling)
3. Part-inspector: verified-exact, shows hall-sensor wiring order claim from vault
4. User places it as a **bench part** (off-board) — ZS-X11H is too large for breadboard
5. Wires go from bench-pin endpoints to breadboard holes
6. Coach surfaces: "Stop = active-low, Brake = active-high" (from `knowledge/bldc-stop-active-low-brake-active-high.md`)
7. DRC fires if user reverses polarity

### "Reconciliation: BOM says 5, stash says 3"

1. `BreadboardReconciliationPanel` shows delta
2. Shopping list surfaces the 2-unit shortfall
3. Preflight gates bring-up: "2 units short — cannot start build"
4. User either adds to cart OR adjusts design to use what they have
5. Coach offers alternatives from existing stash if possible

## The Cognitive Budget

Users have **~7 ± 2 items** of working memory. Breadboard Lab must respect that.

- Toolbar: max 7 primary actions
- Sidebar shelves: paginate beyond 12 parts
- Audit panel: top 3 issues surfaced, rest collapsed
- Coach overlay: one next step at a time
- Inspector: primary info in first 3 fields, details collapsed

**If you're adding a 10th toolbar button, something else needs to move to a menu.**

## Progressive Disclosure Tiers

| Tier | Who | What they see |
|---|---|---|
| Beginner | First-time user | Starter shelf, intake prompt, coach-first |
| Intermediate | Has a project | Project shelf + starter, inventory summary |
| Maker | Has stash + BOM | Reconciliation, preflight, shopping list |
| Advanced | Debugging | Connectivity overlay, DRC overlay, part inspector expanded |
| Expert | Contributor | 3D preview, layout-quality score details, exact-part request flow |

Each tier should be **accessible** from the previous — no tier should *require* the prior one. A beginner should be able to unlock "advanced" by toggling one switch.
