# Breadboard Anti-Patterns

Things that LOOK like good changes but actually break the Breadboard Lab contract. Flag these in review.

## 1. Trust Tier Collapse

**What it looks like:** A PR simplifies the part label. Now "Verified" and "Inferred" both render as just the part name.

**Why it's wrong:** Users can no longer tell which parts are trustworthy enough to wire without double-checking.

**The fix:** Never remove tier badges. If UI space is tight, shrink the badge, don't delete it.

**Regression test:**
```typescript
it('renders distinct labels for all 4 tiers', () => {
  const tiers = ['verified-exact', 'connector-defined', 'heuristic', 'stash-absent'];
  const labels = tiers.map(t => render(<PartLabel tier={t} />).container.textContent);
  expect(new Set(labels).size).toBe(4); // all different
});
```

## 2. Silent Schematic Sync

**What it looks like:** "I improved sync — now schematic changes instantly appear on breadboard!"

**Why it's wrong:** The breadboard looks different without the user doing anything. They lose mental model of "what I built."

**The fix:** Sync must be:
- Triggered explicitly OR
- Announced via toast / badge / visual pulse on the affected part
- Undoable in one click

**Never let sync rearrange existing user work without consent.**

## 3. Audit Score Without Remediation

**What it looks like:** "Layout quality: 47/100" shown prominently.

**Why it's wrong:** A score is only useful if the user can raise it. "47/100" without "here's what to do" is worse than no score — it creates anxiety without agency.

**The fix:** Every audit score must be expandable to show:
- Which issues drag the score down
- What to do about each
- Estimated score delta if each is fixed

## 4. Photorealistic + Wrong

**What it looks like:** A beautifully rendered wire with gradient shading and shadow effects.

**Why it's wrong:** If the wire connects to the wrong hole but looks pretty, the user TRUSTS it more, so the bug is more damaging. Visual polish amplifies correctness bugs.

**The fix:** Fix the identity / correctness first. Polish only after.

**Mnemonic:** A plain straight line to the right hole beats a photorealistic wire to the wrong hole.

## 5. "Fix" That Breaks Beginner Onboarding

**What it looks like:** Adding a power-user feature that complicates the empty-state UI.

**Why it's wrong:** Beginners who can't figure out how to start within 5 seconds leave. Advanced features accessible from a clean starting point > advanced features crowding the front page.

**The fix:** Put advanced features in progressive-disclosure tiers. See `breadboard-workflow-playbook.md` for the tier ladder.

## 6. Magic Numbers In Rules

**What it looks like:** `if (part.spacing === 23) {...}` in some audit rule.

**Why it's wrong:** The "23" means something (NodeMCU spacing) but nobody reviewing will know. And the rule can't be updated without finding the magic number.

**The fix:**
- Named constant: `const NODEMCU_SPACING_MM = 23;`
- Cite vault: `// per knowledge/nodemcu-amica-23mm-spacing-fits-standard-breadboard-with-both-rails-accessible.md`
- Ideally pull from the part's data: `part.breadboardSpacingMm`

## 7. Inventing A New Trust Tier

**What it looks like:** "Let's add a 'partially-verified' tier between `connector-defined` and `verified-exact`."

**Why it's wrong:** Every new tier increases cognitive load. The existing 4 tiers map to real states:
- `verified-exact` — can trust everything
- `connector-defined` — can trust pins, not layout
- `heuristic` — can't trust anything without verification
- `stash-absent` — can't build yet

More tiers make the UI murkier, not clearer.

**The fix:** Use the existing 4. If a part's state doesn't fit, upgrade it to the next lower tier (be conservative).

## 8. DRC Overlay Without Pin Focus

**What it looks like:** DRC flags an I2C pull-up violation with a red icon floating somewhere on the board.

**Why it's wrong:** The user can't tell which pin is the problem. They'll turn off DRC in frustration.

**The fix:** Every DRC issue must:
- Render AT the affected pin/net location
- Highlight the affected hole(s) when hovered
- Offer a one-click focus-and-fix action

## 9. Coach Dumps Full Plan

**What it looks like:** Coach overlay shows 10 steps: "1. Place ESP32. 2. Add decoupler. 3. Wire VCC. ..."

**Why it's wrong:** Overwhelming. Steps 2-10 get ignored; user probably already did step 1.

**The fix:** One step at a time. Next step appears after current step is applied, skipped, or dismissed.

## 10. Relying On Colors Alone For Tier

**What it looks like:** "Green = verified, yellow = connector-defined, blue = heuristic, red = stash-absent."

**Why it's wrong:** 
- Accessibility: colorblind users can't distinguish (especially green/red)
- Cyberpunk theme makes all UI colorful — tier colors get lost in the noise
- Monochrome screenshots lose the signal entirely

**The fix:** Color + icon + text label. All three. Always.

## 11. Breadboard-Only Features Breaking Schematic

**What it looks like:** A new breadboard-placement-specific field added to the part data model. Schematic view ignores it and shows blank.

**Why it's wrong:** Cross-view coherence broken. Users switch views and see different "truths."

