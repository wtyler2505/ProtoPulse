# Breadboard Common Tasks (Recipe-Style)

Canned procedures for frequent Breadboard Lab work. Follow steps in order.

## Recipe 1: Add a new starter part

1. Check parts catalog exists: `grep -rn "newPartName" shared/parts/ shared/verified-boards/`
2. If not, add part definition to `shared/parts/` or `shared/verified-boards/`
3. Register in starter registry
4. Add `<StarterPart>` entry in `BreadboardStarterShelf.tsx` with vault reference
5. Component test — verify starter renders + draggable
6. Browser verify — drop part, check console clean

## Recipe 2: Add a verified board profile

1. Create `shared/verified-boards/<board>.ts` following `arduino-uno-r3.ts` pattern
2. Register in `shared/verified-boards/index.ts`
3. Update `exact-part-resolver.ts` tests
4. Add starter-shelf entry (Recipe 1)
5. Off-board parts: verify `BreadboardBenchPartRenderer.tsx` + `breadboard-bench-connectors.ts`
6. Capture board-specific quirks to `knowledge/` via `inbox/` then `/arscontexta:extract`
7. `npx vitest run shared/__tests__/exact-part-resolver.test.ts`

## Recipe 3: Add an audit rule / DRC check

1. Create or find vault note documenting WHY — rule must cite a claim
2. Decide severity from the severity ladder
3. Add rule in `breadboard-board-audit.ts` or `breadboard-drc.ts`
4. Unit test with BOTH positive + negative fixtures
5. Verify audit panel + DRC overlay render the issue
6. Browser verify with reproduced violating state


## Recipe 4: Fix wrong-tier-badge complaint

1. Select part, check inspector tier
2. Trace: `BreadboardPartInspector.tsx` → `breadboard-part-inspector.ts:deriveTrust()` → `breadboard-bench.ts:classifyPart()` → part source
3. Common causes:
   - Schematic sync didn't preserve source metadata (fix `view-sync.ts`)
   - Verified-exact flag didn't propagate (fix `exact-part-resolver.ts`)
   - Heuristic part "upgraded" by later interaction (there should be NO upgrade path)
4. Add regression test asserting tier stays correct through the identified code path

## Recipe 5: Add bench-pin endpoint for off-board part

1. Read `breadboard-bench-connectors.ts` schema
2. Add pin definitions (label, position, electrical type, color hint)
3. Wire into `BreadboardBenchPartRenderer.tsx`
4. Verify `BreadboardWireEditor.tsx` snaps endpoints
5. Test drag-to-snap in a real browser

## Recipe 6: Debug schematic↔breadboard drift

1. Take snapshots of both views
2. Identify specific delta
3. Check `view-sync.ts` for silent failures / bad dedup / lossy merge
4. Use sync invariant tests from ai-audit-and-sync reference
5. Add negative test for specific drift scenario

## Recipe 7: Safe editing of BreadboardView.tsx (2,284 lines)

1. Identify section (toolbar ~774, canvas ~850, default export ~231)
2. Run full test: `npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
3. Standalone tsc: `NODE_OPTIONS='--max-old-space-size=16384' npx tsc --noEmit`
4. Verify the 6-question lens (SKILL.md) before commit
5. Browser verify all toolbar modes

## Recipe 8: Hook a vault note into coach

1. Identify trigger condition
2. Open `breadboard-coach-plan.ts`, add step entry
3. Use `vaultRef: 'slug'` but pair with concept keywords so future rename doesn't break
4. Ensure `BreadboardCoachOverlay.tsx` renders the vault link as clickable
5. Unit test the plan derivation with triggering fixture

## General Pitfall Checklist

Before claiming any breadboard task done:
- Did I grep before inventing?
- Does provenance survive? (trust tiers + origin labels unchanged)
- Did I update the test for the subsystem I touched?
- Did I verify in a real browser?
- Cross-view coherence? (schematic/inventory/validation agree)
- New knowledge routed through `inbox/` → `/arscontexta:extract`?
