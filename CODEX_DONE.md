# Codex Completion Report

**Task:** Continue the ProtoPulse audit remediation program with the next Wave 6 implementation slice (`Performance / Observability / Route Confidence`)
**Status:** partial

## Changes Made
- `server/request-routing.ts` - added shared request-path, public-path, and SSE-route helpers so mounted middleware uses the real path instead of brittle partial-path checks.
- `server/index.ts` - hardened the request pipeline to use the shared helpers for SSE-aware compression bypass, rate-limit skipping, origin-check skipping, timeout skipping, public-route detection, and consistent request logging paths.
- `server/metrics.ts` - normalized additional high-risk dynamic routes (`agent`, `arduino`, `firmware runtime`) and made metrics collection safer on repeated starts.
- `server/__tests__/request-routing.test.ts` - added focused coverage for mounted-path reconstruction, public-route detection, and SSE-route detection.
- `server/__tests__/metrics.test.ts` - added normalization coverage for agent/hardware/runtime routes and idempotent repeated-start coverage.
- `server/__tests__/api.test.ts` - replaced the old skip-prone “hope a server is already running” integration test with an in-process API smoke harness that exercises current route contracts without external server dependence.

## Commands Run
```bash
npx vitest run server/__tests__/request-routing.test.ts server/__tests__/metrics.test.ts server/__tests__/api.test.ts
npm run check
npx eslint server/index.ts server/metrics.ts server/request-routing.ts server/__tests__/api.test.ts server/__tests__/metrics.test.ts server/__tests__/request-routing.test.ts
```

## Next Steps
- Continue Wave 6 with the release-confidence / readiness side:
  - upgrade `client/src/lib/release-readiness.ts` into a richer confidence scorecard
  - connect confidence/trust data into actual UI surfaces instead of leaving it as library-only logic
- Add broader route-family smoke coverage for more domain routers once a reusable harness pattern is extracted from the rebuilt `api.test.ts`.
- Add failure-injection coverage for AI/provider failure, import/export failure, and hardware disconnect/timeout paths.

## Blockers (if any)
- `npm run check` was started but did not complete within several minutes in this session; I stopped the long-running `tsc` process rather than leave it consuming CPU in the background, so I am **not** claiming a full repo-wide typecheck pass for this slice yet.
- `npx eslint ...` could not be used as a fallback because this repo does not currently have a local `eslint` binary installed; `npx` attempted to fetch ESLint `10.1.0`, which then failed against the repo’s config due missing local peer packages like `@eslint/js`.

## Handoff Notes
- Focused verification is solid:
  - `npx vitest run server/__tests__/request-routing.test.ts server/__tests__/metrics.test.ts server/__tests__/api.test.ts` passed
  - result: `3` files passed, `59` tests passed
- The rebuilt API smoke suite now catches current route contracts instead of stale ones:
  - `/api/projects`, `/api/projects/:id/nodes`, `/api/projects/:id/bom`, and `/api/projects/:id/validation` are asserted as paginated `{ data, total }` collections
  - `/api/metrics` and `/api/docs` are exercised without requiring an already-running dev server
  - authenticated unknown `/api/*` paths now prove the JSON 404 contract
- Metrics/observability hardening in this slice:
  - SSE routes no longer rely on brittle mounted `req.path` checks in the main request pipeline
  - compression now explicitly bypasses known SSE routes
  - route metrics now normalize dynamic `agent`, `arduino`, and `firmware runtime` paths instead of fragmenting per-id/session
  - repeated `startMetricsCollection()` calls are now harmless

## Follow-up Debug Fix
- `server/vite.ts` - changed the dev HMR config to stop hardcoding `localhost`, so the Vite websocket now follows the current page hostname and no longer tears the module graph apart on `127.0.0.1`.
- `server/__tests__/vite.test.ts` - added regression coverage for the HMR host fallback config.
- `client/src/components/layout/sidebar/sidebar-constants.ts` - marked `procurement` as an always-visible workspace view so empty projects no longer get forced away from procurement to architecture.
- `client/src/components/layout/sidebar/__tests__/sidebar-constants.test.ts` - added a regression test proving procurement stays directly reachable.

### Follow-up Verification
```bash
npx vitest run server/__tests__/vite.test.ts client/src/components/layout/sidebar/__tests__/sidebar-constants.test.ts client/src/hooks/__tests__/use-toast.test.ts
```

- Browser verification on March 31, 2026:
  - launched a fresh Chrome window after the browser bridge was accidentally closed
  - loaded `http://127.0.0.1:5000/projects/21/procurement`
  - confirmed the page stayed on `/projects/21/procurement` after waiting
  - confirmed Vite console status changed from websocket failure to `[vite] connected.`
  - confirmed the post-reload console was clean except for the normal React DevTools notice
- One unrelated transient request showed up during the first load:
  - `GET /api/projects/21/arduino/profiles` returned `500` once, then returned `200` on retry
  - procurement, BOM, and history requests were stable on the clean reload

## Wave 6 UI Confidence Slice

**Task:** Continue the remediation program by surfacing release-confidence/readiness directly in export and ordering workflows
**Status:** done

### Changes Made
- `client/src/lib/workspace-release-confidence.ts` - added a shared adapter that converts workspace BOM, validation, architecture nodes, and edges into the existing scorecard engine with lifecycle-aware BOM enrichment.
- `client/src/components/ui/ReleaseConfidenceCard.tsx` - extracted the release-confidence UI into a reusable card so procurement, export, and ordering can share one trust language.
- `client/src/components/views/procurement/RiskScorecardPanel.tsx` - switched procurement to the shared adapter and shared card so its confidence UI becomes the canonical implementation instead of a one-off.
- `client/src/components/panels/ExportPanel.tsx` - added an `Export Release Confidence` card above the export trust receipt, using live BOM/validation/architecture signals from the current workspace.
- `client/src/components/views/PcbOrderingView.tsx` - added an `Order Readiness Confidence` card above the manufacturing preflight receipt, using live workspace readiness alongside the existing fab-specific receipt.
- `client/src/components/ui/__tests__/ReleaseConfidenceCard.test.tsx` - added focused rendering coverage for the shared confidence card.
- `client/src/lib/__tests__/workspace-release-confidence.test.ts` - added adapter coverage proving lifecycle intelligence flows into scorecard blockers/actions.
- `client/src/components/views/procurement/__tests__/RiskScorecardPanel.test.tsx` - tightened the mock typing so the shared card path stays type-safe under full repo typecheck.

### Commands Run
```bash
npx vitest run client/src/components/ui/__tests__/ReleaseConfidenceCard.test.tsx client/src/lib/__tests__/workspace-release-confidence.test.ts client/src/components/views/procurement/__tests__/RiskScorecardPanel.test.tsx
timeout 120s npm run check
```

### Verification
- Focused tests passed:
  - `3` files passed
  - `5` tests passed
- Full repo typecheck passed under the timeout-bounded run:
  - `timeout 120s npm run check`
- Browser verification on March 31, 2026:
  - `/projects/21/output` rendered `Export Release Confidence` above the export preflight receipt
  - `/projects/21/ordering` rendered `Order Readiness Confidence` above the manufacturing preflight receipt
  - both views showed the expected guided-confidence copy, blockers, and next actions
  - the selected-page console was clean during the final browser pass

### Next Steps
- Reuse the same shared release-confidence card in simulation and AI apply/review flows so all high-trust surfaces speak one readiness language.
- Connect the scorecard to checkpoint/recovery state once Wave 2 recovery indicators are implemented, so confidence can degrade when the workspace is stale or mid-recovery.
- Add surface-level tests for export and ordering once there is a lightweight render harness for those larger views.

## Wave 6 Simulation + AI Confidence Slice

**Task:** Extend the shared release-confidence/readiness layer into simulation and AI trust surfaces
**Status:** done

### Changes Made
- `client/src/components/simulation/SimulationPanel.tsx` - added a `Simulation Readiness Confidence` card above the simulation trust ladder so simulation inherits the same workspace-level readiness framing as export and ordering.
- `client/src/components/panels/chat/DesignAgentPanel.tsx` - added an `AI Project Readiness Confidence` card above the design-agent trust receipt so AI setup/autonomy truth is paired with project readiness truth.
- `client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx` - mocked architecture/BOM/validation context and added coverage proving the design agent now renders the shared confidence layer.

### Commands Run
```bash
npx vitest run client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx client/src/components/ui/__tests__/ReleaseConfidenceCard.test.tsx client/src/lib/__tests__/workspace-release-confidence.test.ts client/src/components/views/procurement/__tests__/RiskScorecardPanel.test.tsx
timeout 120s npm run check
timeout 180s npm run check
```

### Verification
- Focused tests passed:
  - `4` files passed
  - `8` tests passed
- Full repo typecheck passed:
  - `timeout 180s npm run check`
- Browser verification on March 31, 2026:
  - `/projects/21/simulation` rendered `Simulation Readiness Confidence` above the simulation trust ladder
  - the Design Agent tab rendered `AI Project Readiness Confidence` above the design-agent trust receipt
  - both surfaces showed guided-confidence copy plus blockers/actions tied to the current workspace state
  - the selected-page console was clean during the final browser pass

### Next Steps
- Bring the same confidence layer into the normal chat pending-action/apply-review flow so ad hoc AI edits stop feeling less trustworthy than the design agent.
- Feed checkpoint/recovery and stale-state signals into the scorecard once those shell indicators land, so AI and simulation confidence can drop when the workspace truth is degraded.
- Add a lightweight simulation render harness so this panel can get direct component-level tests instead of relying mostly on shared builder coverage plus browser verification.

## Chat Pending-Action Trust Receipt Slice

**Task:** Extend the shared AI trust/release-confidence language into the normal chat pending-action review flow
**Status:** done

