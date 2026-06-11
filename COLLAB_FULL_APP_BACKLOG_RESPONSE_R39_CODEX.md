## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R39.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R39_CODEX.md
- Claimed files: client/src/lib/breadboard-instance-provenance.ts; client/src/components/circuit-editor/BreadboardView.tsx; client/src/components/circuit-editor/breadboard-canvas/index.tsx; client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts; client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx; .agents/skills/pp-view-breadboard/references/testing.md; .agents/skills/pp-view-breadboard/references/self-improvement-log.md; .agents/skills/breadboard-lab/references/testing-and-browser-verification.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R39.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R39_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R39 - Codex Response

## Docs And Skill Checks

- Used `pp-view-breadboard`, `breadboard-lab`, and `pp-view-3d` for the Breadboard/3D slice.
- Context7 checked current Vitest docs for importing `describe`, `it`, and `expect` from `vitest` in TypeScript tests.

## Implemented

- Added a small Breadboard provenance helper with canonical instance provenance values, bench/board/staged/conflicting placement classification, provenance fallback reads, and coach-vs-exact trust comparison. See `client/src/lib/breadboard-instance-provenance.ts:3`, `client/src/lib/breadboard-instance-provenance.ts:40`, `client/src/lib/breadboard-instance-provenance.ts:58`, and `client/src/lib/breadboard-instance-provenance.ts:90`.
- New exact-part staging now stamps `breadboardProvenance: 'exact'`. See `client/src/components/circuit-editor/BreadboardView.tsx:619`.
- New coach-created parts now stamp `breadboardProvenance: 'coach'` in both single-remediation and full-plan apply paths. See `client/src/components/circuit-editor/breadboard-canvas/index.tsx:651` and `client/src/components/circuit-editor/breadboard-canvas/index.tsx:692`.
- Project library drops and starter/generic shelf drops now stamp `breadboardProvenance: 'project'` or `breadboardProvenance: 'starter'`. See `client/src/components/circuit-editor/breadboard-canvas/index.tsx:1159`, `client/src/components/circuit-editor/breadboard-canvas/index.tsx:1201`, and `client/src/components/circuit-editor/breadboard-canvas/index.tsx:1244`.
- Replaced placeholder Breadboard Lab contract tests with real guards for canonical provenance values, explicit and legacy provenance reads, coach trust ordering, bench-vs-board state, sync-created wire provenance, and manual-wire preservation. See `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts:126`, `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts:146`, `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts:172`, `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts:199`, and `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts:225`.
- Extended `BreadboardView.test.tsx` so exact, coach, project, and starter creation paths assert the provenance stamp. See `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx:704`, `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx:830`, and `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx:1315`.
- Updated Breadboard skill references with the new guard and durable lesson. See `.agents/skills/pp-view-breadboard/references/testing.md:23`, `.agents/skills/pp-view-breadboard/references/self-improvement-log.md:184`, and `.agents/skills/breadboard-lab/references/testing-and-browser-verification.md:74`.

## Verification

- `npm run test -- client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/circuit-editor/__tests__/view-sync-provenance.test.ts` - passed 3 files, 55 tests.
- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs` - passed, 71 tracked test cases.
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs` - passed, 52 tracked test cases.
- `npm run page-skills:check` - passed, 40 active packs.
- `npm run page-skills:audit-packs` - passed, 40 active packs.
- `npm run check` - passed; token drift passed and TypeScript completed cleanly.
- `npm run build` - passed; client built in 2m 7s and server build exited 0. Build emitted the existing informational meta-images skip line because no Replit deployment domain is configured.
- `git diff --check -- <claimed R39 files>` - passed after response write.
- Port `5000` was clear.

## Notes

- This was a non-visual guard and data-stamping slice, so I did not rerun the Breadboard browser proof. The existing R24/R25/R28/R34 browser checks remain the visible-flow evidence for the bridge, status dock, provenance row, and container behavior.
- `BreadboardView.tsx`, `breadboard-canvas/index.tsx`, and the Breadboard skill references were already dirty before R39. I only added provenance stamps, guard tests, and the related reference notes.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Start the guarded Breadboard canvas cleanup by extracting the lowest-risk viewport/placement helpers behind these contract guards, or continue the money-gate trust output if fabrication/procurement gating is higher priority.
---
