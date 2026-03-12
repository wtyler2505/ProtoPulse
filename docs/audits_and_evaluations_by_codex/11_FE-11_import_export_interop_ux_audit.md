# FE-11 Audit: Import/Export + Interop UX

Date: 2026-03-06  
Auditor: Codex  
Section: FE-11 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Import/interop entry and conversion flow:
  - `client/src/pages/ProjectWorkspace.tsx`
  - `client/src/lib/design-import.ts`
  - `client/src/lib/design-gateway.ts` (scope validation only; this file is a design-rule engine, not import/export transport)
- Export/import UI surfaces:
  - `client/src/components/panels/ExportPanel.tsx`
  - `client/src/components/circuit-editor/ExportPanel.tsx`
  - `client/src/components/simulation/SpiceImportButton.tsx`
  - `client/src/components/panels/chat/hooks/action-handlers/export.ts`
  - `client/src/components/panels/chat/hooks/useActionExecutor.ts`
- Contract references checked:
  - `client/src/lib/queryClient.ts`
  - `server/index.ts`
  - `server/circuit-routes/exports.ts`
  - `server/routes/spice-models.ts`
- Test surface reviewed:
  - `client/src/lib/__tests__/design-import.test.ts`
  - `client/src/lib/__tests__/design-gateway.test.ts`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact behavior break
- `P2`: medium reliability/interop risk
- `P3`: lower-risk quality/debt issue

## Findings

### 1) `P1` Import button parses file but does not apply imported design to project state
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:518`
- `client/src/pages/ProjectWorkspace.tsx:520`
- `client/src/pages/ProjectWorkspace.tsx:522`
- `client/src/pages/ProjectWorkspace.tsx:523`
- `client/src/pages/ProjectWorkspace.tsx:525`

What is happening:
- The import flow reads the file, parses it, converts to ProtoPulse nodes/edges/BOM, then only switches to `output` view and logs to console.
- No `setNodes`, `setEdges`, BOM mutation, or server persistence occurs.

Why this matters:
- User can “import” successfully but sees no imported design data in working state.
- This is a functional break in the FE-11 import UX path.

Fix recommendation:
- After successful `convertToProtoPulse`, apply data into architecture/BOM contexts (or post to server import endpoint), then run validation and show user feedback toast.
- If partial import, show structured warnings/errors in UI, not console only.

---

### 2) `P1` “Output” view claims export workflow, but renders log console and export panels are not wired
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:51`
- `client/src/pages/ProjectWorkspace.tsx:573`
- `client/src/pages/ProjectWorkspace.tsx:576`
- `client/src/components/views/OutputView.tsx:17`
- `client/src/components/views/OutputView.tsx:151`

Additional evidence:
- `rg -n "components/panels/ExportPanel|components/circuit-editor/ExportPanel" client/src` produced no import matches.

What is happening:
- Product copy says output is for export artifacts.
- Actual output tab mounts `OutputView` (log console), not an export center.
- Two export panel implementations exist but appear disconnected from active workspace routing.

Why this matters:
- Users cannot discover or use a dedicated export center from the tab that says it provides export.
- FE-11 interop UX is fragmented and confusing.

Fix recommendation:
- Mount one canonical export panel in `activeView === 'output'`.
- Remove duplicate panel implementation after migration.

---

### 3) `P1` `fzz` export contract mismatch in panel export flow causes hard runtime failure
Evidence:
- `client/src/components/panels/ExportPanel.tsx:168`
- `client/src/components/panels/ExportPanel.tsx:175`
- `client/src/components/panels/ExportPanel.tsx:261`
- `client/src/components/panels/ExportPanel.tsx:263`
- `server/circuit-routes/exports.ts:549`
- `server/circuit-routes/exports.ts:550`

Local reproduction:
- Command:
  - `node -e "const r=new Response(Buffer.from([0x50,0x4b,0x03,0x04]),{headers:{'content-type':'application/zip'}}); r.json().catch(e=>console.log(e.name+': '+e.message));"`
- Output:
  - `SyntaxError: Unexpected token 'P', "PK..." is not valid JSON`

