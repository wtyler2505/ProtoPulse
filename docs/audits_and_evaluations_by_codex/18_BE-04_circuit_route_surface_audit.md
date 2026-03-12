# BE-04 Audit: Circuit Route Surface

Date: 2026-03-06  
Auditor: Codex  
Section: BE-04 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Circuit route registration and route modules:
  - `server/circuit-routes.ts`
  - `server/circuit-routes/index.ts`
  - `server/circuit-routes/designs.ts`
  - `server/circuit-routes/instances.ts`
  - `server/circuit-routes/nets.ts`
  - `server/circuit-routes/wires.ts`
  - `server/circuit-routes/hierarchy.ts`
  - `server/circuit-routes/expansion.ts`
  - `server/circuit-routes/netlist.ts`
  - `server/circuit-routes/autoroute.ts`
  - `server/circuit-routes/exports.ts`
  - `server/circuit-routes/imports.ts`
  - `server/circuit-routes/simulations.ts`
  - `server/circuit-routes/utils.ts`
- Storage contract and implementation for circuit entities:
  - `server/storage/interfaces.ts`
  - `server/storage/circuit.ts`
- Auth/ownership context:
  - `server/routes/auth-middleware.ts`
  - `server/index.ts`
- Test surface reviewed:
  - `server/__tests__/autoroute.test.ts`
  - `server/__tests__/project-ownership.test.ts`
  - `server/__tests__/api.test.ts`
  - `server/__tests__/metrics.test.ts`

## Route Surface Snapshot (Current)
- Total route handlers defined under `server/circuit-routes/*.ts`: `53`.
- `registerCircuitRoutes(app, storage)` mounts all expected circuit route modules:
  - `server/circuit-routes/index.ts:16-26`
- Route families are mixed:
  - project-scoped: `/api/projects/:projectId/...`
  - circuit-scoped: `/api/circuits/:circuitId/...`
  - global child-resource route: `/api/wires/:id`
- Session auth exists globally for `/api/*` via `X-Session-Id`, but circuit routes do not apply per-project ownership middleware.

## Severity Key
- `P0`: immediate security/data exposure risk
- `P1`: high-impact reliability/security/contract risk
- `P2`: medium reliability/contract/test-confidence risk
- `P3`: lower-risk debt/cleanup

## Findings

### 1) `P0` Circuit route surface has no project ownership enforcement
Evidence:
- Ownership middleware exists:
  - `server/routes/auth-middleware.ts:22`
- Circuit routes do not use it (no references in `server/circuit-routes/*.ts`).
- Circuit routes include many mutation endpoints:
  - `server/circuit-routes/designs.ts:37`
  - `server/circuit-routes/instances.ts:59`
  - `server/circuit-routes/nets.ts:48`
  - `server/circuit-routes/wires.ts:30`
  - `server/circuit-routes/simulations.ts:31`

What is happening:
- Any authenticated session can call circuit CRUD/export/import/analyze endpoints by ID without owner checks.

Why this matters:
- Cross-project read/write access is possible if IDs are known/guessable.

Fix recommendation:
- Enforce ownership on all `/api/projects/:projectId/*` circuit routes.
- Add a dedicated circuit ownership middleware for `/api/circuits/:circuitId/*` and `/api/wires/:id`.

---

### 2) `P0` IDOR pattern across circuit/design child resources (path scope not enforced)
Evidence:
- Project + circuit path params are parsed but child operations are by child ID only:
  - `server/circuit-routes/designs.ts:29-32`, `48-57`, `72-75`
  - `server/circuit-routes/instances.ts:52-55`, `70-77`, `81-84`
  - `server/circuit-routes/nets.ts:41-44`, `65-73`, `76-79`
  - `server/circuit-routes/hierarchy.ts:50-57`, `62-65`
  - `server/circuit-routes/simulations.ts:129-133`, `137-140`
- Storage methods are ID-only (no project/circuit predicate on update/delete/get-by-id):
  - `server/storage/circuit.ts:96-101`
  - `server/storage/circuit.ts:115-121`
  - `server/storage/circuit.ts:127-133`
  - `server/storage/circuit.ts:150-155`
  - `server/storage/circuit.ts:169-175`
  - `server/storage/circuit.ts:181-187`
  - `server/storage/circuit.ts:204-209`
  - `server/storage/circuit.ts:223-229`
  - `server/storage/circuit.ts:235-241`
  - `server/storage/circuit.ts:259-265`
  - `server/storage/circuit.ts:281-287`
  - `server/storage/circuit.ts:346-351`
  - `server/storage/circuit.ts:367-374`
  - `server/storage/circuit.ts:379-385`