### Changes Made
- `client/src/components/panels/ChatPanel.tsx` - attached trust receipts to pending chat action bundles, fixed the pending-review message correlation bug by matching on persisted `clientId` metadata, and hardened assistant message creation so review state survives the optimistic/server round-trip.
- `client/src/components/panels/chat/MessageBubble.tsx` - renders the pending-action trust receipt inline above `ActionPreviewList` and now falls back to a stable key when tool calls arrive without an explicit `id`.
- `client/src/components/panels/chat/chat-types.ts` - added the shared `PendingActionReview` shape.
- `client/src/components/panels/chat/hooks/useChatMessaging.ts` - upgraded pending-action state to use the full review object instead of a bare action/message pair.
- `client/src/lib/trust-receipts.ts` - added `buildChatActionTrustReceipt()` for grounded/source-aware chat action review guidance.
- `client/src/lib/project-context.tsx` - extended `ChatMessage` with optional `clientId` so client/server correlation can survive persistence.
- `client/src/lib/contexts/chat-context.tsx` - serializes and hydrates `clientId` through chat metadata.
- `client/src/components/ui/TrustReceiptCard.tsx` - hardened mapped key generation for facts and warnings to eliminate duplicate-key noise in repeated receipt content.
- `client/src/components/panels/chat/__tests__/MessageBubble.test.tsx` - added pending-review receipt rendering coverage.
- `client/src/lib/__tests__/trust-receipts.test.ts` - added grounded/source-light/low-confidence coverage for chat action receipts.
- `client/src/lib/contexts/__tests__/chat-context.test.tsx` - added regression coverage proving `clientId` is serialized on write and hydrated on read.

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/trust-receipts.test.ts client/src/components/panels/chat/__tests__/MessageBubble.test.tsx client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx
npx vitest run client/src/lib/__tests__/trust-receipts.test.ts client/src/components/panels/chat/__tests__/MessageBubble.test.tsx client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx client/src/lib/contexts/__tests__/chat-context.test.tsx
npx vitest run client/src/components/panels/chat/__tests__/MessageBubble.test.tsx client/src/components/ui/__tests__/TrustReceiptCard.test.tsx client/src/lib/contexts/__tests__/chat-context.test.tsx
timeout 300s npm run check
```

### Verification
- Focused tests passed:
  - `4` files passed / `39` tests passed on the correlation + receipt slice
  - final targeted rerun passed `3` files / `16` tests after the console-noise hardening
- Full repo typecheck passed:
  - `timeout 300s npm run check`
- Browser verification on March 31, 2026:
  - live chat pending-review flow rendered `REVIEW PROPOSED CHANGES`
  - the assistant message showed `AI action review receipt`, `Review-first`, `86%` confidence, source trail facts, and `Discard` / `Confirm & Apply`
  - the original correlation bug was reproduced first: toast fired but the receipt failed to mount because persisted chat IDs did not match the local pending-review ID
  - after the `clientId` fix, the same staged review flow mounted the receipt under the correct assistant message
  - the duplicate-key warning inside `MessageBubble` was removed by hardening tool-call keys and receipt list keys
- Cleanup:
  - removed the temporary fake Gemini verification key from both server-side settings and localStorage after the browser pass

### Residual Notes
- The selected-page console still shows transient `500` page-load failures for several Arduino endpoints (`workspace`, `profiles`, `jobs`, `files`, `libraries/installed`) before those same requests succeed on retry; this predates the chat receipt slice and remains a separate backend/runtime issue.

### Next Steps
- Apply the same trust-receipt pattern to any future chat-side AI review queue or approval drawer so the wording stays consistent across chat, design agent, and batch AI actions.
- Investigate the transient Arduino route `500` burst on initial page load, since it is still the main source of console noise during clean browser verification.
- Consider adding stable `id` generation for server-reported tool calls so the fallback key path stays defensive rather than routinely exercised.

## Inline Restore Point Action From Project Health

**Task:** Make the project-health warning actionable in place by letting users create a restore point from the sidebar without losing their current workspace view
**Status:** done

### Changes Made
- `client/src/lib/project-health.ts` - extended the health summary with `actionLabel` and `actionMode` so health states can distinguish between navigation-only recovery actions and inline restore-point creation.
- `client/src/lib/query-keys.ts` - added a project-scoped `designSnapshots` mutation key so inline snapshot creation can participate cleanly in save-state tracking.
- `client/src/components/layout/Sidebar.tsx` - upgraded the health panel action to create a restore point inline when none exists, invalidate snapshot state on success, and show success/error toasts without forcing a route change.
- `client/src/pages/workspace/WorkspaceHeader.tsx` - kept the compact header badge as a navigation shortcut to Design History, with clearer accessibility naming.
- `client/src/lib/__tests__/project-health.test.ts` - added regression coverage for the new action modes.
- `client/src/components/layout/__tests__/Sidebar.test.tsx` - added coverage proving the sidebar action creates a restore point inline and still routes to Design History when review is the correct action.
- `client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx` - updated the header badge expectations to match the clarified recovery navigation behavior.

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/project-health.test.ts client/src/components/layout/__tests__/Sidebar.test.tsx client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `3` files passed / `18` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 3, 2026:
  - loaded `http://127.0.0.1:5000/projects/21/simulation`
  - confirmed the left health panel initially showed `No restore point yet` with a `Create restore point` action
  - clicked the sidebar action and stayed on `/projects/21/simulation`
  - confirmed the health state flipped to `Saved + restore`
  - confirmed the detail text updated to `Saved with 1 restore point`
  - confirmed the action changed to `Review snapshots`
  - confirmed the success toast `Restore point saved` appeared
  - final selected-page console check showed no errors or warnings

### Next Steps
- Extend the same health model with true `stale`, `recovered`, and `checkpoint available` states once those signals exist reliably.
- Add firmware- and AI-action recovery signals so hardware and AI flows share the same restore/trust language.
- Start the next audit tranche on hardware safety and device preflight, especially board/port/profile mismatch handling.

## Arduino Upload Target Safety And Device Preflight

**Task:** Harden hardware safety by checking the selected Arduino profile against the CLI-detected device list before allowing uploads
**Status:** done

### Changes Made
- `client/src/lib/arduino/device-preflight.ts` - added normalization for Arduino CLI board-discovery output plus an upload-target assessment that classifies `checking`, `matched`, `port_missing`, `board_mismatch`, and `device_unidentified` states.
- `client/src/lib/contexts/arduino-context.tsx` - fixed `listBoards()` to unwrap the real `boards/discover` response shape (`{ detected_ports: [...] }`) instead of pretending `json.data` is always an array.
- `client/src/lib/trust-receipts.ts` - extended the Arduino trust receipt with detected-device and port-safety facts, and added caution paths for missing/mismatched hardware.
- `client/src/components/views/ArduinoWorkbenchView.tsx` - now fetches detected boards when a profile port is configured, disables upload while the board check is running, and blocks upload with a destructive toast plus profile-dialog handoff when the detected hardware does not match the selected upload target.
- `client/src/components/views/arduino/ArduinoToolbar.tsx` - disables the Upload button when hardware preflight blocks it and exposes the blocker reason via the button description/title.
- `client/src/lib/arduino/__tests__/device-preflight.test.ts` - added focused coverage for board-list normalization, missing-port blocking, board-mismatch blocking, and matched-device success.
- `client/src/lib/__tests__/trust-receipts.test.ts` - added coverage proving the Arduino receipt falls into a `Check board` caution state when the selected profile disagrees with the detected device.

### Commands Run
```bash
npx vitest run client/src/lib/arduino/__tests__/device-preflight.test.ts client/src/lib/__tests__/trust-receipts.test.ts
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `2` files passed / `26` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 3, 2026:
  - created a temporary Arduino profile for project `21` with `fqbn=arduino:avr:uno` and `port=/dev/ttyACM0`
  - opened `/projects/21/arduino`
  - confirmed the Upload button was disabled during device discovery with the description `Checking the connected board before upload.`
  - waited for board discovery to finish with no connected hardware detected
  - confirmed the Upload button stayed disabled and updated its description to `Arduino CLI did not detect any connected boards. Reconnect the target device or refresh the selected port before uploading.`
  - confirmed the Arduino receipt exposed:
    - `Detected device: No device detected`
    - `Port safety: Device missing`
  - confirmed the selected-page console was clean after a full hard reload
- Cleanup:
  - deleted the temporary verification profile after the browser pass so project `21` was not left with fake hardware configuration

### Residual Notes
- During live verification, a hot-reload moment temporarily triggered `useArduino must be used within ArduinoProvider`; a full reload cleared it and the final runtime verification was clean. This looked like an HMR/export compatibility edge case rather than a persisted app-state failure.

### Next Steps
- Extend the same preflight logic into the Serial Monitor so board filters, detected USB identity, and Arduino upload targets stop behaving like separate worlds.
- Add a manual `Refresh device check` affordance in the workbench so users do not need to wait on passive rediscovery when swapping boards.
- Consider surfacing a shared shell-level hardware status rail so Arduino, Serial Monitor, and AI hardware actions all speak the same readiness language.

## Arduino Workspace Bootstrap Healing

**Task:** Investigate and harden the transient Arduino cold-start/bootstrap path
**Status:** done

### Changes Made
- `server/arduino-service.ts` - made `ensureWorkspace()` idempotent and self-healing by recreating missing workspace directories for existing DB rows, and added an in-flight promise map so concurrent cold-start requests for the same project cannot race into split workspace bootstrap state.
- `server/arduino-service.ts` - updated `scanWorkspace()` to recreate the root directory before scanning so stale DB rows no longer produce `ENOENT` warnings during normal page load.
- `server/__tests__/arduino-workspace.test.ts` - added focused regression coverage for:
  - healing an existing workspace row whose directory is gone
  - deduplicating concurrent `ensureWorkspace()` calls
  - recreating the root directory before scan

### Commands Run
```bash
npx vitest run server/__tests__/arduino-workspace.test.ts server/__tests__/arduino-jobs.test.ts server/__tests__/arduino-sse.test.ts
timeout 300s npm run check
curl -s -H 'X-Session-Id: dc994408-58e0-4bdb-9eaf-39346f9d7725' http://localhost:5000/api/projects/21/arduino/workspace
ls -ld /home/wtyler/Projects/ProtoPulse/data /home/wtyler/Projects/ProtoPulse/data/sketches /home/wtyler/Projects/ProtoPulse/data/sketches/project_21
```

### Verification
- Focused Arduino server tests passed:
  - `3` files passed / `43` tests passed
- Browser verification on April 1, 2026:
  - reloaded `/projects/21/simulation`
  - all Arduino startup requests returned `200`:
    - `/arduino/health`
    - `/arduino/workspace`
    - `/arduino/profiles`
    - `/arduino/jobs`
    - `/arduino/files`
    - `/arduino/libraries/installed`
    - `/arduino/cores/list`
  - final selected-page console check was clean
- Shell verification on April 1, 2026:
  - direct authenticated call to `/api/projects/21/arduino/workspace` returned the existing workspace row
  - after that call, `/home/wtyler/Projects/ProtoPulse/data/sketches/project_21` existed on disk again
- Behavioral improvement:
  - the old `[arduino:scan] ENOENT` warning no longer appeared after the workspace-healing pass

### Residual Notes
- I could not claim a full repo typecheck pass for this slice. `timeout 300s npm run check` never surfaced TypeScript errors, but it still timed out at 300 seconds in this environment.
- The earlier transient Arduino `500` burst did not reproduce on the final clean backend run, so this fix is anchored to the concrete stale-workspace inconsistency I verified live rather than a re-captured `500` stack trace.

### Next Steps
- Add a lightweight route-level Arduino cold-start test that exercises `/workspace`, `/files`, `/profiles`, and `/jobs` together so the bootstrap burst is covered above the service layer.
- Consider surfacing a tiny workspace-healed event or debug metric so future stale-disk issues are visible without needing log spelunking.
- If the startup `500` burst reappears, the next place to instrument is the shared Arduino route cold-load fanout in `ArduinoProvider`, now that the workspace-healing path is stable.

## Arduino Route Cold-Start Regression

**Task:** Lock the Arduino browser-style startup fanout behind a route-level regression test
**Status:** done

### Changes Made
- `server/__tests__/arduino-routes.test.ts` - added a route-level cold-start harness that exercises the Arduino startup fanout through Express route handling without binding a real TCP port.
- `server/__tests__/arduino-routes.test.ts` - covered the parallel startup set:
  - `/api/projects/21/arduino/workspace`
  - `/api/projects/21/arduino/files`
  - `/api/projects/21/arduino/profiles`
  - `/api/projects/21/arduino/jobs`
  - `/api/projects/21/arduino/libraries/installed`
  - `/api/projects/21/arduino/cores/list`
- `server/__tests__/arduino-routes.test.ts` - added a stale-workspace-row route test proving route access heals the missing root directory and does not emit warning noise.

### Commands Run
```bash
npx vitest run server/__tests__/arduino-routes.test.ts server/__tests__/arduino-workspace.test.ts server/__tests__/arduino-jobs.test.ts server/__tests__/arduino-sse.test.ts
```

### Verification
- Focused Arduino route + service tests passed:
  - `4` files passed / `45` tests passed
- Behavioral guarantees locked by the new route test:
  - parallel startup endpoints return `200`
  - workspace bootstrap only creates one workspace row
  - mkdir/bootstrap work stays scoped to the real project sketch root
  - stale workspace rows heal during route access instead of degrading into warning noise

### Residual Notes
- This slice is test-only, so I did not run a new browser pass.
- The route harness intentionally avoids `app.listen()` because port binding is restricted in this sandbox; it drives `app.handle()` directly instead.

### Next Steps
- If the Arduino cold-start burst resurfaces in the browser, add one more integration-style regression around the exact client startup sequence and query timing rather than only the route fanout.
- Consider capturing a tiny route/bootstrap metric for `workspace healed` events so future stale-disk issues show up in observability without manual reproduction.

## Project Picker Truth Cleanup

**Task:** Fix the project-picker stale recent-project / stale last-project truth bug
**Status:** done

### Changes Made
- `client/src/pages/ProjectPickerPage.tsx` - stopped trusting dead recent-project IDs, added cleanup for stale recent entries and stale last-project IDs after the live project list loads, and prevented stale recent clicks from navigating into a dead project route.
- `client/src/pages/ProjectPickerPage.tsx` - added a user-facing destructive toast when a recent project is no longer available instead of silently navigating into a `Not found` bounce.
- `client/src/components/layout/RecentProjectsList.tsx` - added live-project filtering so the recent-projects surface only renders entries that are still actually available in the current project list.
- `client/src/lib/project-navigation-state.ts` - added `clearCurrentLastProjectId()` so the picker can remove only the current scoped last-project value instead of blasting all scoped history.
- `client/src/pages/__tests__/ProjectPickerPage.test.tsx` - added regressions for stale recent-project pruning and stale last-project cleanup, plus reset the recent-project manager between tests so storage-backed picker behavior stays isolated.

### Commands Run
```bash
npx vitest run client/src/pages/__tests__/ProjectPickerPage.test.tsx client/src/lib/__tests__/recent-projects.test.ts
timeout 180s npm run check
```

### Verification
- Focused client tests passed:
  - `2` files passed / `128` tests passed
- Browser verification on April 1, 2026:
  - opened `http://127.0.0.1:5000/projects`
  - injected a fake dead recent project (`projectId: 999`) and a fake dead scoped last-project ID into localStorage
  - reloaded the picker
  - confirmed the page stayed on `/projects`
  - confirmed the stale recent entry did not render
  - confirmed the surviving valid recent entry still rendered
  - confirmed localStorage was rewritten to remove the dead recent entry and clear the dead last-project ID
  - final console check was clean aside from normal Vite/React DevTools notices