What is happening:
- Client marks `fzz` as `jsonResponse: true` and always calls `res.json()`.
- Server returns ZIP binary for `/export/fzz`.

Why this matters:
- FZZ export path fails at runtime when using this panel flow.

Fix recommendation:
- Set `fzz` to binary response handling (`res.blob()`/`arrayBuffer()`), not JSON path.
- Add content-type guard before parsing.

---

### 4) `P1` Gerber export contract mismatch drops layer files in panel export flow
Evidence:
- `client/src/components/panels/ExportPanel.tsx:265`
- `client/src/components/panels/ExportPanel.tsx:266`
- `client/src/components/panels/ExportPanel.tsx:275`
- `client/src/components/panels/ExportPanel.tsx:276`
- `server/circuit-routes/exports.ts:171`
- `server/circuit-routes/exports.ts:178`

Local reproduction:
- Command:
  - `node -e "const json={layers:[{filename:'top.gbr',content:'L1'},{filename:'bot.gbr',content:'L2'}],drill:{filename:'drill.drl',content:'D'}}; let downloaded=[]; const files=json.files; if(files&&Array.isArray(files)){for(const f of files)downloaded.push(f.filename);} const drill=json.drill; if(drill)downloaded.push(drill.filename); console.log(JSON.stringify(downloaded));"`
- Output:
  - `["drill.drl"]`

What is happening:
- Panel handler expects `json.files` and separately `drill`.
- Server returns `layers` + `drill` for Gerber package.

Why this matters:
- Manufacturing layer files are skipped; user may download only drill and assume export succeeded.

Fix recommendation:
- Handle both `layers` and `files` payload variants, or enforce one shared contract with schema validation.

---

### 5) `P1` Export panel request path bypasses auth header pattern used everywhere else
Evidence:
- `client/src/components/panels/ExportPanel.tsx:250`
- `client/src/components/panels/ExportPanel.tsx:252`
- `client/src/lib/queryClient.ts:7`
- `client/src/lib/queryClient.ts:9`
- `client/src/lib/queryClient.ts:25`
- `server/index.ts:191`
- `server/index.ts:196`
- `server/index.ts:202`

Inference from source:
- The panel uses raw `fetch` with only `Content-Type`.
- The app’s API middleware requires `X-Session-Id` for non-public `/api` routes.
- Standard helper `apiRequest` includes this header from localStorage.

Why this matters:
- This panel flow is likely to 401 in normal authenticated operation unless dev bypass is enabled.

Fix recommendation:
- Route all export calls through `apiRequest`, or add the same auth-header helper here.

---

### 6) `P2` `importFile` swallows parser exception details; caller gets generic failure only
Evidence:
- `client/src/lib/design-import.ts:716`
- `client/src/lib/design-import.ts:717`
- `client/src/lib/design-import.ts:725`
- `client/src/pages/ProjectWorkspace.tsx:526`
- `client/src/pages/ProjectWorkspace.tsx:528`

Local reproduction:
- Command:
  - `npx -y tsx -e "import { DesignImporter } from './client/src/lib/design-import.ts'; const imp:any=DesignImporter.getInstance(); imp.parseKicadSchematic=()=>{throw new Error('parser boom')}; const r=imp.importFile('(kicad_sch (version 1))','x.kicad_sch'); console.log(JSON.stringify(r));"`
- Output:
  - `{"status":"error","design":null,...,"errorCount":1}`

What is happening:
- Caught exception object is discarded.
- Result contains no actionable parser message.
- UI path logs only count, not reason.

Why this matters:
- Debugging real-world malformed files becomes trial-and-error.

Fix recommendation:
- Include sanitized `errorMessage` in `ImportResult`.
- Surface a user-facing toast/modal with parser details and suggested next actions.

---

### 7) `P2` `convertToProtoPulse` reduces net topology to chain edges and can collapse duplicate reference mappings
Evidence:
- `client/src/lib/design-import.ts:1443`
- `client/src/lib/design-import.ts:1449`
- `client/src/lib/design-import.ts:1462`
- `client/src/lib/design-import.ts:1465`
- `client/src/lib/__tests__/design-import.test.ts:837`