**The fix:** Either:
- Make the field view-specific (`placement.breadboard.fitZone`, not top-level)
- Or make it render in BOTH views (possibly differently)

## 12. Heuristic Part Upgraded By Sync

**What it looks like:** User places a heuristic "generic IC". Later they sync schematic (which has a verified-exact version of the same chip). The breadboard part now shows `verified-exact`.

**Why it's wrong:** A heuristic placement got "laundered" into verified-exact without the user explicitly confirming. The footprint on the breadboard hasn't been re-checked.

**The fix:** Sync preserves trust tier. If user wants to upgrade, they must explicitly:
1. Delete the heuristic part
2. Replace with the verified-exact version

Or offer a "Replace with verified" button that's clearly a user action.

## 13. Stash Truth Bypass

**What it looks like:** "Preflight ready to build!" but the BOM has 5 resistors and stash has 0.

**Why it's wrong:** User orders bring-up parts they don't have, discovers mid-build that the preflight lied.

**The fix:** Preflight gate MUST check stash truth (`shared/parts/shortfall.ts:computeShortfall()`). If ANY shortfall > 0, preflight is NOT ready.

## 14. Ignoring Off-Board Rules

**What it looks like:** Mega 2560 placed directly on breadboard grid.

**Why it's wrong:** Mega doesn't fit any breadboard. The vault explicitly documents this (`knowledge/mega-2560-too-wide-for-any-breadboard.md`). Placement is physically impossible.

**The fix:** Off-board-only parts must render as bench parts with bench-pin endpoints. `BreadboardBenchPartRenderer.tsx` + `breadboard-bench-connectors.ts` handle this.

**Regression test:**
```typescript
it('rejects on-board placement for off-board-only parts', () => {
  const result = validatePlacement({ part: mega2560Definition, target: 'on-breadboard' });
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/too wide/i);
});
```

## 15. Prompt Template That Lies About Tier

**What it looks like:** Coach prompt builder includes the selected part name but not the trust tier. Model returns confident advice for a heuristic part.

**Why it's wrong:** User trusts the advice. Wires up their board. Component blows up because the "confident" pinout was inferred, not verified.

**The fix:** Every coach prompt template MUST include the trust tier as a typed field, and the model's response style should be conditioned on it:

```
SYSTEM: You are giving wiring advice for a {{trust_tier}} part.
- verified-exact: you may give confident specific instructions
- connector-defined: give instructions but remind user to verify against datasheet
- heuristic: give best-guess with explicit "please verify" framing
- stash-absent: don't give wiring advice; suggest adding part to stash first
```

## 16. Adding A 10th Toolbar Button

**What it looks like:** "Let's add a 'toggle layout grid' button to the toolbar."

**Why it's wrong:** Cognitive budget. Toolbar already has 9 actions. 10+ pushes past working-memory limit.

**The fix:** Put the new action in a menu or context-specific overlay. Only primary-workflow actions belong in the toolbar.

## 17. Testing The Isolated Unit, Not The Interaction

**What it looks like:** A test for `deriveTrust()` that passes. But when mounted in `BreadboardPartInspector`, the tier doesn't render.

**Why it's wrong:** Users don't interact with functions; they interact with the integrated UI. Unit passing + integration broken = still broken.

**The fix:** For cross-subsystem changes, write a component test that mounts the actual shell and asserts the visible outcome.

## 18. Browser-Unverified "Done"

**What it looks like:** Tests pass, typecheck clean, PR merged. Two days later user reports the feature is broken.

**Why it's wrong:** Tests exercise code, not UX. Many regressions (layout shift, race conditions, visual bugs) only surface in the real browser.

**The fix:** The Done Criteria in `breadboard-testing-and-browser-verification.md` mandates browser verification. Non-negotiable.

## 19. Inventing A "Performance" Optimization That Breaks Flow

**What it looks like:** "Let's debounce the drop preview 300ms to save renders."

**Why it's wrong:** 300ms feels sluggish. The real-world feel of "drop the part, snap immediately" breaks.

**The fix:** Performance optimizations in Breadboard canvas must be user-testable in the browser. If the interaction feels slower, roll back — even if the numbers look better.

## 20. Breaking The "Grep First" Promise

**What it looks like:** "I needed this function, so I wrote it."

**Why it's wrong:** A similar function already exists in another `-lib` file. Now there are 2 slightly different implementations and the next bug will only fix one.

**The fix:** Before writing any new breadboard helper, grep:
```bash
grep -rn "similar_function_name\|related_keyword" client/src/lib/breadboard-*.ts client/src/lib/circuit-editor/*.ts
```

If anything close exists, extend it. Don't fork it.

---

## The Pre-Commit Review Check

Every Breadboard PR should be filtered against this list. If you see any anti-pattern from this file in the diff, the PR isn't ready.

## Adding To This File

When a new anti-pattern surfaces in review, add it here with:
- Short name
- "What it looks like" (concrete example)
- "Why it's wrong" (user-facing consequence)
- "The fix" (actionable correction)
- Regression test snippet if applicable

The list only works if it stays current.