### Residual Notes
- `timeout 180s npm run check` timed out without surfacing TypeScript errors, so I am not claiming a fresh full-repo typecheck pass for this slice.
- This fix handles the picker-side truth problem directly. If inaccessible projects can still appear in the main `/api/projects` list itself, that would be a separate backend/data-visibility issue.

### Next Steps
- If we want to go further, add a lightweight “Unavailable project removed from recents” inline status near the recent-projects header so the cleanup feels less magical.
- Investigate whether the long tail of old `E2E Test Project` entries in the main project list should be archived or hidden by default, because they still create visual noise even though they are technically real.

## Project Picker Command Center Upgrade

**Task:** Implement the next picker upgrade batch: subtle recent-cleanup messaging, archive/hide controls for noisy projects, backend sanity checks for `/api/projects`, and status facets for the home surface
**Status:** done

### Changes Made
- `client/src/pages/ProjectPickerPage.tsx`
  - added a command-center facet strip with `Recent`, `Sample`, `Learning`, `Experimental`, and `Archived` counts
  - upgraded the main project grid to filter by facet instead of staying flat
  - added project status badges so cards explain why they are in a bucket
  - added local archive/hide controls on project cards plus restore controls in the archived view
  - added the subtle `Removed unavailable project from recents.` helper note under the recent-projects header
  - kept stale recent/last-project cleanup honest while avoiding interference with brand-new project creation
- `client/src/components/layout/RecentProjectsList.tsx`
  - added optional helper text support so recent cleanup can be explained in-place
  - kept recent-project rendering filtered to live visible project IDs
- `client/src/lib/project-picker-visibility.ts`
  - added scoped local-storage support for hiding/restoring projects from the home picker
  - added pruning for stale hidden-project IDs
- `client/src/pages/__tests__/ProjectPickerPage.test.tsx`
  - added coverage for the recent-cleanup helper note
  - added facet filtering coverage for sample projects
  - added archive/restore coverage for picker-hidden projects
- `server/lib/project-list-sanity.ts`
  - added a pure sanity checker for suspicious `/api/projects` rows
  - flags ownerless rows, leaked soft-deleted rows, blank names, and duplicate IDs
- `server/routes/projects.ts`
  - wired the sanity checker into `GET /api/projects`
  - now emits a structured warning when anomalous project rows appear
- `server/lib/__tests__/project-list-sanity.test.ts`
  - added focused unit tests for the backend anomaly detector

### Commands Run
```bash
npx vitest run client/src/pages/__tests__/ProjectPickerPage.test.tsx server/lib/__tests__/project-list-sanity.test.ts
timeout 180s npm run check
```

### Verification
- Focused tests passed:
  - `2` files passed / `75` tests passed
- Browser verification on April 1, 2026:
  - loaded `http://127.0.0.1:5000/projects`
  - confirmed the new command-center cards and facet filters render with real counts
  - injected a fake dead recent project into localStorage and reloaded
  - confirmed the subtle helper note rendered: `Removed unavailable project from recents.`
  - confirmed the ghost recent entry did not render and the valid recent entry remained
  - hid an `E2E Test Project` from the main list and verified:
    - `Archived` count incremented
    - the project disappeared from the active list
    - the toast confirmed it moved to archived
  - switched to the `Archived` facet and confirmed the project rendered there with a `Restore` control
  - restored it and confirmed the project returned to the active list and the archived count dropped back down
  - switched to the `Sample` facet and confirmed only sample-derived projects remained in the grid
  - final console check was clean aside from normal Vite/React DevTools notices

### Residual Notes
- `timeout 180s npm run check` still timed out in this environment, so I am not claiming a fresh full-repo typecheck pass for this slice.
- The backend sanity check is intentionally warning-only; it does not mutate `/api/projects` results or block responses.

### Next Steps
- Add a lightweight bulk action for archiving multiple experimental/test projects from the picker in one move.
- Consider persisting the active picker facet so people who mostly live in `Recent` or `Learning` land there by default.
- If ownerless legacy projects are still expected for a while, consider downgrading `owner missing` to a separate `legacy-ownerless` warning bucket so the sanity log is more actionable.

## Workspace Sidepanel Hover Peek

**Task:** Add desktop hover-reveal behavior for both workspace side panels without breaking the existing collapse model
**Status:** done

### Changes Made
- `client/src/pages/ProjectWorkspace.tsx`
  - added a shared `HoverPeekDock` wrapper around both the left sidebar and right AI panel
  - wired the workspace shell so collapsed panels temporarily peek open on desktop hover/focus and auto-hide again on leave
  - kept the persisted `sidebarCollapsed` / `chatCollapsed` state unchanged so hover peeking stays transient
  - preserved the existing resize-handle behavior for permanently expanded panels
- `client/src/pages/workspace/useHoverPeekPanel.ts`
  - added a reusable hover-peek hook with delayed auto-hide behavior and mobile/collapsed guards
  - ensures hover timers clear cleanly on re-entry, unmount, and permanent re-expansion
- `client/src/pages/workspace/__tests__/useHoverPeekPanel.test.ts`
  - added focused coverage for open-on-hover, mobile guardrails, delayed hide, hide-cancel on re-entry, and reset-on-expand
- `server/__tests__/arduino-routes.test.ts`
  - fixed the Express test harness typing so full repo typecheck passes again

### Commands Run
```bash
npx vitest run client/src/pages/workspace/__tests__/useHoverPeekPanel.test.ts client/src/pages/workspace/__tests__/workspace-reducer.test.ts
npx vitest run server/__tests__/arduino-routes.test.ts client/src/pages/workspace/__tests__/useHoverPeekPanel.test.ts
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `2` files passed / `11` tests passed for the workspace hover hook + reducer slice
  - `2` files passed / `7` tests passed for the Arduino route harness + hover hook follow-up
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 1, 2026:
  - opened `http://127.0.0.1:5000/projects/21/simulation`
  - collapsed the left and right panels from the workspace header
  - hovered the left collapsed rail and confirmed the full sidebar peeks open while the header still reports `Show sidebar`
  - moved away and confirmed the left side returns to the collapsed rail
  - confirmed the right AI panel peeks open from the collapsed rail and returns to the vertical collapsed rail after leave
  - captured a verification screenshot: `workspace-hover-peek-verification`
  - performed a fresh page reload and confirmed the final console was clean apart from normal Vite / React DevTools messages

### Residual Notes
- During the first live pass, `GET /api/projects/21/arduino/files` threw a transient `500`, but a direct replay and a clean page reload both returned `200`, so I did not fold Arduino file-route changes into this UI tranche.
- The new hover behavior is desktop-only and intentionally tied to the existing collapsed state. Mobile drawer behavior is unchanged.

### Next Steps
- Add a visible “auto-hide rail” preference so people can choose between pinned and hover-peek behavior explicitly.
- Add a subtle edge glow or affordance on collapsed rails so the hover-peek capability is more discoverable.
- If we want to push this further, add the same transient-peek pattern to any future inspector or diagnostics slide-over panels so the workspace shell behaves consistently.

## Project Health / Recovery Signals

**Task:** Ship a first real workspace health layer so ProtoPulse surfaces save state and restore availability instead of a fake “all good” footer
**Status:** done

### Changes Made
- `client/src/lib/project-health.ts`
  - added a shared project-health model that combines live save state with design snapshot availability
  - computes honest states for `Saving`, `Saved`, `Saved + restore`, and `Restore unknown`
  - tracks both total restore points and manufacturing checkpoints derived from saved design snapshots
- `client/src/lib/query-keys.ts`
  - added a canonical `designSnapshots(projectId)` query key for the new recovery signal
- `client/src/components/layout/Sidebar.tsx`
  - replaced the old one-line save footer with a real project-health indicator
  - now shows a badge, summary, recovery detail, and fact pills like `No restore point yet` or saved restore counts
- `client/src/pages/workspace/WorkspaceHeader.tsx`
  - added a compact health badge in the header so the signal stays visible even when the sidebar is collapsed
  - wired it to the same project mutation/save cadence as the sidebar
- `client/src/lib/__tests__/project-health.test.ts`
  - added focused coverage for the health state machine
- `client/src/components/layout/__tests__/Sidebar.test.tsx`
  - updated sidebar coverage for the new health indicator
- `client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`
  - added coverage for the new header health badge

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/project-health.test.ts client/src/components/layout/__tests__/Sidebar.test.tsx client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `3` files passed / `16` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 1, 2026:
  - opened `http://127.0.0.1:5000/projects/21/simulation`
  - confirmed the header now shows a compact `Saved` health badge while the sidebar is collapsed
  - expanded the sidebar and confirmed the detailed project-health panel rendered:
    - badge: `Saved`
    - summary: `All changes saved`
    - detail text explaining there is no restore point yet
    - fact pill: `No restore point yet`
  - confirmed the health copy matched the actual empty-snapshot state of the project instead of implying recovery coverage that does not exist
  - captured a verification screenshot at `/tmp/project-health-verification.png`
  - final console check returned no warnings or errors

### Residual Notes
- This first slice is intentionally conservative: it uses real design snapshot availability as the saved restore signal and does not pretend session-level undo is a durable restore point.
- The current project used for browser verification has no saved design snapshots, so the UI correctly lands in the “saved but no restore point yet” state.

### Next Steps
- Add a one-click action from the health panel into `Design History` so the warning state is immediately actionable.
- Extend the same health layer with `stale`, `recovered`, and `checkpoint available` states once those signals exist reliably.
- Fold firmware snapshots and manufacturing export checkpoints into a richer cross-domain recovery story for hardware-heavy projects.

## Project Health Recovery CTA

**Task:** Make the new project-health warning actionable so users can immediately create or review restore points
**Status:** done

### Changes Made
- `client/src/lib/project-health.ts`
  - added state-specific `actionLabel` values so health surfaces can guide users toward the right recovery action
  - action labels now change based on whether ProtoPulse wants the user to create, check, or review restore points
- `client/src/components/layout/Sidebar.tsx`
  - added a `project-health-action` button below the detailed recovery readout
  - clicking it now routes directly to `design_history`
- `client/src/pages/workspace/WorkspaceHeader.tsx`
  - turned the compact health badge into a real button
  - clicking the badge now routes directly to `design_history`
  - the tooltip now includes the corresponding recovery action text
- `client/src/lib/__tests__/project-health.test.ts`
  - extended coverage for the new action labels
- `client/src/components/layout/__tests__/Sidebar.test.tsx`
  - added coverage proving the sidebar recovery action opens `design_history`
- `client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`
  - added coverage proving the header badge routes to `design_history`

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/project-health.test.ts client/src/components/layout/__tests__/Sidebar.test.tsx client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `3` files passed / `17` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 3, 2026:
  - opened `http://127.0.0.1:5000/projects/21/simulation`
  - confirmed the header badge renders as `Create restore point`
  - clicked the header badge and verified the route changed to `/projects/21/design_history`
  - confirmed `Design Version History` loaded and the `Save Snapshot` button was visible
  - returned to `/projects/21/simulation`
  - clicked the sidebar `Create restore point` action and verified it also landed on `/projects/21/design_history`
  - final console check returned no warnings or errors

