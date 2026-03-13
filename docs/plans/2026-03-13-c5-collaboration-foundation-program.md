# C5 Program Plan — Collaboration Foundation, RBAC, Branching, and Merge

> **For Claude:** Use the `executing-plans` skill when this program is converted into delivery waves.

**Goal:** Evolve ProtoPulse from owner-only collaboration and live presence into a trustworthy team workflow with membership, review, approvals, branchable design state, and merge tooling.
**Architecture:** Build this in layers: session hardening and role enforcement first, project-level collaborator membership second, review/audit flows third, branch semantics fourth, and full org/team tenancy last. Do not build branching on top of the current owner-only authorization shortcut.
**Tech Stack:** React 19, TypeScript, existing WebSocket collaboration server/client, session auth, Drizzle ORM, audit logging, design snapshots, route-level ownership middleware.

## Backlog Scope

- Primary C5 items: `BL-0381`, `BL-0184`, `BL-0185`
- Closely related items: `BL-0181`, `BL-0182`, `BL-0183`, `BL-0186`, `BL-0189`, `BL-0190`, `BL-0524`, `BL-0525`, `BL-0526`, `BL-0380`, `BL-0376`

## Executive Recommendation

Choose a **phased foundation strategy**, not "tenancy first everywhere" and not "branch first on the current model".

1. **Harden session and membership semantics first**
   Today the platform mostly knows `owner` and "everyone else". That is not enough for safe branching or merge.
2. **Add lightweight collaborator membership before org tenancy**
   Project-level members/roles provide real user value fast and de-risk the future org/team model.
3. **Add review and audit primitives before design branches**
   Approvals, activity, and restore semantics should exist before merge workflows start carrying risk.
4. **Only then build branch and merge**
   Once identity, permissions, audit, and base snapshot semantics are stable, branching becomes much less dangerous.

This gives ProtoPulse a believable path from maker collaboration to team-grade workflows without forcing a giant all-or-nothing enterprise detour.

## Why This Direction Wins

| Option | Strength | Failure Mode |
|--------|----------|--------------|
| RBAC/org tenancy first | Strong long-term foundation | Delays near-term collaboration value and inflates scope before the product has stable branch semantics |
| Branching on current owner-only model | Fastest apparent path to flashy features | Unsafe authorization, brittle merge semantics, and painful migration later |
| **Phased foundation** | Best sequencing for safety, migration, and user value | Requires discipline to keep each layer thin and compatible |

## Current Repo Readiness

### Already in place

- [`server/auth.ts`](/home/wtyler/Projects/ProtoPulse/server/auth.ts) already has hashed sessions, session rotation, and encrypted API key storage.
- [`server/routes/auth-middleware.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/auth-middleware.ts) already enforces project ownership on HTTP routes.
- [`server/collaboration.ts`](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts) and [`client/src/lib/collaboration-client.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/collaboration-client.ts) already provide live collaboration, roles in memory, cursor/selection streaming, entity locks, and CRDT state updates.
- [`shared/collaboration.ts`](/home/wtyler/Projects/ProtoPulse/shared/collaboration.ts) already defines `owner | editor | viewer` collaboration roles and merge/lock primitives.
- [`server/routes/comments.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/comments.ts) and [`server/routes/design-history.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/design-history.ts) already give ProtoPulse review comments and architecture snapshots/diffs.
- [`server/audit-log.ts`](/home/wtyler/Projects/ProtoPulse/server/audit-log.ts) already provides request-level audit entries that can feed a richer activity model later.

### Not in place yet

- Authorization is still fundamentally **single-project-owner** based; [`server/routes/auth-middleware.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/auth-middleware.ts) allows only the owner (or ownerless legacy projects).
- The collaboration server infers `owner` or `editor` from ownership at connection time; there is no persisted collaborator membership table yet.
- `viewer` exists as a runtime role in collaboration types/tests, but not as a durable project membership model.
- Design history snapshots currently cover architecture state only, not a complete multi-surface branchable design graph.
- Chat branches exist, but design branches do not; merge tooling for hardware artifacts is still absent.
- The backlog already identifies reconnect/session validation as a real gap (`BL-0526`).

## Program Phases

### Phase 0 — Session Hardening and Auth Consistency

**Purpose:** Remove the most dangerous trust gaps before adding more collaboration surface.

**Backlog dependencies**

- `BL-0526`

**Deliverables**

- Re-validate session and membership on WebSocket reconnect
- Shared auth helper for HTTP routes and collaboration sockets
- Explicit distinction between `authentication`, `project membership`, and `role`

**Likely files**

- Modify: [`server/routes/auth-middleware.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/auth-middleware.ts)
- Modify: [`server/collaboration.ts`](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts)
- Modify: [`server/auth.ts`](/home/wtyler/Projects/ProtoPulse/server/auth.ts)
- Modify: [`client/src/lib/collaboration-client.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/collaboration-client.ts)

### Phase 1 — Project Membership and Lightweight RBAC

**Purpose:** Create a real collaborator model without waiting for full org/team tenancy.

**Deliverables**

- `project_members` table with `owner`, `editor`, `reviewer`, `viewer`
- Invite / accept / revoke collaborator flows
- Route guards and WebSocket guards based on membership
- Backward-compatible migration for current `ownerId` projects

**Likely files**

- Modify: [`shared/schema.ts`](/home/wtyler/Projects/ProtoPulse/shared/schema.ts)
- Modify: [`server/storage/projects.ts`](/home/wtyler/Projects/ProtoPulse/server/storage/projects.ts)
- Create: `server/routes/project-members.ts`
- Create: `server/storage/project-members.ts`
- Modify: [`server/routes/auth-middleware.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/auth-middleware.ts)
- Modify: [`server/collaboration.ts`](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts)

