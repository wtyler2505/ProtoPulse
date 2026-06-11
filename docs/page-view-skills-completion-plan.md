# ProtoPulse Page/View Skills Completion Plan

## Objective

Build every planned ProtoPulse page/view skill into a usable skill pack, then verify that no planned page skills remain.

## Success Criteria

- The page-skill manifest has 40 entries.
- All 40 entries are `active`.
- The original 30 planned entries have real skill folders.
- Every active page skill has:
  - `SKILL.md`
  - `agents/openai.yaml`
  - `references/page-map.md`
  - `references/testing.md`
  - `references/ux-contract.md`
  - `references/gotchas.md`
  - `references/self-improvement-log.md`
  - `scripts/inspect-<skill>.mjs`
- Every inspector runs without failure.
- Manifest coverage passes.
- Pack audit passes.
- Script tests pass.
- TypeScript passes.

## Built Shape

The completed page skills use the Breadboard gold-pack structure:

- `SKILL.md` gives the fast workflow and self-improvement rule.
- `page-map.md` records source and test handles.
- `testing.md` records the closest tests and browser-check expectations.
- `ux-contract.md` records user-facing behavior expectations.
- `gotchas.md` records common failure modes.
- `self-improvement-log.md` records durable lessons and future proposals.
- `agents/openai.yaml` gives an agent-facing prompt.
- `scripts/inspect-<skill>.mjs` verifies the pack and anchor files.

## Verification Commands

- `npm run page-skills:build-planned`
- `npm run page-skills:sync`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`
- `for f in .agents/skills/pp-view-*/scripts/inspect-*.mjs; do node "$f"; done`
- `npm run test -- scripts/__tests__/page-skills.test.ts scripts/__tests__/pp-view-breadboard-inspector.test.ts`
- `npm run check`

## Current Result

As of the completion pass, the manifest reports 40 active skills and 0 planned skills. The pack audit passes, all inspectors pass, script tests pass, and TypeScript passes.
