# AUDX-04: Permissions, Isolation, and Collaboration Safety Audit

Date: 2026-03-30  
Author: Codex  
Wave: Deep Systems Expansion  
Purpose: Determine whether ProtoPulse consistently respects project ownership, collaboration boundaries, and AI action scope, then define the path to a credible trust and tenancy model.

## Current Isolation Posture
- `Project ownership enforcement`: insufficient
- `Realtime collaboration isolation`: unsafe
- `AI/project scope containment`: underdefined and high risk

This is one of the most serious deep-systems audit domains. The existing audit corpus still points to multiple `P0` paths where authenticated access is not the same thing as authorized project access.

## What Was Reviewed
- Prior auth, route, collaboration, and security audits:
  - `docs/audits_and_evaluations_by_codex/16_BE-02_auth_session_api_key_security_audit.md`
  - `docs/audits_and_evaluations_by_codex/17_BE-03_main_rest_route_surface_audit.md`
  - `docs/audits_and_evaluations_by_codex/26_BE-12_collaboration_realtime_audit.md`
  - `docs/audits_and_evaluations_by_codex/29_BE-15_security_hardening_audit.md`
- AI scope and trust-layer audits:
  - `docs/audits_and_evaluations_by_codex/19_BE-05_ai_core_orchestration_audit.md`
  - `docs/audits_and_evaluations_by_codex/20_BE-06_ai_tool_registry_executors_audit.md`
  - `docs/audits_and_evaluations_by_codex/49_UIUX-16_ai_blind_spots_and_failure_modes.md`
  - `docs/audits_and_evaluations_by_codex/50_UIUX-17_ai_trust_safety_operating_model.md`

## What Was Verified
- Reconfirmed that prior route and collaboration audits already documented multiple ownership/isolation gaps.
- Reconfirmed that collaboration admission, lock scoping, and child-resource mutation patterns are not yet strong enough for confident multi-user trust.
- Reconfirmed that the newer AI trust-layer documents still identify scope and ownership isolation as the most dangerous unresolved AI trust risk.
- No new multi-user live attack simulation was executed in this pass.

## Findings By Severity

### 1) `P0` Project ownership enforcement is still missing across too much of the route surface
Evidence:
- `17_BE-03_main_rest_route_surface_audit.md`
- `29_BE-15_security_hardening_audit.md`
- Prior audits already confirmed that ownership middleware exists but is not consistently applied across most project-scoped routes.

Why this matters:
- “Logged in” is not the same thing as “allowed to touch this project.”
- This is a foundational ship blocker for any serious collaboration or cloud-connected trust claims.

Recommended direction:
- Enforce project-access middleware across all project-scoped route families by default.
- Move from opt-in authz to opt-out authz.

### 2) `P0` Realtime collaboration still has unsafe join and lock-scope behavior
Evidence:
- `26_BE-12_collaboration_realtime_audit.md`
- Prior collaboration audit already documented:
  - arbitrary project join risk for authenticated sessions
  - non-owner users receiving overly powerful roles
  - lock keys not being project-scoped
  - state/lock leakage across rooms

Why this matters:
- Collaboration bugs do not stay local. They leak presence, intent, and edit power across project boundaries.

Recommended direction:
- Require explicit project membership before room join.
- Scope every lock, presence record, and collaboration event to project identity.

### 3) `P0` Child-resource routes still allow unsafe ID-only access patterns and identity spoofing
Evidence:
- `17_BE-03_main_rest_route_surface_audit.md`
- `26_BE-12_collaboration_realtime_audit.md`
- Prior audits already documented comment/snapshot/lifecycle/preference routes that validate a project in the URL but mutate by raw child ID only, plus comment identity fields accepted from caller-controlled payloads.

Why this matters:
- This is how systems end up with “secure-looking URLs” and insecure underlying behavior.

Recommended direction:
- Require `(projectId, childId)` pairing at both route and storage layers.
- Derive actor identity from authenticated context only.

### 4) `P1` Imported or shared state can still weaken project isolation
Evidence:
- `17_BE-03_main_rest_route_surface_audit.md`
- `29_BE-15_security_hardening_audit.md`
- Prior audits already showed imported projects can become ownerless under current behavior.

Why this matters:
- Any flow that creates ownerless or ambiguously owned records becomes a permanent hole in the trust model.

Recommended direction:
- Make `ownerId` assignment mandatory for imported and generated project artifacts.
- Add migration and repair tooling for legacy ownerless records.

### 5) `P1` Shared in-memory job/batch/RAG state remains weaker than a serious multi-user model demands
Evidence:
- `17_BE-03_main_rest_route_surface_audit.md`
- Prior route-surface audit already identified unscoped or weakly scoped in-memory records in jobs, batch, and RAG flows.