Local reproduction:
- Command:
  - `npx -y tsx -e "import { DesignImporter, type ImportedDesign } from './client/src/lib/design-import.ts'; const importer=DesignImporter.getInstance(); const design: ImportedDesign={format:'eagle-schematic',fileName:'x.sch',components:[{refDes:'U1',name:'MCU',value:'',package:'',library:'',properties:{},pins:[]},{refDes:'R1',name:'R',value:'',package:'0402',library:'',properties:{},pins:[]},{refDes:'C1',name:'C',value:'',package:'0402',library:'',properties:{},pins:[]}],nets:[{name:'BUS',pins:[{componentRef:'U1',pinNumber:'1'},{componentRef:'R1',pinNumber:'1'},{componentRef:'C1',pinNumber:'1'}]}],wires:[],metadata:{},warnings:[],errors:[]}; const out=importer.convertToProtoPulse(design); console.log(JSON.stringify({edgeCount:out.edges.length}));"`
- Output:
  - `{"edgeCount":2}`

What is happening:
- Multi-pin net becomes pairwise chain, not net-level adjacency object.
- `componentIdMap` is keyed only by `refDes`; duplicates overwrite earlier IDs.

Why this matters:
- Imported connectivity can be semantically degraded for interop and downstream tooling.

Fix recommendation:
- Preserve net-centric structure in conversion result (or add explicit net membership map).
- Add duplicate-ref guard before conversion or use stable unique source IDs from parser.

---

### 8) `P2` Import history is unbounded in localStorage and failures are silent
Evidence:
- `client/src/lib/design-import.ts:1891`
- `client/src/lib/design-import.ts:1902`
- `client/src/lib/design-import.ts:1904`
- `client/src/lib/design-import.ts:1917`
- `client/src/lib/design-import.ts:1919`

Local reproduction:
- Command:
  - `npx -y tsx /tmp/fe11_history_probe.ts`
- Output:
  - `{"historyLen":250,"storageBytes":72009}`

What is happening:
- Every import appends entire `ImportResult` into history with no cap/prune.
- `saveHistory` silently ignores quota/storage errors.
- `loadHistory` casts parsed arrays without shape validation.

Why this matters:
- Large sessions can bloat localStorage and silently stop persisting useful history.

Fix recommendation:
- Cap history length (for example last 20 or 50 entries).
- Persist compact summaries instead of full parsed design payloads.
- Validate stored shape at load and migrate/repair bad entries.

---

### 9) `P2` SPICE import button cache invalidation does not refresh filtered model lists
Evidence:
- `client/src/components/simulation/SpiceImportButton.tsx:58`
- `client/src/lib/simulation/useSpiceModels.ts:44`
- `client/src/lib/simulation/useSpiceModels.ts:71`
- `client/src/lib/simulation/useSpiceModels.ts:88`

Local reproduction:
- Command:
  - `npx -y tsx -e "import { QueryClient } from '@tanstack/react-query'; const qc=new QueryClient(); qc.setQueryData(['/api/spice-models?search=lm358'],{models:[]}); const before=qc.getQueryState(['/api/spice-models?search=lm358'])?.isInvalidated??false; qc.invalidateQueries({queryKey:['/api/spice-models']}).then(()=>{ const after=qc.getQueryState(['/api/spice-models?search=lm358'])?.isInvalidated??false; console.log(JSON.stringify({before,after})); });"`
- Output:
  - `{"before":false,"after":false}`

What is happening:
- List keys include query-string suffix.
- Invalidation key does not match filtered keys.

Why this matters:
- User can import models and still see stale filtered results.

Fix recommendation:
- Move to structured keys, e.g. `['spice-models', filters]`, then invalidate `['spice-models']`.

---

### 10) `P2` Chat `download_file` action can throw on malformed base64 and abort remaining actions
Evidence:
- `client/src/components/panels/chat/hooks/action-handlers/export.ts:16`
- `client/src/components/panels/chat/hooks/action-handlers/export.ts:17`
- `client/src/components/panels/chat/hooks/useActionExecutor.ts:69`
- `client/src/components/panels/chat/hooks/useActionExecutor.ts:71`