### Residual Notes
- This slice intentionally routes users to the existing snapshot workflow instead of auto-creating a snapshot behind their backs.
- The current verification project still has zero saved snapshots, so both entry points correctly guide the user into the empty-state Design History surface.

### Next Steps
- Add a lightweight `Save Snapshot` quick action from the sidebar health panel if we want to reduce one more click without introducing hidden persistence.
- Extend the same actionability to the `Restore unknown` state with retry affordances when snapshot verification fails.
- Add a “last restore point” fact so the health UI shows not just whether recovery exists, but how fresh it is.

## Serial Monitor Device Preflight Alignment

**Task:** Carry the hardware trust/preflight language into Serial Monitor so it reflects Arduino profile context, selected board filters, and the active project correctly
**Status:** done

### Changes Made
- `client/src/lib/arduino/serial-device-preflight.ts`
  - added a reusable serial-device assessment helper that compares the connected device against:
    - the selected serial board filter
    - the active Arduino build profile
  - returns normalized trust states:
    - `not_connected`
    - `matched`
    - `filter_mismatch`
    - `profile_mismatch`
    - `device_unidentified`
- `client/src/components/panels/SerialMonitorPanel.tsx`
  - resolved the active project with `useProjectId()` instead of silently defaulting the standalone Serial Monitor view to project `1`
  - wired the panel to `useArduino()` so it can read the default Arduino profile for the current project
  - normalized the board filter state so `Any device` does not leak through as a literal persisted filter value
  - fed the new serial-device preflight assessment into the trust receipt
- `client/src/lib/trust-receipts.ts`
  - expanded the serial trust receipt with new facts:
    - `Detected device`
    - `Arduino profile`
    - `Board safety`
  - added caution states for:
    - profile mismatch
    - filter mismatch
    - unidentified connected devices
- `client/src/lib/arduino/__tests__/serial-device-preflight.test.ts`
  - added focused coverage for matched, filter-mismatch, and profile-mismatch cases
- `client/src/lib/__tests__/trust-receipts.test.ts`
  - extended serial receipt coverage for the new board-safety facts and mismatch guidance

### Commands Run
```bash
npx vitest run client/src/lib/arduino/__tests__/serial-device-preflight.test.ts client/src/lib/__tests__/trust-receipts.test.ts
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `2` files passed / `26` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 3, 2026:
  - opened `http://127.0.0.1:5000/projects/21/serial_monitor`
  - verified the Serial Monitor receipt now shows:
    - `Detected device`
    - `Arduino profile`
    - `Board safety`
  - created a temporary default Arduino profile for project `21` and reloaded
  - confirmed the receipt reflected the project board context:
    - `Arduino profile: Serial Safety Check`
    - warning text explaining the serial monitor was still set to `Any device`
  - changed the board filter to `Arduino Uno/Mega (ATmega16U2)` and confirmed the warning about `Any device` disappeared
  - deleted the temporary verification profile and hard reloaded
  - confirmed the normal steady state returned to `Arduino profile: No Arduino profile`
  - final console check after cleanup reload returned no warnings or errors

### Residual Notes
- The mismatch UI is fully covered in unit tests, but live browser verification was limited to disconnected-state behavior because no physical serial device was attached during this pass.
- Clicking `AI Copilot` from the disconnected serial panel still returns a `400 Missing code or serialLogs` toast when no sketch/log context exists; that behavior predates this slice and was not changed here.

### Next Steps
- Add the same preflight facts into the Troubleshoot Wizard so the recovery flow starts from the same board/profile truth the main receipt now uses.
- Gate `AI Copilot` behind a cleaner readiness check so disconnected empty-state sessions do not produce avoidable `400` toasts.
- Cross-check the serial session against the Arduino upload target more aggressively once a real device is connected, so upload and monitor trust states converge into one hardware rail.

## Serial Copilot and Troubleshooter Truthfulness

**Task:** Continue the hardware audit remediation by making Serial Monitor AI and troubleshooting flows honest in empty or mismatched hardware states
**Status:** done

### Changes Made
- `client/src/lib/arduino/hardware-co-debug.ts`
  - added a shared readiness helper for the Serial Monitor AI Copilot path
  - blocks the action entirely when neither sketch code nor serial logs exist
  - permits partial-context runs by filling the missing side with explicit placeholders so the backend receives intentional context instead of empty fields
- `client/src/components/panels/SerialMonitorPanel.tsx`
  - wired the new AI readiness helper into the `AI Copilot` button
  - disables the button in true empty-state sessions with a clear blocker reason in the tooltip/description
  - routes the preflight facts already shown in the main receipt into the Troubleshoot Wizard context:
    - detected device
    - Arduino profile
    - board safety
    - blocker reason
- `client/src/lib/arduino/serial-troubleshooter.ts`
  - extended `SerialContext` with hardware preflight truth fields
  - changed step ordering so `board-selection` is no longer skipped when a selected board is actually flagged as mismatched
- `client/src/components/arduino/TroubleshootWizard.tsx`
  - added a `Current hardware truth` summary block that surfaces the live device/profile/safety context and any blocker reason before the user starts stepping through diagnosis
- `client/src/lib/arduino/__tests__/hardware-co-debug.test.ts`
  - added unit coverage for empty-state blocking and partial-context fallback behavior
- `client/src/components/arduino/__tests__/TroubleshootWizard.test.tsx`
  - added coverage for the new hardware-preflight summary UI
- `client/src/lib/arduino/__tests__/serial-troubleshooter.test.ts`
  - added regression coverage proving `board-selection` is prioritized when the selected board is mismatched

### Commands Run
```bash
npx vitest run client/src/lib/arduino/__tests__/hardware-co-debug.test.ts client/src/components/arduino/__tests__/TroubleshootWizard.test.tsx client/src/lib/arduino/__tests__/serial-troubleshooter.test.ts
timeout 600s npm run check
```

### Verification
- Focused tests passed:
  - `3` files passed / `62` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 3, 2026:
  - reloaded `http://127.0.0.1:5000/projects/21/serial_monitor`
  - confirmed the live receipt still showed the correct disconnected-state preflight facts:
    - `Detected device: Not connected`
    - `Arduino profile: No Arduino profile`
    - `Board safety: Not checked`
  - confirmed `AI Copilot` was disabled in the real empty-state UI
  - confirmed the button description explained the blocker instead of allowing a broken request:
    - `AI Copilot needs sketch code, serial logs, or both before it can diagnose hardware issues.`
  - final console check after reload showed only normal dev messages:
    - `[vite] connecting...`
    - `[vite] connected.`
    - React DevTools info banner

### Residual Notes
- The new Troubleshoot Wizard hardware summary is covered by component tests and wired into the live panel flow, but I did not force-open the wizard in the browser because the natural trigger still requires a connected session that receives no data for 10 seconds.
- The backend `POST /api/projects/:id/arduino/co-debug` route still formally expects both `code` and `serialLogs`; the new client helper satisfies that contract by sending explicit placeholders when only one side of context is available.

### Next Steps
- Carry the same hardware truth into the Troubleshoot Wizard conclusion so the final diagnosis summary repeats the exact device/profile mismatch that triggered it.
- Add a shell-level hardware trust rail so Arduino upload, Serial Monitor, and future troubleshooting share one status model instead of adjacent receipts.
- Consider softening or reshaping the server-side `co-debug` validation contract so partial-context diagnosis becomes a first-class backend behavior, not just a client-assisted compatibility path.

## Breadboard Deep-Link Redirect Fix

**Task:** Stop the workspace from bouncing the Breadboard route back to Architecture for empty projects
**Status:** done

### Changes Made
- `client/src/components/layout/sidebar/sidebar-constants.ts`
  - added `breadboard` to `alwaysVisibleIds`
  - this keeps `/projects/:id/breadboard` from being treated like a hidden deep link when a project has no architecture nodes yet
- `client/src/lib/__tests__/hardware-workspace-status.test.ts`
  - refreshed the `ArduinoJob` test fixture to match the current schema so repo-wide typecheck passes again

### Commands Run
```bash
npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx client/src/components/layout/__tests__/Sidebar.test.tsx client/src/lib/__tests__/hardware-workspace-status.test.ts
npx vitest run client/src/lib/__tests__/hardware-workspace-status.test.ts
timeout 600s npm run check
```

### Verification
- Focused regression slice passed:
  - `4` files passed / `44` tests passed
- Follow-up hardware status test passed:
  - `1` file passed / `4` tests passed
- Full repo typecheck passed:
  - `timeout 600s npm run check`
- Browser verification on April 3, 2026:
  - hard reloaded `http://127.0.0.1:5000/projects/21/breadboard`
  - confirmed the URL remained `/projects/21/breadboard` after reload and after an additional wait
  - confirmed the crash boundary was gone
  - confirmed the new Breadboard workbench rail rendered:
    - `data-testid="breadboard-workbench"`
    - `data-testid="breadboard-view"`
    - `data-testid="breadboard-empty"`
  - confirmed the page no longer redirected back to `architecture`

### Residual Notes
- The page stayed on Breadboard and rendered the new empty-state workbench correctly, but the selected browser tab still showed Vite websocket handshake errors in the dev console during this pass. That did not trigger the old Architecture redirect and did not break the Breadboard UI itself.
- The toolbar does not render in the zero-circuit state by design; the empty-state workbench and starter flow render instead.

### Next Steps
- Build the actual high-fidelity breadboard canvas experience further:
  - richer part artwork
  - pin-accurate placements
  - better starter part geometry
  - interactive wiring polish
- Investigate the current Vite HMR websocket handshake noise separately so browser verification stays cleaner during development.
- Add a direct `Create wiring canvas` success path that automatically focuses the new board and starter shelf after first creation.

## Breadboard Bench Intelligence + AI Tranche

**Task:** Use targeted web research to sharpen Breadboard Lab decisions, then implement the first inventory-aware + AI-wired bench shelf slice
**Status:** done

### Research Inputs Used
- Official/product sources reviewed before implementation:
  - Fritzing graphics / parts guidance and open parts ecosystem
  - Autodesk Tinkercad Circuits beginner-positioning docs/pages
  - Wokwi docs on diagram/part structure and custom chip extensibility
  - Google Gemini robotics / embodied reasoning docs for fit with spatial bench planning
- Product conclusions applied:
  - lean into physical bench realism and open part metadata like Fritzing
  - keep beginner-first entry points like Tinkercad
  - use structured part/connection metadata like Wokwi
  - route breadboard planning toward Gemini ER-style reasoning instead of plain generic chat prompts

### Changes Made
- `shared/component-types.ts`
  - added optional breadboard/bench metadata to `PartMeta`:
    - `breadboardFit`
    - `breadboardModelQuality`
    - `benchCategory`
    - `inventoryHint`
- `client/src/lib/project-context.tsx`
  - widened client BOM typing to include inventory fields already present server-side:
    - `storageLocation`
    - `quantityOnHand`
    - `minimumStock`
- `client/src/lib/breadboard-bench.ts`
  - added shared bench heuristics for:
    - breadboard fit inference
    - model-quality/trust inference
    - owned/on-hand matching from BOM
    - starter-friendly classification
    - bench summary totals
    - inventory digest generation for AI prompts
- `client/src/lib/breadboard-ai-prompts.ts`
  - added Breadboard Lab-specific prompt builders for:
    - explain current breadboard
    - diagnose likely wiring issues
    - suggest stash substitutes
    - Gemini ER-style build-from-stash planning
    - Gemini ER-style cleaner-layout planning
- `client/src/components/circuit-editor/ComponentPlacer.tsx`
  - added breadboard mode with filter chips:
    - `All`
    - `Owned`
    - `Bench-ready`
    - `Verified`
    - `Starter`
  - added per-part trust/inventory badges:
    - fit label
    - model-quality label
    - owned/on-hand state
    - storage hint