Why this matters:
- Even if the main project CRUD surface is fixed, auxiliary operational surfaces can still leak or allow disruption across users.

Recommended direction:
- Add tenant and project identity to all in-memory operational records.
- Enforce ownership on list/read/cancel/delete operations.

### 6) `P1` AI scope and ownership isolation are still not strong enough for higher-autonomy trust
Evidence:
- `49_UIUX-16_ai_blind_spots_and_failure_modes.md`
- `50_UIUX-17_ai_trust_safety_operating_model.md`
- The AI blind-spots pack explicitly called out scope and ownership isolation as ProtoPulse’s most dangerous remaining AI trust risk.

Why this matters:
- The more powerful AI becomes, the more dangerous vague scope becomes.
- A trustworthy AI action system must know exactly what project, what branch, what authority tier, and what review path it is acting within.

Recommended direction:
- Make AI permission tier, project scope, and rollback path explicit on every meaningful action path.

### 7) `P2` Collaboration policy is still less productized than the app’s ambition
Evidence:
- `26_BE-12_collaboration_realtime_audit.md`
- `12_FE-12_collaboration_offline_pwa_audit.md`
- Collaboration infrastructure exists, but the current audit corpus still reads it more as under-integrated infrastructure than as a coherent permissioned product model.

Why this matters:
- Real collaboration requires more than transport. It requires understandable roles, approvals, review rules, and audit trails.

Recommended direction:
- Productize collaborator roles and activity visibility instead of leaving policy implicit in backend code.

## Why It Matters
Permissions and isolation are the trust floor for everything else in ProtoPulse. If project ownership is weak, then exports, AI actions, design history, comments, jobs, and collaboration are all operating on a shaky foundation. This is also the area where “local-first” does not excuse sloppiness. The moment ProtoPulse supports multiple users, teammates, or future hosted sync, the system needs a credible tenancy model, not a mostly-authenticated model.

## Improvement Directions
1. Make route-level project access control universal and centralized.
2. Replace ID-only child-resource mutation with project-scoped storage contracts.
3. Redesign collaboration around explicit membership and role policy.
4. Make AI action scope, authority, and rollback visible on every meaningful flow.
5. Add an audit-friendly authorization model for auxiliary systems like jobs, batch, and RAG.

## Enhancement / Addition / Integration Ideas
- Add explicit collaborator roles such as `owner`, `editor`, `reviewer`, `viewer`, and `lab-student`.
- Add per-project activity feeds that show who joined, edited, commented, exported, or approved AI actions.
- Add approval-required modes for sensitive operations like export handoff, hardware upload, and AI apply.
- Add secure share invitations instead of implicit access expansion through IDs or ownerless records.
- Add safe classroom and makerspace roles with bounded abilities.
- Add visible `You are acting as...` trust indicators for collaboration and AI autonomy state.
- Add an authorization audit console for admins and developers.

## Quick Wins
1. Apply project-access middleware to all project-scoped route families by default.
2. Stop accepting caller-provided user identity fields for comments and similar collaboration records.
3. Scope collaboration locks and presence data by project.
4. Force imported projects to receive an owner at creation time.
5. Add explicit denial behavior for unknown or unauthorized collaboration joins instead of permissive fallback roles.

## Medium Lifts
1. Replace ID-only child-resource storage APIs with project-scoped variants.
2. Add collaborator membership tables and explicit role mapping.
3. Scope jobs, batch, and RAG operational records to tenant/project identity.
4. Add AI permission tiers with server-enforced policy, not just client UX.
5. Build role-aware tests covering cross-user, cross-project, and cross-surface access attempts.

## Big Swings
1. Build a full `Trust and Access Layer` with centralized policy evaluation across CRUD, collaboration, AI, jobs, and hardware actions.
2. Add review/approval workflows for high-sensitivity actions such as AI-applied changes, export-to-fab, and hardware upload.
3. Create a first-class shared-workspace model with presence, reviewer roles, and audit receipts that is safe enough for classrooms, clubs, and teams.

## Residual Unknowns
- No new live multi-user exploitation pass was performed in this wave.
- The current audit corpus does not yet fully map how future desktop-native sync or cloud sharing plans would interact with these gaps.
- Fine-grained role policy for classroom use is still product-defined only in fragments.

## Related Prior Audits
- `16_BE-02_auth_session_api_key_security_audit.md` — confirmed
- `17_BE-03_main_rest_route_surface_audit.md` — confirmed
- `26_BE-12_collaboration_realtime_audit.md` — confirmed
- `29_BE-15_security_hardening_audit.md` — confirmed
- `49_UIUX-16_ai_blind_spots_and_failure_modes.md` — extended
- `50_UIUX-17_ai_trust_safety_operating_model.md` — extended
