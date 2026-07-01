# Codex to Claude Handoff - 2026-06-17

## Lane Reservation

- Active channels: `CODEX_TO_CLAUDE_HANDOFF_2026-06-17.md` only.
- Claimed files: this handoff file only. For the next ESP32-S3 slice, expected target files are `packages/emu/src/esp32s3.ts`, `packages/emu/src/esp32s3.test.ts`, `ROADMAP.md`, `docs/CHANGELOG.md`, and `docs/FEATURE_MATURITY.md`.
- Forbidden files: do not modify existing `CODEX_*`, `COLLAB_*`, or `CLAUDE_RESPONSE_*` point-in-time files unless Tyler explicitly asks. Do not edit `docs/vision/*` in place. Do not touch `docs/notebooklm.md` or `data/pp-nlm/**`.
- Background sessions: none intentionally left running. Tyler rebooted the machine and asked to leave dev servers off for now.
- Round type: resume handoff, then implement the next v0.5 ESP32-S3 long-tail slice.
- Target file edits permitted this round: no target edits from this handoff alone. When resuming engineering work, use listed-only edits for the selected slice.
- Agent cap status: 0/6 active as of handoff. Re-check with process list before spawning agents or long-running watches.

## Situation Summary

Tyler is about to run out of weekly Codex usage and needs to swap to Claude. This document is meant to let Claude resume without reconstructing the whole interrupted thread.

The active engineering lane is v0.5 Bridge, specifically ESP32-S3 TWAI/CAN long-tail work in `@protopulse/emu`. Codex landed two TWAI slices on `main` and then pushed a doc-refresh commit:

- `6c6b5528 emu: surface ESP32-S3 TWAI RX overruns`
- `eba8961d emu: mark TWAI ACK errors as bus errors`
- `c9346b36 docs: refresh ESP32-S3 TWAI status`

`origin/main` is at `c9346b36`, and all GitHub workflows for that pushed commit are green.

Important: after the docs push, the repo's local auto-commit hook created an unpushed local commit:

```text
72cccadf Auto: 5 files |  5 files changed, 424 insertions(+), 13 deletions(-)
```

That local commit includes the handoff plus generated/runtime dirt:

```text
M  .claude/.tsc-errors.log
A  CODEX_TO_CLAUDE_HANDOFF_2026-06-17.md
M  data/metrics.json
A  ops/sessions/29071c6b-370c-4701-85e7-ccb6861a7c26.json
A  ops/sessions/4265838a-3019-4437-8fc5-5ebe713d1ebc.json
```

Do not push `72cccadf` blindly. Review or clean that auto-commit first.

## Current Live State

Last checked by Codex:

```text
time: 2026-06-16T21:29:19-05:00 local / 2026-06-17 UTC for GitHub and docs
branch: main...origin/main [ahead 1]
local HEAD: 72cccadf Auto: 5 files |  5 files changed, 424 insertions(+), 13 deletions(-)
origin/main: c9346b36 docs: refresh ESP32-S3 TWAI status
servers: off; no listeners on :5000 or :5174 after Tyler rebooted
```

Current tracked worktree after the auto-commit was clean before this handoff update. If this file is modified after this paragraph, that is intentional handoff freshness.

The unpushed auto-commit contains these generated/runtime files:

```text
 M .claude/.tsc-errors.log
 M data/metrics.json
 A ops/sessions/29071c6b-370c-4701-85e7-ccb6861a7c26.json
 A ops/sessions/4265838a-3019-4437-8fc5-5ebe713d1ebc.json
```

Intentional doc refresh that is already pushed and green at `c9346b36`:

- `README.md`: refreshed engine test badge/counts to 1,517 and broadened the high-level ESP32-S3 emulator summary through PCNT/I2C/SPI/MCPWM/TWAI surfaces.
- `docs/DEVELOPER.md`: refreshed engine test count and `@protopulse/emu` package description through ESP32-S3 TWAI slice 108.
- `packages/README.md`: made the `@protopulse/emu` row explicit about TWAI host-drained events, peer ACK/no-ACK behavior, listen-only suppression, RX FIFO overrun, and ACK bus-error flags.
- `.ref/project-dna.md` and `.ref/project-map.md`: refreshed navigation/status counts and ESP32-S3/TWAI wording.
- Verification for `c9346b36`: Packages CI, CI, and Tauri build matrix all completed successfully on GitHub.