- `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx`
  - upgraded the workbench rail with bench intelligence stats:
    - owned
    - bench-ready
    - verified
    - starter-safe
    - low stock
  - added the new `Bench AI` card with quick actions
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - now derives bench insights from project parts + BOM
  - wires Breadboard Lab actions into chat and planner entry points
  - dispatches a chat-open event so breadboard AI actions can uncollapse/open the right rail
- `client/src/pages/ProjectWorkspace.tsx`
  - added a global `protopulse:open-chat-panel` listener that opens and uncollapses the AI rail
- `client/src/components/panels/ChatPanel.tsx`
  - listens for `protopulse:open-chat-panel`
  - can switch into the design-agent tab from another surface
  - seeds the design agent with a breadboard-specific planning prompt
- `client/src/components/panels/chat/DesignAgentPanel.tsx`
  - accepts seeded prompts so Breadboard Lab can prime Gemini ER-style planning instead of dumping users into a blank agent form
- Tests added/updated:
  - `client/src/lib/__tests__/breadboard-bench.test.ts`
  - `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - `client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx`

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/breadboard-bench.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx
rm -f /tmp/protopulse-check.log && timeout 180s npm run check >/tmp/protopulse-check.log 2>&1; status=$?; echo "STATUS:$status"; tail -n 80 /tmp/protopulse-check.log
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `34` tests passed
- Full repo typecheck passed:
  - `STATUS:0` from the logged `timeout 180s npm run check` run
- Browser verification on April 3, 2026:
  - reloaded `http://127.0.0.1:5000/projects/21/breadboard`
  - confirmed the Breadboard workbench rail rendered the new bench intelligence stats and filter chips
  - confirmed the bench shelf rendered fit/trust/ownership badges on project parts
  - confirmed `Explain this breadboard` opened the AI rail and injected a Breadboard Lab-specific prompt into chat
  - confirmed `Gemini ER: build from my stash` switched to the `Design Agent` tab and prefilled the seeded planning brief
  - confirmed the design-agent seed included inventory-aware and physical-layout guidance, not just a generic prompt

### Residual Notes
- The browser console still showed Vite HMR websocket handshake noise during this pass:
  - `WebSocket connection to 'ws://127.0.0.1:5000/vite-hmr?...' failed`
  - that did not block the new Breadboard Lab features, but it keeps the console from being fully clean during dev verification
- The current project used in verification still had no owned BOM-matched breadboard parts, so the `Owned` count stayed at `0`; the inventory-aware behavior is wired, but it needs richer project inventory to look impressive immediately
- The Gemini ER handoff is currently a seeded planner entry point, not a fully dedicated breadboard-specific agent mode yet

### Next Steps
- Build a dedicated `Owned Parts / Inventory Intake` surface for Breadboard Lab:
  - quick add
  - receipt/photo import
  - kit import
  - storage drawers/bins
- Add higher-trust breadboard metadata to the actual part library so `Verified` is meaningful instead of mostly inferred
- Start the next breadboard tranche around:
  - exact pin-anchor overlays
  - richer SVG/device artwork
  - inventory-constrained autoplace/autoroute suggestions
  - a true Gemini ER bench-planner workflow instead of seeded prompts alone

## Breadboard Bench Stash Manager

**Task:** Push Breadboard Lab further with a real stash-management flow, tighter build-readiness truth, and deeper Gemini ER integration
**Status:** done

### Changes Made
- `client/src/lib/breadboard-bench.ts`
  - extended bench insights with tracked/BOM linkage, required quantity, missing quantity, and more truthful `readyNow` logic
  - added tracked/missing totals so Breadboard Lab can say whether a build is actually ready, not just “some quantity exists”
- `client/src/lib/breadboard-ai-prompts.ts`
  - added `reconcile_inventory` Gemini ER planner mode for stash cleanup / gap analysis / bin suggestions
- `client/src/components/circuit-editor/BreadboardInventoryDialog.tsx`
  - added a new bench-native stash manager dialog
  - supports search + filters (`All`, `Needs tracking`, `Owned`, `Low stock`, `Missing`)
  - supports quick tracking of project parts into stash, editing on-hand qty / build floor / storage bin, and `Mark build-ready`
- `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx`
  - added `Manage stash`
  - upgraded the stats panel to show tracked / missing state, not just owned / ready
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - wires the new stash dialog into Breadboard Lab
  - creates stash entries via `addBomItem`
  - updates tracked stash entries via `updateBomItem`
  - primes Gemini ER from the stash dialog via the design-agent handoff
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - added coverage for stash dialog open, stash save, and stash-reconcile Gemini ER handoff
- `client/src/lib/__tests__/breadboard-bench.test.ts`
  - added assertions for tracked/missing totals, BOM linkage, and the new planner prompt

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/breadboard-bench.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/panels/chat/__tests__/DesignAgentPanel.test.tsx
timeout 240s npm run check
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `36` tests passed
- Full repo typecheck passed:
  - `timeout 240s npm run check` exited `0`
- Browser verification on April 3, 2026:
  - opened `http://127.0.0.1:5000/projects/21/breadboard`
  - verified Breadboard Lab now shows `Manage stash`
  - opened the new `Bench Stash Manager` dialog
  - filled `ATtiny85` stash data:
    - `On hand = 2`
    - `Storage bin = Bench Drawer C3`
  - clicked `Track in stash`
  - verified the left bench rail updated immediately:
    - `Tracked = 1`
    - `Owned = 1`
    - `Bench-ready = 1`
    - `Missing = 0`
  - verified the bench shelf part card changed from `Need to buy` to `2 on hand` and showed `Stored in Bench Drawer C3`
  - clicked `Gemini ER: reconcile stash`
  - verified the design agent opened with a seeded inventory-aware prompt containing the updated stash state
  - final browser console check was clean apart from normal dev-only messages:
    - `[vite] connecting...`
    - `[vite] connected.`
    - React DevTools suggestion

### Handoff Notes
- This is still project-scoped stash tracking because it rides the current BOM/inventory model. It is honest and useful now, but a true cross-project/global owned-parts system is still a future tranche.
- The next high-value breadboard work is obvious now:
  - dedicated inventory intake flows
  - richer verified physical part models
  - exact pin-anchor authoring/inspection
  - Gemini ER layout/refactor actions that mutate the bench with preview/review

## Breadboard Bench Coach + Pin Anchor Overlay

**Task:** Push Breadboard Lab deeper by turning selected parts into a real bench-instrument workflow with coach guidance, pin-role intelligence, and always-visible anchor overlays
**Status:** done

### Changes Made
- `client/src/lib/breadboard-part-inspector.ts`
  - added pin-role classification (`power`, `ground`, `control`, `clock`, `communication`, `analog`, `passive`, `signal`)
  - added critical-pin tracking, exact vs heuristic pin totals, and a generated `coach` model for selected parts
  - added bench coach guidance for orientation, rail strategy, support parts, cautions, and next moves
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - upgraded the selected-part panel with a new `Bench coach` section
  - added exact/heuristic/critical/power-ground stats
  - added support-part chips, next-move guidance, caution callouts, and per-pin role badges
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - added always-visible selected-part pin anchor overlays on the canvas
  - styled anchors by pin role and distinguished heuristic pins with dashed outlines
  - passed the new coach/orientation context into the Gemini ER selected-part prompt
- `client/src/lib/breadboard-ai-prompts.ts`
  - expanded selected-part prompts with orientation guidance, rail strategy, exact/heuristic counts, bench next moves, and bench cautions
- Tests updated:
  - `client/src/lib/__tests__/breadboard-part-inspector.test.ts`
  - `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `2` files passed / `32` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - started the dev server and loaded `http://127.0.0.1:5000/projects/21/breadboard`
  - selected the live breadboard part on the canvas
  - verified the selected-part inspector now rendered `Bench coach`
  - verified the coach copy included trench/orientation guidance, rail strategy, and next moves
  - verified the canvas rendered the new `breadboard-pin-anchor-overlay`
  - verified the browser console was clean except for the normal React DevTools info message
  - saved a verification screenshot to `/tmp/breadboard-bench-coach-overlay.png`

### Next Steps
- Turn the new coach model into actionable preview mutations:
  - suggested rail hookup
  - decoupling placement preview
  - layout cleanup previews around the selected part
- Add explicit power/ground/reset annotations to more library parts so the coach becomes even sharper on real projects
- Follow through on the larger breadboard tranche:
  - exact pin-anchor authoring tools
  - richer verified breadboard artwork
  - Gemini ER preview/apply flows that can actually rearrange the bench

### Handoff Notes
- This slice stays fully client-side and builds on the existing stash + selection model, so it did not disturb server contracts.
- I did not create a git commit for this slice because the repo already has a large unrelated dirty worktree in progress.

## Breadboard Coach Support-Plan Preview + Apply

**Task:** Keep pushing Breadboard Lab so the selected-part coach can preview and stage real support parts directly on the board, then harden it against messy real-world part metadata
**Status:** done

### Changes Made
- `client/src/lib/breadboard-coach-plan.ts`
  - added a dedicated coach planner that converts selected-part bench context into support-part suggestions, highlighted target pins, and corridor hints
  - currently generates real bench actions for nearby decoupling support and lane reservation
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - added `Preview support plan` and `Apply support parts` actions to the bench coach panel
  - disables actions honestly when no resolved suggestions remain
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - renders live support-plan overlays on the canvas, including corridor hints, target lines, and ghost support parts
  - stages suggested support parts onto the board as real instances with coach-plan metadata
  - shows a toast after apply so the bench mutation is obvious and trustworthy
  - fixed TypeScript typing around coach overlay rendering
- `client/src/lib/breadboard-part-inspector.ts`
  - fixed the root-cause metadata bug: connector `terminalPositions.breadboard` pixels are now trusted only when they actually snap onto real breadboard tie-points
  - when connector artwork is off-grid, the selected-part model now falls back to heuristic tie-points instead of surfacing `Unmapped` pins and starving the coach planner
- Tests updated:
  - `client/src/lib/__tests__/breadboard-part-inspector.test.ts`
  - `client/src/lib/__tests__/breadboard-coach-plan.test.ts`
  - `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-coach-plan.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `36` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - loaded `http://127.0.0.1:5000/projects/21/breadboard`
  - selected the live `ATtiny85` instance already placed on the board
  - verified the inspector now downgraded the real part honestly to `Heuristic map` instead of leaving pins `Unmapped`
  - verified the bench coach showed `Preview support plan (1)` and enabled both preview/apply buttons
  - clicked `Preview support plan` and verified the live canvas rendered the coach overlay plus the `100 nF decoupler` ghost suggestion
  - clicked `Apply support parts` and verified:
    - toast: `Bench coach support staged`
    - network: `POST /api/circuits/7/instances` returned `201`
    - board state advanced from one instance to two instances (`bb-instance-14`, `bb-instance-15`)
    - preview count dropped back to `0` once the support part was staged
  - final browser console check was clean

### Next Steps
- Add richer coach actions beyond decoupling:
  - reset/enable pull support where the part metadata is explicit enough
  - rail-bridge previews
  - jumper cleanup suggestions around dense ICs
- Tighten part intelligence so common microcontrollers expose more truthful control/reset pins without hand-authoring every single part
- Keep climbing toward the bigger breadboard goal:
  - exact pin-anchor authoring
  - verified physical breadboard artwork
  - Gemini ER preview/apply layout mutations that can rearrange the board, not just add support parts

### Handoff Notes
- The important root cause here was not the coach planner itself. Real component definitions were carrying breadboard pixel art that looked plausible but did not land on actual tie-points, which made the old model prefer unusable exact pixels over safe heuristic anchors.
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Coach Rail Hookups

**Task:** Keep pushing Breadboard Lab so the bench coach can preview and stage real rail hookups, not just ghost support parts
**Status:** done

