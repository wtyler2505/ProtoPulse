# 2026-06-12 Claude usage-limit recovery

## Trigger

Claude Code session `c409c92f-1f2e-499d-b1e6-9ce3863c18ab` hit the weekly usage limit at about 10:34 AM America/Chicago while multi-agent ProtoPulse work was in flight. The reset message in the transcript says the limit resets June 15, 2026 at 5:00 PM America/Chicago.

## Transcript And Local Evidence

- Main Claude transcript: `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse/c409c92f-1f2e-499d-b1e6-9ce3863c18ab.jsonl`
- Main job timeline: `/home/wtyler/.claude/jobs/c409c92f/timeline.jsonl`
- Skill/work queue transcripts: `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse--claude-worktrees-skill-audit-fixes/*.jsonl`
- 3D viewer transcripts: `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse--claude-worktrees-3d-viewer/*.jsonl`
- Claude memory breadcrumb: `/home/wtyler/.claude/memory/project_protopulse_six_lane_push_2026_06_12.md`

## Reconstructed Break Point

The last useful Claude status said both local UIs were up:

- Legacy app: `http://localhost:5000`
- New engine editor: `http://localhost:5174`

It also said three build lanes were still live:

- ESP32 slice 13: timers/watchdogs
- BL-0879: Option C-plus-ACK CRDT conflict implementation
- PP3D-8: exploded view, camera presets, keyboard navigation, accessibility

Disk state showed PP3D-8 had actually already landed on branch `worktree-3d-viewer` and was pushed to `origin/worktree-3d-viewer`. The remaining risky work was in `.claude/worktrees/skill-audit-fixes`, where slice 13 and BL-0879 were partly auto-committed plus had small uncommitted edits.

## Verification Run By Codex

In `.claude/worktrees/skill-audit-fixes`:

- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts` passed: 65 tests.
- `npx vitest run server/__tests__/collaboration-crdt-integration.test.ts server/__tests__/collaboration-auth.test.ts client/src/lib/__tests__/collaboration-client.test.ts` passed: 135 tests.
- `npm run check` passed with no TypeScript output.

In `.claude/worktrees/3d-viewer`:

- `npx vitest run client/src/components/views/__tests__/BoardViewer3DView.switch.test.tsx client/src/components/views/board-viewer-3d` passed: 127 tests.
- `npx tsc -p tsconfig.3d-check.json --noEmit` passed.
- `NODE_OPTIONS='--max-old-space-size=4096' npx eslint client/src/components/views/board-viewer-3d client/src/components/views/BoardViewer3DView.tsx client/src/components/views/__tests__/BoardViewer3DView.switch.test.tsx e2e/p1-viewer-3d-webgl.spec.ts e2e/p1-keyboard-nav.spec.ts` passed after lint cleanup.

Both dev servers answered `200` during recovery.

## Current State After Recovery

- Main checkout is still on `main` at `f1e3dfc7` / `origin/main`, with only `data/metrics.json` modified before Codex recovery.
- `.claude/worktrees/skill-audit-fixes` is on `worktree-skill-audit-fixes`; source work for slice 13 and BL-0879 verifies clean, but it is not merged to main.
- `.claude/worktrees/3d-viewer` is on `worktree-3d-viewer`; PP3D-8 is committed and pushed, and Codex added uncommitted lint cleanup in that worktree.
- Untracked `ops/sessions/*.json` files exist in both worktrees from session-capture hooks. They are session artifacts, not source work.

## Next Safe Actions

1. In `skill-audit-fixes`, review and split the verified changes into clean commits for ESP32 slice 13 and BL-0879, then merge to main.
2. In `3d-viewer`, commit the Codex lint cleanup, then merge `worktree-3d-viewer` to main after checking for conflicts.
3. Keep both dev servers available for Tyler while doing merges if local capacity allows.
4. Do not resume Claude until the weekly limit resets unless Tyler explicitly wants a `claude --resume c409c92f-1f2e-499d-b1e6-9ce3863c18ab` attempt.