Do not stage the generated runtime files casually.

- `.claude/.tsc-errors.log`: generated watch/log file. Current diff showed the file contents removed, including an old transient TypeScript watch error that had later cleared. Treat as runtime/log dirt unless Tyler says otherwise.
- `data/metrics.json`: generated legacy server metrics. Current diff was only final newline and/or `persistedAt` timestamp churn from starting the legacy dev server earlier. Treat as runtime dirt.

If you need a clean worktree before committing a new slice, inspect first:

```bash
git status --short --branch
git diff -- .claude/.tsc-errors.log data/metrics.json
```

If the diffs are still only generated noise and Tyler has not intentionally edited them, either leave them unstaged or restore them explicitly. Never use `git add .`.

## Server Instructions

Tyler asked to leave servers off for now. When Tyler or you need to start them:

```bash
npm run dev
npm run -w @protopulse/app dev -- --host 0.0.0.0
```

Expected URLs:

- Legacy app: `http://localhost:5000/`
- New engine editor: `http://localhost:5174/`

Important: `npm run dev` mutates `data/metrics.json` roughly every minute through `server/metrics.ts`. That is expected runtime noise. Do not commit it unless the task is explicitly about metrics persistence.

## Verification Evidence For Latest Landed Slice

Latest commit:

```text
eba8961d emu: mark TWAI ACK errors as bus errors
```

Local verification before push:

```bash
git diff --check
npm run -w @protopulse/emu test -- src/esp32s3.test.ts
npm run check:packages
npm run test:packages
```

Results:

- Red phase first: focused ESP32-S3 test failed because expected `busError` was missing.
- Focused suite then passed: `packages/emu/src/esp32s3.test.ts`, 175 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across all packages, 1,517 package/golden tests.
- `git diff --check` passed.

Remote GitHub Actions for `eba8961d`:

```text
27659583731 Packages CI        completed success eba8961d 2026-06-17T01:28:37Z
27659583670 Tauri build matrix completed success eba8961d 2026-06-17T01:28:37Z
27659583655 CI                 completed success eba8961d 2026-06-17T01:28:37Z
```

Previous commit `6c6b5528` also had all three workflows green:

```text
27656898410 Packages CI        completed success 6c6b5528
27656898384 Tauri build matrix completed success 6c6b5528
27656898350 CI                 completed success 6c6b5528
```

## What Changed In Slice 107

Commit:

```text
6c6b5528 emu: surface ESP32-S3 TWAI RX overruns
```

Files changed:

- `packages/emu/src/esp32s3.ts`
- `packages/emu/src/esp32s3.test.ts`
- `ROADMAP.md`
- `docs/CHANGELOG.md`
- `docs/FEATURE_MATURITY.md`
- `packages/README.md`

Behavior:

- Added `rxFifoOverrun?: true` to `Esp32s3TwaiErrorFlags`.
- When host/peer injection hits a full modeled TWAI RX FIFO, `twaiPushRxFrame()` now:
  - keeps existing data-overrun status/interrupt behavior;
  - returns `false`;
  - pushes a host-drained event: `{ type: 'error', flags: { rxFifoOverrun: true } }`.
- `twaiCloneEvent()` preserves `rxFifoOverrun`.

Key references:

- `packages/emu/src/esp32s3.ts:24` includes `rxFifoOverrun?: true`.
- `packages/emu/src/esp32s3.ts:4540` emits the overrun error event.
- `packages/emu/src/esp32s3.ts:4639` clones the flag.
- `packages/emu/src/esp32s3.test.ts:906` test name: `surfaces TWAI RX FIFO overruns to the host bench`.
- `packages/emu/src/esp32s3.test.ts:926` asserts the drained error event.
- `ROADMAP.md:1467` documents slice 107.
- `docs/CHANGELOG.md:27` documents slice 107.

Test shape:

- Firmware leaves reset mode.
- Host injects 64 accepted frames to fill FIFO.
- Test drains 64 `rx_done` events.
- Host injects a 65th frame.
- Expected:
  - injection returns `false`;
  - drained event stream equals `[{ type: 'error', flags: { rxFifoOverrun: true } }]`.

## What Changed In Slice 108

Commit:

```text
eba8961d emu: mark TWAI ACK errors as bus errors
```

Files changed:

- `packages/emu/src/esp32s3.ts`
- `packages/emu/src/esp32s3.test.ts`
- `ROADMAP.md`
- `docs/CHANGELOG.md`
- `docs/FEATURE_MATURITY.md`

Behavior:

- Added `busError?: true` to `Esp32s3TwaiErrorFlags`.
- ACK failures already set `TWAI_INTR_ERR | TWAI_INTR_BUS_ERR`.
- Now the host-facing event matches that bus-error path:
  - no-ACK transmit error emits `{ type: 'error', flags: { ackErr: true, busError: true } }`.
- `twaiCloneEvent()` preserves `busError`.

Key references:

- `packages/emu/src/esp32s3.ts:23` includes `busError?: true`.
- `packages/emu/src/esp32s3.ts:4638` clones `busError`.
- `packages/emu/src/esp32s3.ts:4671` emits `{ ackErr: true, busError: true }`.
- `packages/emu/src/esp32s3.test.ts:808` test name: `drains TWAI ACK bus-error events with failed tx_done callbacks`.
- `packages/emu/src/esp32s3.test.ts:833` asserts the new `busError` flag.
- `ROADMAP.md:1475` documents slice 108.
- `docs/CHANGELOG.md:5` documents slice 108.
- `docs/FEATURE_MATURITY.md:212` now says ESP32-S3 is through slice 108 and mentions ACK bus-error events.

Test shape:

- Existing no-ACK transmit test was tightened, not a new test count.
- Firmware leaves reset, writes a standard frame, issues TX request with no peer.
- Expected drained events:
  - first: `{ type: 'error', flags: { ackErr: true, busError: true } }`
  - then failed `tx_done` for frame `0x404`.

## Current ESP32-S3 TWAI/CAN State

The emulator currently has:

- Source-pinned ESP32-S3 TWAI register block.
- Self-test transmit/receive.
- Host frame injection.
- Host TX drain.
- Standard-frame acceptance filtering.
- Virtual peer-bus delivery.
- ACK/no-ACK TEC movement.
- State-change events for active/warning/passive/bus_off.
- Listen-only TX suppression.
- RX FIFO overrun host event.
- ACK bus-error host event.
- Host-drained TX/RX/error/state-change events.
- CAN_INT interrupt routing.

Major honest cuts still open:

- No full ESP-IDF driver alert queue yet.
- No bit timing.
- No arbitration or arbitration-lost event/capture modeling.
- No retry scheduling.
- No wire-level GPIO waveform.
- No exact dual-filter mode.
- No full unmodified IDF/FreeRTOS target yet.

## Docs / Source Truth Checked

Before TWAI work, Codex checked current ESP-IDF docs via Context7:

- Library: `/websites/espressif_projects_esp-idf_en_v5_5_4_esp32s3`
- Topic: TWAI error states, error flags, legacy alert/error semantics.

Also checked official Espressif primary source/docs:

- https://docs.espressif.com/projects/esp-idf/en/v5.5.4/esp32s3/api-reference/peripherals/twai.html
- Raw ESP-IDF v5.5.4 TWAI headers were consulted for legacy alert names, including ACK error, bus error, RX FIFO overrun, arbitration lost, TX failed/retried style alerts.

Claude should repeat Context7/official-doc verification before making any new library/API/toolchain claims or changing behavior based on ESP-IDF semantics. Project rules require Context7-first.

## Recommended Next Engineering Slice

Continue v0.5 ESP32-S3 TWAI long tail.

Best next small slice: expose a bus-off host event flag/alert shape.

Why this is a good next bite:

- Bus-off state transition is already modeled via repeated no-ACK transmissions.
- Existing tests already check state transitions:
  - `packages/emu/src/esp32s3.test.ts` has `drains TWAI state-change events as ACK errors escalate TEC`.
- ESP-IDF has bus-off alert semantics, and the emulator already reaches bus-off internally.
- This is a narrow extension of current host-drained error/state-change event work.

Suggested red test:

1. Use the existing no-ACK burst firmware pattern from the state-change test.
2. Drive 32 no-ACK transmissions so TEC reaches bus-off.
3. Assert `drainTwaiEvents()` includes an error event with a new flag, probably `busOff: true`, near the transition from `passive` to `bus_off`.
4. Assert existing state-change events remain unchanged.

Suggested implementation:

1. Add `busOff?: true` to `Esp32s3TwaiErrorFlags`.
2. In `twaiRecordAckError()`, when `nextTec >= 256`, push an error event with `{ busOff: true }` before or adjacent to the state-change push.
3. Preserve the flag in `twaiCloneEvent()`.
4. Update docs:
   - prepend `docs/CHANGELOG.md` entry for slice 109;
   - add ROADMAP item after slice 108;
   - update `docs/FEATURE_MATURITY.md` from slice 108 to 109 and mention bus-off host event.
5. Run verification:
   - red focused test first;
   - `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`;
   - `git diff --check`;
   - `npm run check:packages`;
   - `npm run test:packages`;
   - commit/push;
   - watch GitHub Actions:
     - Packages CI;
     - CI;
     - Tauri build matrix.

Alternative next small slice:

- Arbitration-lost event/capture modeling.
- This may require a bit more design because the emulator currently has no real arbitration/retry scheduler.
- Do it only after checking ESP-IDF docs and deciding the test can stay narrow.

## Exact Command Patterns To Use

Focused test:

```bash
npm run -w @protopulse/emu test -- src/esp32s3.test.ts
```

Package typecheck:

```bash
npm run check:packages
```

Full package tests:

```bash
npm run test:packages
```

Whitespace:

```bash
git diff --check
```

GitHub watch after push:

```bash
gh run list --branch main --limit 8 --json databaseId,workflowName,status,conclusion,headSha,createdAt \
  --jq '.[] | [.databaseId, .workflowName, .status, (.conclusion // ""), .headSha[0:8], .createdAt] | @tsv'

gh run watch <run-id> --exit-status --interval 15
```

Never broad-stage:

```bash
git add packages/emu/src/esp32s3.ts packages/emu/src/esp32s3.test.ts ROADMAP.md docs/CHANGELOG.md docs/FEATURE_MATURITY.md
```

Only add `packages/README.md` if a new test is added and the 1,517 test count changes.

## Important Process Notes For Claude

1. Read `AGENTS.md` before broad claims or edits.
2. Read `.ref/project-dna.md` and `.ref/project-map.md` for navigation.
3. Use Context7 first for ESP-IDF/TWAI semantics.
4. Use TDD for each emulator behavior slice:
   - write the failing test;
   - run the focused test and observe the expected failure;
   - implement minimal production code;
   - rerun focused and broad checks.
5. Keep status docs honest:
   - `ROADMAP.md` is canonical build order/status;
   - `docs/CHANGELOG.md` gets a new top entry per slice;
   - `docs/FEATURE_MATURITY.md` updates only when maturity genuinely changes.
6. Do not touch `docs/vision/*`; it is frozen.
7. Do not write directly to `knowledge/`.
8. Ignore or carefully restore generated runtime dirt from:
   - `.claude/.tsc-errors.log`;
   - `data/metrics.json`.
9. Do not reuse existing `CODEX_*`, `COLLAB_*`, or `CLAUDE_RESPONSE_*` files. They are history.
10. If Tyler asks for servers, start them with the commands in the server section above.

## Open Questions / Watch Items

- Whether to treat `data/metrics.json` as generated runtime state long-term. It keeps dirtying the worktree when the legacy server runs.
- Whether to add a dev env var or gitignore strategy for metrics persistence later. Do not do that inside the TWAI slice unless Tyler asks.
- Whether to park or restore `.claude/.tsc-errors.log`; current diff looks like generated watch-log cleanup, not product work.
- The next ESP32-S3 TWAI slices should stay small. The broader v0.5 list is huge, but current momentum is in one narrow TWAI event/alert chain.

## User Tone / Preference Context

Tyler wants direct, plain-language status and real evidence. He asks process questions to learn, not to force the agent to abandon judgment. Make the safe engineering call and explain it briefly.

He has repeatedly asked to avoid dirty-worktree accidents. Before commits:

```bash
git status --short --branch
git diff --stat
git diff --name-only
git diff --cached --stat
```

Stage only intentional paths. Do not use `git add .`.

## Convergence

---
ROUND_STATUS: discovery-complete
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Claude - resume ESP32-S3 TWAI long-tail or start dev servers when Tyler asks
NEXT_ROUND: Claude should read this handoff, re-check live git/server state, optionally start servers, then continue with the next small TWAI slice using TDD
---