### Changes Made
- `client/src/lib/breadboard-coach-plan.ts`
  - extended the coach planner with explicit `hookups` for first-pass power and ground rail routing
  - keeps those hookup targets highlighted alongside support-part targets so the canvas and inspector agree on the bench plan
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - added resolved coach-hookup planning on top of the existing support-part flow
  - reuses existing nets when available, creates missing coach nets when needed, and stages real breadboard `jump` wires for the rail hookups
  - renders labeled `VCC rail` / `GND rail` preview overlays so the bench path is obvious before apply
  - dedupes hookup previews when the same jumper path is already on the board
  - upgraded the coach action count so the inspector now reflects the full support plan, not only support parts
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - updated the action copy to `Apply support plan` so the UI matches the broader coach behavior
- Tests updated:
  - `client/src/lib/__tests__/breadboard-coach-plan.test.ts`
  - `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/breadboard-coach-plan.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/__tests__/breadboard-part-inspector.test.ts
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `36` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - reloaded `http://127.0.0.1:5000/projects/21/breadboard`
  - selected the live `ATtiny85` instance (`bb-instance-14`) already placed on the board
  - verified the inspector showed `Preview support plan (2)` and `Apply support plan`
  - previewed the coach plan and verified the live canvas rendered labeled `VCC rail` and `GND rail` hookup overlays
  - applied the support plan and verified:
    - preview count dropped back to `0`
    - the board now showed `2 LIVE WIRES`
    - network requests included:
      - `POST /api/circuits/7/nets` → `201` for the missing `GND` net
      - `POST /api/circuits/7/wires` → `201` twice for the staged rail jumpers
  - final console check showed only the pre-existing React DevTools info message, Vite dev noise, and the same unrelated `401` resource errors already present before this slice

### Next Steps
- Add smarter hookup shaping so coach wires avoid duplicate points and choose cleaner elbow geometry on dense layouts
- Teach the coach to propose rail-bridge and cross-channel cleanup actions, not just direct pin-to-rail hookups
- Let Gemini ER preview multi-step bench rewiring from the same action graph, then apply only the approved mutations

### Handoff Notes
- On the live board, the ATtiny currently needed only hookup actions because the decoupler support part had already been staged in the previous tranche.
- The current implementation creates missing coach nets by name and net type; it does not yet try to merge semantically equivalent names beyond a simple exact-name or net-type match.
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Bench Plan Ledger + Rail Bridges

**Task:** Keep pushing Breadboard Lab so the bench coach feels like a real bench checklist, then turn rail-bridge advice into actionable staged work
**Status:** done

### Changes Made
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - upgraded the selected-part inspector with a `Bench plan` ledger that shows pending, staged, and advisory coach actions instead of only summarizing the selected part
  - hardened the coach action prop handling so hot-reload does not crash when the action list is briefly undefined
- `client/src/lib/breadboard-ai-prompts.ts`
  - extended selected-part Gemini ER prompts with the same bench-plan steps shown in the inspector so AI layout guidance and the visible coach plan stay in sync
- `client/src/lib/breadboard-coach-plan.ts`
  - added first-class coach `bridges` so the planner can recommend same-polarity rail bridges for bench-friendly DIP-style parts that occupy both sides of the board
  - chooses a bridge row just outside the active part footprint so the suggested bridge lane stays readable and useful
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - threaded the bench-plan ledger into the selected-part inspector and Gemini ER prompt builder
  - added actionable rail-bridge preview/apply flow alongside existing hookup and support-part staging
  - renders labeled bridge overlays, tracks routed-vs-pending bridge state, and stages bridge wires onto the real breadboard net graph
  - tightened hookup/bridge path generation so duplicate consecutive points are stripped from coach-generated routes
- Tests updated:
  - `client/src/lib/__tests__/breadboard-coach-plan.test.ts`
  - `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

### Commands Run
```bash
npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-coach-plan.test.ts
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `36` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - restarted the local dev server and reloaded `http://127.0.0.1:5000/projects/21/breadboard`
  - selected the live `ATtiny85` instance (`bb-instance-14`)
  - verified the inspector now exposed a full bench-plan ledger with:
    - `GND rail bridge`
    - `GND rail jumper`
    - `VCC rail bridge`
    - `VCC rail jumper`
    - staged `100 nF decoupler`
    - advisory `Keep rail bridge lane open`
  - confirmed the live preview button showed `Preview support plan (4)` before apply
  - previewed the plan and verified the canvas rendered both bridge overlays plus both jumper overlays
  - applied the plan and verified:
    - inspector flipped to `Preview support plan (0)`
    - the ledger showed all actionable bridge/jumper items as `Staged`
    - the board count increased to `6 LIVE WIRES`
    - network requests included `POST /api/circuits/7/wires` → `201` four times for the two bridges plus two jumpers
  - final console check showed only the normal React DevTools info message

### Next Steps
- Make rail bridges smarter about existing manual wiring by matching endpoints/connectivity instead of exact point arrays only
- Add coach-generated bridge placement variants so crowded parts can choose an upper or lower bridge row instead of always taking the default side
- Let Gemini ER preview and apply larger bench rewiring bundles from the same staged action graph

### Handoff Notes
- The new bridge planner intentionally only activates when a selected part occupies both left and right terminal fields; single-lane parts still avoid over-prescriptive rail-bridge advice.
- On the live board in this pass, the support capacitor was already staged, so the actionable queue was the two jumpers plus two rail bridges.
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Staged Plan Review Mode

**Task:** Keep pushing Breadboard Lab so a fully staged coach plan stays reviewable on-canvas instead of disappearing once all pending actions are complete
**Status:** done

### Changes Made
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - changed the coach preview button so it stays usable whenever the selected part has a bench plan ledger, even if there are no pending actions left
  - the preview button now switches between `Preview support plan (N)`, `Show bench plan`, and `Hide bench plan` based on the staged state instead of going dead at `0`
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - upgraded plan overlay rendering so staged rail bridges and rail jumpers can still be inspected after apply
  - styled pending coach wires as stronger dashed previews while staged coach wires render as calmer solid review overlays
  - tightened routed-coach detection so hookups and bridges can be recognized by endpoint connectivity on the expected net, not only by exact polyline equality
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - added regression coverage proving a fully staged plan now surfaces `Show bench plan` and re-renders the staged bridge/jumper overlays when toggled
  - reset shared mock nets/wires between tests so staged-coach scenarios do not leak state into unrelated breadboard tests

### Commands Run
```bash
npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-coach-plan.test.ts
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `37` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - kept working on `http://127.0.0.1:5000/projects/21/breadboard` with the already-staged live `ATtiny85` plan
  - confirmed the inspector showed `Show bench plan` instead of a disabled `Preview support plan (0)` button
  - clicked `Show bench plan` and verified the staged overlay returned on-canvas
  - confirmed the overlay rendered:
    - `breadboard-coach-bridge-bridge-power-rails`
    - `breadboard-coach-bridge-bridge-ground-rails`
    - `breadboard-coach-hookup-hookup-power-pin1`
    - `breadboard-coach-hookup-hookup-ground-pin7`
  - confirmed the button flipped to `Hide bench plan`
  - final console check remained clean except for the normal React DevTools info message

### Next Steps
- Render staged support-part highlights too, so the review overlay can spotlight already-placed coach capacitors/resistors in the same pass as staged wires
- Let staged review mode call out which coach items were inferred from exact net matches versus semantic endpoint matches
- Add a one-click `Re-open staged plan around this part` action from the canvas/context menu so users do not need to reselect the part to review previous coach work

### Handoff Notes
- This slice deliberately keeps `Apply support plan` disabled when there is nothing left to stage; only the review/toggle affordance stays alive.
- Semantic routed detection currently requires a resolved coach net ID; exact path matching still acts as the fallback when no matching net exists yet.
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Staged Support-Part Review Overlay

**Task:** Keep pushing Breadboard Lab so staged bench-plan review also spotlights already-placed coach support parts, not just staged wires
**Status:** done

### Changes Made
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - added staged coach-suggestion resolution keyed by `coachPlanFor` / `coachPlanKey`, so already-placed support parts can be rediscovered from the live circuit state
  - extracted a shared `CoachSuggestionOverlay` renderer so pending ghost suggestions and staged support highlights share the same visual language
  - staged support parts now render as calmer on-canvas halos with the same target-pin callouts and a `staged support` label during bench-plan review
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - extended the staged-plan review regression so it now proves the decoupler and control-pull support overlays appear during `Show bench plan`, alongside the staged bridge and jumper overlays

### Commands Run
```bash
npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-coach-plan.test.ts
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `3` files passed / `37` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - reloaded `http://127.0.0.1:5000/projects/21/breadboard`
  - selected the live staged `ATtiny85` part from the canvas
  - confirmed the inspector showed `Show bench plan` with `All staged`
  - toggled the review overlay and verified the canvas exposed:
    - `VCC bridge`
    - `GND bridge`
    - `VCC rail`
    - `GND rail`
    - `100 nF decoupler`
    - `staged support`
  - DOM verification confirmed `breadboard-coach-suggestion-support-decoupler` was present alongside the staged bridge and hookup overlays
  - final console check showed only the normal React DevTools info message

### Next Steps
- Add stronger staged support highlighting for multi-support plans so multiple placed coach parts remain easy to differentiate on dense boards
- Surface the selected staged support part identity in the overlay label (for example `C1 staged`) when multiple support instances exist
- Let Gemini ER reuse the staged support-overlay graph as part of a richer `review my current bench layout` pass

### Handoff Notes
- The live ATtiny verification target only had a staged decoupler suggestion, so the browser pass validated one staged support overlay instead of both decoupler + pull resistor
- The new overlay path only renders staged support suggestions that have a real placed instance with breadboard coordinates; unresolved or off-board staged metadata stays out of the canvas review pass
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Layout Quality Scorecard

**Task:** Push Breadboard Lab beyond a checklist by adding a real selected-part layout-quality scorecard and feeding that same bench-health context into Gemini ER part planning
**Status:** done

### Changes Made
- `client/src/lib/breadboard-layout-quality.ts`
  - added a reusable scoring engine for selected-part breadboard health using pin trust, rail readiness, support coverage, and local probe-space density
  - generates a 0-100 score, quality band, summary copy, strengths, risks, and per-metric detail so future whole-board audits can reuse the same model
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - added a new `Layout quality` section with score, band badge, four bench-health metrics, what-is-working callouts, and the next risks to watch
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - computes nearby foreign-part density and local wire density around the selected part
  - derives live layout-quality state from staged coach hooks/bridges/support parts plus pin trust and stash readiness
  - passes the scorecard into the inspector and into the selected-part Gemini ER prompt flow
- `client/src/lib/breadboard-ai-prompts.ts`
  - extended selected-part prompts with layout-quality score, summary, strengths, and risks so Gemini ER sees the same bench-health picture the user sees
- `client/src/lib/__tests__/breadboard-layout-quality.test.ts`
  - added focused coverage for both dialed-in and fragile bench scenarios
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - added regression assertions for the new inspector scorecard and the new prompt context lines

### Commands Run
```bash
npx vitest run client/src/lib/__tests__/breadboard-layout-quality.test.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-coach-plan.test.ts
timeout 300s npm run check
```

### Verification
- Focused regression slice passed:
  - `4` files passed / `39` tests passed
- Full repo typecheck passed:
  - `timeout 300s npm run check` exited `0`
- Browser verification on April 4, 2026:
  - reloaded `http://127.0.0.1:5000/projects/21/breadboard`
  - selected the live staged `ATtiny85` part from the canvas
  - confirmed the inspector rendered a live `Layout quality` card with:
    - score `81`
    - band `Solid`
    - `Pin trust`, `Rail readiness`, `Support coverage`, and `Probe space` metrics
    - strengths describing staged rails/support parts and stash readiness
    - a risk calling out heuristic critical-pin trust
  - triggered `Gemini ER: plan around this part` and verified the emitted prompt now included:
    - `Bench layout quality: Solid (81/100)`
    - `Bench layout summary: ...`
    - `Bench layout strengths: ...`
    - `Bench layout risks: ...`
  - final console check showed only the normal React DevTools info message

### Next Steps
- Turn the selected-part scorecard into a full-board breadboard audit panel that can rank the worst bench zones before the user clicks anything
- Detect concrete wire-crossing and same-row congestion events so `Probe space` is based on true routing conflicts instead of just nearby density
- Let Gemini ER propose score-improving layout changes directly from the weakest metric instead of only receiving passive quality context