What is happening:
- `download_file` directly calls `atob(content)` with no guard.
- Action executor invokes handlers without try/catch.

Why this matters:
- One malformed AI action payload can terminate execution loop and skip subsequent valid actions.

Fix recommendation:
- Wrap decode and blob creation in try/catch and emit an actionable validation issue/log entry.
- Add per-action isolation in executor to continue processing other actions.

---

### 11) `P3` Secondary export panel ignores server-provided FZZ filename
Evidence:
- `client/src/components/circuit-editor/ExportPanel.tsx:249`
- `server/circuit-routes/exports.ts:550`

What is happening:
- FZZ downloads as hardcoded `export.fzz` instead of server filename (`<circuit>.fzz`).

Why this matters:
- Lower UX quality and file management friction when exporting multiple variants.

Fix recommendation:
- Parse and honor `Content-Disposition` filename for ZIP responses.

## Test Coverage Assessment (this section)

What exists:
- `design-import` has a large direct unit suite covering parser branches, format detection, conversion basics, validation, persistence, and basic hook shape:
  - `client/src/lib/__tests__/design-import.test.ts`
- `design-gateway` also has broad rule-level and hook tests:
  - `client/src/lib/__tests__/design-gateway.test.ts`

Important gaps:
- No tests found for:
  - `client/src/components/panels/ExportPanel.tsx`
  - `client/src/components/circuit-editor/ExportPanel.tsx`
  - `client/src/components/simulation/SpiceImportButton.tsx`
  - `client/src/components/panels/chat/hooks/action-handlers/export.ts`
- No tests for ProjectWorkspace import button behavior (`input` -> parse -> apply state):
  - `client/src/pages/ProjectWorkspace.tsx:507`
- No contract tests for:
  - FZZ binary response path from panel export flow
  - Gerber `layers` payload handling in panel export flow
  - Export auth-header presence
- `design-import` conversion tests only assert basic 2-pin edge output (`client/src/lib/__tests__/design-import.test.ts:837`) and do not cover multi-pin topology fidelity or duplicate-ref edge cases.

Execution note:
- Per user direction, this pass is inspection-only and did not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) One canonical FE export surface
- Keep one export panel implementation, remove duplicate logic, and wire it into `activeView === 'output'`.

### B) Typed import/export contract layer
- Share strict schemas for each export payload variant (`files`, `layers`, binary) and validate client-side before download branching.

### C) Import pipeline with explicit commit step
- Split parse/preview/apply:
  - Parse + validation summary
  - User confirmation
  - State/server commit with rollback support

### D) Interop “confidence report”
- After import, show what was mapped exactly, inferred, dropped, or downgraded.

### E) Export reliability telemetry
- Track per-format success/failure and response-shape mismatches in logs for fast regression detection.

## Decision Questions Before FE-12
1. Should imported designs auto-apply into architecture/BOM immediately, or go through a preview + confirm modal first?
2. Which export panel becomes the single source of truth (`panels/ExportPanel.tsx` or `circuit-editor/ExportPanel.tsx`)?
3. Do we preserve net topology as net objects in conversion output, or continue flattening into edges and accept lossiness?

## Suggested Fix Order (practical)
1. `P1`: Make import button actually apply imported data and show user-facing status/errors.
2. `P1`: Wire a canonical export panel into `output` tab and remove dead/duplicate paths.
3. `P1`: Fix FZZ and Gerber payload contract handling in export panel.
4. `P1`: Route export requests through auth-aware `apiRequest`.
5. `P2`: Improve `importFile` error reporting and surface details in UI.
6. `P2`: Address conversion topology/refDes collision risk.
7. `P2`: Add capped/compact import history persistence.
8. `P2`: Fix SPICE model invalidation key strategy.
9. `P2`: Add per-action error isolation for chat export handlers.
10. `P3`: Respect server-provided filename for ZIP downloads.

## Bottom Line
FE-11 has real user-flow breaks today: import appears to succeed without applying data, output/export UX is fragmented, and one export panel has multiple API contract mismatches (FZZ and Gerber). The fastest path to stability is to wire one canonical export/import UX path end-to-end, enforce typed response contracts, and add targeted tests around binary/JSON branching and import state application.