What is happening:
- Route path scope (project/circuit/design) is not consistently enforced in data-layer operations.

Why this matters:
- A user can mutate/delete/read resources from other circuits/projects using raw IDs.

Fix recommendation:
- Introduce scoped storage methods (`getXForCircuit`, `updateXForCircuit`, `deleteXForCircuit`, etc.).
- Verify parent-child relationship in every child-resource route.

---

### 3) `P1` Global wire mutation endpoints bypass circuit-scoped contracts
Evidence:
- Wire update/delete are not circuit-scoped:
  - `server/circuit-routes/wires.ts:40`
  - `server/circuit-routes/wires.ts:51`
- Storage wire operations are ID-only:
  - `server/storage/circuit.ts:223-229`
  - `server/storage/circuit.ts:235-241`

What is happening:
- `/api/wires/:id` allows direct global mutation without circuit ID in route.

Why this matters:
- Easier unauthorized mutation path; harder to enforce parent ownership.

Fix recommendation:
- Move to `/api/circuits/:circuitId/wires/:id`.
- Require wire-to-circuit match before update/delete.

---

### 4) `P1` FZZ import stores net segment shape that downstream logic does not understand
Evidence:
- FZZ import writes `fromInstanceRef/toInstanceRef`:
  - `server/circuit-routes/imports.ts:94-98`
- Core consumers expect numeric `fromInstanceId/toInstanceId`:
  - `server/circuit-routes/autoroute.ts:258-259`
  - `server/circuit-routes/netlist.ts:49-53`
  - `server/export/fzz-handler.ts:90-95`

What is happening:
- Imported nets are stored with instance reference strings, but routing/export/simulation code expects numeric instance IDs.

Why this matters:
- Imported circuits can silently fail or degrade in autoroute/netlist/export analysis flows.

Fix recommendation:
- Map FZZ instance refs to created ProtoPulse instance IDs before persisting net segments.
- Validate segment schema before `createCircuitNet`.

---

### 5) `P1` FZZ/KiCad imports are multi-step writes without transaction protection
Evidence:
- FZZ import performs many inserts (parts/instances/nets) with no transaction:
  - `server/circuit-routes/imports.ts:31-104`
- KiCad import performs repeated inserts similarly:
  - `server/circuit-routes/imports.ts:136-178`
- Storage layer uses transactions in other domains, but import flow does not:
  - `server/storage/architecture.ts:161`
  - `server/storage/bom.ts:71`

What is happening:
- Import failures can leave partially created circuits, parts, and nets.

Why this matters:
- Data integrity and cleanup burden increase after mid-import failures.

Fix recommendation:
- Wrap import pipelines in a single DB transaction.
- Return structured import failure reports and rollback all partial writes.

---

### 6) `P1` Import endpoint size contract conflicts with global parser limits
Evidence:
- Route-level limit says `10MB`:
  - `server/circuit-routes/imports.ts:7`
  - `server/circuit-routes/imports.ts:117`
- Global body parsers are stricter:
  - `server/index.ts:144` (`express.json` limit `1mb`)
  - `server/index.ts:148` (`express.raw` limit `5mb`)
- Route comment claims multipart support:
  - `server/circuit-routes/imports.ts:10`

What is happening:
- Real accepted payload sizes are lower than route contract indicates.
- Multipart support is implied in comments but no multipart parser is configured in this flow.

Why this matters:
- Client uploads fail unexpectedly and contract behavior is confusing.

Fix recommendation:
- Align parser limits with route contract (or lower route contract explicitly).
- Define exact supported `Content-Type` paths and enforce/document them.

---

### 7) `P1` Project/circuit params are often ignored in simulation/export routes
Evidence:
- `projectId` parsed then unused in simulation execution route:
  - `server/circuit-routes/simulations.ts:32`
- Simulation result get/delete use `simId` only:
  - `server/circuit-routes/simulations.ts:129-133`
  - `server/circuit-routes/simulations.ts:137-140`
- Capabilities endpoint ignores project/circuit path params:
  - `server/circuit-routes/simulations.ts:145`
- Export PDF parses `projectId` but does not enforce project lookup:
  - `server/circuit-routes/exports.ts:351-365`

What is happening:
- Route contracts imply project/circuit scoping that handlers do not consistently enforce.

Why this matters:
- Increases risk of cross-resource access and contract confusion.