### Handoff Notes
- The live ATtiny score stayed `Solid` instead of `Dialed in` because the current bench model still has heuristic critical-pin anchors, which is exactly the weakness the new scorecard is supposed to expose
- `Probe space` intentionally ignores staged coach support parts when counting nearby foreign-part clutter, so support passives do not unfairly tank the score
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Exact Part Truth Pipeline

**Task:** Implement the first end-to-end exact-part trust workflow so ProtoPulse can distinguish verified vs candidate board/module parts, prefer exact breadboard art, and block authoritative wiring when a part still needs review
**Status:** done

### Changes Made
- `shared/component-trust.ts`
  - added shared exact-part trust primitives: part families, verification status/level, evidence records, visual/pin accuracy reports, and helpers for exact-view preference plus authoritative-wiring gating
  - added candidate/verified metadata stamp helpers for AI-generated or reviewer-approved parts
- `shared/component-types.ts`
  - extended `PartMeta` with verification status, level, evidence, notes, accuracy reports, reviewer metadata, and part-family fields
  - default part metadata now starts in a safe candidate/community-only state instead of silently pretending new exact parts are trusted
- `server/component-ai.ts`
  - exact AI generation now stamps drafts as candidate parts with evidence and draft accuracy notes
  - AI modification also downgrades edited exact parts back to candidate review state so the model cannot silently self-certify a part
- `server/routes/components.ts`
  - normalized trust metadata on component-part save/create/import flows
  - added `POST /api/projects/:projectId/component-parts/:id/verify`
  - blocked public publishing of board/module exact parts until they are explicitly verified
  - added source-url support on the AI generation route
- `server/ai-tools/component.ts`
  - AI-created parts now enter the library as candidate exact parts with explicit trust notes
- `client/src/lib/component-editor/hooks.ts`
  - added exact-draft and verification mutations for the new workflow
- `client/src/components/views/component-editor/ExactPartDraftModal.tsx`
  - added an exact-draft modal for natural-language board/module creation with official/community source URLs, optional reference image, and Gemini key entry
  - wrapped the modal in a real `<form>` so the Gemini password input no longer triggers the browser DOM warning
- `client/src/components/views/ComponentEditorView.tsx`
  - added an `Exact Draft` entry point
  - added the exact-part trust strip showing status, family, verification level, evidence count, and wiring-lock state
  - added a verification flow for candidate board/module parts and publish gating for unverified exact parts
- `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx`
  - board/module parts now prefer exact `views.breadboard.shapes` artwork over generic family stand-ins when the part data supports it
- `client/src/lib/breadboard-part-inspector.ts`
  - selected-part models now carry trust summary, verification status/level, part family, and authoritative-wiring eligibility
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx`
  - added exact-part trust badges and wiring-lock guidance to the bench coach
  - switches Gemini ER wording to provisional planning when a selected part is still only a candidate
- `client/src/lib/breadboard-ai-prompts.ts`
  - selected-part prompts now include trust status/level and explicitly tell Gemini ER not to present exact hookup steps as authoritative for candidate board/module parts
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - passes the new trust context into selected-part Gemini ER planning
- `client/src/lib/breadboard-bench.ts`
  - verified exact parts now elevate breadboard model quality to `verified`
- `shared/__tests__/component-trust.test.ts`
  - added coverage for classification, candidate defaults, verified promotion, and exact-view preference
- `client/src/lib/__tests__/breadboard-part-inspector.test.ts`
  - added trust-gating assertions for candidate board/module parts
- `client/src/lib/__tests__/breadboard-layout-quality.test.ts`
  - updated fixture models to include the new trust fields
- `client/src/lib/__tests__/breadboard-ai-prompts.test.ts`
  - added prompt regression coverage for provisional exact-part planning language
- `client/src/components/circuit-editor/__tests__/BreadboardComponentRenderer.test.tsx`
  - added exact-artwork renderer coverage
- `client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx`
  - added a regression test proving the Gemini API key input stays inside a form

### Commands Run
```bash
npx vitest run shared/__tests__/component-trust.test.ts client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-layout-quality.test.ts client/src/lib/__tests__/breadboard-ai-prompts.test.ts client/src/components/circuit-editor/__tests__/BreadboardComponentRenderer.test.tsx
npx vitest run client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx shared/__tests__/component-trust.test.ts client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-layout-quality.test.ts client/src/lib/__tests__/breadboard-ai-prompts.test.ts client/src/components/circuit-editor/__tests__/BreadboardComponentRenderer.test.tsx
npm run check
```

### Verification
- Focused trust/exact-rendering regression slice passed:
  - `6` files passed / `14` tests passed
- Full repo typecheck passed:
  - `npm run check` exited `0`
- Browser verification on April 4, 2026:
  - opened `http://127.0.0.1:5000/projects/21/component_editor`
  - confirmed the ATtiny editor shows the new trust strip with:
    - `Candidate exact part`
    - family `ic-package`
    - level `Community-only`
    - `Authoritative wiring unlocked`
    - guidance that this part does not require exact-part verification before wiring help
  - opened `Create Exact Part Draft` and confirmed the modal rendered:
    - exact-description field
    - official/community source URL fields
    - reference-image upload
    - Gemini API key field
    - explicit copy that authoritative wiring stays blocked until review
  - browser console originally showed `[DOM] Password field is not contained in a form`; I fixed the dialog structure and added a regression test for it
  - breadboard live verification confirmed the ATtiny shelf card returned to a normal `MICROCONTROLLER` classification after tightening `inferPartFamily` so `microcontroller` no longer gets misread as a driver/controller module

### Next Steps
- Build the actual exact-part verification workbench with source-image overlay, pin-table review, and promotion criteria instead of a simple approve dialog
- Seed a curated verified board/module pack starting with `Arduino Mega 2560 R3`, `Arduino Uno R3`, common ESP boards, and real motor drivers/controllers
- Teach the AI add-and-wire flow to resolve requested parts against verified aliases first, create candidate drafts when missing, and refuse authoritative wiring whenever any required board/module remains unverified

### Handoff Notes
- The current ATtiny part intentionally shows `Candidate exact part` because the new trust strip covers all parts consistently, but `ic-package` parts do not require the same verification gate as boards/modules, so wiring remains unlocked
- The family classifier was the main live bug discovered during browser verification: naive `controller` matching was incorrectly treating `microcontroller` as a driver-like exact module
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Exact Part Verification Workbench

**Task:** Replace the lightweight exact-part approval flow with a real verification workbench and make the API enforce the same exactness checklist the UI shows
**Status:** done

### Changes Made
- `shared/exact-part-verification.ts`
  - added a shared readiness engine for exact board/module promotion
  - computes blockers, warnings, checklist items, and summary text from evidence, breadboard artwork, connector availability, visual fidelity, and pin fidelity
- `shared/__tests__/exact-part-verification.test.ts`
  - added coverage for ready-to-promote board modules, blocked driver/module candidates, and non-board parts that do not require exact verification
- `server/routes/components.ts`
  - extended the verify route schema to accept `visualAccuracyReport` and `pinAccuracyReport`
  - swapped the old “has breadboard shapes + connectors” gate for the shared readiness engine
  - the route now returns the same blocker-driven rejection logic the UI uses instead of silently allowing under-reviewed exact parts through
- `client/src/components/views/component-editor/ExactPartVerificationDialog.tsx`
  - added a full verification workbench dialog with:
    - readiness summary
    - evidence review/editing
    - visual fidelity selectors
    - pin fidelity selectors
    - unresolved review-item tracking
    - promotion button disabled until blockers are cleared
- `client/src/components/views/ComponentEditorView.tsx`
  - replaced the thin note-only verify dialog with the new workbench
  - trust strip now surfaces verification-blocker counts before the user opens the dialog
  - verify CTA now reads `Open verification workbench`
- `client/src/lib/component-editor/hooks.ts`
  - widened verify mutation payload typing for the new accuracy-report fields
- `client/src/components/views/component-editor/__tests__/ExactPartVerificationDialog.test.tsx`
  - added a UI regression proving blocked candidates cannot be promoted and exact-ready candidates can
- `client/src/components/views/component-editor/ExactPartDraftModal.tsx`
  - added `autoComplete="off"` to the Gemini API key field after live browser verification surfaced the follow-up DOM warning

### Commands Run
```bash
npx vitest run shared/__tests__/exact-part-verification.test.ts shared/__tests__/component-trust.test.ts client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx client/src/components/views/component-editor/__tests__/ExactPartVerificationDialog.test.tsx client/src/lib/__tests__/breadboard-part-inspector.test.ts client/src/lib/__tests__/breadboard-layout-quality.test.ts client/src/lib/__tests__/breadboard-ai-prompts.test.ts client/src/components/circuit-editor/__tests__/BreadboardComponentRenderer.test.tsx
npx vitest run client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx client/src/components/views/component-editor/__tests__/ExactPartVerificationDialog.test.tsx shared/__tests__/exact-part-verification.test.ts
timeout 180s npm run check
```

### Verification
- Focused regression slice passed:
  - `8` files passed / `19` tests passed
- Workbench-focused regression slice passed:
  - `3` files passed / `6` tests passed
- Browser verification on April 4, 2026:
  - reloaded `http://127.0.0.1:5000/projects/21/component_editor`
  - confirmed the ATtiny trust strip still shows the non-board exact state:
    - `Candidate exact part`
    - family `ic-package`
    - `Authoritative wiring unlocked`
  - opened `Create Exact Part Draft` and rechecked the exact-draft modal after the form fix
  - fresh console check showed only:
    - Vite connect debug logs
    - the normal React DevTools info line
  - the earlier password/autocomplete DOM warnings were no longer present on the final reload/open pass
- Full repo typecheck did not complete within the bounded verification window:
  - `timeout 180s npm run check` exited `124` with no TypeScript diagnostics emitted
  - this looks like a long-running repo-scale typecheck issue rather than a concrete compile error from this slice, but it is not a green `tsc` result

### Next Steps
- Let the workbench edit exact-part aliases and canonical request phrases so AI part resolution can match prompts like `Arduino Mega 2560 R3` or `RioRand motor controller` against verified entries before drafting candidates
- Add source-image/board-art visual overlay review so the user can compare the rendered part against the real board instead of only filling out fidelity selectors
- Seed the first verified board/module pack and drive it through this workbench so the flow proves itself on real `Mega`, `Uno`, and motor-controller parts

### Handoff Notes
- There is still no verified board/module part in this project, so the live browser pass validated the trust strip and exact-draft modal directly; the new verification workbench itself is covered by tests in this slice
- The workbench is intentionally strict: board/module promotion now expects accepted evidence, exact outline/connectors, exact pin names/roles/anchors, and zero unresolved review items
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Exact Part Resolver

**Task:** Add a real exact-part request lane to Breadboard Lab so users can resolve an exact board/module request before placement, place matched parts directly onto the bench, or fall straight into a seeded candidate-draft workflow when the part is missing
**Status:** done

### Changes Made
- `shared/component-types.ts`
  - added optional `aliases` on `PartMeta` so exact parts can carry canonical request phrases over time
- `shared/exact-part-resolver.ts`
  - added a shared request resolver that scores project parts against a natural-language exact-part request
  - classifies outcomes into `verified-match`, `candidate-match`, `ambiguous-match`, or `needs-draft`
  - added exact-request playbooks for `Arduino Mega 2560 R3`, `Arduino Uno R3`, `RioRand motor controller`, and `ESP32`-style dev boards
  - emits a better seeded draft description plus evidence checklist when no trustworthy match exists
- `shared/__tests__/exact-part-resolver.test.ts`
  - added coverage for verified matches, candidate matches, ambiguous matches, and draft-first fallback behavior
- `client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx`
  - added the new bench-side resolver dialog with:
    - request input
    - example prompts
    - trust-aware match cards
    - exact-request playbook panel
    - one-click handoff into the exact-draft flow
- `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx`
  - added a `Resolve exact part request` entry point in the Breadboard Lab Bench AI card
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - wired the resolver dialog into Breadboard Lab
  - can now stage a resolved project part directly onto the active wiring canvas
  - if no canvas exists, it creates one first and then stages the part for auto-placement
  - wired missing-part fallback into the exact-draft modal with a seeded, more physically specific request description