### Phase 2 — Review, Approval, and Activity Foundation

**Purpose:** Add the governance layer that branch/merge will depend on later.

**Backlog dependencies**

- `BL-0181`, `BL-0182`, `BL-0186`, `BL-0189`

**Deliverables**

- Comment resolution and reviewer assignment flows
- Approval gates before export/release for protected projects
- Activity feed sourced from collaboration events, comments, snapshots, and audit logs
- Audit explorer UI grounded in actual data, not just server logs

**Likely files**

- Modify: [`server/routes/comments.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/comments.ts)
- Modify: [`server/audit-log.ts`](/home/wtyler/Projects/ProtoPulse/server/audit-log.ts)
- Create: `server/routes/project-activity.ts`
- Create: `client/src/components/views/ActivityFeedView.tsx`
- Create: `client/src/components/views/AuditLogExplorerView.tsx`

### Phase 3 — Branchable Design State Model (`BL-0184`)

**Purpose:** Define what a design branch actually means across ProtoPulse's multiple editors and artifacts.

**Deliverables**

- ADR for branch semantics: whole-project branch vs per-surface branch
- Branch tables / branch heads / merge base references
- Snapshot coverage expanded beyond architecture into the surfaces required for meaningful restore/merge
- Read-only branch switching and compare view before write-enabled branch editing

**Likely files**

- Create: `docs/adr/0009-collaboration-membership-and-rbac.md`
- Create: `docs/adr/0010-design-branching-model.md`
- Modify: [`shared/schema.ts`](/home/wtyler/Projects/ProtoPulse/shared/schema.ts)
- Modify: [`server/routes/design-history.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/design-history.ts)
- Create: `server/routes/design-branches.ts`
- Create: `server/storage/design-branches.ts`

### Phase 4 — Merge Tooling and Conflict UX (`BL-0185`)

**Purpose:** Make branch comparison and merge safe enough for real use.

**Backlog dependencies**

- `BL-0524`, `BL-0183`, `BL-0190`, `BL-0376`

**Deliverables**

- Domain-aware diff engine coverage for architecture, schematic/netlist/BOM, and other branchable artifacts
- Merge proposal objects with accept/reject/manual resolution states
- Conflict UI for concurrent edits and branch merges
- Restore at view/object granularity where the underlying diff supports it

**Likely files**

- Create: `shared/design-merge.ts`
- Create: `server/routes/design-merge.ts`
- Create: `client/src/components/dialogs/MergeConflictDialog.tsx`
- Modify: [`shared/arch-diff.ts`](/home/wtyler/Projects/ProtoPulse/shared/arch-diff.ts)
- Modify: [`shared/netlist-diff.ts`](/home/wtyler/Projects/ProtoPulse/shared/netlist-diff.ts)
- Modify: [`server/collaboration.ts`](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts)

### Phase 5 — Org / Team Tenancy (`BL-0381`, `BL-0380`)

**Purpose:** Expand from project membership into reusable org/team identity once the project-level model is proven.

**Deliverables**

- `organizations`, `teams`, and membership tables
- Team-scoped project ownership
- Org-level policy presets and workspace standards packs
- Optional SSO/OIDC for team deployments

**Likely files**

- Modify: [`shared/schema.ts`](/home/wtyler/Projects/ProtoPulse/shared/schema.ts)
- Create: `server/routes/organizations.ts`
- Create: `server/routes/teams.ts`
- Create: `server/storage/organizations.ts`
- Create: `server/storage/teams.ts`
- Modify: [`server/routes/auth.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/auth.ts)

## ADRs Required Before Coding Deeply

1. **Membership model:** Is project membership the primary authorization unit, with org/team tenancy layered on later?
2. **Branch scope:** Are branches whole-project, design-surface specific, or snapshot-derived overlays?
3. **Merge authority:** Who can merge to protected branches and under what approval gates?
4. **Legacy migration:** How do ownerless projects and current `ownerId` projects get upgraded without breaking access?
5. **Audit source of truth:** Which events must be durable DB records vs derived from request logs?

## Open Questions

- Do makers need `reviewer` as a first-class role immediately, or can `editor` + approval requests cover the first phase?
- Should comments, approvals, and branches all anchor to the same snapshot/commit-like object?
- Is the first useful branch workflow "safe experimentation branch" rather than full Git-like team branching?
- Which surfaces are truly branch-critical in v1: architecture only, or architecture + schematic + BOM together?

## Exit Criteria

This C5 program is "real" only when all of the following are true:

1. Non-owner collaborators can be invited, assigned roles, and safely limited.
2. Collaboration reconnects re-check both session validity and current membership.
3. A project can require approval before protected actions.
4. A user can create a design branch, compare it to a base, and understand conflicts before merge.
5. Every critical collaboration action is traceable through durable audit/activity data.

## Suggested First Delivery Cut

If only one slice gets funded first, do this:

1. Fix reconnect/session hardening.
2. Add persisted project membership with `owner/editor/viewer`.
3. Ship review activity + approval groundwork.

That sequence gives immediate collaboration safety and value, and it prevents `BL-0184` / `BL-0185` from being built on top of the wrong trust model.