Fix recommendation:
- Enforce path parameter relationships (`projectId -> circuitId -> simId`) in every scoped handler.
- Remove unused scope params if endpoint is intentionally global.

---

### 8) `P2` Multi-circuit exports default to first circuit (`circuits[0]`)
Evidence:
- Export routes frequently fetch project circuits then export first one:
  - `server/circuit-routes/exports.ts:53`
  - `server/circuit-routes/exports.ts:100`
  - `server/circuit-routes/exports.ts:198`
  - `server/circuit-routes/exports.ts:241`
  - `server/circuit-routes/exports.ts:301`
  - `server/circuit-routes/exports.ts:512`
  - `server/circuit-routes/exports.ts:575`
  - `server/circuit-routes/exports.ts:658`
- SPICE export route does same:
  - `server/circuit-routes/simulations.ts:158`

What is happening:
- Export target is implicit and order-dependent for projects with multiple circuit designs.

Why this matters:
- Wrong design can be exported without obvious user intent.

Fix recommendation:
- Require explicit `circuitId` for circuit-based exports.
- If defaulting, introduce and enforce a clear “main circuit” field.

---

### 9) `P2` Circuit payload validation is too permissive for critical graph fields
Evidence:
- Net schemas allow loose JSON in key graph fields:
  - `server/circuit-routes/nets.ts:12-15`
  - `server/circuit-routes/nets.ts:22-24`
- Design updates allow untyped settings:
  - `server/circuit-routes/designs.ts:12`
- Downstream logic assumes typed segment fields:
  - `server/circuit-routes/netlist.ts:49-53`
  - `server/circuit-routes/autoroute.ts:257-263`

What is happening:
- Malformed graph structures can enter storage and fail later in compute/export paths.

Why this matters:
- Failures appear far from write-time origin, making bugs hard to diagnose.

Fix recommendation:
- Centralize strict segment/point schemas in shared types.
- Validate all net/wire segment writes against those schemas.

## What Is Already Good
- Circuit route registration appears complete in one place:
  - `server/circuit-routes/index.ts:16-26`
- Most write endpoints use `safeParse` + explicit `400` handling.
- Circuit design route includes optimistic concurrency support (ETag + version conflict):
  - `server/circuit-routes/designs.ts:33`
  - `server/circuit-routes/designs.ts:54-67`
- `asyncHandler` is used consistently, avoiding uncaught async route failures.

## Test Coverage Assessment (BE-04)
- Strong unit-style route test exists for autoroute route module:
  - `server/__tests__/autoroute.test.ts:6`
  - `server/__tests__/autoroute.test.ts:229`
- Coverage gap:
  - No integration tests for `registerCircuitRoutes(...)` mounting.
  - No ownership/authorization tests for circuit routes.
  - No route-level tests found for imports/exports/simulations/hierarchy/nets/wires/design CRUD surface.
- Legacy `api.test.ts` remains runtime-availability gated:
  - `server/__tests__/api.test.ts:84`

## Improvements and Enhancements (Open-Minded)
1. Add `CircuitAccessGuard` middleware:
   - Resolve `circuitId -> projectId -> owner` once per request.
   - Cache per request in `res.locals`.
2. Introduce scoped storage contracts:
   - `getCircuitInstance(id, circuitId)` and similar for net/wire/port/sim.
3. Add `POST /api/projects/:projectId/export/*` request contracts with explicit `circuitId` where needed.
4. Make import pipelines transactional with post-import integrity checks.
5. Add route-manifest and auth-manifest tests:
   - Ensure intended modules are mounted.
   - Ensure all scoped routes use ownership guard.

## Decision Questions Before BE-05
1. Should `/api/circuits/:circuitId/*` remain public-to-any-auth-session, or be fully owner-guarded?
2. Do we want to keep project-level export endpoints that auto-pick a circuit, or require explicit `circuitId` now?
3. For imported nets, do we want strict rejection on invalid segment shapes or auto-repair with warnings?

## Suggested Fix Order
1. Security first: enforce ownership + scoped child-resource checks (`P0`).
2. Data integrity: fix FZZ segment mapping + transactional imports (`P1`).
3. Contract clarity: align parser limits and export target rules (`P1/P2`).
4. Confidence: add route-level integration/auth tests for circuit surface (`P2`).

## Bottom Line
BE-04 route coverage is functionally rich but currently high-risk on authorization/scoping. The largest immediate risks are cross-project access paths and ID-only child-resource mutation patterns. Fixing scoped authorization + import data integrity first will remove most of the serious risk in this section.