- `client/src/components/views/component-editor/ExactPartDraftModal.tsx`
  - added `initialDescription` support so Breadboard Lab can hand off a missing exact-part request without retyping it
- `client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx`
  - added regression coverage for verified placement and draft-launch fallback
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - added BreadboardView integration coverage for:
    - resolving a verified exact request and staging the part
    - launching the seeded exact-draft modal when a request has no trustworthy match
- `client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx`
  - added a regression proving the seeded draft description actually hydrates the modal

### Commands Run
```bash
npx vitest run shared/__tests__/exact-part-resolver.test.ts client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx
timeout 300s npm run check
timeout 60s npx eslint shared/exact-part-resolver.ts client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx client/src/components/circuit-editor/BreadboardView.tsx client/src/components/views/component-editor/ExactPartDraftModal.tsx
git diff --check -- shared/component-types.ts shared/exact-part-resolver.ts shared/__tests__/exact-part-resolver.test.ts client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx client/src/components/circuit-editor/BreadboardView.tsx client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/component-editor/ExactPartDraftModal.tsx client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx
```

### Verification
- Focused regression slice passed:
  - `4` files passed / `42` tests passed
- Browser verification on April 4, 2026 at `http://127.0.0.1:5000/projects/21/breadboard`:
  - opened the new `Resolve exact part request` dialog from the Breadboard Lab sidebar
  - confirmed the resolver opens with example requests and an empty-state exact-part message
  - entered `ATtiny85` and confirmed the dialog classified it as a `Candidate match`
  - clicked `Place on bench` and verified:
    - toast: `Exact part staged for the bench`
    - network: `POST /api/circuits/7/instances` returned `201`
    - network: the follow-up auto-placement `PATCH /api/circuits/7/instances/16` returned `200`
    - the Breadboard Lab `Placed` stat increased from `2` to `3`
  - reopened the resolver, clicked the `RIORAND MOTOR CONTROLLER` example, and confirmed:
    - state changed to `Needs draft`
    - the `RioRand Motor Controller playbook` appeared
    - clicking `Create exact draft` opened the exact-draft modal with the longer seeded RioRand description already in the request field
- Browser console remained clean apart from the normal Vite connect logs and the React DevTools info line
- `git diff --check` for the touched files exited `0`
- Full repo typecheck still did not finish within the bounded window:
  - `timeout 300s npm run check` exited `124` with no TypeScript diagnostics emitted
- Targeted lint was also long-running in this workspace and did not return diagnostics within the bounded run

### Next Steps
- Let the resolver open directly from AI/user add-and-wire intents so a prompt like `add an Arduino Mega 2560 R3 and a RioRand motor controller` first resolves trusted exact parts before placement or wiring
- Add resolver awareness of canonical aliases stored on verified parts so one part can answer to real-world names, revisions, and distributor labels
- Seed a first verified board/module set and use the exact-request playbooks to drive evidence collection and verification around high-value parts like `Mega`, `Uno`, and real motor controllers

### Handoff Notes
- The live project used for browser verification only had `ATtiny85` as a resolvable project part, so the positive placement path was proven on that part and the missing-part fallback was proven on `RioRand`
- The staged part uses the existing instance auto-placement path in BreadboardCanvas, so the resolver intentionally creates an unresolved instance first and lets the current bench layout engine pick the final drop location
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Breadboard Exact Source Seeds

**Task:** Make Breadboard Lab’s exact-part flow source-aware so a real product URL, like the RioRand Amazon listing, can seed an exact draft with marketplace evidence and a more accurate controller description
**Status:** done

### Changes Made
- `shared/exact-part-resolver.ts`
  - introduced `ExactPartDraftSeed` so the resolver can hand off more than just freeform text
  - upgraded playbooks to emit structured source-aware seeds
  - enriched the `RioRand motor controller` playbook into a specific `RioRand KJL-01` BLDC hall-sensor controller description
  - attached the user-provided Amazon listing as a default marketplace source seed for that playbook
- `shared/component-trust.ts`
  - added `marketplace-listing` as a first-class evidence type
  - updated verification-level inference so marketplace evidence behaves like assistive non-official evidence instead of pretending to be official truth
- `server/routes/components.ts`
  - extended exact-part generation requests and verification evidence validation to accept `marketplaceSourceUrl` / `marketplace-listing`
- `server/component-ai.ts`
  - stores marketplace listing evidence on AI-generated candidate exact parts
  - threads source URLs into the AI generation prompt as exact-variant context, while explicitly telling the model to treat marketplace URLs as assistive rather than authoritative
- `client/src/lib/component-editor/hooks.ts`
  - added `marketplaceSourceUrl` support to exact-part generation mutation payloads
- `client/src/components/views/component-editor/ExactPartDraftModal.tsx`
  - replaced the old single-string seed with a structured exact-part seed
  - hydrates description plus official/community/marketplace URLs from Breadboard handoff
  - added a dedicated `Marketplace or seller URL` field
  - added proper form `autocomplete` metadata so the exact-part modal is console-clean in the browser
- `client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx`
  - now accepts an optional pasted reference URL
  - classifies pasted links into official, community, or marketplace evidence buckets before launching the exact draft
  - surfaces a `Source seed attached` signal when the playbook already carries seeded evidence
- `client/src/components/circuit-editor/BreadboardView.tsx`
  - now stores and forwards structured exact-part draft seeds instead of only a description string
- `client/src/components/views/ComponentEditorView.tsx`
  - updated for the structured seed prop shape
- `shared/__tests__/exact-part-resolver.test.ts`
  - now verifies RioRand draft seeds include the marketplace URL
- `client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx`
  - now verifies the marketplace URL hydrates into the modal
- `client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx`
  - now verifies pasted marketplace URLs flow into the exact draft seed
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
  - updated the Breadboard integration regression to assert the richer RioRand seed and attached marketplace source

### Commands Run
```bash
npx vitest run shared/__tests__/exact-part-resolver.test.ts client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx
timeout 180s npm run check
git diff --check -- client/src/components/views/component-editor/ExactPartDraftModal.tsx client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx client/src/components/circuit-editor/BreadboardView.tsx client/src/lib/component-editor/hooks.ts shared/exact-part-resolver.ts shared/component-trust.ts server/component-ai.ts server/routes/components.ts client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/component-editor/__tests__/ExactPartDraftModal.test.tsx shared/__tests__/exact-part-resolver.test.ts client/src/components/views/ComponentEditorView.tsx
```

### Verification
- Focused regression slice passed:
  - `4` files passed / `42` tests passed
- Browser verification on April 4, 2026 at `http://127.0.0.1:5000/projects/21/breadboard`:
  - opened `Resolve exact part request`
  - confirmed the dialog now includes a `Reference URL` field
  - selected the `RIORAND MOTOR CONTROLLER` example and confirmed the playbook text now targets the specific `RioRand KJL-01` hall-sensor BLDC controller behavior instead of a generic motor-controller stub
  - confirmed the resolver shows `SOURCE SEED ATTACHED`
  - clicked `Create exact draft` and verified the exact-draft modal opened with:
    - the richer RioRand/KJL-01 description already loaded
    - the `Marketplace or seller URL` field prefilled with `https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D`
  - verified the exact-draft modal copy now explicitly says it captures official, community, and marketplace evidence
- Browser console after the final reload + exact-draft flow was clean except for:
  - Vite connect logs
  - the normal React DevTools info message
- `git diff --check` for the touched files exited `0`
- Full repo typecheck still did not finish within the bounded window:
  - `timeout 180s npm run check` exited `124` with no TypeScript diagnostics emitted

### Next Steps
- Feed exact source seeds into AI add-and-wire intents so a user prompt with a product URL can enter the same verified/candidate exact-part flow before any wiring guidance is generated
- Add first-class support for multiple source seeds per request, not just one URL bucket, so a user can combine an Amazon listing, a datasheet PDF, and a Fritzing helper in one draft handoff
- Build an evidence overlay in the verification workbench that shows seeded URLs as review cards with source type, acceptance status, and unresolved visual/pin questions

### Handoff Notes
- The RioRand playbook now uses the user-provided Amazon listing as marketplace evidence, not as official truth
- The modal autocomplete warning that originally showed up in Chrome DevTools is fixed for the new exact-part form inputs
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.

## Exact-Part AI Trust Gate

**Task:** Push the exact-part workflow into ProtoPulse's AI add-and-wire backend so verified exact boards/modules are treated as authoritative, candidate exact boards stay provisional, and missing exact requests stop being silently substituted
**Status:** done

### Changes Made
- `shared/exact-part-ai-policy.ts`
  - added a shared exact-part AI policy layer that classifies parts as `standard`, `verified-exact`, or `provisional-exact`
  - added generated-circuit trust summarization so a whole AI-produced circuit can report whether its exact board/module usage is authoritative or still provisional
- `shared/exact-part-resolver.ts`
  - exported `findExactPartPlaybooksInText()` so the backend can detect explicit exact-part intents like `Arduino Mega 2560 R3` and `RioRand motor controller` inside a natural-language AI request
- `server/circuit-ai/prompt.ts`
  - extracted the circuit-generation prompt builder into a pure module
  - added exact-part trust annotations to every available part line
  - added exact-part intent detection so the prompt can tell Gemini when a requested board/module is verified, candidate-only, ambiguous, or draft-only
  - explicitly instructs the model not to substitute a generic board/module when an exact request has no trustworthy match
- `server/circuit-ai/generate.ts`
  - now uses the trust-aware prompt builder
  - stamps AI-created circuit instances with exact-part trust metadata and a `provisionalWiring` flag
  - returns an `exactPartWorkflow` summary payload describing whether the generated result is authoritative or provisional, which parts were used, and what warnings apply
- `server/ai-tools/circuit.ts`
  - upgraded `place_component` to look up the real part and apply the same exact-part trust rules
  - verified exact parts now report as verified in the tool result
  - candidate exact parts now return a provisional placement message instead of sounding authoritative
- `shared/__tests__/exact-part-ai-policy.test.ts`
  - added regression coverage for verified exact parts, candidate exact parts, and mixed generated-circuit trust summaries
- `server/circuit-ai/prompt.test.ts`
  - added prompt-level coverage to prove candidate/verified trust annotations and missing exact-request anti-substitution rules are embedded into the AI prompt
- `server/__tests__/ai-tools-boundary.test.ts`
  - added placement-tool coverage to prove candidate exact parts are flagged as provisional and verified exact parts return verified messaging

### Commands Run
```bash
npx vitest run shared/__tests__/exact-part-ai-policy.test.ts server/circuit-ai/prompt.test.ts shared/__tests__/exact-part-resolver.test.ts server/__tests__/ai-tools-boundary.test.ts
timeout 120s npm run check
```

### Verification
- Focused regression slice passed:
  - `4` files passed / `274` tests passed
- Browser sanity verification on April 4, 2026 at `http://127.0.0.1:5000/projects/21/breadboard`:
  - confirmed the Breadboard Lab page still renders with the exact-part draft modal and RioRand marketplace seed intact
  - confirmed no new browser `error` or `warn` messages appeared after the backend/shared trust-gate changes
  - remaining console noise was limited to Vite/HMR debug chatter plus the normal React DevTools info message
- Full repo typecheck still did not finish within the bounded window:
  - `timeout 120s npm run check` exited `124` with no TypeScript diagnostics emitted before timeout

### Next Steps
- Feed `exactPartWorkflow` into the chat/action UI so the user can actually see when the AI generated a provisional circuit versus an authoritative one
- Add a dedicated AI tool for `resolve_exact_part_request` so chat can branch into `place verified exact`, `use candidate provisionally`, or `open exact draft` before any wiring mutation happens
- Start curating the first real verified exact board pack around `Arduino Mega 2560 R3`, `Arduino Uno R3`, `NodeMCU/ESP32`, and the RioRand controller variants so the AI can resolve them against trustworthy geometry instead of draft-only models

### Handoff Notes
- The AI circuit-generation prompt now explicitly distinguishes verified exact boards/modules from provisional exact candidates
- `place_component` now surfaces exact-part trust in the tool result instead of sounding equally confident for every board/module
- I did not create a git commit for this slice because the repo still has a large unrelated dirty worktree in progress.
